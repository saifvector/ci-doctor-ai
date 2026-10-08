import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import app from '../server.js'
import { failureMemoryRepository } from '../services/failureMemory.js'

describe('Incident & Failure Memory REST APIs', () => {
  let server
  let baseUrl
  const createdIncidentIds = new Set()

  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port
        baseUrl = `http://localhost:${port}/api`
        resolve()
      })
    })
  })

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve))
    }
    for (const id of createdIncidentIds) {
      await failureMemoryRepository.delete(id)
    }
  })

  describe('POST /api/incidents', () => {
    it('creates and returns structured incident record with deterministic fingerprint', async () => {
      const payload = {
        repository: 'techenthusiasticindia/ci-doctor-ai',
        runId: 991200,
        workflowName: 'Production Deploy',
        category: 'configuration',
        failedStep: 'Check Environment',
        logs: 'Missing required configuration secret DATABASE_URL',
      }

      const res = await fetch(`${baseUrl}/incidents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      assert.strictEqual(res.status, 201)
      const data = await res.json()
      if (data.incident?.id) createdIncidentIds.add(data.incident.id)
      assert.strictEqual(data.success, true)
      assert.ok(data.incident)
      assert.strictEqual(data.incident.repository, 'techenthusiasticindia/ci-doctor-ai')
      assert.strictEqual(data.incident.runId, 991200)
      assert.ok(data.incident.fingerprint?.exactHash)
      assert.strictEqual(data.incident.fingerprint.exactHash.length, 64)
    })

    it('rejects payload missing mandatory repository with ERR_INVALID_INPUT', async () => {
      const res = await fetch(`${baseUrl}/incidents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs: 'Some error' }),
      })

      assert.strictEqual(res.status, 400)
      const data = await res.json()
      assert.strictEqual(data.code, 'ERR_INVALID_INPUT')
      assert.ok(data.error.includes('repository'))
    })

    it('rejects payload missing mandatory logs with ERR_INVALID_INPUT', async () => {
      const res = await fetch(`${baseUrl}/incidents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repository: 'org/repo' }),
      })

      assert.strictEqual(res.status, 400)
      const data = await res.json()
      assert.strictEqual(data.code, 'ERR_INVALID_INPUT')
      assert.ok(data.error.includes('logs'))
    })
  })

  describe('GET /api/incidents/:id', () => {
    it('returns existing incident record by ID', async () => {
      // Seed an incident
      const saved = await failureMemoryRepository.save({
        id: 'inc_lookup_test_01',
        repository: 'techenthusiasticindia/ci-doctor-ai',
        runId: 554433,
        workflowName: 'CI Test',
        category: 'configuration',
        failedStep: 'Run Tests',
        logs: 'npm error Missing script: "test"',
        createdAt: new Date().toISOString(),
      })
      createdIncidentIds.add(saved.id)

      const res = await fetch(`${baseUrl}/incidents/${saved.id}`)
      assert.strictEqual(res.status, 200)
      const data = await res.json()
      assert.strictEqual(data.success, true)
      assert.strictEqual(data.incident.id, saved.id)
    })

    it('returns 404 with ERR_INCIDENT_NOT_FOUND when incident does not exist', async () => {
      const res = await fetch(`${baseUrl}/incidents/non_existent_incident_id_xyz`)
      assert.strictEqual(res.status, 404)
      const data = await res.json()
      assert.strictEqual(data.code, 'ERR_INCIDENT_NOT_FOUND')
    })
  })

  describe('GET /api/incidents/search', () => {
    it('supports query search, category filtering, and pagination', async () => {
      const res = await fetch(`${baseUrl}/incidents/search?category=configuration&limit=10`)
      assert.strictEqual(res.status, 200)
      const data = await res.json()
      assert.strictEqual(data.success, true)
      assert.ok(Array.isArray(data.items))
      assert.ok(typeof data.total === 'number')
      assert.strictEqual(data.limit, 10)
    })
  })

  describe('GET /api/incidents/similar/:id', () => {
    it('returns ranked similar incidents and historical success metrics for a target incident', async () => {
      // Ensure source incident exists
      const target = await failureMemoryRepository.save({
        id: 'inc_query_target_test',
        repository: 'techenthusiasticindia/ci-doctor-ai',
        runId: 998877,
        workflowName: 'Deploy',
        category: 'configuration',
        failedStep: 'Run Tests',
        logs: 'npm error Missing script: "test"\nnpm error npm test failed with exit code 1',
        createdAt: new Date().toISOString(),
      })
      createdIncidentIds.add(target.id)

      const res = await fetch(`${baseUrl}/incidents/similar/${target.id}?threshold=0.2`)
      assert.strictEqual(res.status, 200)
      const data = await res.json()
      assert.strictEqual(data.success, true)
      assert.strictEqual(data.incidentId, target.id)
      assert.ok(Array.isArray(data.matches))
      assert.ok(data.metrics)
      assert.ok(typeof data.metrics.totalMatches === 'number')
    })

    it('rejects invalid threshold with ERR_INVALID_THRESHOLD', async () => {
      const res = await fetch(`${baseUrl}/incidents/similar/inc_query_target_test?threshold=2.5`)
      assert.strictEqual(res.status, 400)
      const data = await res.json()
      assert.strictEqual(data.code, 'ERR_INVALID_THRESHOLD')
    })

    it('returns 404 with ERR_INCIDENT_NOT_FOUND for non-existent target ID', async () => {
      const res = await fetch(`${baseUrl}/incidents/similar/missing_target_404`)
      assert.strictEqual(res.status, 404)
      const data = await res.json()
      assert.strictEqual(data.code, 'ERR_INCIDENT_NOT_FOUND')
    })
  })
})
