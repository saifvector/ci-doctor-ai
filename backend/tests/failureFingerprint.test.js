import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeErrorText,
  extractErrorSignature,
  tokenizeText,
  generateFailureFingerprint,
} from '../services/failureFingerprint.js'

describe('Failure Fingerprinting Service', () => {
  describe('normalizeErrorText', () => {
    it('strips ANSI color escape sequences cleanly', () => {
      const raw = '\u001b[31mError:\u001b[39m \u001b[1mProcess exited with code 1\u001b[22m'
      const normalized = normalizeErrorText(raw)
      assert.strictEqual(normalized, 'Error: Process exited with code 1')
    })

    it('masks ISO-8601 timestamps and runner elapsed times', () => {
      const raw = '2026-10-08T05:12:00.123Z [ERROR] Failed after 14.52s in 250ms'
      const normalized = normalizeErrorText(raw)
      assert.ok(normalized.includes('<TIMESTAMP>'))
      assert.ok(normalized.includes('<DURATION>'))
      assert.ok(!normalized.includes('2026-10-08T05:12:00.123Z'))
    })

    it('normalizes dynamic Linux and Windows runner workspace directories', () => {
      const linuxLog = 'at Object.<anonymous> (/home/runner/work/ci-doctor-ai/ci-doctor-ai/src/index.js:42:15)'
      const windowsLog = 'at Object.<anonymous> (C:\\Users\\runneradmin\\actions-runner\\_work\\ci-doctor-ai\\ci-doctor-ai\\src\\index.js:42:15)'

      const normLinux = normalizeErrorText(linuxLog)
      const normWindows = normalizeErrorText(windowsLog)

      assert.ok(normLinux.includes('<WORKSPACE>/src/index.js:<LINE>'))
      assert.ok(normWindows.includes('<WORKSPACE>/src/index.js:<LINE>'))
    })

    it('masks memory addresses, UUIDs, and commit hashes', () => {
      const raw = 'Fatal at 0x7ffee4b2a890 for task 550e8400-e29b-41d4-a716-446655440000 on commit 4674296e8d1a3b5c7f890123456789abcdef0123'
      const normalized = normalizeErrorText(raw)

      assert.ok(normalized.includes('<ADDR>'))
      assert.ok(normalized.includes('<UUID>'))
      assert.ok(normalized.includes('<SHA>'))
      assert.ok(!normalized.includes('0x7ffee4b2a890'))
    })
  })

  describe('extractErrorSignature', () => {
    it('isolates highest-signal error line from stack trace', () => {
      const log = `
npm info run test
npm error Missing script: "test"
npm error To see a list of scripts, run:
npm error npm run
`
      const sig = extractErrorSignature(log)
      assert.strictEqual(sig, 'npm error Missing script: "test"')
    })

    it('falls back to first non-empty line when no standard error keyword is found', () => {
      const log = 'Pipeline terminated abnormally during preparation step'
      const sig = extractErrorSignature(log)
      assert.strictEqual(sig, 'Pipeline terminated abnormally during preparation step')
    })
  })

  describe('tokenizeText', () => {
    it('extracts unique normalized tokens and filters common stop words', () => {
      const text = 'npm error Missing script test in package.json for runner'
      const tokens = tokenizeText(text)

      assert.ok(tokens.includes('missing'))
      assert.ok(tokens.includes('script'))
      assert.ok(tokens.includes('test'))
      assert.ok(tokens.includes('package.json'))
      // Stop words like "in" and "for" should be omitted
      assert.ok(!tokens.includes('in'))
      assert.ok(!tokens.includes('for'))
    })
  })

  describe('generateFailureFingerprint', () => {
    it('generates deterministic exact and structural SHA-256 hashes across different runner paths', () => {
      const run1 = {
        logs: '2026-10-08T01:00:00Z /home/runner/work/repo/repo/src/test.js:10\nnpm error Missing script: "test"',
        category: 'configuration',
        failedStep: 'Run Tests',
        exitCode: 1,
      }

      const run2 = {
        logs: '2026-10-08T02:00:00Z /home/runner/work/repo/repo/src/test.js:10\nnpm error Missing script: "test"',
        category: 'configuration',
        failedStep: 'Run Tests',
        exitCode: 1,
      }

      const fp1 = generateFailureFingerprint(run1)
      const fp2 = generateFailureFingerprint(run2)

      assert.strictEqual(fp1.exactHash, fp2.exactHash)
      assert.strictEqual(fp1.structuralHash, fp2.structuralHash)
      assert.strictEqual(fp1.failedStep, 'Run Tests')
      assert.ok(fp1.tokens.length > 0)
    })

    it('produces 64-character SHA-256 hex strings', () => {
      const fp = generateFailureFingerprint({ logs: 'TypeError: Cannot read properties of undefined' })
      assert.strictEqual(fp.exactHash.length, 64)
      assert.strictEqual(fp.structuralHash.length, 64)
    })
  })
})
