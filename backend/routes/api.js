import { Router } from 'express'
import {
  getWorkflowRuns,
  getRunDetails,
  getRunLogs,
  getDashboardStats,
  getUserRepositories,
  applyFixAndCreatePR,
} from '../services/github.js'
import { diagnosePipeline, generateFix } from '../services/ai.js'
import { resolveRelevantFiles } from '../services/contextResolver.js'
import { fetchGroundedFiles } from '../services/fileGrounding.js'
import { verifyFix } from '../services/fixVerification.js'
import { failureMemoryRepository } from '../services/failureMemory.js'
import { generateFailureFingerprint } from '../services/failureFingerprint.js'
import { findSimilarByIncidentId } from '../services/similaritySearch.js'
import store from '../services/store.js'

const router = Router()

function resolveRepo(req) {
  const owner = req.query.owner || req.body?.owner || process.env.GITHUB_OWNER || 'techenthusiasticindia'
  const repo = req.query.repo || req.body?.repo || process.env.GITHUB_REPO || 'ci-doctor-ai'
  return { owner, repo }
}

function resolveToken(req) {
  const authHeader = req.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim()
    if (token && token !== 'null' && token !== 'undefined') {
      return token
    }
  }
  return null
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
    const token = resolveToken(req)
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
    const token = resolveToken(req)
    const githubStats = await getDashboardStats(owner, repo, token)
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
    const token = resolveToken(req)
    const limit = parseInt(req.query.limit) || 20
    const runs = await getWorkflowRuns(owner, repo, limit, token)

    // Enrich with cached diagnosis info
    const enrichedRuns = runs.map((run) => {
      const diagnosis = store.getDiagnosis(run.id)
      const fix = store.getFix(run.id)
      return {
        ...run,
        hasDiagnosis: !!diagnosis,
        hasFix: !!fix,
        fixVerification: fix?.verification || null,
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
    const token = resolveToken(req)
    const runId = parseInt(req.params.id)
    const details = await getRunDetails(runId, owner, repo, token)
    const logs = await getRunLogs(runId, owner, repo, token)

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
 * Trigger AI diagnosis of a failed pipeline run with grounded repository files
 */
router.post('/pipelines/:id/diagnose', async (req, res) => {
  try {
    const { owner, repo } = resolveRepo(req)
    const token = resolveToken(req)
    const runId = parseInt(req.params.id)

    // Check cache first
    const cached = store.getDiagnosis(runId)
    if (cached) {
      return res.json({ diagnosis: cached, cached: true })
    }

    // Fetch run details and logs
    const details = await getRunDetails(runId, owner, repo, token)
    const logs = await getRunLogs(runId, owner, repo, token)

    // Context Intelligence: Identify candidate files from error log patterns
    const { candidateFiles } = resolveRelevantFiles(logs, details)

    // File Grounding: Fetch actual repository file manifests and apply line windowing
    const groundedFiles = await fetchGroundedFiles(candidateFiles, owner, repo, token)

    // Run grounded AI diagnosis
    const diagnosis = await diagnosePipeline(details, logs, groundedFiles)

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
 * Generate AI fix for a diagnosed pipeline failure and verify it
 */
router.post('/pipelines/:id/fix', async (req, res) => {
  try {
    const { owner, repo } = resolveRepo(req)
    const token = resolveToken(req)
    const runId = parseInt(req.params.id)

    // Check cache first
    const cachedFix = store.getFix(runId)
    if (cachedFix) {
      return res.json({ fix: cachedFix, cached: true })
    }

    const details = await getRunDetails(runId, owner, repo, token)
    const logs = await getRunLogs(runId, owner, repo, token)

    // Context Intelligence & Grounding
    const { candidateFiles } = resolveRelevantFiles(logs, details)
    const groundedFiles = await fetchGroundedFiles(candidateFiles, owner, repo, token)

    let diagnosis = store.getDiagnosis(runId)
    if (!diagnosis) {
      diagnosis = await diagnosePipeline(details, logs, groundedFiles)
      store.saveDiagnosis(runId, diagnosis)
    }

    // Generate verified AI fix
    const fix = await generateFix(details, logs, diagnosis, groundedFiles)

    // Cache the result
    store.saveFix(runId, fix)

    res.json({ fix, cached: false })
  } catch (error) {
    console.error('Fix generation error:', error.message)
    res.status(500).json({ error: 'Failed to generate fix: ' + error.message })
  }
})

/**
 * POST /api/pipelines/:id/verify
 * Dedicated verification engine endpoint to re-verify or evaluate fix
 */
router.post('/pipelines/:id/verify', async (req, res) => {
  try {
    const { owner, repo } = resolveRepo(req)
    const token = resolveToken(req)
    const runId = parseInt(req.params.id)

    const fix = req.body.fix || store.getFix(runId)
    if (!fix) {
      return res.status(404).json({ error: 'No fix found to verify' })
    }

    const details = await getRunDetails(runId, owner, repo, token)
    const logs = await getRunLogs(runId, owner, repo, token)
    const { candidateFiles } = resolveRelevantFiles(logs, details)
    const groundedFiles = await fetchGroundedFiles(candidateFiles, owner, repo, token)

    const verification = verifyFix(fix, groundedFiles, details)
    fix.verification = verification
    fix.validation = verification
    store.saveFix(runId, fix)

    res.json({ verification, fix })
  } catch (error) {
    console.error('Verification error:', error.message)
    res.status(500).json({ error: 'Failed to verify fix: ' + error.message })
  }
})

/**
 * POST /api/fixes/apply
 * Apply fix and create Pull Request on GitHub with Safety Gating
 */
router.post('/fixes/apply', async (req, res) => {
  try {
    const { owner, repo } = resolveRepo(req)
    const { runId, fix, baseBranch } = req.body

    if (!runId || !fix) {
      return res.status(400).json({ error: 'runId and fix object are required' })
    }

    // Safety Gate: block PR creation if verification critically failed
    if (fix.verification && fix.verification.validationPassed === false) {
      return res.status(422).json({
        error: 'Pull Request blocked: fix failed critical pre-merge verification checks',
        validationPassed: false,
        validationErrors: fix.verification.validationErrors || [],
        summary: fix.verification.summary,
      })
    }

    if (!fix.filesChanged || fix.filesChanged.length === 0) {
      return res.status(422).json({
        error: 'Pull Request blocked: no valid files specified in changeset',
      })
    }

    const token = resolveToken(req)

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

    // Update failure memory PR outcome asynchronously
    const incidentId = `inc_${runId}`
    failureMemoryRepository.updateOutcome(incidentId, 'pr', {
      prNumber: prResult.prNumber,
      prUrl: prResult.prUrl,
      branch: prResult.branch,
      merged: false,
    }).catch(() => {})

    res.json(prResult)
  } catch (error) {
    console.error('Apply fix error:', error.message)
    res.status(500).json({ error: 'Failed to apply fix: ' + error.message })
  }
})

/**
 * POST /api/incidents
 * Store structured incident record with deterministic failure fingerprinting
 */
router.post('/incidents', async (req, res) => {
  try {
    const { repository, runId, logs, category, failedStep } = req.body

    // Input Validation
    if (!repository || typeof repository !== 'string') {
      return res.status(400).json({
        error: 'Validation failed: "repository" is required and must be a string',
        code: 'ERR_INVALID_INPUT',
      })
    }

    if (!logs || typeof logs !== 'string') {
      return res.status(400).json({
        error: 'Validation failed: "logs" is required and must be a string',
        code: 'ERR_INVALID_INPUT',
      })
    }

    // Generate failure fingerprint if not supplied
    const fingerprint = req.body.fingerprint || generateFailureFingerprint({
      logs,
      category: category || null,
      failedStep: failedStep || 'CI Execution',
      exitCode: req.body.exitCode || 1,
    })

    const incidentId = req.body.id || `inc_${runId || Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const now = new Date().toISOString()

    const incident = {
      id: incidentId,
      repository: repository.trim(),
      runId: runId ? Number(runId) : null,
      workflowName: req.body.workflowName || 'CI Pipeline',
      branch: req.body.branch || 'main',
      commitSha: req.body.commitSha || 'unknown',
      category: category || 'unknown',
      failedStep: failedStep || 'CI Execution',
      logs,
      fingerprint,
      diagnosis: req.body.diagnosis || null,
      fixOutcome: req.body.fixOutcome || null,
      verificationOutcome: req.body.verificationOutcome || null,
      prOutcome: req.body.prOutcome || null,
      createdAt: req.body.createdAt || now,
      updatedAt: now,
    }

    const saved = await failureMemoryRepository.save(incident)
    res.status(201).json({ success: true, incident: saved })
  } catch (error) {
    console.error('Save incident error:', error.message)
    res.status(500).json({
      error: 'Failed to record failure memory incident: ' + error.message,
      code: 'ERR_SAVE_INCIDENT_FAILED',
    })
  }
})

/**
 * GET /api/incidents/search
 * Search failure memory incidents with filtering and pagination
 */
router.get('/incidents/search', async (req, res) => {
  try {
    const { query, category, repository, limit, offset } = req.query
    const parsedLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100)
    const parsedOffset = Math.max(parseInt(offset) || 0, 0)

    const result = await failureMemoryRepository.findMany({
      query: query ? String(query) : null,
      category: category ? String(category) : null,
      repository: repository ? String(repository) : null,
      limit: parsedLimit,
      offset: parsedOffset,
    })

    res.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error('Search incidents error:', error.message)
    res.status(500).json({
      error: 'Failed to search failure memory incidents: ' + error.message,
      code: 'ERR_SEARCH_INCIDENTS_FAILED',
    })
  }
})

/**
 * GET /api/incidents/similar/:id
 * Retrieve ranked similar historical incidents for an existing incident record
 */
router.get('/incidents/similar/:id', async (req, res) => {
  try {
    const incidentId = req.params.id
    const threshold = req.query.threshold ? parseFloat(req.query.threshold) : 0.30
    const limit = req.query.limit ? parseInt(req.query.limit) : 5

    if (isNaN(threshold) || threshold < 0 || threshold > 1) {
      return res.status(400).json({
        error: 'Validation failed: "threshold" must be a float between 0.0 and 1.0',
        code: 'ERR_INVALID_THRESHOLD',
      })
    }

    const result = await findSimilarByIncidentId(incidentId, {
      threshold,
      limit: Math.min(Math.max(limit, 1), 20),
    })

    res.json({
      success: true,
      incidentId,
      matches: result.matches,
      metrics: result.metrics,
    })
  } catch (error) {
    if (error.code === 'ERR_INCIDENT_NOT_FOUND' || error.statusCode === 404) {
      return res.status(404).json({
        error: error.message,
        code: 'ERR_INCIDENT_NOT_FOUND',
      })
    }
    console.error('Similar incident retrieval error:', error.message)
    res.status(500).json({
      error: 'Failed to retrieve similar incidents: ' + error.message,
      code: 'ERR_SIMILAR_INCIDENTS_FAILED',
    })
  }
})

/**
 * GET /api/incidents/:id
 * Get single incident by ID
 */
router.get('/incidents/:id', async (req, res) => {
  try {
    const incident = await failureMemoryRepository.findById(req.params.id)
    if (!incident) {
      return res.status(404).json({
        error: `Incident with ID "${req.params.id}" was not found`,
        code: 'ERR_INCIDENT_NOT_FOUND',
      })
    }

    res.json({ success: true, incident })
  } catch (error) {
    console.error('Get incident error:', error.message)
    res.status(500).json({
      error: 'Failed to retrieve incident: ' + error.message,
      code: 'ERR_GET_INCIDENT_FAILED',
    })
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
