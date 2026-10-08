import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { generateFailureFingerprint } from './failureFingerprint.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DATA_DIR = path.resolve(__dirname, '../data')
const INCIDENTS_FILE = path.join(DATA_DIR, 'incidents.json')

/**
 * Storage Interface Specification (Repository Pattern)
 * Any storage provider (In-Memory, File-Backed, PostgreSQL, Vector DB)
 * must implement these methods.
 */
export class IIncidentRepository {
  async save(incident) { throw new Error('Not implemented') }
  async findById(id) { throw new Error('Not implemented') }
  async findByExactHash(hash) { throw new Error('Not implemented') }
  async findMany(query) { throw new Error('Not implemented') }
  async getAll() { throw new Error('Not implemented') }
  async updateOutcome(id, outcomeType, outcomeData) { throw new Error('Not implemented') }
  async delete(id) { throw new Error('Not implemented') }
  async count() { throw new Error('Not implemented') }
}

/**
 * Production File-Backed Incident Repository
 * Maintains in-memory index for O(1) lookups with persistent JSON snapshotting.
 * Ready to be swapped with PostgreSQL or pgvector adapter via dependency injection.
 */
export class FileBackedIncidentRepository extends IIncidentRepository {
  constructor(filePath = INCIDENTS_FILE, { seed = true } = {}) {
    super()
    this.filePath = filePath
    this.shouldSeed = seed
    this.incidents = new Map()
    this.hashIndex = new Map()
    this.isInitialized = false
    this.init()
  }

