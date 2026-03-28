'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMessages, resolveAppLanguage } from '@/lib/i18n/messages'
import { getServerLanguage } from '@/lib/i18n/server'

async function getActionMessages(formData?: FormData) {
    const formLanguage = formData?.get('language');
    const language = typeof formLanguage === 'string'
        ? resolveAppLanguage(formLanguage)
        : await getServerLanguage();

    return getMessages(language);
}

function translateAuthError(message: string, authMessages: ReturnType<typeof getMessages>['auth']) {
    const normalized = message.toLowerCase()

    if (normalized.includes('invalid login credentials')) {
        return authMessages.invalidCredentials
    }

    if (normalized.includes('email not confirmed')) {
        return authMessages.confirmEmail
    }

    if (normalized.includes('user already registered')) {
        return authMessages.userAlreadyRegistered
    }

    if (normalized.includes('password should be at least')) {
        return authMessages.passwordMinLength
    }

    if (normalized.includes('unable to validate email address')) {
        return authMessages.invalidEmail
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
    const t = await getActionMessages(formData)
    const loginId = formData.get('loginId') as string
    const password = formData.get('password') as string

    if (!loginId || !password) {
        return { error: t.auth.completeLoginFields }
    }

    const supabase = await createClient()
    let email = loginId

    if (!loginId.includes('@')) {
        const { data: fetchedEmail, error: rpcError } = await supabase.rpc('get_email_by_username', {
            p_username: loginId
        })

        if (rpcError || !fetchedEmail) {
            return { error: t.auth.invalidCredentials }
        }
        email = fetchedEmail
    }

    const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
    })

    if (error) {
        return { error: translateAuthError(error.message, t.auth) }
    }

    revalidatePath('/', 'layout')
    redirect('/')
}

export async function signup(formData: FormData) {
    const t = await getActionMessages(formData)
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const confirmPassword = formData.get('confirmPassword') as string
    const username = formData.get('username') as string

    if (!email || !password || !username) {
        return { error: t.auth.completeAllFields }
    }

    if (username.length > 20) {
        return { error: t.auth.usernameMaxLength }
    }

    if (password !== confirmPassword) {
        return { error: t.auth.passwordsMismatch }
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
        return { error: translateAuthError(error.message, t.auth) }
    }

    return { success: t.auth.confirmEmailSuccess }
}

export async function logout() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
}
