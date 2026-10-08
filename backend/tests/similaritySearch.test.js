import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateJaccardSimilarity,
  computeSimilarityScore,
  analyzeHistoricalSuccess,
  findSimilarIncidents,
  findSimilarByIncidentId,
} from '../services/similaritySearch.js'
import { FileBackedIncidentRepository } from '../services/failureMemory.js'
import { generateFailureFingerprint } from '../services/failureFingerprint.js'

describe('Similarity Search & Historical Recall Service', () => {
  describe('calculateJaccardSimilarity', () => {
    it('returns 1.0 for identical token sets', () => {
      const setA = ['npm', 'missing', 'script', 'test']
      const setB = ['npm', 'missing', 'script', 'test']
      assert.strictEqual(calculateJaccardSimilarity(setA, setB), 1.0)
    })

    it('returns 0.0 for completely disjoint sets', () => {
      const setA = ['python', 'pip', 'wheel']
      const setB = ['gradle', 'jvm', 'kotlin']
      assert.strictEqual(calculateJaccardSimilarity(setA, setB), 0.0)
    })

    it('calculates proper fraction for partial intersection', () => {
      const setA = ['npm', 'missing', 'test']
      const setB = ['npm', 'missing', 'build', 'vite']
      // intersection: ['npm', 'missing'] (2), union: ['npm', 'missing', 'test', 'build', 'vite'] (5) => 2/5 = 0.4
      assert.strictEqual(calculateJaccardSimilarity(setA, setB), 0.4)
    })
  })

  describe('computeSimilarityScore', () => {
    it('returns 1.0 immediately for exact hash match', () => {
      const hash = 'a'.repeat(64)
      const target = { exactHash: hash }
      const candidate = { fingerprint: { exactHash: hash } }
      assert.strictEqual(computeSimilarityScore(target, candidate), 1.0)
    })

    it('returns at least 0.85 for structural hash match', () => {
      const structHash = 'b'.repeat(64)
      const target = { structuralHash: structHash }
      const candidate = { fingerprint: { structuralHash: structHash } }
      const score = computeSimilarityScore(target, candidate)
      assert.ok(score >= 0.85)
    })

    it('computes weighted composite score for fuzzy matching', () => {
      const target = {
        tokens: ['missing', 'script', 'test', 'package.json'],
        category: 'configuration',
        failedStep: 'Run Tests',
        affectedFiles: ['package.json'],
      }

      const candidate = {
        fingerprint: {
          tokens: ['missing', 'script', 'test', 'runner'],
        },
        category: 'configuration',
        failedStep: 'Run Tests',
        diagnosis: {
          affectedFiles: ['package.json'],
        },
      }

      const score = computeSimilarityScore(target, candidate)
      assert.ok(score >= 0.70, `Expected score >= 0.70, got ${score}`)
    })
  })

  describe('analyzeHistoricalSuccess', () => {
    it('accurately calculates verification rate and selects best historical fix', () => {
      const incidents = [
        {
          id: 'inc_1',
          similarityScore: 0.95,
          verificationOutcome: { validationPassed: true, confidenceScore: 98 },
          prOutcome: { merged: true },
          fixOutcome: {
            title: 'Fix missing test script in package.json',
            diff: '+ "test": "exit 0"',
            categoryType: 'configuration',
            filesChanged: ['package.json'],
          },
        },
        {
          id: 'inc_2',
          similarityScore: 0.80,
          verificationOutcome: { validationPassed: true, confidenceScore: 90 },
          prOutcome: { merged: false },
          fixOutcome: {
            title: 'Add dummy test script',
            diff: '+ "test": "echo test"',
            categoryType: 'configuration',
            filesChanged: ['package.json'],
          },
        },
      ]

      const analysis = analyzeHistoricalSuccess(incidents)
      assert.strictEqual(analysis.totalMatches, 2)
      assert.strictEqual(analysis.successRate, '100%')
      assert.strictEqual(analysis.verifiedFixCount, 2)
      assert.strictEqual(analysis.mergedPrCount, 1)
      assert.ok(analysis.recommendedHistoricalFix)
      assert.strictEqual(analysis.recommendedHistoricalFix.title, 'Fix missing test script in package.json')
      assert.strictEqual(analysis.recommendedHistoricalFix.sourceIncidentId, 'inc_1')
      assert.strictEqual(analysis.recommendedHistoricalFix.similarityScore, '95%')
    })
  })

  describe('findSimilarIncidents with repository integration', () => {
    it('filters below threshold and ranks top matches descending', async () => {
      const testRepo = new FileBackedIncidentRepository(':memory:', { seed: false })

      const fp1 = generateFailureFingerprint({ logs: 'npm error Missing script: "test"' })
      const fp2 = generateFailureFingerprint({ logs: 'java.lang.NullPointerException at com.app.Main' })

      await testRepo.save({
        id: 'inc_node_test',
        category: 'configuration',
        failedStep: 'Run Tests',
        logs: 'npm error Missing script: "test"',
        fingerprint: fp1,
        diagnosis: { rootCause: 'Missing test script' },
        verificationOutcome: { validationPassed: true },
        fixOutcome: { title: 'Add test script' },
      })

      await testRepo.save({
        id: 'inc_java_npe',
        category: 'build_error',
        failedStep: 'Gradle Build',
        logs: 'java.lang.NullPointerException at com.app.Main',
        fingerprint: fp2,
        diagnosis: { rootCause: 'Null pointer exception' },
      })

      const target = {
        logs: 'npm error Missing script: "test"',
        category: 'configuration',
        failedStep: 'Run Tests',
        tokens: fp1.tokens,
      }

      const result = await findSimilarIncidents(target, { repository: testRepo, threshold: 0.4 })
      assert.strictEqual(result.matches.length, 1)
      assert.strictEqual(result.matches[0].id, 'inc_node_test')
      assert.strictEqual(result.metrics.verifiedFixCount, 1)
    })

    it('throws ERR_INCIDENT_NOT_FOUND when source incident does not exist in findSimilarByIncidentId', async () => {
      const testRepo = new FileBackedIncidentRepository(':memory:', { seed: false })
      await assert.rejects(
        async () => {
          await findSimilarByIncidentId('non_existent_id', { repository: testRepo })
        },
        (err) => {
          assert.strictEqual(err.code, 'ERR_INCIDENT_NOT_FOUND')
          return true
        }
      )
    })
  })
})
