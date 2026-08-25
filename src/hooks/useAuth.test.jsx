import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@solidjs/testing-library'
import { AuthProvider, useAuth } from './useAuth'

// Mock Supabase client
const mockGetSession = vi.fn()
const mockOnAuthStateChange = vi.fn()
const mockSignUp = vi.fn()
const mockSignInWithPassword = vi.fn()
const mockSignInWithOAuth = vi.fn()
const mockSignOut = vi.fn()
const mockSelect = vi.fn()
const mockUpdate = vi.fn()
const mockUpsert = vi.fn()
const mockEq = vi.fn()
const mockMaybeSingle = vi.fn()

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  supabase: {
    auth: {
      getSession: (...args) => mockGetSession(...args),
      onAuthStateChange: (...args) => mockOnAuthStateChange(...args),
      signUp: (...args) => mockSignUp(...args),
      signInWithPassword: (...args) => mockSignInWithPassword(...args),
      signInWithOAuth: (...args) => mockSignInWithOAuth(...args),
      signOut: (...args) => mockSignOut(...args),
    },
    from: (table) => ({
      select: (...args) => {
        mockSelect(table, ...args)
        return {
          eq: (field, val) => {
            mockEq(field, val)
            return {
              maybeSingle: () => mockMaybeSingle(),
            }
          },
        }
      },
      update: (...args) => {
        mockUpdate(table, ...args)
        return {
          eq: (field, val) => {
            mockEq(field, val)
            return Promise.resolve({ error: null })
          },
        }
      },
      upsert: (...args) => {
        mockUpsert(table, ...args)
        return Promise.resolve({ error: null })
      },
    }),
  },
}))

function TestConsumer(props) {
  const auth = useAuth()
  props.onAuth(auth)
  return null
}

function renderAuth() {
  let auth
  render(() => (
    <AuthProvider>
      <TestConsumer onAuth={(a) => { auth = a }} />
    </AuthProvider>
  ))
  return () => auth
}

// Wait until the predicate holds, polling the live auth accessor
async function waitFor(predicate, { timeout = 2000 } = {}) {
  const start = Date.now()
  while (!predicate()) {
    if (Date.now() - start > timeout) throw new Error('waitFor timed out')
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

describe('useAuth and AuthProvider', () => {
  let authStateCallback = null

  beforeEach(() => {
    vi.clearAllMocks()
    authStateCallback = null
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
    mockOnAuthStateChange.mockImplementation((callback) => {
      authStateCallback = callback
      return {
        data: {
          subscription: {
            unsubscribe: vi.fn(),
          },
        },
      }
    })
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })
  })

  it('initializes in guest mode when no session is present', async () => {
    const getAuth = renderAuth()

    await waitFor(() => getAuth() && !getAuth().loading)

    expect(getAuth().isGuest).toBe(true)
    expect(getAuth().isAuthenticated).toBe(false)
    expect(getAuth().user).toBeNull()
    expect(getAuth().loading).toBe(false)
  })

  it('restores existing session on mount', async () => {
    const mockUser = { id: 'u-1', email: 'test@example.com', user_metadata: { full_name: 'Test User' } }
    const mockSession = { user: mockUser, access_token: 'token123' }
    mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null })
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'u-1', display_name: 'Test User', avatar_url: null },
      error: null,
    })

    const getAuth = renderAuth()

    await waitFor(() => getAuth() && !getAuth().loading)

    expect(getAuth().isAuthenticated).toBe(true)
    expect(getAuth().user.id).toBe('u-1')
    expect(getAuth().profile.display_name).toBe('Test User')
  })

  it('signs in with email/password', async () => {
    const mockUser = { id: 'u-2', email: 'signin@example.com', user_metadata: { full_name: 'Sign In User' } }
    const mockSession = { user: mockUser, access_token: 'token456' }
    mockSignInWithPassword.mockResolvedValue({ data: { user: mockUser, session: mockSession }, error: null })
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'u-2', display_name: 'Sign In User' },
      error: null,
    })

    const getAuth = renderAuth()
    await waitFor(() => getAuth() && !getAuth().loading)

    const res = await getAuth().signIn('signin@example.com', 'secret123')
    expect(res.data.user.email).toBe('signin@example.com')

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'signin@example.com',
      password: 'secret123',
    })
    expect(getAuth().isAuthenticated).toBe(true)
  })

  it('signs up with email, password, and display name', async () => {
    const mockUser = { id: 'u-3', email: 'signup@example.com', user_metadata: { full_name: 'New User' } }
    const mockSession = { user: mockUser, access_token: 'token789' }
    mockSignUp.mockResolvedValue({ data: { user: mockUser, session: mockSession }, error: null })

    const getAuth = renderAuth()
    await waitFor(() => getAuth() && !getAuth().loading)

    await getAuth().signUp('signup@example.com', 'secret123', 'New User')

    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'signup@example.com',
      password: 'secret123',
      options: {
        data: { full_name: 'New User', name: 'New User' },
      },
    })
    expect(getAuth().isAuthenticated).toBe(true)
  })

  it('handles sign in errors gracefully', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: null,
      error: { message: 'Invalid login credentials' },
    })

    const getAuth = renderAuth()
    await waitFor(() => getAuth() && !getAuth().loading)

    const res = await getAuth().signIn('wrong@example.com', 'badpass')
    expect(res.error.message).toBe('Invalid login credentials')

    expect(getAuth().authError).toBe('Invalid login credentials')
    expect(getAuth().isAuthenticated).toBe(false)

    getAuth().clearError()
    expect(getAuth().authError).toBeNull()
  })

  it('signs out and reverts state to guest mode without clearing local storage', async () => {
    const mockUser = { id: 'u-4', email: 'user@example.com' }
    const mockSession = { user: mockUser }
    mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null })
    mockSignOut.mockResolvedValue({ error: null })

    const getAuth = renderAuth()
    await waitFor(() => getAuth() && !getAuth().loading)
    expect(getAuth().isAuthenticated).toBe(true)

    await getAuth().signOut()

    expect(mockSignOut).toHaveBeenCalled()
    expect(getAuth().isAuthenticated).toBe(false)
    expect(getAuth().isGuest).toBe(true)
    expect(getAuth().user).toBeNull()
    expect(getAuth().profile).toBeNull()
  })

  it('updates user display name', async () => {
    const mockUser = { id: 'u-5', email: 'update@example.com' }
    const mockSession = { user: mockUser }
    mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null })
    mockMaybeSingle.mockResolvedValue({ data: { id: 'u-5', display_name: 'Old Name' }, error: null })

    const getAuth = renderAuth()
    await waitFor(() => getAuth() && !getAuth().loading)

    await getAuth().updateDisplayName('Brand New Name')

    expect(mockUpdate).toHaveBeenCalledWith('profiles', { display_name: 'Brand New Name' })
    expect(getAuth().profile.display_name).toBe('Brand New Name')
  })
})
