import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import apiRoutes from './routes/api.js'
import authRoutes from './routes/auth.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN
    ? [...process.env.CORS_ORIGIN.split(','), 'http://localhost:5173', 'http://localhost:3000']
    : '*',
  methods: ['GET', 'POST'],
}))
app.use(express.json())

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} | ${req.method} ${req.path}`)
  next()
})

// Auth and API Routes
app.use('/api/auth', authRoutes)
app.use('/api', apiRoutes)

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'CI Doctor AI',
    description: 'AI-powered CI/CD pipeline debugger',
    version: '1.0.0',
    endpoints: {
      authMe: '/api/auth/me',
      authLogin: '/api/auth/login',
      health: '/api/health',
      repos: '/api/repos',
      dashboard: '/api/dashboard',
      pipelines: '/api/pipelines',
      failure: '/api/pipelines/:id/failure',
      diagnose: '/api/pipelines/:id/diagnose (POST)',
      fix: '/api/pipelines/:id/fix (POST)',
      applyFix: '/api/fixes/apply (POST)',
    },
  })
})

// Error handling
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  })
})

// Start server only when executed directly, not when imported by test suites
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
let server = null
if (isMain) {
  server = app.listen(PORT, () => {
    console.log('')
    console.log('=============================================')
    console.log('   CI Doctor AI Backend')
    console.log('   -----------------------------------------')
    console.log(`   Server:    http://localhost:${PORT}`)
    console.log(`   Health:    http://localhost:${PORT}/api/health`)
    console.log(`   Dashboard: http://localhost:${PORT}/api/dashboard`)
    console.log('   -----------------------------------------')
    console.log(`   GitHub:    ${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}`)
    console.log(`   AI:        Gemini ${process.env.GEMINI_API_KEY ? '[CONFIGURED]' : '[MISSING KEY]'}`)
    console.log(`   GitHub:    ${process.env.GITHUB_TOKEN ? '[CONFIGURED]' : '[MISSING TOKEN]'}`)
    console.log('=============================================')
    console.log('')
  })
}

export { app, server }
export default app
