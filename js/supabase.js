// Supabase client + auth. The anon key is public by design; data access
// is enforced server-side by RLS (only the couple's emails can read/write).
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

export const SB_URL = 'https://nvhbuejvuinumxoaagqh.supabase.co'
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52aGJ1ZWp2dWludW14b2FhZ3FoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3Mzg5NjMsImV4cCI6MjA5OTMxNDk2M30.u_TshYtl51B7f8silMCEkFtmFjmUL2B0OZ-9ErzdTTI'

export const ALLOWED = {
  'hansmbrito@gmail.com': 'Hans',
  'biadamatopsi@gmail.com': 'Bia',
}

export const sb = createClient(SB_URL, SB_KEY)

export const signInGoogle = () =>
  sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin } })

export const signInEmail = (email) =>
  sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin } })

export const signOut = () => sb.auth.signOut()
