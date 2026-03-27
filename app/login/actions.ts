'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function translateAuthError(message: string) {
    const normalized = message.toLowerCase()

    if (normalized.includes('invalid login credentials')) {
        return 'Email, usuario o contraseña inválidos.'
    }

    if (normalized.includes('email not confirmed')) {
        return 'Confirmá tu email antes de entrar.'
    }

    if (normalized.includes('user already registered')) {
        return 'Ya existe una cuenta con ese email.'
    }

    if (normalized.includes('password should be at least')) {
        return 'La contraseña debe tener al menos 6 caracteres.'
    }

    if (normalized.includes('unable to validate email address')) {
        return 'Ingresá un email válido.'
    }

    return message
}

async function getSignupEmailRedirectUrl() {
    const configuredBaseUrl =
        process.env.NEXT_PUBLIC_APP_URL
        ?? process.env.NEXT_PUBLIC_SITE_URL

    let baseUrl = configuredBaseUrl

    if (!baseUrl) {
        const headerStore = await headers()
        const host = headerStore.get('x-forwarded-host') ?? headerStore.get('host')
        const protocol = headerStore.get('x-forwarded-proto') ?? 'https'

        if (host) {
            baseUrl = `${protocol}://${host}`
        }
    }

    if (!baseUrl) {
        return undefined
    }

    const redirectUrl = new URL('/auth/callback', baseUrl)
    redirectUrl.searchParams.set('next', '/login?verified=1')

    return redirectUrl.toString()
}

export async function login(formData: FormData) {
    const loginId = formData.get('loginId') as string
    const password = formData.get('password') as string

    if (!loginId || !password) {
        return { error: 'Completá tu email o usuario y tu contraseña.' }
    }

    const supabase = await createClient()

    let email = loginId;

    // If it's not an email, assume it's a username and look up the email
    if (!loginId.includes('@')) {
        const { data: fetchedEmail, error: rpcError } = await supabase.rpc('get_email_by_username', {
            p_username: loginId
        });

        if (rpcError || !fetchedEmail) {
            return { error: 'Email, usuario o contraseña inválidos.' }
        }
        email = fetchedEmail;
    }

    const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
    })

    if (error) {
        return { error: translateAuthError(error.message) }
    }

    revalidatePath('/', 'layout')
    redirect('/')
}

export async function signup(formData: FormData) {
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const confirmPassword = formData.get('confirmPassword') as string
    const username = formData.get('username') as string

    if (!email || !password || !username) {
        return { error: 'Completá todos los campos.' }
    }

    if (username.length > 20) {
        return { error: 'El usuario puede tener hasta 20 caracteres.' }
    }

    if (password !== confirmPassword) {
        return { error: 'Las contraseñas no coinciden.' }
    }

    const supabase = await createClient()
    const emailRedirectTo = await getSignupEmailRedirectUrl()

    const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            emailRedirectTo,
            data: { username }
        }
    })

    if (error) {
        return { error: translateAuthError(error.message) }
    }

    return { success: 'Revisa tu correo para confirmar tu cuenta.' }
}

export async function logout() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
}
