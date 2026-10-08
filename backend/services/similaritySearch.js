import { tokenizeText } from './failureFingerprint.js'
import { failureMemoryRepository } from './failureMemory.js'

/**
 * Calculates Jaccard similarity coefficient between two sets of tokens
 * J(A, B) = |A ∩ B| / |A ∪ B|
 *
 * @param {Set<string>|Array<string>} tokensA
 * @param {Set<string>|Array<string>} tokensB
 * @returns {number} Float between 0.0 and 1.0
 */
export function calculateJaccardSimilarity(tokensA, tokensB) {
  const setA = new Set(tokensA || [])
  const setB = new Set(tokensB || [])

  if (setA.size === 0 && setB.size === 0) return 0
  if (setA.size === 0 || setB.size === 0) return 0

  let intersectionCount = 0
  for (const token of setA) {
    if (setB.has(token)) {
      intersectionCount++
    }
  }

  const unionCount = setA.size + setB.size - intersectionCount
  return unionCount === 0 ? 0 : intersectionCount / unionCount
}

/**
 * Calculates string similarity between step names (case-insensitive substring and exact)
 */
function calculateStepSimilarity(stepA = '', stepB = '') {
  const a = (stepA || '').toLowerCase().trim()
  const b = (stepB || '').toLowerCase().trim()

  if (!a || !b) return 0
  if (a === b) return 1.0
  if (a.includes(b) || b.includes(a)) return 0.75

  // Token comparison for step names
  const tokensA = tokenizeText(a)
  const tokensB = tokenizeText(b)
  return calculateJaccardSimilarity(tokensA, tokensB)
}

/**
 * Calculate overlap between affected file paths
 */
function calculateFileOverlap(filesA = [], filesB = []) {
  const setA = new Set((filesA || []).map((f) => f.toLowerCase()))
  const setB = new Set((filesB || []).map((f) => f.toLowerCase()))

  if (setA.size === 0 || setB.size === 0) return 0
  let matches = 0
  for (const file of setA) {
    if (setB.has(file)) matches++
  }
  return matches / Math.max(setA.size, setB.size)
}

/**
 * Computes composite similarity score between a target query and candidate incident
 *
 * Weights:
 * - Token similarity (Jaccard on normalized logs): 50%
 * - Category match: 20%
 * - Step name similarity: 15%
 * - File overlap: 15%
 *
 * @param {Object} target - Target failure features
 * @param {Object} candidate - Stored historical incident
 * @returns {number} Score between 0.0 and 1.0 (or 1.0 if exact hash match)
 */
export function computeSimilarityScore(target, candidate) {
  // 1. Exact hash match
  if (
    target.exactHash &&
    candidate.fingerprint?.exactHash &&
    target.exactHash === candidate.fingerprint.exactHash
  ) {
    return 1.0
  }

  // 2. Structural hash match
  if (
    target.structuralHash &&
    candidate.fingerprint?.structuralHash &&
    target.structuralHash === candidate.fingerprint.structuralHash
  ) {
    // Structural match provides baseline 0.85
    const tokenSim = calculateJaccardSimilarity(
      target.tokens || [],
      candidate.fingerprint?.tokens || []
    )
    return Math.min(0.98, 0.85 + tokenSim * 0.13)
  }

  // 3. Multi-factor weighted fuzzy matching
  const targetTokens = target.tokens || tokenizeText(target.logs || target.signatureSnippet || '')
  const candidateTokens = candidate.fingerprint?.tokens || tokenizeText(candidate.logs || '')
  const tokenSim = calculateJaccardSimilarity(targetTokens, candidateTokens)

  const categoryMatch =
    (target.category || '').toLowerCase() === (candidate.category || '').toLowerCase() ? 1.0 : 0.0

  const stepSim = calculateStepSimilarity(
    target.failedStep || '',
    candidate.failedStep || candidate.fingerprint?.failedStep || ''
  )

  const fileOverlap = calculateFileOverlap(
    target.affectedFiles || [],
    candidate.diagnosis?.affectedFiles || candidate.fixOutcome?.filesChanged || []
  )

  const composite = (tokenSim * 0.50) + (categoryMatch * 0.20) + (stepSim * 0.15) + (fileOverlap * 0.15)
  return Math.round(composite * 100) / 100
}

