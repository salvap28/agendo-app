import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

type BlockRow = {
  user_id: string
  start_at: string
  notifications: number[] | null
  title: string | null
}

type PushSubscriptionRow = {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

type PushError = {
  statusCode?: number
  body?: string
}

function shouldDeletePushSubscription(error: PushError) {
  if (error.statusCode === 404 || error.statusCode === 410) return true
  if (error.statusCode === 401 || error.statusCode === 403) return true

  if (error.statusCode === 400) {
    const body = error.body || ""
    return body.includes("VapidPkHashMismatch")
      || body.includes("authorization header do not correspond")
      || body.includes("InvalidToken")
      || body.includes("invalid token")
      || body.includes("expired")
  }

  return false
}

const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    'mailto:support@agendo.app',
    vapidPublicKey,
    vapidPrivateKey
  )
}

serve(async () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: "Missing DB env var" }), { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const now = new Date()
  const timeLimit = new Date(now.getTime() + 120 * 60000 + 60000)

  const { data: blocksData, error: blocksError } = await supabase
    .from('blocks')
    .select('*')
    .eq('status', 'planned')
    .gte('start_at', now.toISOString())
    .lte('start_at', timeLimit.toISOString())

  if (blocksError || !blocksData) {
    return new Response(JSON.stringify({ error: blocksError }), { status: 500 })
  }

  const blocks = blocksData as BlockRow[]

  if (blocks.length === 0) {
    return new Response(JSON.stringify({ message: "No blocks found." }), { status: 200 })
  }

  const userIds = [...new Set(blocks.map((block) => block.user_id))]
  const { data: subsData, error: subsError } = await supabase
    .from('push_subscriptions')
    .select('*')
    .in('user_id', userIds)

  if (subsError) {
    return new Response(JSON.stringify({ error: subsError }), { status: 500 })
  }

  const subs = (subsData ?? []) as PushSubscriptionRow[]
  const notificationsToSend: Promise<unknown>[] = []

  for (const block of blocks) {
    const startAt = new Date(block.start_at)
    const startAtMin = Math.floor(startAt.getTime() / 60000)
    const nowMin = Math.floor(now.getTime() / 60000)
    const diffMinutes = startAtMin - nowMin
    const offsets = block.notifications || [5]

    if (!offsets.includes(diffMinutes)) {
      continue
    }

    let bodyMsg = `Empezando en ${diffMinutes} minutos.`
    if (diffMinutes === 0) bodyMsg = "Â¡Tu bloque empieza ahora!"
    else if (diffMinutes === 60) bodyMsg = "Tu bloque empieza en 1 hora."

    const payload = JSON.stringify({
      title: block.title || 'Recordatorio de Agendo',
      body: bodyMsg,
      icon: '/favicon.ico'
    })

    const userSubs = subs.filter((subscription) => subscription.user_id === block.user_id)

    for (const sub of userSubs) {
      notificationsToSend.push(
        webpush.sendNotification({
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        }, payload).catch((error: PushError) => {
          console.error("Error sending push API request", error)
          if (shouldDeletePushSubscription(error)) {
            return supabase.from('push_subscriptions').delete().eq('id', sub.id)
          }
        })
      )
    }
  }

  await Promise.all(notificationsToSend)

  return new Response(JSON.stringify({ message: `Sent ${notificationsToSend.length} pushes.` }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
