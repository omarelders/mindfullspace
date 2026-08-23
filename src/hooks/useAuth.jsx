import { useState, useEffect, useCallback, createContext, useContext, useMemo, createElement } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(null)

  const fetchProfile = useCallback(async (userId, fallbackUser = null) => {
    if (!supabase || !userId) return null

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (!error && data) {
        setProfile(data)
        return data
      }

      // If profile record doesn't exist yet (e.g. trigger latency), provide fallback profile
      const defaultName =
        fallbackUser?.user_metadata?.full_name ||
        fallbackUser?.user_metadata?.name ||
        fallbackUser?.email?.split('@')[0] ||
        'Mindful User'

      const defaultAvatar =
        fallbackUser?.user_metadata?.avatar_url ||
        fallbackUser?.user_metadata?.picture ||
        null

      const fallbackProfile = {
        id: userId,
        display_name: defaultName,
        avatar_url: defaultAvatar,
      }

      setProfile(fallbackProfile)

      // Best-effort auto-create profile if missing
      supabase
        .from('profiles')
        .upsert(fallbackProfile, { onConflict: 'id' })
        .then(() => {})
        .catch(() => {})

      return fallbackProfile
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) {
      setLoading(false)
      return undefined
    }

    let isMounted = true

    // Initial session retrieval
    supabase.auth.getSession().then(({ data: { session: currentSession }, error }) => {
      if (!isMounted) return
      if (error) {
        setAuthError(error.message)
      }
      setSession(currentSession)
      setUser(currentSession?.user ?? null)
      if (currentSession?.user) {
        fetchProfile(currentSession.user.id, currentSession.user)
      }
      setLoading(false)
    }).catch(() => {
      if (isMounted) setLoading(false)
    })

    // Auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!isMounted) return
        setSession(newSession)
        setUser(newSession?.user ?? null)

        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED') && newSession?.user) {
          await fetchProfile(newSession.user.id, newSession.user)
        } else if (event === 'SIGNED_OUT') {
          setProfile(null)
          setAuthError(null)
        }
        setLoading(false)
      }
    )

    return () => {
      isMounted = false
      subscription?.unsubscribe()
    }
  }, [fetchProfile])

  const signUp = useCallback(async (email, password, displayName) => {
    if (!supabase) {
      return { error: { message: 'Supabase is not configured.' } }
    }
    setAuthError(null)
    const name = displayName?.trim() || email.split('@')[0]
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name, name },
      },
    })
    if (error) {
      setAuthError(error.message)
      return { error }
    }
    if (data?.user) {
      setUser(data.user)
      setSession(data.session)
      await fetchProfile(data.user.id, data.user)
    }
    return { data }
  }, [fetchProfile])

  const signIn = useCallback(async (email, password) => {
    if (!supabase) {
      return { error: { message: 'Supabase is not configured.' } }
    }
    setAuthError(null)
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) {
      setAuthError(error.message)
      return { error }
    }
    if (data?.user) {
      setUser(data.user)
      setSession(data.session)
      await fetchProfile(data.user.id, data.user)
    }
    return { data }
  }, [fetchProfile])

  const signInWithOAuth = useCallback(async (provider) => {
    if (!supabase) {
      return { error: { message: 'Supabase is not configured.' } }
    }
    setAuthError(null)
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      },
    })
    if (error) {
      setAuthError(error.message)
      return { error }
    }
    return { data }
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return
    setAuthError(null)
    const { error } = await supabase.auth.signOut()
    if (error) {
      setAuthError(error.message)
    }
    setUser(null)
    setSession(null)
    setProfile(null)
  }, [])

  const updateDisplayName = useCallback(async (newName) => {
    if (!supabase || !user) return
    const trimmed = newName?.trim()
    if (!trimmed) return

    setProfile((prev) => (prev ? { ...prev, display_name: trimmed } : null))
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: trimmed })
      .eq('id', user.id)

    if (error) {
      setAuthError(error.message)
    }
  }, [user])

  const clearError = useCallback(() => {
    setAuthError(null)
  }, [])

  const contextValue = useMemo(() => ({
    user,
    profile,
    session,
    loading,
    authError,
    isGuest: !user,
    isAuthenticated: Boolean(user),
    isConfigured: isSupabaseConfigured(),
    signUp,
    signIn,
    signInWithOAuth,
    signOut,
    updateDisplayName,
    clearError,
    fetchProfile,
  }), [
    user,
    profile,
    session,
    loading,
    authError,
    signUp,
    signIn,
    signInWithOAuth,
    signOut,
    updateDisplayName,
    clearError,
    fetchProfile,
  ])

  return createElement(AuthContext.Provider, { value: contextValue }, children)
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
