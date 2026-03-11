import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    'mailto:support@agendo.app',
    vapidPublicKey,
    vapidPrivateKey
  )
}

serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: "Missing DB env var" }), { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // 1. Get all planned blocks starting in the next roughly 120 minutes (max allowed)
  const now = new Date();
  const timeLimit = new Date(now.getTime() + 120 * 60000 + 60000);

  const { data: blocks, error: blocksError } = await supabase
    .from('blocks')
    .select('*')
    .eq('status', 'planned')
    .gte('start_at', now.toISOString())
    .lte('start_at', timeLimit.toISOString());

  if (blocksError || !blocks) {
    return new Response(JSON.stringify({ error: blocksError }), { status: 500 })
  }

  if (blocks.length === 0) {
    return new Response(JSON.stringify({ message: "No blocks found." }), { status: 200 })
  }

  // 2. Fetch subscriptions for users who have blocks in window
  const userIds = [...new Set(blocks.map((b: any) => b.user_id))];
  const { data: subs, error: subsError } = await supabase
    .from('push_subscriptions')
    .select('*')
    .in('user_id', userIds);

  if (subsError) {
    return new Response(JSON.stringify({ error: subsError }), { status: 500 })
  }

  // 3. Filter blocks to see if they match their custom notification times this current minute
  const notificationsToSend: Promise<any>[] = [];

  for (const block of blocks) {
    const startAt = new Date(block.start_at);
    const diffMs = startAt.getTime() - now.getTime();
    const diffMinutes = Math.round(diffMs / 60000);

    const offsets: number[] = block.notifications || [5]; // default 5 mins

    // Check if the current diff matches exactly any of the requested offsets
    if (offsets.includes(diffMinutes)) {

      let bodyMsg = `Empezando en ${diffMinutes} minutos.`;
      if (diffMinutes === 0) bodyMsg = "¡Tu bloque empieza ahora!";
      else if (diffMinutes === 60) bodyMsg = "Tu bloque empieza en 1 hora.";

      const payload = JSON.stringify({
        title: block.title || 'Recordatorio de Agendo',
        body: bodyMsg,
        icon: '/favicon.ico'
      });

      // Find subs for this user
      const userSubs = subs.filter((s: Record<string, any>) => s.user_id === block.user_id);

      for (const sub of userSubs) {
        notificationsToSend.push(
          webpush.sendNotification({
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth
            }
          }, payload).catch((e: any) => {
            console.error("Error sending push API request", e);
            // Handle expired subscriptions by deleting them
            if (e.statusCode === 410 || e.statusCode === 404) {
              return supabase.from('push_subscriptions').delete().eq('id', sub.id);
            }
          })
        );
      }
    }
  }

  await Promise.all(notificationsToSend);

  return new Response(JSON.stringify({ message: `Sent ${notificationsToSend.length} pushes.` }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
