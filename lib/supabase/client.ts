import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient, User } from '@supabase/supabase-js'

export function createClient() {
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
}

export async function getClientUser(supabase: SupabaseClient = createClient()): Promise<User | null> {
    try {
        const { data: { session } } = await supabase.auth.getSession()
        return session?.user ?? null
    } catch {
        return null
    }
}
