import { createClient } from '@supabase/supabase-js';

// Use import.meta.env for client-side environment variables
// Fallback to placeholder if not defined, but warn clearly
const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.SUPABASE_ANON_KEY;

const isConfigured = supabaseUrl && supabaseUrl.includes('supabase.co') && supabaseAnonKey && supabaseAnonKey !== 'placeholder';

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);

// Helpful log to diagnose connection issues
if (!isConfigured) {
  console.warn('Warunk Digital: Supabase is not fully configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Secrets.');
}
