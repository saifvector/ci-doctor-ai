import { GoogleGenerativeAI } from '@google/generative-ai'
import dotenv from 'dotenv'
import { verifyFix, detectProjectType } from './fixVerification.js'

dotenv.config()

const apiKey = process.env.GEMINI_API_KEY || ''
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null

const model = genAI
  ? genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.3,
      },
    })
  : null

// Retry helper with exponential backoff
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      const msg = (error.message || '').toLowerCase()
      const isRateLimit =
        msg.includes('429') ||
        msg.includes('quota') ||
        msg.includes('rate limit') ||
        msg.includes('resource_exhausted')

      if (isRateLimit && attempt < maxRetries) {
        const waitTime = Math.pow(2, attempt + 1) * 4000 // 8s, 16s, 32s
        console.log(
          `AI rate limited. Retrying in ${waitTime / 1000}s (attempt ${attempt + 1}/${maxRetries})...`
        )
        await new Promise((resolve) => setTimeout(resolve, waitTime))
        continue
      }
      throw error
    }
  }
}

/**
 * Analyze CI/CD failure logs and generate a grounded diagnosis
 */
export async function diagnosePipeline(runDetails, logs, groundedFiles = []) {
  const projectType = detectProjectType(groundedFiles, runDetails)
  const fileContextString = Array.isArray(groundedFiles) && groundedFiles.length > 0
    ? groundedFiles.map((f) => `--- File: ${f.path} ---\n${f.content}`).join('\n\n')
    : null

  const prompt = `You are CI Doctor AI, an enterprise-grade CI/CD pipeline debugger and reliability engineer. Analyze the following failed GitHub Actions workflow run and provide an exact, technical diagnosis grounded in actual repository files.

## Workflow Run Info
- Workflow: ${runDetails.name}
- Branch: ${runDetails.branch}
- Commit: ${runDetails.commit} - ${runDetails.commitMessage}
- Author: ${runDetails.author}
- Duration: ${runDetails.duration}
- Detected Stack: ${projectType}
- Stages: ${JSON.stringify(runDetails.stages)}

## Error Logs
${logs}

${fileContextString ? `## Grounded Repository Context (With Line Annotations)\n${fileContextString}` : ''}

## Instructions
Analyze the failure and respond with ONLY this JSON structure:
{
  "rootCause": "A clear, concise explanation of why the pipeline failed (1-2 sentences)",
  "confidence": "A percentage like 94% indicating confidence",
  "severityScore": "One of: P0 - Critical, P1 - High, P2 - Moderate, P3 - Low",
  "affectedFiles": ["list", "of", "likely", "affected", "files"],
  "riskLevel": "Low or Medium or High or Critical",
  "recommendation": "A specific, actionable recommendation to fix this issue (1-2 sentences)",
  "category": "One of: dependency, configuration, test_failure, build_error, deployment, permission, environment, syntax, timeout, unknown",
  "supportingEvidence": [
    {
      "file": "exact/file/path",
      "lineRange": "Line number or range like L12-L16",
      "snippet": "actual code snippet from repository that triggered or failed",
      "explanation": "Why this specific line or configuration caused the CI pipeline failure"
    }
  ]
}

Be specific and technical. Reference exact file names, line numbers, missing variables, and commands.`

  if (model) {
    try {
      const result = await retryWithBackoff(async () => {
        return await model.generateContent(prompt)
      })
      const text = result.response.text()
      const diagnosis = JSON.parse(text)

      return {
        rootCause: diagnosis.rootCause || 'Unable to determine root cause',
        confidence: diagnosis.confidence || '50%',
        severityScore: diagnosis.severityScore || 'P1 - High',
        affectedFiles: diagnosis.affectedFiles || [],
        riskLevel: diagnosis.riskLevel || 'Medium',
        recommendation: diagnosis.recommendation || 'Review the error logs manually',
        category: diagnosis.category || 'unknown',
        projectType,
        supportingEvidence: Array.isArray(diagnosis.supportingEvidence) ? diagnosis.supportingEvidence : [],
        groundedFilesCount: (groundedFiles || []).length,
      }
    } catch (error) {
      console.error('AI diagnosis error (falling back to pattern matcher):', error.message)
    }
  }

  // Fallback pattern matching with grounded files
  return generateFallbackDiagnosis(runDetails, logs, groundedFiles)
}

/**
 * Generate a fix/patch for a diagnosed pipeline failure
 */
export async function generateFix(runDetails, logs, diagnosis, groundedFiles = []) {
  const projectType = detectProjectType(groundedFiles, runDetails)
  const fileContextString = Array.isArray(groundedFiles) && groundedFiles.length > 0
    ? groundedFiles.map((f) => `--- File: ${f.path} ---\n${f.content}`).join('\n\n')
    : null

  const prompt = `You are CI Doctor AI, an expert CI/CD pipeline debugger. Based on the diagnosis below, generate an automated recovery patch.

## Workflow Run Info
- Workflow: ${runDetails.name}
- Branch: ${runDetails.branch}
- Commit: ${runDetails.commit} - ${runDetails.commitMessage}
- Author: ${runDetails.author}
- Detected Stack: ${projectType}

## Error Logs
${logs}

## Diagnosis
- Root Cause: ${diagnosis.rootCause}
- Confidence: ${diagnosis.confidence}
- Severity: ${diagnosis.severityScore || 'P1 - High'}
- Affected Files: ${(diagnosis.affectedFiles || []).join(', ')}
- Risk Level: ${diagnosis.riskLevel}
- Category: ${diagnosis.category}
- Recommendation: ${diagnosis.recommendation}

${fileContextString ? `## Grounded Repository Context\n${fileContextString}` : ''}

## Instructions
Generate a fix and respond with ONLY this JSON structure:
{
  "title": "Short title for the recovery patch (e.g., 'Fix missing test script in package.json')",
  "confidence": "A percentage like 93% indicating confidence",
  "summary": "A 1-2 sentence summary starting with 'CI Doctor AI generated a recovery patch to...'",
  "reasoning": "A concise explanation of why this patch fixes the root cause",
  "categoryType": "dependency, configuration, or code_fix",
  "filesChanged": ["list", "of", "files", "that", "need", "changes"],
  "diff": "A unified diff showing the exact changes needed. Use + for additions, - for removals. Keep it concise but complete.",
  "prTitle": "A descriptive PR title like 'Fix CI pipeline failure caused by missing test script'",
  "prBranch": "A clean branch name like 'fix/ci-test-script-recovery'"
}

Be specific. Show actual code changes in the diff.`

  let generatedFix = null

  if (model) {
    try {
      const result = await retryWithBackoff(async () => {
        return await model.generateContent(prompt)
      })
      const text = result.response.text()
      const fix = JSON.parse(text)

      generatedFix = {
        title: fix.title || 'Generated Recovery Patch',
        confidence: fix.confidence || '70%',
        summary: fix.summary || 'CI Doctor AI generated a recovery patch.',
        reasoning: fix.reasoning || diagnosis.recommendation,
        categoryType: fix.categoryType || diagnosis.category,
        filesChanged: fix.filesChanged || [],
        diff: fix.diff || 'No diff generated',
        prTitle: fix.prTitle || 'Fix CI pipeline failure',
        prBranch: fix.prBranch || 'fix/ci-recovery',
      }
    } catch (error) {
      console.error('AI fix generation error (falling back to pattern matcher):', error.message)
    }
  }

  // Fallback fix generation if model failed
  if (!generatedFix) {
    generatedFix = generateFallbackFix(runDetails, logs, diagnosis, groundedFiles)
  }

  // Run comprehensive Verification Engine
  const verification = verifyFix(generatedFix, groundedFiles, runDetails)
  generatedFix.verification = verification
  generatedFix.validation = verification // Backward compatibility
  if (verification.confidenceScore) {
    generatedFix.confidence = `${verification.confidenceScore}%`
  }

  return generatedFix
}

/**
 * Fallback diagnosis using pattern matching with grounded evidence extraction
 */
function generateFallbackDiagnosis(runDetails, logs, groundedFiles = []) {
  const logText = (logs || '').toLowerCase()
  const groundedCount = (groundedFiles || []).length
  const projectType = detectProjectType(groundedFiles, runDetails)

  // Find package.json in grounded files if present
  const pkgFile = (groundedFiles || []).find((f) => f.path.endsWith('package.json'))
  const workflowFile = (groundedFiles || []).find((f) => f.path.includes('.github/workflows'))

  if (logText.includes('missing script') && logText.includes('test')) {
    let snippet = '"scripts": {\n  "dev": "vite",\n  "build": "vite build",\n  "lint": "eslint ."\n}'
    let lineRange = 'L12-L17'

    if (pkgFile && pkgFile.lines) {
      const scriptLines = pkgFile.lines.filter((l) =>
        l.text.includes('"scripts"') || l.text.includes('"build"') || l.text.includes('"lint"')
      )
      if (scriptLines.length > 0) {
        snippet = scriptLines.map((l) => l.text).join('\n')
        lineRange = `L${scriptLines[0].number}-L${scriptLines[scriptLines.length - 1].number}`
      }
    }

    return {
      rootCause:
        'The pipeline failed because the "test" script is missing from package.json. The workflow executes "npm test", which exits with code 1 when no test script is declared.',
      confidence: '96%',
      severityScore: 'P1 - High',
      affectedFiles: ['package.json', runDetails.workflowFile || '.github/workflows/deploy.yml'],
      riskLevel: 'Medium',
      recommendation:
        'Add a "test" script to package.json, or update the workflow to run "npm test --if-present".',
      category: 'configuration',
      projectType,
      groundedFilesCount: groundedCount,
      supportingEvidence: [
        {
          file: pkgFile ? pkgFile.path : 'package.json',
          lineRange,
          snippet,
          explanation: 'No "test" entry exists inside "scripts" configuration while CI runner invokes "npm test".',
        },
      ],
    }
  }

  if (logText.includes('api_key') || logText.includes('api key') || logText.includes('secret')) {
    let snippet = '- name: Deploy Application\n  run: npm run deploy'
    let lineRange = 'L24-L26'

    if (workflowFile && workflowFile.lines) {
      const deployStep = workflowFile.lines.filter((l) =>
        l.text.toLowerCase().includes('deploy') || l.text.toLowerCase().includes('env')
      )
      if (deployStep.length > 0) {
        snippet = deployStep.slice(0, 4).map((l) => l.text).join('\n')
        lineRange = `L${deployStep[0].number}-L${deployStep[deployStep.length - 1].number}`
      }
    }

    return {
      rootCause:
        'The pipeline failed because the required API_KEY environment secret is not configured in the GitHub Actions runner environment.',
      confidence: '95%',
      severityScore: 'P0 - Critical',
      affectedFiles: [runDetails.workflowFile || '.github/workflows/deploy.yml'],
      riskLevel: 'High',
      recommendation:
        'Add API_KEY to repository GitHub Actions Secrets and map it as an environment variable in the workflow YAML.',
      category: 'environment',
      projectType,
      groundedFilesCount: groundedCount,
      supportingEvidence: [
        {
          file: workflowFile ? workflowFile.path : '.github/workflows/deploy.yml',
          lineRange,
          snippet,
          explanation: 'Workflow deployment job attempts to access API_KEY without secret mapping in runner environment.',
        },
      ],
    }
  }

  if (logText.includes('module not found') || logText.includes('cannot find module')) {
    return {
      rootCause:
        'The pipeline failed because a required module dependency could not be resolved by the Node.js runtime.',
      confidence: '88%',
      severityScore: 'P1 - High',
      affectedFiles: ['package.json'],
      riskLevel: 'Medium',
      recommendation:
        'Ensure the package is declared in package.json dependencies and verify the import specifier.',
      category: 'dependency',
      projectType,
      groundedFilesCount: groundedCount,
      supportingEvidence: [
        {
          file: pkgFile ? pkgFile.path : 'package.json',
          lineRange: 'dependencies',
          snippet: '"dependencies": {\n  "react": "^19.0.0"\n}',
          explanation: 'Required runtime package is absent from dependencies declaration.',
        },
      ],
    }
  }

  if (logText.includes('lint') || logText.includes('eslint')) {
    return {
      rootCause:
        'The pipeline failed due to ESLint code quality or syntax rule violations during verification.',
      confidence: '90%',
      severityScore: 'P2 - Moderate',
      affectedFiles: ['eslint.config.js'],
      riskLevel: 'Low',
      recommendation:
        'Resolve the ESLint rule violations flagged in the logs or run "npm run lint -- --fix".',
      category: 'syntax',
      projectType,
      groundedFilesCount: groundedCount,
      supportingEvidence: [
        {
          file: 'eslint.config.js',
          lineRange: 'L10-L15',
          snippet: 'rules: {\n  "react/jsx-no-target-blank": "off"\n}',
          explanation: 'Code violates configured linting constraints.',
        },
      ],
    }
  }

  return {
    rootCause:
      'The pipeline failed during stage execution. Review the sanitized log trace for detailed stack information.',
    confidence: '65%',
    severityScore: 'P2 - Moderate',
    affectedFiles: [runDetails.workflowFile || '.github/workflows/deploy.yml'],
    riskLevel: 'Medium',
    recommendation:
      'Inspect the error logs to pinpoint the exact failing command and apply remediation.',
    category: 'unknown',
    projectType,
    groundedFilesCount: groundedCount,
    supportingEvidence: [
      {
        file: runDetails.workflowFile || '.github/workflows/deploy.yml',
        lineRange: 'L1-L20',
        snippet: 'name: CI Pipeline\non: [push, pull_request]',
        explanation: 'Workflow trigger and job execution failed during runner step.',
      },
    ],
  }
}

/**
 * Fallback fix generation when Gemini API is unavailable
 */
function generateFallbackFix(runDetails, logs, diagnosis, groundedFiles = []) {
  const logText = (logs || '').toLowerCase()

  if (diagnosis.category === 'configuration' && logText.includes('missing script')) {
    return {
      title: 'Fix missing test script in package.json',
      confidence: '94%',
      summary:
        'CI Doctor AI generated a recovery patch to add the missing "test" script to package.json, resolving the npm test failure in the deploy pipeline.',
      reasoning: 'The GitHub Actions workflow runs "npm test", which fails with code 1 if package.json has no test script defined.',
      categoryType: 'configuration',
      filesChanged: ['package.json', '.github/workflows/deploy.yml'],
      diff: `--- a/package.json
+++ b/package.json
@@ scripts @@
   "dev": "vite",
   "build": "vite build",
   "lint": "eslint .",
-  "preview": "vite preview"
+  "preview": "vite preview",
+  "test": "echo \\"No tests configured\\" && exit 0"

--- a/.github/workflows/deploy.yml
+++ b/.github/workflows/deploy.yml
@@ test step @@
   - name: Run Tests
     working-directory: ./frontend
-    run: npm test
+    run: npm test --if-present`,
      prTitle: 'Fix CI pipeline failure: add missing test script',
      prBranch: 'fix/add-missing-test-script',
    }
  }

  if (diagnosis.category === 'environment') {
    return {
      title: 'Fix missing environment variable in CI workflow',
      confidence: '91%',
      summary:
        'CI Doctor AI generated a recovery patch to inject the required API_KEY secret into the GitHub Actions workflow environment.',
      reasoning: 'The deployment step expects the $API_KEY variable to be present before initiating deployment.',
      categoryType: 'configuration',
      filesChanged: ['.github/workflows/deploy.yml'],
      diff: `--- a/.github/workflows/deploy.yml
+++ b/.github/workflows/deploy.yml
@@ deploy job @@
   deploy:
     runs-on: ubuntu-latest
     needs: test
+    env:
+      API_KEY: \${{ secrets.API_KEY }}

     steps:
       - name: Checkout Code`,
      prTitle: 'Fix CI pipeline failure: add missing API_KEY env secret',
      prBranch: 'fix/add-api-key-env',
    }
  }

  return {
    title: `Fix ${diagnosis.category} issue in CI pipeline`,
    confidence: '75%',
    summary: `CI Doctor AI generated a recovery patch to address the ${diagnosis.category} issue in ${runDetails.name}.`,
    reasoning: diagnosis.recommendation,
    categoryType: diagnosis.category,
    filesChanged: diagnosis.affectedFiles || ['.github/workflows/deploy.yml'],
    diff: `--- a/${diagnosis.affectedFiles?.[0] || '.github/workflows/deploy.yml'}
+++ b/${diagnosis.affectedFiles?.[0] || '.github/workflows/deploy.yml'}
@@ remediation @@
# Issue: ${diagnosis.rootCause}
# Solution: ${diagnosis.recommendation}`,
    prTitle: `Fix CI pipeline failure: ${diagnosis.category} remediation`,
    prBranch: `fix/ci-${diagnosis.category}-recovery`,
  }
}
