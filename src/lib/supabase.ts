import { createClient } from '@supabase/supabase-js';

// Use import.meta.env for client-side environment variables
// Fallback to placeholder if not defined, but warn clearly
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || (typeof process !== 'undefined' ? process.env.SUPABASE_URL : null);
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || (typeof process !== 'undefined' ? process.env.SUPABASE_ANON_KEY : null);

const isConfigured = supabaseUrl && supabaseUrl.includes('supabase.co') && supabaseAnonKey && supabaseAnonKey !== 'placeholder';

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);

// Helpful log to diagnose connection issues
if (!isConfigured) {
  console.warn('Warunk Digital: Supabase is not fully configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY in Secrets.');
}
