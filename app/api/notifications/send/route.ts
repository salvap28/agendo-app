import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import webpush from "web-push";
import { cookies } from "next/headers";
import { requireSupabaseConfig } from "@/lib/supabase/config";

export async function POST(req: Request) {
    try {
        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

        if (!vapidPublicKey || !vapidPrivateKey) {
            return NextResponse.json({ error: "VAPID configuration missing" }, { status: 500 });
        }

        webpush.setVapidDetails(
            'mailto:admin@agendo.app',
            vapidPublicKey,
            vapidPrivateKey
        );

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
            .select("*")
            .eq("user_id", user.id);

        if (!subscriptions || subscriptions.length === 0) {
            return NextResponse.json({ success: true, count: 0 });
        }

        const payload = JSON.stringify({
            title,
            body: options?.body,
            icon: options?.icon || "/icon.png",
        });

        const promises = subscriptions.map((sub) => {
            // Prevent duplicate notification on the device that triggered it locally
            if (excludeEndpoint && sub.endpoint === excludeEndpoint) {
                return Promise.resolve();
            }

            return webpush.sendNotification(
                {
                    endpoint: sub.endpoint,
                    keys: { p256dh: sub.p256dh, auth: sub.auth }
                },
                payload
            ).catch(async (err) => {
                if (err.statusCode === 404 || err.statusCode === 410) {
                    await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
                } else {
                    console.error("Error sending push notification to endpoint:", sub.endpoint, err);
                }
            });
        });

        await Promise.all(promises);
        return NextResponse.json({ success: true, devicesNotified: promises.length });
    } catch (e: any) {
        console.error("Push Broadcast Error:", e);
        return NextResponse.json({ error: e.message || "Internal Server Error" }, { status: 500 });
    }
}
