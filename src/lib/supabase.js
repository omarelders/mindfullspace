import { createClient } from '@supabase/supabase-js'

const rawUrl = typeof import.meta !== 'undefined' && import.meta.env
  ? import.meta.env.VITE_SUPABASE_URL
  : undefined

const rawKey = typeof import.meta !== 'undefined' && import.meta.env
  ? import.meta.env.VITE_SUPABASE_ANON_KEY
  : undefined

const supabaseUrl = typeof rawUrl === 'string' ? rawUrl.trim() : undefined
const supabaseAnonKey = typeof rawKey === 'string' ? rawKey.replace(/\s+/g, '') : undefined

export const isSupabaseConfigured = () => Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storageKey: 'mindfulspace-auth',
      },
    })
  : null
