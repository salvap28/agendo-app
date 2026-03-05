'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
    const loginId = formData.get('loginId') as string
    const password = formData.get('password') as string

    if (!loginId || !password) {
        return { error: 'Please enter your email/username and password' }
    }

    const supabase = await createClient()

    let email = loginId;

    // If it's not an email, assume it's a username and look up the email
    if (!loginId.includes('@')) {
        const { data: fetchedEmail, error: rpcError } = await supabase.rpc('get_email_by_username', {
            p_username: loginId
        });

        if (rpcError || !fetchedEmail) {
            return { error: 'Invalid username or password' }
        }
        email = fetchedEmail;
    }

    const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
    })

    if (error) {
        return { error: error.message }
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
        return { error: 'Please fill in all fields' }
    }

    if (username.length > 20) {
        return { error: 'Username must be 20 characters or less' }
    }

    if (password !== confirmPassword) {
        return { error: 'Passwords do not match' }
    }

    const supabase = await createClient()

    const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { username }
        }
    })

    if (error) {
        return { error: error.message }
    }

    return { success: 'Check your email for the confirmation link.' }
}

export async function logout() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
}
