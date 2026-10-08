import crypto from 'crypto'
import { sanitizeLog } from './logSanitizer.js'

/**
 * Stop words filtered from tokenized error signatures
 */
const STOP_WORDS = new Set([
  'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'in', 'to', 'of',
  'for', 'by', 'with', 'from', 'as', 'that', 'this', 'it', 'was', 'be', 'are',
  'run', 'running', 'step', 'job', 'error', 'err', 'failed', 'failure', 'exit',
  'code', 'status', 'command', 'process', 'finished', 'completed', 'started'
])

/**
 * Normalizes log trace by stripping ephemeral identifiers:
 * - Timestamps (ISO, standard dates)
 * - Temporary file paths and runner workspace directories
 * - Memory addresses and hex pointers
 * - Process IDs and thread hashes
 * - UUIDs and commit SHAs
 *
 * @param {string} logText - Raw or sanitized error log text
 * @returns {string} Normalized canonical log string
 */
export function normalizeErrorText(logText = '') {
  if (!logText || typeof logText !== 'string') return ''

  return logText
    // Remove ANSI escape sequences
    .replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '')
    // Normalize runner work paths (Linux: /home/runner/work/repo/repo/ -> <WORKSPACE>/)
    .replace(/(?:\/[a-zA-Z0-9_\-\.]+)+\/work\/[a-zA-Z0-9_\-\.]+\/[a-zA-Z0-9_\-\.]+\/?/g, '<WORKSPACE>/')
    // Normalize Windows runner paths (e.g., C:\Users\runneradmin\actions-runner\_work\repo\repo\...)
    .replace(/[a-zA-Z]:\\(?:Users|actions-runner|[a-zA-Z0-9_\-\.\\])+\\_work\\[a-zA-Z0-9_\-\.]+\\[a-zA-Z0-9_\-\.]+\\?/gi, '<WORKSPACE>/')
    // Normalize path separators inside <WORKSPACE>/
    .replace(/<WORKSPACE>\/([^ \t\r\n\(\)]+)/g, (match, relPath) => `<WORKSPACE>/${relPath.replace(/\\/g, '/')}`)
    // Normalize Windows drive paths (e.g., C:\Users\...)
    .replace(/[a-zA-Z]:\\[a-zA-Z0-9_\-\.\\]+/g, '<PATH>')
    // Normalize absolute unix paths
    .replace(/\/(?:usr|var|tmp|etc|opt|home)\/[a-zA-Z0-9_\-\.\/]+/g, '<PATH>')
    // Normalize ISO timestamps (2026-10-08T10:14:16.123Z)
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?/gi, '<TIMESTAMP>')
    // Normalize standalone dates and times
    .replace(/\b\d{4}-\d{2}-\d{2}\b|\b\d{2}:\d{2}:\d{2}\b/g, '<TIMESTAMP>')
    // Normalize durations (e.g., 14.52s, 250ms)
    .replace(/\b\d+(?:\.\d+)?(?:ms|s|m|h)\b/gi, '<DURATION>')
    // Normalize hex memory addresses (0x7fff5fbff8e0)
    .replace(/0x[a-fA-F0-9]{4,16}/g, '<ADDR>')
    // Normalize UUIDs
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<UUID>')
    // Normalize git commit SHAs (40 or 7 chars)
    .replace(/\b[0-9a-f]{40}\b|\b[0-9a-f]{7}\b/gi, '<SHA>')
    // Normalize line numbers in stack traces (at File.js:42:15 -> at File.js:<LINE>)
    .replace(/:(\d+)(?::(\d+))?/g, ':<LINE>')
    // Normalize whitespace
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

/**
 * Extracts the most salient error lines from a log block
 *
 * @param {string} normalizedText - Pre-normalized log text
 * @returns {string} Core error signature
 */
export function extractErrorSignature(normalizedText = '') {
  if (!normalizedText) return ''

  const lines = normalizedText.split('\n')
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    const lower = line.toLowerCase()
    if (
      lower.includes('npm err!') ||
      lower.includes('npm error') ||
      lower.includes('error:') ||
      lower.includes('fatal:') ||
      lower.includes('exception:') ||
      lower.includes('modulenotfounderror:') ||
      lower.includes('cannot find module') ||
      lower.includes('failed step:') ||
      lower.includes('missing script:') ||
      lower.includes('command failed with exit code') ||
      lower.includes('dockerfile:') ||
      lower.includes('syntaxerror:') ||
      lower.includes('typeerror:')
    ) {
      return line
    }
  }

  // Fallback: take first non-empty line
  return lines.find((l) => l.trim().length > 0)?.trim() || ''
}

/**
 * Extracts searchable, normalized tokens for fuzzy index comparison
 *
 * @param {string} text - Text to tokenize
 * @returns {Array<string>} Deduplicated array of significant tokens
 */
export function tokenizeText(text = '') {
  if (!text || typeof text !== 'string') return []

  const rawTokens = text
    .toLowerCase()
    .replace(/[^a-z0-9_\-\.\/]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token))

  return Array.from(new Set(rawTokens))
}

/**
 * Generates a deterministic Failure Fingerprint for an incident.
 *
 * Structure:
 * - exactHash: SHA-256 of (category + failedStep + normalizedSignature)
 * - normalizedSignature: Canonical error signature
 * - tokens: Array of significant tokens for fuzzy similarity search
 * - structuralHash: SHA-256 of (category + failedStep + exitCode)
 *
 * @param {Object} params
 * @param {string} params.logs - Raw or cleaned log content
 * @param {string} params.category - Detected failure category (configuration, dependency, etc.)
 * @param {string} params.failedStep - Name of the failed workflow step
 * @param {number|string} [params.exitCode] - Optional process exit code
 * @returns {Object} Complete Failure Fingerprint
 */
export function generateFailureFingerprint({
  logs = '',
  category = 'unknown',
  failedStep = 'unknown',
  exitCode = 1,
}) {
  const sanitized = sanitizeLog(logs || '')
  const normalized = normalizeErrorText(sanitized)
  const errorSignature = extractErrorSignature(normalized)

  // 1. Exact deterministic fingerprint payload
  const exactPayload = [
    category.trim().toLowerCase(),
    failedStep.trim().toLowerCase(),
    errorSignature.trim(),
  ].join('::')

  const exactHash = crypto
    .createHash('sha256')
    .update(exactPayload)
    .digest('hex')

  // 2. Structural fingerprint payload (higher-level abstraction)
  const structuralPayload = [
    category.trim().toLowerCase(),
    failedStep.trim().toLowerCase(),
    String(exitCode),
  ].join('::')

  const structuralHash = crypto
    .createHash('sha256')
    .update(structuralPayload)
    .digest('hex')

  // 3. Searchable fuzzy tokens
  const tokenSet = tokenizeText(`${category} ${failedStep} ${errorSignature}`)

  return {
    exactHash,
    structuralHash,
    category: category.trim().toLowerCase(),
    failedStep: failedStep.trim(),
    exitCode: Number(exitCode) || 1,
    signatureSnippet: errorSignature.slice(0, 300),
    tokens: Array.from(tokenSet),
    timestamp: new Date().toISOString(),
  }
}
