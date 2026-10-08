import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  IIncidentRepository,
  FileBackedIncidentRepository,
} from '../services/failureMemory.js'
import { generateFailureFingerprint } from '../services/failureFingerprint.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const TEST_STORAGE_PATH = path.join(__dirname, 'temp_incidents_test.json')

describe('Failure Memory Storage Architecture', () => {
  let repository

  before(() => {
    if (fs.existsSync(TEST_STORAGE_PATH)) {
      fs.unlinkSync(TEST_STORAGE_PATH)
    }
    repository = new FileBackedIncidentRepository(TEST_STORAGE_PATH)
  })

  after(() => {
    if (fs.existsSync(TEST_STORAGE_PATH)) {
      fs.unlinkSync(TEST_STORAGE_PATH)
    }
  })

  it('implements IIncidentRepository abstraction interface', () => {
    assert.ok(repository instanceof IIncidentRepository)
  })

  it('stores and retrieves incident by ID with exact hash indexing', async () => {
    const fp = generateFailureFingerprint({
      logs: 'SyntaxError: Unexpected token < in JSON at position 0',
      category: 'syntax',
    })

    const incident = {
      id: 'inc_test_syntax_01',
      repository: 'techenthusiasticindia/ci-doctor-ai',
      runId: 101,
      workflowName: 'Test Suite',
      branch: 'feature/login',
      category: 'syntax',
      failedStep: 'Parse Config',
      logs: 'SyntaxError: Unexpected token < in JSON at position 0',
      fingerprint: fp,
      createdAt: new Date().toISOString(),
    }

    const saved = await repository.save(incident)
    assert.strictEqual(saved.id, 'inc_test_syntax_01')

    const fetched = await repository.findById('inc_test_syntax_01')
    assert.strictEqual(fetched.id, 'inc_test_syntax_01')
    assert.strictEqual(fetched.category, 'syntax')

    const byHash = await repository.findByExactHash(fp.exactHash)
    assert.strictEqual(byHash.id, 'inc_test_syntax_01')
  })

  it('filters incidents by query, category, and repository with pagination', async () => {
    const fp2 = generateFailureFingerprint({
      logs: 'ModuleNotFoundError: No module named pytest',
      category: 'dependency',
    })

    await repository.save({
      id: 'inc_test_python_dep',
      repository: 'techenthusiasticindia/python-backend',
      runId: 102,
      workflowName: 'PyTest Runner',
      category: 'dependency',
      failedStep: 'Run Pytest',
      logs: 'ModuleNotFoundError: No module named pytest',
      fingerprint: fp2,
      createdAt: new Date().toISOString(),
    })

    // Search by category
    const depResults = await repository.findMany({ category: 'dependency' })
    assert.ok(depResults.items.some((i) => i.id === 'inc_test_python_dep'))

    // Search by repo
    const repoResults = await repository.findMany({ repository: 'python-backend' })
    assert.strictEqual(repoResults.total, 1)

    // Search by query text
    const queryResults = await repository.findMany({ query: 'pytest' })
    assert.strictEqual(queryResults.total, 1)

    // Pagination limit
    const paged = await repository.findMany({ limit: 1, offset: 0 })
    assert.strictEqual(paged.items.length, 1)
  })

  it('tracks fix outcome, verification outcome, and PR outcome transitions', async () => {
    // 1. Update Fix outcome
    await repository.updateOutcome('inc_test_syntax_01', 'fix', {
      title: 'Fix JSON configuration parser syntax',
      diff: '- { invalid }\n+ { valid: true }',
      categoryType: 'syntax',
      filesChanged: ['config.json'],
    })

    let current = await repository.findById('inc_test_syntax_01')
    assert.strictEqual(current.fixOutcome.title, 'Fix JSON configuration parser syntax')
    assert.ok(current.fixOutcome.synthesizedAt)

    // 2. Update Verification outcome
    await repository.updateOutcome('inc_test_syntax_01', 'verification', {
      validationPassed: true,
      confidenceScore: 94,
      checks: [{ name: 'Syntax Check', passed: true }],
    })

    current = await repository.findById('inc_test_syntax_01')
    assert.strictEqual(current.verificationOutcome.validationPassed, true)
    assert.strictEqual(current.verificationOutcome.confidenceScore, 94)

    // 3. Update PR outcome
    await repository.updateOutcome('inc_test_syntax_01', 'pr', {
      prNumber: 42,
      prUrl: 'https://github.com/techenthusiasticindia/ci-doctor-ai/pull/42',
      branch: 'fix/ci-syntax-repair',
      merged: true,
    })

    current = await repository.findById('inc_test_syntax_01')
    assert.strictEqual(current.prOutcome.prNumber, 42)
    assert.strictEqual(current.prOutcome.merged, true)
  })

  it('throws structured error for non-existent incident or invalid outcome type', async () => {
    await assert.rejects(
      async () => {
        await repository.updateOutcome('unknown_id', 'fix', {})
      },
      /ERR_INCIDENT_NOT_FOUND/
    )

    await assert.rejects(
      async () => {
        await repository.updateOutcome('inc_test_syntax_01', 'unsupported_type', {})
      },
      /ERR_INVALID_OUTCOME_TYPE/
    )
  })

  it('persists data to disk and recovers state upon fresh instance reload', async () => {
    const reloadedRepo = new FileBackedIncidentRepository(TEST_STORAGE_PATH)
    const item = await reloadedRepo.findById('inc_test_syntax_01')
    assert.ok(item, 'Item should persist in file and be reloadable')
    assert.strictEqual(item.id, 'inc_test_syntax_01')
    assert.strictEqual(item.prOutcome.prNumber, 42)
  })
})
