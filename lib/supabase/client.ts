import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { getSupabaseConfig, requireSupabaseConfig } from './config'

export function createClient() {
    const { url, anonKey } = requireSupabaseConfig()

    return createBrowserClient(url, anonKey)
}

export function tryCreateClient() {
    const config = getSupabaseConfig()

    if (!config) {
        return null
    }

    return createBrowserClient(config.url, config.anonKey)
}

export async function getClientUser(supabase: SupabaseClient | null = tryCreateClient()): Promise<User | null> {
    if (!supabase) {
        return null
    }

    try {
        const { data: { session } } = await supabase.auth.getSession()
        return session?.user ?? null
    } catch {
        return null
    }
}
