import { Router } from 'express'
import {
  getWorkflowRuns,
  getRunDetails,
  getRunLogs,
  getDashboardStats,
  getUserRepositories,
  getRepoFileContent,
  applyFixAndCreatePR,
} from '../services/github.js'
import { diagnosePipeline, generateFix } from '../services/ai.js'
import store from '../services/store.js'

const router = Router()

function resolveRepo(req) {
  const owner = req.query.owner || req.body?.owner || process.env.GITHUB_OWNER || 'techenthusiasticindia'
  const repo = req.query.repo || req.body?.repo || process.env.GITHUB_REPO || 'ci-doctor-ai'
  return { owner, repo }
}

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'CI Doctor AI Backend',
    timestamp: new Date().toISOString(),
  })
})

/**
 * GET /api/repos
 * List accessible repositories for selection
 */
router.get('/repos', async (req, res) => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    const username = req.query.username || process.env.GITHUB_OWNER || 'techenthusiasticindia'

    const repos = await getUserRepositories(token, username)
    res.json({ repos, total: repos.length })
  } catch (error) {
    console.error('Error fetching repositories:', error.message)
    res.status(500).json({ error: 'Failed to fetch repositories' })
  }
})

/**
 * POST /api/repos/select
 * Select current active repository
 */
router.post('/repos/select', (req, res) => {
  const { owner, repo } = req.body
  if (!owner || !repo) {
    return res.status(400).json({ error: 'owner and repo are required' })
  }
  res.json({ success: true, selectedRepo: `${owner}/${repo}` })
})

/**
 * GET /api/dashboard
 * Get dashboard statistics for status cards (supports dynamic repo)
 */
router.get('/dashboard', async (req, res) => {
  try {
    const { owner, repo } = resolveRepo(req)
    const githubStats = await getDashboardStats(owner, repo)
    const storeStats = store.getStats()
    const avgConfidence = store.getAverageConfidence()

    res.json({
      totalPipelines: githubStats.totalPipelines,
      failedBuilds: githubStats.failedBuilds,
      autoRecoveries: storeStats.totalRecoveries,
      aiConfidence: avgConfidence > 0 ? `${avgConfidence}%` : 'N/A',
      successRate: `${githubStats.successRate}%`,
      activeRepo: `${owner}/${repo}`,
    })
  } catch (error) {
    console.error('Dashboard error:', error.message)
    res.status(500).json({ error: 'Failed to fetch dashboard stats' })
  }
})

/**
 * GET /api/pipelines
 * List recent workflow runs for target repo
 */
router.get('/pipelines', async (req, res) => {
  try {
    const { owner, repo } = resolveRepo(req)
    const limit = parseInt(req.query.limit) || 20
    const runs = await getWorkflowRuns(owner, repo, limit)

    // Enrich with cached diagnosis info
    const enrichedRuns = runs.map((run) => {
      const diagnosis = store.getDiagnosis(run.id)
      const fix = store.getFix(run.id)
      return {
        ...run,
        hasDiagnosis: !!diagnosis,
        hasFix: !!fix,
      }
    })

    res.json({ runs: enrichedRuns, total: enrichedRuns.length, repo: `${owner}/${repo}` })
  } catch (error) {
    console.error('Pipelines error:', error.message)
    res.status(500).json({ error: 'Failed to fetch pipelines' })
  }
})

/**
 * GET /api/pipelines/:id/failure
 * Get failure details and cleaned error log for a specific run
 */
router.get('/pipelines/:id/failure', async (req, res) => {
  try {
    const { owner, repo } = resolveRepo(req)
    const runId = parseInt(req.params.id)
    const details = await getRunDetails(runId, owner, repo)
    const logs = await getRunLogs(runId, owner, repo)

    res.json({
      pipeline: details,
      errorLog: logs,
      repo: `${owner}/${repo}`,
    })
  } catch (error) {
    console.error('Failure details error:', error.message)
    res.status(500).json({ error: 'Failed to fetch failure details' })
  }
})