  init() {
    if (this.isInitialized) return
    if (this.filePath === ':memory:') {
      if (this.shouldSeed) {
        this.seedHistoricalIncidents()
      }
      this.isInitialized = true
      return
    }

    try {
      const dir = path.dirname(this.filePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8')
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            this.incidents.set(item.id, item)
            if (item.fingerprint?.exactHash) {
              this.hashIndex.set(item.fingerprint.exactHash, item.id)
            }
          }
        }
      } else if (this.shouldSeed) {
        // Seed canonical historical incidents so memory is functional immediately
        this.seedHistoricalIncidents()
        this.persist()
      }
    } catch (err) {
      console.warn(`Failure memory persistence warning: ${err.message}. Initializing store.`)
      if (this.shouldSeed) {
        this.seedHistoricalIncidents()
      }
    }
    this.isInitialized = true
  }

  persist() {
    if (this.filePath === ':memory:') return
    try {
      const data = Array.from(this.incidents.values())
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf8')
    } catch (err) {
      console.error(`Failed to persist failure memory: ${err.message}`)
    }
  }

  seedHistoricalIncidents() {
    const seed1Fingerprint = generateFailureFingerprint({
      logs: 'npm error Missing script: "test"\nnpm error To see a list of scripts, run:\nnpm error npm run',
      category: 'configuration',
      failedStep: 'Run Tests',
      exitCode: 1,
    })

    const seed1 = {
      id: 'inc_node_missing_test_script',
      repository: 'techenthusiasticindia/ci-doctor-ai',
      runId: 981240,
      workflowName: 'Deploy Pipeline',
      branch: 'main',
      commitSha: '7f3a9bc',
      category: 'configuration',
      failedStep: 'Run Tests',
      logs: 'npm error Missing script: "test"\nnpm error npm test failed with exit code 1',
      fingerprint: seed1Fingerprint,
      diagnosis: {
        rootCause: 'The pipeline failed because the "test" script is missing from package.json.',
        confidence: '96%',
        severityScore: 'P1 - High',
        affectedFiles: ['package.json'],
        recommendation: 'Add a "test" script to package.json: "test": "echo \\"No tests configured\\" && exit 0"',
      },
      fixOutcome: {
        title: 'Fix missing test script in package.json',
        categoryType: 'configuration',
        filesChanged: ['package.json'],
        diff: '--- a/package.json\n+++ b/package.json\n@@ scripts @@\n+  "test": "echo \\"No tests configured\\" && exit 0"',
        synthesizedAt: '2026-09-15T14:20:00Z',
      },
      verificationOutcome: {
        validationPassed: true,
        confidenceScore: 96,
        verifiedAt: '2026-09-15T14:21:00Z',
      },
      prOutcome: {
        created: true,
        prNumber: 42,
        prUrl: 'https://github.com/techenthusiasticindia/ci-doctor-ai/pull/42',
        merged: true,
        appliedAt: '2026-09-15T14:25:00Z',
      },
      createdAt: '2026-09-15T14:15:00Z',
      updatedAt: '2026-09-15T14:25:00Z',
    }

    const seed2Fingerprint = generateFailureFingerprint({
      logs: 'Error: API_KEY is required but was not provided in process.env. UnhandledPromiseRejection',
      category: 'environment',
      failedStep: 'Deploy Application',
      exitCode: 1,
    })

    const seed2 = {
      id: 'inc_workflow_missing_secret',
      repository: 'techenthusiasticindia/ci-doctor-ai',
      runId: 981245,
      workflowName: 'Deploy Pipeline',
      branch: 'main',
      commitSha: '9b2c8de',
      category: 'environment',
      failedStep: 'Deploy Application',
      logs: 'Error: API_KEY environment secret is missing from workflow runner context.',
      fingerprint: seed2Fingerprint,
      diagnosis: {
        rootCause: 'Required API_KEY environment secret is not configured in workflow environment.',
        confidence: '95%',
        severityScore: 'P0 - Critical',
        affectedFiles: ['.github/workflows/deploy.yml'],
        recommendation: 'Map API_KEY secret from secrets.API_KEY into workflow env block.',
      },
      fixOutcome: {
        title: 'Inject missing API_KEY in CI workflow',
        categoryType: 'configuration',
        filesChanged: ['.github/workflows/deploy.yml'],
        diff: '--- a/.github/workflows/deploy.yml\n+++ b/.github/workflows/deploy.yml\n@@ env @@\n+      API_KEY: ${{ secrets.API_KEY }}',
        synthesizedAt: '2026-09-20T09:10:00Z',
      },
      verificationOutcome: {
        validationPassed: true,
        confidenceScore: 94,
        verifiedAt: '2026-09-20T09:11:00Z',
      },
      prOutcome: {
        created: true,
        prNumber: 58,
        prUrl: 'https://github.com/techenthusiasticindia/ci-doctor-ai/pull/58',
        merged: true,
        appliedAt: '2026-09-20T09:15:00Z',
      },
      createdAt: '2026-09-20T09:05:00Z',
      updatedAt: '2026-09-20T09:15:00Z',
    }

    this.incidents.set(seed1.id, seed1)
    this.hashIndex.set(seed1.fingerprint.exactHash, seed1.id)

    this.incidents.set(seed2.id, seed2)
    this.hashIndex.set(seed2.fingerprint.exactHash, seed2.id)
  }

  async save(incident) {
    if (!incident || !incident.id) {
      throw new Error('ERR_INVALID_INPUT: Incident record requires a valid id property')
    }

    const existing = this.incidents.get(incident.id)
    const now = new Date().toISOString()

    const record = {
      ...existing,
      ...incident,
      updatedAt: now,
      createdAt: existing ? existing.createdAt : (incident.createdAt || now),
    }

    this.incidents.set(record.id, record)
    if (record.fingerprint?.exactHash) {
      this.hashIndex.set(record.fingerprint.exactHash, record.id)
    }

    this.persist()
    return record
  }

  async findById(id) {
    return this.incidents.get(id) || null
  }

  async findByExactHash(hash) {
    const id = this.hashIndex.get(hash)
    if (!id) return null
    return this.incidents.get(id) || null
  }

  async findMany({ query = '', category = '', repository = '', limit = 20, offset = 0 } = {}) {
    let results = Array.from(this.incidents.values())

    if (repository) {
      const target = repository.toLowerCase()
      results = results.filter((inc) => {
        const repo = (inc.repository || '').toLowerCase()
        return repo === target || repo.includes(target)
      })
    }

    if (category) {
      const targetCat = category.toLowerCase()
      results = results.filter((inc) => {
        const cat = (inc.category || '').toLowerCase()
        return cat === targetCat || cat.includes(targetCat)
      })
    }

    if (query) {
      const q = query.toLowerCase()
      results = results.filter((inc) =>
        (inc.failedStep || '').toLowerCase().includes(q) ||
        (inc.logs || '').toLowerCase().includes(q) ||
        (inc.diagnosis?.rootCause || '').toLowerCase().includes(q) ||
        (inc.fixOutcome?.title || '').toLowerCase().includes(q)
      )
    }

    // Sort newest first
    results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    const total = results.length
    const paginated = results.slice(offset, offset + limit)

    return {
      items: paginated,
      total,
      limit,
      offset,
    }
  }

  async getAll() {
    return Array.from(this.incidents.values())
  }

  async updateOutcome(id, outcomeType, outcomeData) {
    const incident = this.incidents.get(id)
    if (!incident) {
      throw new Error(`ERR_INCIDENT_NOT_FOUND: Incident ${id} not found`)
    }

    const now = new Date().toISOString()
    if (outcomeType === 'fix') {
      incident.fixOutcome = { ...incident.fixOutcome, ...outcomeData, synthesizedAt: now }
    } else if (outcomeType === 'verification') {
      incident.verificationOutcome = { ...incident.verificationOutcome, ...outcomeData, verifiedAt: now }
    } else if (outcomeType === 'pr') {
      incident.prOutcome = { ...incident.prOutcome, ...outcomeData, appliedAt: now }
    } else {
      throw new Error(`ERR_INVALID_OUTCOME_TYPE: Unknown outcomeType "${outcomeType}"`)
    }

    incident.updatedAt = now
    this.incidents.set(id, incident)
    this.persist()
    return incident
  }

  async delete(id) {
    if (!this.incidents.has(id)) return false
    const item = this.incidents.get(id)
    if (item?.fingerprint?.exactHash) {
      this.hashIndex.delete(item.fingerprint.exactHash)
    }
    this.incidents.delete(id)
    this.persist()
    return true
  }

  async count() {
    return this.incidents.size
  }
}

// Default singleton repository
export const failureMemoryRepository = new FileBackedIncidentRepository()
