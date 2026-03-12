import { createClient } from "@/lib/supabase/client";

function urlB64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export async function requestNotificationPermission() {
    if (!("Notification" in window)) {
        console.warn("This browser does not support desktop notification");
        return false;
    }

    let permission = Notification.permission;
    if (permission !== "granted") {
        permission = await Notification.requestPermission();
    }

    if (permission !== "granted") return false;

    // Register Push SW and subscribe if supported
    if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');

            const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
            if (VAPID_PUBLIC_KEY) {
                let subscription = await registration.pushManager.getSubscription();
                if (!subscription) {
                    subscription = await registration.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY)
                    });
                }

                if (subscription) {
                    const subData = JSON.parse(JSON.stringify(subscription));
                    const supabase = createClient();
                    const { data: { user } } = await supabase.auth.getUser();

                    if (user) {
                        await supabase.from('push_subscriptions').upsert({
                            user_id: user.id,
                            endpoint: subData.endpoint,
                            p256dh: subData.keys.p256dh,
                            auth: subData.keys.auth
                        }, { onConflict: 'endpoint' });
                    }
                }
            }
        } catch (error) {
            console.error('Error during push subscription:', error);
        }
    }

    return true;
}

export async function sendNotification(title: string, options?: NotificationOptions) {
    if (!("Notification" in window)) return;

    if (Notification.permission === "granted") {
        new Notification(title, options);
    } else if (Notification.permission !== "denied") {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
            new Notification(title, options);
        }
    }
}
