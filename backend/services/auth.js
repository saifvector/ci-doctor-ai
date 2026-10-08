import dotenv from 'dotenv'
import { Octokit } from 'octokit'

dotenv.config()

// In-memory sessions store
const sessions = new Map()

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || ''
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || ''

/**
 * Generate GitHub OAuth authorization URL
 */
export function getOAuthUrl(redirectUri) {
  if (!GITHUB_CLIENT_ID) {
    return null
  }

  const rootUrl = 'https://github.com/login/oauth/authorize'
  const options = {
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: 'repo,read:user,user:email',
    state: Math.random().toString(36).substring(7),
  }

  const qs = new URLSearchParams(options)
  return `${rootUrl}?${qs.toString()}`
}

/**
 * Exchange OAuth authorization code for access token
 */
export async function exchangeCodeForToken(code, redirectUri) {
  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    throw new Error('GitHub OAuth is not configured in backend .env (missing GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET).')
  }

  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    }),
  })

  const data = await response.json()
  if (data.error) {
    throw new Error(`GitHub OAuth error: ${data.error_description || data.error}`)
  }

  return data.access_token
}

/**
 * Fetch GitHub user profile using access token or unauthenticated owner lookup
 */
export async function getUserProfile(token) {
  if (token) {
    try {
      const octokit = new Octokit({ auth: token })
      const { data } = await octokit.rest.users.getAuthenticated()
      return {
        login: data.login,
        name: data.name || data.login,
        avatar_url: data.avatar_url,
        html_url: data.html_url,
        email: data.email || null,
        mode: 'oauth',
      }
    } catch (err) {
      console.warn('Failed to fetch authenticated user with token:', err.message)
    }
  }

  // Fallback: Check GITHUB_TOKEN or GITHUB_OWNER
  const fallbackOwner = process.env.GITHUB_OWNER || 'techenthusiasticindia'
  try {
    const unauthed = new Octokit()
    const { data } = await unauthed.rest.users.getByUsername({ username: fallbackOwner })
    return {
      login: data.login,
      name: data.name || data.login,
      avatar_url: data.avatar_url,
      html_url: data.html_url,
      email: null,
      mode: 'pat',
    }
  } catch (err) {
    return {
      login: fallbackOwner,
      name: fallbackOwner,
      avatar_url: 'https://github.com/identicons/app.png',
      html_url: `https://github.com/${fallbackOwner}`,
      email: null,
      mode: 'pat',
    }
  }
}

/**
 * Create or register a session
 */
export function createSession(user, token = null) {
  const sessionId = 'session_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
  sessions.set(sessionId, {
    user,
    token,
    createdAt: new Date().toISOString(),
  })
  return sessionId
}

/**
 * Get active session
 */
export function getSession(sessionId) {
  if (!sessionId) return null
  return sessions.get(sessionId) || null
}

/**
 * Delete session (logout)
 */
export function destroySession(sessionId) {
  if (!sessionId) return false
  return sessions.delete(sessionId)
}

/**
 * Get current user: checks session token first, falls back to server default
 */
export async function getCurrentUser(sessionId) {
  const session = getSession(sessionId)
  if (session && session.user) {
    return {
      authenticated: true,
      user: session.user,
      mode: session.user.mode || 'oauth',
      hasWriteAccess: !!session.token,
    }
  }

  // Default dev / PAT mode user
  const profile = await getUserProfile(process.env.GITHUB_TOKEN)
  return {
    authenticated: true,
    user: profile,
    mode: 'pat',
    hasWriteAccess: !!process.env.GITHUB_TOKEN,
  }
}
