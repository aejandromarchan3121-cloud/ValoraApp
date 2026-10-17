import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl) {
  console.error("⚠️ ALERTA: VITE_SUPABASE_URL no está definida");
}

export const supabase = createClient(
  supabaseUrl || '', 
  supabaseAnonKey || ''
)