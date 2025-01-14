import {createClient} from "@supabase/supabase-js"
const supabaseUrl = process.env.SUPABASE_URL as string
const anonKey = process.env.SUPABASE_ANON as string
const supabase = createClient(supabaseUrl, anonKey,)

export default supabase