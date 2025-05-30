// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js';
console.log('[supabaseClient] Initializing Supabase client...');

// If using .env files (VITE example):
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  const errorMessage = "[supabaseClient] CRITICAL ERROR: Supabase URL or Anon Key is missing. Ensure they are set (e.g., in .env file with VITE_ prefix for Vite, or hardcoded).";
  console.error(errorMessage);
  // It's often better to throw an error to stop the app if the client can't be created.
  // However, for debugging, we'll let it proceed so we can see if `supabase` is null later.
  // throw new Error(errorMessage);
} else {
  console.log('[supabaseClient] Supabase URL and Anon Key seem to be present.');
}

// Create and export the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

if (supabase) {
  console.log('[supabaseClient] Supabase client created successfully.');
  // You can even log a part of the client to see if it looks right, e.g., supabase.auth
  // console.log('[supabaseClient] supabase.auth object:', supabase.auth);
} else {
  console.error('[supabaseClient] CRITICAL ERROR: Supabase client creation failed or resulted in null/undefined.');
}