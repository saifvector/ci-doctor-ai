import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getRepoFileContent } from './github.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '../../')

/**
 * File Grounding Service
 * Fetches actual repository file contents, applies token-aware windowing,
 * and formats lines with 1-based indexing for grounded evidence citation.
 */

/**
 * Fetch candidate repository files for grounded analysis
 * @param {string[]} candidatePaths - Array of relative file paths from contextResolver
 * @param {string} owner - GitHub repository owner
 * @param {string} repo - GitHub repository name
 * @param {string|null} token - Optional GitHub auth token
 * @returns {Promise<Array<{path: string, content: string, lines: Array<{number: number, text: string}>, lineCount: number}>>}
 */
export async function fetchGroundedFiles(candidatePaths = [], owner, repo, token = null) {
  const groundedFiles = []

  for (const relPath of candidatePaths) {
    if (!relPath || typeof relPath !== 'string') continue
    const cleanPath = relPath.replace(/^(\.\/|\/)/, '')

    let rawContent = null

    // 1. Try fetching via GitHub API
    try {
      rawContent = await getRepoFileContent(cleanPath, owner, repo, token)
    } catch {
      rawContent = null
    }

    // 2. Fallback to local workspace if fetching self-repository
    if (!rawContent && (repo === 'ci-doctor-ai' || !owner)) {
      try {
        const localPath = path.join(projectRoot, cleanPath)
        if (fs.existsSync(localPath) && fs.statSync(localPath).isFile()) {
          rawContent = fs.readFileSync(localPath, 'utf8')
        }
      } catch {
        rawContent = null
      }
    }

    if (rawContent && typeof rawContent === 'string') {
      const windowed = windowFileContent(cleanPath, rawContent)
      groundedFiles.push({
        path: cleanPath,
        content: windowed.text,
        lines: windowed.lines,
        lineCount: windowed.totalLines,
      })
    }
  }

  return groundedFiles
}

/**
 * Window file content to keep it concise and token-efficient while preserving line numbering
 */
function windowFileContent(filePath, content, maxLines = 150) {
  const rawLines = content.split('\n')
  const totalLines = rawLines.length

  let selectedLines = []

  // For package.json, prioritize scripts, dependencies, devDependencies
  if (filePath.endsWith('package.json')) {
    try {
      // Find where scripts and dependencies live
      const scriptStart = rawLines.findIndex((l) => l.includes('"scripts"'))
      if (scriptStart !== -1 && totalLines > maxLines) {
        // Extract 40 lines around scripts, and top 20 lines
        const head = rawLines.slice(0, Math.min(25, scriptStart)).map((t, idx) => ({ number: idx + 1, text: t }))
        const middle = rawLines
          .slice(scriptStart, Math.min(totalLines, scriptStart + 40))
          .map((t, idx) => ({ number: scriptStart + idx + 1, text: t }))
        selectedLines = [...head, ...middle]
      }
    } catch {
      // fallback to standard slice
    }
  }

  // Standard slice if not custom-windowed
  if (selectedLines.length === 0) {
    const sliceCount = Math.min(totalLines, maxLines)
    selectedLines = rawLines.slice(0, sliceCount).map((text, idx) => ({
      number: idx + 1,
      text,
    }))
  }

  const formattedText = selectedLines
    .map((l) => `[L${l.number}] ${l.text}`)
    .join('\n')

  return {
    lines: selectedLines,
    text: formattedText,
    totalLines,
  }
}

/**
 * Format grounded files into prompt-ready context block
 */
export function formatGroundedContextForPrompt(groundedFiles = []) {
  if (!groundedFiles || groundedFiles.length === 0) return null

  let context = 'Grounded Repository Files:\n\n'
  for (const file of groundedFiles) {
    context += `--- File: ${file.path} (${file.lineCount} total lines) ---\n`
    context += file.content + '\n\n'
  }
  return context
}
