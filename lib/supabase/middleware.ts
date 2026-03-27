import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isSupabaseConfigured, requireSupabaseConfig } from './config'

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    try {
        const pathname = request.nextUrl.pathname
        const isPublicInternalEndpoint = pathname === '/api/analytics/consolidate/batch'

        if (isPublicInternalEndpoint) {
            return supabaseResponse
        }

        if (!isSupabaseConfigured()) {
            return supabaseResponse
        }

        const { url, anonKey } = requireSupabaseConfig()

        const supabase = createServerClient(
            url,
            anonKey,
            {
                cookies: {
                    getAll() {
                        return request.cookies.getAll()
                    },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                        supabaseResponse = NextResponse.next({
                            request,
                        })
                        cookiesToSet.forEach(({ name, value, options }) =>
                            supabaseResponse.cookies.set(name, value, options)
                        )
                    },
                },
            }
        )

        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (
            !user &&
            !pathname.startsWith('/login') &&
            !pathname.startsWith('/auth') &&
            !pathname.startsWith('/sw.js')
        ) {
            const url = request.nextUrl.clone()
            url.pathname = '/login'
            return NextResponse.redirect(url)
        }

        if (user && pathname.startsWith('/login')) {
            const url = request.nextUrl.clone()
            url.pathname = '/'
            return NextResponse.redirect(url)
        }

        return supabaseResponse
    } catch (e) {
        // If there's an error initializing the client (e.g., missing env vars on Vercel)
        // gracefully fail and redirect to login, rather than throwing a 500.
        console.error("Middleware Supabase Error:", e)
        if (!request.nextUrl.pathname.startsWith('/login')) {
            const url = request.nextUrl.clone()
            url.pathname = '/login'
            return NextResponse.redirect(url)
        }
        return NextResponse.next({ request });
    }
}
