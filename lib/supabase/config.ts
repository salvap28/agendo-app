export const SUPABASE_SETUP_HINT =
    "Add real NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY values to .env.local."

export const SUPABASE_SETUP_ERROR = `Supabase is not configured. ${SUPABASE_SETUP_HINT}`

type SupabaseConfig = {
    url: string
    anonKey: string
}

function isPlaceholderValue(value: string | undefined) {
    if (!value) return true

    const normalized = value.trim().toLowerCase()

    return (
        normalized.length === 0
        || normalized.startsWith("your-")
        || normalized.includes("placeholder")
        || normalized === "changeme"
    )
}

export function getSupabaseConfig(): SupabaseConfig | null {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

    if (!url || isPlaceholderValue(url) || !anonKey || isPlaceholderValue(anonKey)) {
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

export function hasValidSupabaseServiceRoleKey() {
    return !isPlaceholderValue(process.env.SUPABASE_SERVICE_ROLE_KEY)
}
