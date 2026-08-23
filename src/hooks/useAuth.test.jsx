import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
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

describe('useAuth and AuthProvider', () => {
  let authStateCallback = null

  beforeEach(() => {
    vi.clearAllMocks()
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
    const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>
    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {})

    expect(result.current.isGuest).toBe(true)
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.user).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it('restores existing session on mount', async () => {
    const mockUser = { id: 'u-1', email: 'test@example.com', user_metadata: { full_name: 'Test User' } }
    const mockSession = { user: mockUser, access_token: 'token123' }
    mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null })
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'u-1', display_name: 'Test User', avatar_url: null },
      error: null,
    })

    const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>
    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {})

    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.user.id).toBe('u-1')
    expect(result.current.profile.display_name).toBe('Test User')
  })

  it('signs in with email/password', async () => {
    const mockUser = { id: 'u-2', email: 'signin@example.com', user_metadata: { full_name: 'Sign In User' } }
    const mockSession = { user: mockUser, access_token: 'token456' }
    mockSignInWithPassword.mockResolvedValue({ data: { user: mockUser, session: mockSession }, error: null })
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'u-2', display_name: 'Sign In User' },
      error: null,
    })

    const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>
    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      const res = await result.current.signIn('signin@example.com', 'secret123')
      expect(res.data.user.email).toBe('signin@example.com')
    })

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'signin@example.com',
      password: 'secret123',
    })
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('signs up with email, password, and display name', async () => {
    const mockUser = { id: 'u-3', email: 'signup@example.com', user_metadata: { full_name: 'New User' } }
    const mockSession = { user: mockUser, access_token: 'token789' }
    mockSignUp.mockResolvedValue({ data: { user: mockUser, session: mockSession }, error: null })

    const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>
    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      await result.current.signUp('signup@example.com', 'secret123', 'New User')
    })

    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'signup@example.com',
      password: 'secret123',
      options: {
        data: { full_name: 'New User', name: 'New User' },
      },
    })
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('handles sign in errors gracefully', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: null,
      error: { message: 'Invalid login credentials' },
    })

    const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>
    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      const res = await result.current.signIn('wrong@example.com', 'badpass')
      expect(res.error.message).toBe('Invalid login credentials')
    })

    expect(result.current.authError).toBe('Invalid login credentials')
    expect(result.current.isAuthenticated).toBe(false)

    act(() => {
      result.current.clearError()
    })
    expect(result.current.authError).toBeNull()
  })

  it('signs out and reverts state to guest mode without clearing local storage', async () => {
    const mockUser = { id: 'u-4', email: 'user@example.com' }
    const mockSession = { user: mockUser }
    mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null })
    mockSignOut.mockResolvedValue({ error: null })

    const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>
    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {})
    expect(result.current.isAuthenticated).toBe(true)

    await act(async () => {
      await result.current.signOut()
    })

    expect(mockSignOut).toHaveBeenCalled()
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.isGuest).toBe(true)
    expect(result.current.user).toBeNull()
    expect(result.current.profile).toBeNull()
  })

  it('updates user display name', async () => {
    const mockUser = { id: 'u-5', email: 'update@example.com' }
    const mockSession = { user: mockUser }
    mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null })
    mockMaybeSingle.mockResolvedValue({ data: { id: 'u-5', display_name: 'Old Name' }, error: null })

    const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>
    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {})

    await act(async () => {
      await result.current.updateDisplayName('Brand New Name')
    })

    expect(mockUpdate).toHaveBeenCalledWith('profiles', { display_name: 'Brand New Name' })
    expect(result.current.profile.display_name).toBe('Brand New Name')
  })
})