/**
 * Analyzes historical success metrics across similar incidents
 *
 * @param {Array} similarIncidents - Ranked similar incidents
 * @returns {Object} Success metrics and recommended fix
 */
export function analyzeHistoricalSuccess(similarIncidents = []) {
  if (!similarIncidents || similarIncidents.length === 0) {
    return {
      totalMatches: 0,
      successRate: '0%',
      verifiedFixCount: 0,
      mergedPrCount: 0,
      recommendedHistoricalFix: null,
    }
  }

  let verifiedCount = 0
  let mergedCount = 0
  let bestFix = null
  let highestScore = -1

  for (const inc of similarIncidents) {
    const isVerified = inc.verificationOutcome?.validationPassed === true
    const isMerged = inc.prOutcome?.merged === true

    if (isVerified) verifiedCount++
    if (isMerged) mergedCount++

    if (inc.fixOutcome && inc.similarityScore > highestScore) {
      if (isVerified || isMerged) {
        highestScore = inc.similarityScore
        bestFix = {
          title: inc.fixOutcome.title,
          diff: inc.fixOutcome.diff,
          categoryType: inc.fixOutcome.categoryType,
          filesChanged: inc.fixOutcome.filesChanged,
          confidence: inc.verificationOutcome?.confidenceScore ? `${inc.verificationOutcome.confidenceScore}%` : '95%',
          sourceIncidentId: inc.id,
          similarityScore: `${Math.round(inc.similarityScore * 100)}%`,
        }
      }
    }
  }

  const successRate = similarIncidents.length > 0
    ? `${Math.round((verifiedCount / similarIncidents.length) * 100)}%`
    : '0%'

  return {
    totalMatches: similarIncidents.length,
    successRate,
    verifiedFixCount: verifiedCount,
    mergedPrCount: mergedCount,
    recommendedHistoricalFix: bestFix,
  }
}

/**
 * Searches failure memory repository for incidents matching target features
 *
 * @param {Object} target - Target failure features (fingerprint, logs, category, etc.)
 * @param {Object} [options]
 * @param {number} [options.threshold=0.30] - Minimum similarity threshold
 * @param {number} [options.limit=5] - Maximum items to return
 * @param {string} [options.excludeId] - Optional incident ID to exclude (e.g. self)
 * @param {IIncidentRepository} [options.repository] - Injected repository instance
 * @returns {Promise<Object>} Ranked similar incidents and historical success analysis
 */
export async function findSimilarIncidents(target, {
  threshold = 0.30,
  limit = 5,
  excludeId = null,
  repository = failureMemoryRepository,
} = {}) {
  const allIncidents = await repository.getAll()

  const scored = []
  for (const incident of allIncidents) {
    if (excludeId && incident.id === excludeId) continue

    const score = computeSimilarityScore(target, incident)
    if (score >= threshold) {
      scored.push({
        ...incident,
        similarityScore: score,
        similarityPercentage: `${Math.round(score * 100)}%`,
      })
    }
  }

  // Sort descending by similarity score
  scored.sort((a, b) => b.similarityScore - a.similarityScore)
  const topMatches = scored.slice(0, limit)
  const historicalAnalysis = analyzeHistoricalSuccess(topMatches)

  return {
    matches: topMatches,
    metrics: historicalAnalysis,
  }
}

/**
 * Find similar incidents for an existing incident by ID
 *
 * @param {string} incidentId - Incident ID to find matches for
 * @param {Object} [options]
 * @returns {Promise<Object>} Matches and analysis
 */
export async function findSimilarByIncidentId(incidentId, options = {}) {
  const repository = options.repository || failureMemoryRepository
  const incident = await repository.findById(incidentId)

  if (!incident) {
    const error = new Error(`ERR_INCIDENT_NOT_FOUND: Incident ${incidentId} was not found in failure memory`)
    error.code = 'ERR_INCIDENT_NOT_FOUND'
    error.statusCode = 404
    throw error
  }

  const target = {
    exactHash: incident.fingerprint?.exactHash,
    structuralHash: incident.fingerprint?.structuralHash,
    tokens: incident.fingerprint?.tokens,
    category: incident.category,
    failedStep: incident.failedStep,
    affectedFiles: incident.diagnosis?.affectedFiles || [],
    logs: incident.logs,
  }

  return findSimilarIncidents(target, {
    ...options,
    excludeId: incidentId,
    repository,
  })
}
