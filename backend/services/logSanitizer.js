/**
 * Log Sanitizer Service
 * Strips ANSI escape codes and normalizes raw CI/CD logs for clean AI prompt ingestion.
 */

// Regex for ANSI escape color and styling codes
const ANSI_REGEX = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g

/**
 * Clean terminal logs:
 * 1. Strips ANSI color/cursor escape codes
 * 2. Normalizes carriage returns and line breaks
 * 3. Trims whitespace
 */
export function sanitizeLog(rawLog) {
  if (!rawLog || typeof rawLog !== 'string') return ''

  return rawLog
    .replace(ANSI_REGEX, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim()
}

/**
 * Extract key error lines from sanitized log
 */
export function extractErrorSnippets(sanitizedLog, maxLines = 40) {
  if (!sanitizedLog) return ''

  const lines = sanitizedLog.split('\n')
  const errorKeywords = ['error', 'failed', 'fatal', 'exception', 'npm error', 'exit code', 'cannot find', 'missing']

  const matchedIndices = new Set()

  lines.forEach((line, index) => {
    const lower = line.toLowerCase()
    if (errorKeywords.some((kw) => lower.includes(kw))) {
      // Capture 2 lines before and 3 lines after for surrounding context
      for (let i = Math.max(0, index - 2); i <= Math.min(lines.length - 1, index + 3); i++) {
        matchedIndices.add(i)
      }
    }
  })

  if (matchedIndices.size === 0) {
    // If no explicit keyword matches, return the tail
    return lines.slice(-maxLines).join('\n')
  }

  const sorted = Array.from(matchedIndices).sort((a, b) => a - b)
  return sorted.slice(-maxLines).map((idx) => lines[idx]).join('\n')
}