/**
 * POST /api/pipelines/:id/diagnose
 * Trigger AI diagnosis of a failed pipeline run with grounded context
 */
router.post('/pipelines/:id/diagnose', async (req, res) => {
  try {
    const { owner, repo } = resolveRepo(req)
    const runId = parseInt(req.params.id)

    // Check cache first
    const cached = store.getDiagnosis(runId)
    if (cached) {
      return res.json({ diagnosis: cached, cached: true })
    }

    // Fetch run details and logs
    const details = await getRunDetails(runId, owner, repo)
    const logs = await getRunLogs(runId, owner, repo)

    // Grounding: attempt to retrieve package.json and workflow file if relevant
    let fileContext = {}
    try {
      const pkgJson = await getRepoFileContent('package.json', owner, repo)
      if (pkgJson) fileContext['package.json'] = pkgJson
      if (details.workflowFile && details.workflowFile !== 'unknown') {
        const wf = await getRepoFileContent(`.github/workflows/${details.workflowFile}`, owner, repo)
        if (wf) fileContext[details.workflowFile] = wf
      }
    } catch {
      // Non-blocking grounding attempt
    }

    // Run AI diagnosis
    const diagnosis = await diagnosePipeline(details, logs, Object.keys(fileContext).length > 0 ? fileContext : null)

    // Cache the result
    store.saveDiagnosis(runId, diagnosis)

    res.json({ diagnosis, cached: false })
  } catch (error) {
    console.error('Diagnosis error:', error.message)
    res.status(500).json({ error: 'Failed to generate diagnosis: ' + error.message })
  }
})

/**
 * POST /api/pipelines/:id/fix
 * Generate AI fix for a diagnosed pipeline failure
 */
router.post('/pipelines/:id/fix', async (req, res) => {
  try {
    const { owner, repo } = resolveRepo(req)
    const runId = parseInt(req.params.id)

    // Check cache first
    const cachedFix = store.getFix(runId)
    if (cachedFix) {
      return res.json({ fix: cachedFix, cached: true })
    }

    // Ensure we have diagnosis
    let diagnosis = store.getDiagnosis(runId)
    const details = await getRunDetails(runId, owner, repo)
    const logs = await getRunLogs(runId, owner, repo)

    if (!diagnosis) {
      diagnosis = await diagnosePipeline(details, logs)
      store.saveDiagnosis(runId, diagnosis)
    }

    // Grounding context
    let fileContext = {}
    try {
      const pkgJson = await getRepoFileContent('package.json', owner, repo)
      if (pkgJson) fileContext['package.json'] = pkgJson
    } catch {
      // ignore
    }

    // Generate AI fix
    const fix = await generateFix(details, logs, diagnosis, Object.keys(fileContext).length > 0 ? fileContext : null)

    // Cache the result
    store.saveFix(runId, fix)

    res.json({ fix, cached: false })
  } catch (error) {
    console.error('Fix generation error:', error.message)
    res.status(500).json({ error: 'Failed to generate fix: ' + error.message })
  }
})

/**
 * POST /api/fixes/apply
 * Apply fix and create Pull Request on GitHub
 */
router.post('/fixes/apply', async (req, res) => {
  try {
    const { owner, repo } = resolveRepo(req)
    const { runId, fix, baseBranch } = req.body

    if (!runId || !fix) {
      return res.status(400).json({ error: 'runId and fix object are required' })
    }

    const authHeader = req.headers.authorization
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

    const prResult = await applyFixAndCreatePR({
      owner,
      repo,
      runId,
      fix,
      baseBranch: baseBranch || 'main',
      customToken: token,
    })

    // Increment recoveries counter
    store.recoveryCount++

    res.json(prResult)
  } catch (error) {
    console.error('Apply fix error:', error.message)
    res.status(500).json({ error: 'Failed to apply fix: ' + error.message })
  }
})

/**
 * GET /api/stats
 * Get internal store stats
 */
router.get('/stats', (req, res) => {
  res.json(store.getStats())
})

export default router
