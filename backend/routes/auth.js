import { Router } from 'express'
import {
  getOAuthUrl,
  exchangeCodeForToken,
  getUserProfile,
  createSession,
  destroySession,
  getCurrentUser,
} from '../services/auth.js'

const router = Router()

/**
 * GET /api/auth/me
 * Returns currently authenticated user or dev-mode profile
 */
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization
    const sessionId = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

    const userState = await getCurrentUser(sessionId)
    res.json(userState)
  } catch (error) {
    console.error('Error fetching current user:', error.message)
    res.status(500).json({ error: 'Failed to retrieve user profile' })
  }
})

/**
 * GET /api/auth/login
 * Starts GitHub OAuth flow
 */
router.get('/login', (req, res) => {
  const host = req.get('host')
  const protocol = req.protocol
  const redirectUri = process.env.GITHUB_CALLBACK_URL || `${protocol}://${host}/api/auth/callback`

  const oauthUrl = getOAuthUrl(redirectUri)

  if (!oauthUrl) {
    return res.status(400).json({
      error: 'OAuth not configured',
      message: 'Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in backend/.env to enable GitHub OAuth login.',
      mode: 'pat',
    })
  }

  // If request accepts json, return url; otherwise redirect
  if (req.headers.accept?.includes('application/json')) {
    return res.json({ url: oauthUrl })
  }

  res.redirect(oauthUrl)
})

/**
 * GET /api/auth/callback
 * GitHub OAuth callback handler
 */
router.get('/callback', async (req, res) => {
  const { code } = req.query
  if (!code) {
    return res.status(400).send('Missing OAuth code')
  }

  const host = req.get('host')
  const protocol = req.protocol
  const redirectUri = process.env.GITHUB_CALLBACK_URL || `${protocol}://${host}/api/auth/callback`

  try {
    const token = await exchangeCodeForToken(code, redirectUri)
    const profile = await getUserProfile(token)
    const sessionId = createSession(profile, token)

    // Redirect to frontend with token
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
    res.redirect(`${frontendUrl}?session=${sessionId}`)
  } catch (error) {
    console.error('OAuth Callback Error:', error.message)
    res.status(500).send(`Authentication failed: ${error.message}`)
  }
})

/**
 * POST /api/auth/token
 * Manual token login for developers
 */
router.post('/token', async (req, res) => {
  try {
    const { token } = req.body
    if (!token) {
      return res.status(400).json({ error: 'Token is required' })
    }

    const profile = await getUserProfile(token)
    const sessionId = createSession(profile, token)

    res.json({
      authenticated: true,
      user: profile,
      token: sessionId,
      mode: 'token',
    })
  } catch (error) {
    console.error('Manual token auth error:', error.message)
    res.status(400).json({ error: 'Invalid GitHub token: ' + error.message })
  }
})

/**
 * POST /api/auth/logout
 * Log out and clear session
 */
router.post('/logout', (req, res) => {
  const authHeader = req.headers.authorization
  const sessionId = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (sessionId) {
    destroySession(sessionId)
  }

  res.json({ success: true, message: 'Logged out successfully' })
})

export default router
