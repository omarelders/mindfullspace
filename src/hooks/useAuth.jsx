import { createContext, useContext, createSignal, onMount, onCleanup } from 'solid-js'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const AuthContext = createContext()

export function AuthProvider(props) {
  const [user, setUser] = createSignal(null)
  const [profile, setProfile] = createSignal(null)
  const [session, setSession] = createSignal(null)
  const [loading, setLoading] = createSignal(true)
  const [authError, setAuthError] = createSignal(null)

  async function fetchProfile(userId, fallbackUser = null) {
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
  }

  async function signUp(email, password, displayName) {
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
    if (data?.session && data?.user) {
      setUser(data.user)
      setSession(data.session)
      await fetchProfile(data.user.id, data.user)
    }
    return { data }
  }

  async function signIn(email, password) {
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
  }

  async function signInWithOAuth(provider) {
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
  }

  async function signOut() {
    if (!supabase) return
    setAuthError(null)
    const { error } = await supabase.auth.signOut()
    if (error) {
      setAuthError(error.message)
    }
    setUser(null)
    setSession(null)
    setProfile(null)
  }

  async function updateDisplayName(newName) {
    const currentUser = user()
    if (!supabase || !currentUser) return
    const trimmed = newName?.trim()
    if (!trimmed) return

    setProfile((prev) => (prev ? { ...prev, display_name: trimmed } : null))
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: trimmed })
      .eq('id', currentUser.id)

    if (error) {
      setAuthError(error.message)
    }
  }

  function clearError() {
    setAuthError(null)
  }

  onMount(() => {
    if (!isSupabaseConfigured() || !supabase) {
      setLoading(false)
      return
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

    onCleanup(() => {
      isMounted = false
      subscription?.unsubscribe()
    })
  })

  const isAuthed = () => Boolean(user() && session())

  const contextValue = {
    get user() { return isAuthed() ? user() : null },
    get profile() { return isAuthed() ? profile() : null },
    get session() { return session() },
    get loading() { return loading() },
    get authError() { return authError() },
    get isGuest() { return !isAuthed() },
    get isAuthenticated() { return isAuthed() },
    get isConfigured() { return isSupabaseConfigured() },
    signUp,
    signIn,
    signInWithOAuth,
    signOut,
    updateDisplayName,
    clearError,
    fetchProfile,
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {props.children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
