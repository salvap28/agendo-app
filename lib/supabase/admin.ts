import { createClient } from "@supabase/supabase-js";
import { hasValidSupabaseServiceRoleKey, requireSupabaseConfig } from "./config";

export function createAdminClient() {
    const { url: supabaseUrl } = requireSupabaseConfig();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!hasValidSupabaseServiceRoleKey() || !serviceRoleKey) {
        throw new Error("Supabase admin is not configured. Add a real SUPABASE_SERVICE_ROLE_KEY to .env.local.");
    }

    return createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}
