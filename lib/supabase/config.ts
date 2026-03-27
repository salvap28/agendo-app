export const SUPABASE_SETUP_HINT =
    "Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local."

export const SUPABASE_SETUP_ERROR = `Supabase is not configured. ${SUPABASE_SETUP_HINT}`

type SupabaseConfig = {
    url: string
    anonKey: string
}

export function getSupabaseConfig(): SupabaseConfig | null {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

    if (!url || !anonKey) {
        return null
    }

    return { url, anonKey }
}

export function isSupabaseConfigured() {
    return getSupabaseConfig() !== null
}

export function requireSupabaseConfig(): SupabaseConfig {
    const config = getSupabaseConfig()

    if (!config) {
        throw new Error(SUPABASE_SETUP_ERROR)
    }

    return config
}
