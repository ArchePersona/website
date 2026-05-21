import { createClient } from 'https://esm.sh/@supabase/supabase-js'

const supabaseUrl = 'https://eaczccnkbgbvtbtuvlbq.supabase.co'

const supabaseKey = 'sb_publishable_saTJuk2RYbKw8_A7Wlnqxg_EFDiv1Hc'

export const supabase = createClient(supabaseUrl, supabaseKey)