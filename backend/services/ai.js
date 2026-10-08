import { GoogleGenerativeAI } from '@google/generative-ai'
import dotenv from 'dotenv'

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
export async function diagnosePipeline(runDetails, logs, fileContext = null) {
  const prompt = `You are CI Doctor AI, an enterprise-grade CI/CD pipeline debugger and reliability engineer. Analyze the following failed GitHub Actions workflow run and provide an exact, technical diagnosis.

## Workflow Run Info
- Workflow: ${runDetails.name}
- Branch: ${runDetails.branch}
- Commit: ${runDetails.commit} - ${runDetails.commitMessage}
- Author: ${runDetails.author}
- Duration: ${runDetails.duration}
- Stages: ${JSON.stringify(runDetails.stages)}

## Error Logs
${logs}

${fileContext ? `## Grounded Repository Context\n${JSON.stringify(fileContext, null, 2)}` : ''}

## Instructions
Analyze the failure and respond with ONLY this JSON structure:
{
  "rootCause": "A clear, concise explanation of why the pipeline failed (1-2 sentences)",
  "confidence": "A percentage like 92% indicating confidence",
  "severityScore": "One of: P0 - Critical, P1 - High, P2 - Moderate, P3 - Low",
  "affectedFiles": ["list", "of", "likely", "affected", "files"],
  "riskLevel": "Low or Medium or High or Critical",
  "recommendation": "A specific, actionable recommendation to fix this issue (1-2 sentences)",
  "category": "One of: dependency, configuration, test_failure, build_error, deployment, permission, environment, syntax, timeout, unknown"
}

Be specific and technical. Reference exact file names, missing variables, and commands.`

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
      }
    } catch (error) {
      console.error('AI diagnosis error (falling back to pattern matcher):', error.message)
    }
  }

  // Fallback pattern matching
  return generateFallbackDiagnosis(runDetails, logs)
}

/**
 * Generate a fix/patch for a diagnosed pipeline failure
 */
export async function generateFix(runDetails, logs, diagnosis, fileContext = null) {
  const prompt = `You are CI Doctor AI, an expert CI/CD pipeline debugger. Based on the diagnosis below, generate an automated recovery patch.

## Workflow Run Info
- Workflow: ${runDetails.name}
- Branch: ${runDetails.branch}
- Commit: ${runDetails.commit} - ${runDetails.commitMessage}
- Author: ${runDetails.author}

## Error Logs
${logs}

## Diagnosis
- Root Cause: ${diagnosis.rootCause}
- Confidence: ${diagnosis.confidence}
- Severity: ${diagnosis.severityScore || 'P1 - High'}
- Affected Files: ${diagnosis.affectedFiles.join(', ')}
- Risk Level: ${diagnosis.riskLevel}
- Category: ${diagnosis.category}
- Recommendation: ${diagnosis.recommendation}

${fileContext ? `## Grounded Repository Context\n${JSON.stringify(fileContext, null, 2)}` : ''}

## Instructions
Generate a fix and respond with ONLY this JSON structure:
{
  "title": "Short title for the recovery patch (e.g., 'Fix missing API_KEY in CI workflow')",
  "confidence": "A percentage like 93% indicating confidence",
  "summary": "A 1-2 sentence summary starting with 'CI Doctor AI generated a recovery patch to...'",
  "reasoning": "A concise explanation of why this patch fixes the root cause",
  "categoryType": "dependency, configuration, or code_fix",
  "filesChanged": ["list", "of", "files", "that", "need", "changes"],
  "diff": "A unified diff showing the exact changes needed. Use + for additions, - for removals. Keep it concise but complete.",
  "prTitle": "A descriptive PR title like 'Fix CI pipeline failure caused by missing API_KEY'",
  "prBranch": "A clean branch name like 'fix/ci-api-key-recovery'"
}

Be specific. Show actual code changes in the diff.`

  if (model) {
    try {
      const result = await retryWithBackoff(async () => {
        return await model.generateContent(prompt)
      })
      const text = result.response.text()
      const fix = JSON.parse(text)

      return {
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

  // Fallback fix generation
  return generateFallbackFix(runDetails, logs, diagnosis)
}

/**
 * Fallback diagnosis using pattern matching when Gemini API is unavailable
 */
function generateFallbackDiagnosis(runDetails, logs) {
  const logText = (logs || '').toLowerCase()

  if (logText.includes('missing script') && logText.includes('test')) {
    return {
      rootCause:
        'The pipeline failed because the "test" script is missing from package.json. The workflow attempts to execute "npm test" but no test script is defined in package.json.',
      confidence: '96%',
      severityScore: 'P1 - High',
      affectedFiles: ['package.json', '.github/workflows/deploy.yml'],
      riskLevel: 'Medium',
      recommendation:
        'Add a "test" script to package.json, or configure "npm test --if-present" in the deploy workflow.',
      category: 'configuration',
    }
  }

  if (logText.includes('api_key') || logText.includes('api key')) {
    return {
      rootCause:
        'The pipeline failed because the required API_KEY environment secret is not configured in the GitHub Actions runner environment.',
      confidence: '95%',
      severityScore: 'P0 - Critical',
      affectedFiles: ['.github/workflows/deploy.yml'],
      riskLevel: 'High',
      recommendation:
        'Add API_KEY to repository GitHub Actions Secrets and map it as an environment variable in the workflow YAML.',
      category: 'environment',
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
    }
  }

  if (logText.includes('timeout') || logText.includes('timed out')) {
    return {
      rootCause:
        'The pipeline step exceeded the allotted execution timeout threshold.',
      confidence: '82%',
      severityScore: 'P1 - High',
      affectedFiles: ['.github/workflows/deploy.yml'],
      riskLevel: 'Medium',
      recommendation:
        'Review long-running async steps or increase the step timeout-minutes setting in the workflow.',
      category: 'timeout',
    }
  }

  if (logText.includes('permission denied') || logText.includes('403')) {
    return {
      rootCause:
        'The pipeline failed due to insufficient permissions for the GITHUB_TOKEN on the runner.',
      confidence: '89%',
      severityScore: 'P0 - Critical',
      affectedFiles: ['.github/workflows/deploy.yml'],
      riskLevel: 'High',
      recommendation:
        'Adjust the "permissions" block in your workflow file to grant appropriate read/write scopes.',
      category: 'permission',
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
  }
}

/**
 * Fallback fix generation when Gemini API is unavailable
 */
function generateFallbackFix(runDetails, logs, diagnosis) {
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
@@ scripts
   "dev": "vite",
   "build": "vite build",
   "lint": "eslint .",
-  "preview": "vite preview"
+  "preview": "vite preview",
+  "test": "echo \\"No tests configured\\" && exit 0"

--- a/.github/workflows/deploy.yml
+++ b/.github/workflows/deploy.yml
@@ test step
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
@@ deploy job
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
    diff: `# Recommended Patch:
# Issue: ${diagnosis.rootCause}
# Solution: ${diagnosis.recommendation}`,
    prTitle: `Fix CI pipeline failure: ${diagnosis.category} remediation`,
    prBranch: `fix/ci-${diagnosis.category}-recovery`,
  }
}
