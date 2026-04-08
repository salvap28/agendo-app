import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import webpush from "web-push";
import { cookies } from "next/headers";
import { requireSupabaseConfig } from "@/lib/supabase/config";

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : "Internal Server Error";
}

export async function POST() {
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

        // Wait 8 seconds so user can close the app
        await new Promise(resolve => setTimeout(resolve, 8000));

        const payload = JSON.stringify({
            title: "¡Test Exitoso!",
            body: "Agendo te puede notificar con la app cerrada. 🎯",
            icon: "/icon.png",
        });

        const promises = subscriptions.map((sub) => {
            return webpush.sendNotification(
                {
                    endpoint: sub.endpoint,
                    keys: { p256dh: sub.p256dh, auth: sub.auth }
                },
                payload
            ).catch(async (err) => {
                if (err.statusCode === 404 || err.statusCode === 410) {
                    await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
                }
            });
        });

        await Promise.all(promises);
        return NextResponse.json({ success: true, devicesNotified: promises.length });
    } catch (error: unknown) {
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}
