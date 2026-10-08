/**
 * Context Resolver Service (Context Intelligence)
 * Analyzes error logs, failed steps, and workflow metadata to determine
 * which repository files must be retrieved for grounded AI reasoning.
 */

export function resolveRelevantFiles(logs = '', runDetails = {}) {
  const logText = (logs || '').toLowerCase()
  const candidateFiles = new Set()
  let detectedCategory = 'unknown'
  const failureKeywords = []

  // 1. Inspect Workflow Manifest
  if (runDetails.workflowFile && runDetails.workflowFile !== 'unknown') {
    candidateFiles.add(`.github/workflows/${runDetails.workflowFile}`)
  } else {
    candidateFiles.add('.github/workflows/deploy.yml')
    candidateFiles.add('.github/workflows/ci.yml')
  }

  // 2. Node / NPM / Yarn / PNPM Patterns
  if (
    logText.includes('missing script') ||
    logText.includes('npm err') ||
    logText.includes('yarn run') ||
    logText.includes('pnpm')
  ) {
    candidateFiles.add('package.json')
    candidateFiles.add('frontend/package.json')
    candidateFiles.add('backend/package.json')
    detectedCategory = 'configuration'
    failureKeywords.push('missing_npm_script')
  }

  if (
    logText.includes('cannot find module') ||
    logText.includes('module_not_found') ||
    logText.includes('err_module_not_found') ||
    logText.includes('failed to resolve import')
  ) {
    candidateFiles.add('package.json')
    candidateFiles.add('frontend/package.json')
    candidateFiles.add('backend/package.json')
    candidateFiles.add('package-lock.json')
    detectedCategory = 'dependency'
    failureKeywords.push('missing_module_dependency')
  }

  // 3. Python Patterns
  if (
    logText.includes('modulenotfounderror') ||
    logText.includes('no module named') ||
    logText.includes('pip install') ||
    logText.includes('pytest')
  ) {
    candidateFiles.add('requirements.txt')
    candidateFiles.add('pyproject.toml')
    candidateFiles.add('setup.py')
    detectedCategory = 'dependency'
    failureKeywords.push('python_dependency_error')
  }

  // 4. Docker / Container Patterns
  if (
    logText.includes('docker build') ||
    logText.includes('dockerfile') ||
    logText.includes('executor failed') ||
    logText.includes('failed to solve with frontend dockerfile')
  ) {
    candidateFiles.add('Dockerfile')
    candidateFiles.add('docker-compose.yml')
    candidateFiles.add('docker-compose.yaml')
    detectedCategory = 'build_error'
    failureKeywords.push('docker_build_failure')
  }

  // 5. Linter & Static Analysis Patterns
  if (logText.includes('eslint') || logText.includes('lint') || logText.includes('prettier')) {
    candidateFiles.add('eslint.config.js')
    candidateFiles.add('frontend/eslint.config.js')
    candidateFiles.add('.eslintrc.json')
    candidateFiles.add('package.json')
    detectedCategory = 'syntax'
    failureKeywords.push('lint_rule_violation')
  }

  // 6. TypeScript Patterns
  if (logText.includes('error ts') || logText.includes('type error') || logText.includes('cannot find name')) {
    candidateFiles.add('tsconfig.json')
    candidateFiles.add('frontend/tsconfig.json')
    detectedCategory = 'syntax'
    failureKeywords.push('typescript_type_error')
  }

  // 7. Missing Environment Variable / Secrets Patterns
  if (
    logText.includes('api_key') ||
    logText.includes('secret') ||
    logText.includes('env variable') ||
    logText.includes('401') ||
    logText.includes('unauthorized')
  ) {
    if (runDetails.workflowFile) {
      candidateFiles.add(`.github/workflows/${runDetails.workflowFile}`)
    }
    candidateFiles.add('backend/.env.example')
    candidateFiles.add('.env.example')
    detectedCategory = 'environment'
    failureKeywords.push('missing_environment_secret')
  }

  // 8. Extract relative file paths mentioned in stack traces
  // Matches patterns like "src/App.jsx:42:10" or "at ... (frontend/src/main.jsx:12:4)"
  const stackPathRegex = /(?:at\s+.*?\s+\(?|\s+|\/|^)([a-zA-Z0-9_\-\.\/]+\.(?:jsx?|tsx?|py|json|ya?ml|css|sh|md))(?::\d+)?/g
  let match
  while ((match = stackPathRegex.exec(logs)) !== null) {
    const rawPath = match[1]
    if (
      rawPath &&
      !rawPath.startsWith('node_modules') &&
      !rawPath.includes('usr/') &&
      !rawPath.includes('node:') &&
      !rawPath.includes('internal/') &&
      (rawPath.includes('/') || rawPath.endsWith('.json') || rawPath.endsWith('.yml'))
    ) {
      candidateFiles.add(rawPath.replace(/^(\.\/|\/)/, ''))
    }
  }

  return {
    candidateFiles: Array.from(candidateFiles).slice(0, 8), // Cap at 8 most relevant files
    detectedCategory,
    failureKeywords,
  }
}
