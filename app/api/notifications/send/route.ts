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

export async function POST(req: Request) {
    try {
        if (!configureWebPush()) {
            return NextResponse.json({ error: "VAPID configuration missing" }, { status: 500 });
        }

        const { title, options, excludeEndpoint } = await req.json();

        // Use the cookies to authenticate the sender
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

        const payload = JSON.stringify({
            title,
            body: options?.body,
            icon: options?.icon || "/icon.png",
            data: options?.data ?? null,
        });

        let attempted = 0;
        let invalidated = 0;
        let delivered = 0;

        const promises = (subscriptions as PushSubscriptionRow[]).map((sub) => {
            // Prevent duplicate notification on the device that triggered it locally
            if (excludeEndpoint && sub.endpoint === excludeEndpoint) {
                return Promise.resolve();
            }

            attempted += 1;
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
                    console.error("Error sending push notification to endpoint:", sub.endpoint, formatPushError(err));
                }
            });
        });

        await Promise.all(promises);
        return NextResponse.json({
            success: true,
            devicesNotified: delivered,
            attempted,
            invalidated,
        });
    } catch (error: unknown) {
        console.error("Push Broadcast Error:", error);
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}
