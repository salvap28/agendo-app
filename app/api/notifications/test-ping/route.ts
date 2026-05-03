import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import webpush from "web-push";
import { cookies } from "next/headers";
import { requireSupabaseConfig } from "@/lib/supabase/config";
import {
    configureWebPush,
    formatPushError,
    shouldDeletePushSubscription,
    type PushSubscriptionRow,
} from "@/lib/server/pushNotifications";

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : "Internal Server Error";
}

export async function POST() {
    try {
        if (!configureWebPush()) {
            return NextResponse.json({ error: "VAPID configuration missing" }, { status: 500 });
        }

        const { url, anonKey } = requireSupabaseConfig();
        const cookieStore = await cookies();
        const supabase = createServerClient(url, anonKey, {
            cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} }
        });

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data: subscriptions } = await supabase
            .from("push_subscriptions")
            .select("id, endpoint, p256dh, auth")
            .eq("user_id", user.id);

        if (!subscriptions || subscriptions.length === 0) {
            return NextResponse.json({ success: true, count: 0 });
        }

        // Wait 8 seconds so user can close the app
        await new Promise(resolve => setTimeout(resolve, 8000));

        const payload = JSON.stringify({
            title: "¡Test Exitoso!",
            body: "Agendo te puede notificar con la app cerrada. 🎯",
            icon: "/icon.png",
        });

        let delivered = 0;
        let invalidated = 0;

        const promises = (subscriptions as PushSubscriptionRow[]).map((sub) => {
            return webpush.sendNotification(
                {
                    endpoint: sub.endpoint,
                    keys: { p256dh: sub.p256dh, auth: sub.auth }
                },
                payload
            ).then(() => {
                delivered += 1;
            }).catch(async (err) => {
                if (shouldDeletePushSubscription(err)) {
                    invalidated += 1;
                    await supabase.from("push_subscriptions").delete().eq("id", sub.id);
                } else {
                    console.error("Error sending test push notification to endpoint:", sub.endpoint, formatPushError(err));
                }
            });
        });

        await Promise.all(promises);
        return NextResponse.json({
            success: true,
            devicesNotified: delivered,
            attempted: subscriptions.length,
            invalidated,
        });
    } catch (error: unknown) {
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}
