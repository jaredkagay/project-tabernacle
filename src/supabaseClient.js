// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://olpsqjeqspqwknowmiux.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9scHNxamVxc3Bxd2tub3dtaXV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg1NzQ4MDIsImV4cCI6MjA2NDE1MDgwMn0.vwsVQSEMi5RhCuriJu6Vb9MiMg617zisyE1Qfm4Ez-E'

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase URL and Anon Key are required. Did you forget to update them in supabaseClient.js?");
}

export const supabase = createClient(supabaseUrl, supabaseKey);