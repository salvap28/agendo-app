import { createClient, getClientUser } from "@/lib/supabase/client";

function urlB64ToUint8Array(base64String: string) {
    const padding = "=".repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
}

let vapidPublicKeyPromise: Promise<string | null> | null = null;

function wireNotificationEvents(notification: Notification, options?: NotificationOptions) {
    const data = typeof options?.data === "object" && options?.data
        ? options.data as { url?: string; notificationType?: string }
        : {};
    const targetUrl = typeof data.url === "string" ? data.url : "";

    if (targetUrl) {
        notification.onclick = () => {
            window.focus();
            window.location.href = targetUrl;
        };
    }

    if (data.notificationType) {
        notification.onclose = () => {
            fetch("/api/habit/events", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: "notification_dismissed",
                    surface: "notification",
                    metadata: {
                        type: data.notificationType,
                    },
                }),
                keepalive: true,
            }).catch(() => {
                // noop
            });
        };
    }
}

async function getVapidPublicKey() {
    const bundledKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
    if (bundledKey) return bundledKey;

    if (!vapidPublicKeyPromise) {
        vapidPublicKeyPromise = fetch("/api/notifications/vapid-public-key", {
            cache: "no-store"
        })
            .then(async (response) => {
                if (!response.ok) return null;

                const data = await response.json();
                return typeof data.publicKey === "string" ? data.publicKey.trim() : null;
            })
            .catch((error) => {
                console.warn("Unable to load VAPID public key at runtime.", error);
                return null;
            });
    }

    return vapidPublicKeyPromise;
}

async function syncPushSubscription(registration: ServiceWorkerRegistration) {
    const vapidPublicKey = await getVapidPublicKey();
    if (!vapidPublicKey) {
        console.warn("Push notifications are not configured. Browser notifications will still work while the app is open.");
        return;
    }

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlB64ToUint8Array(vapidPublicKey)
        });
    }

    const subData = subscription.toJSON();
    if (!subData.endpoint || !subData.keys?.p256dh || !subData.keys?.auth) {
        console.warn("Push subscription payload is incomplete.");
        return;
    }

    const supabase = createClient();
    const user = await getClientUser(supabase);

    if (!user) return;

    await supabase.from("push_subscriptions").upsert({
        user_id: user.id,
        endpoint: subData.endpoint,
        p256dh: subData.keys.p256dh,
        auth: subData.keys.auth
    }, { onConflict: "endpoint" });
}

export async function requestNotificationPermission() {
    if (!("Notification" in window)) {
        console.warn("This browser does not support desktop notifications.");
        return false;
    }

    let permission = Notification.permission;
    if (permission !== "granted") {
        permission = await Notification.requestPermission();
    }

    if (permission !== "granted") return false;

    if ("serviceWorker" in navigator && "PushManager" in window) {
        try {
            const registration = await navigator.serviceWorker.register("/sw.js");
            await syncPushSubscription(registration);
        } catch (error) {
            console.error("Error during push subscription:", error);
        }
    }

    return true;
}

export async function sendNotification(title: string, options?: NotificationOptions) {
    if (!("Notification" in window)) return;

    if (Notification.permission === "granted") {
        const notification = new Notification(title, options);
        wireNotificationEvents(notification, options);
    } else if (Notification.permission !== "denied") {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
            const notification = new Notification(title, options);
            wireNotificationEvents(notification, options);
        }
    }

    // Broadcast explicitly to other synced devices
    try {
        let currentEndpoint: string | undefined = undefined;
        if ("serviceWorker" in navigator && "PushManager" in window) {
            const registration = await navigator.serviceWorker.getRegistration();
            if (registration) {
                const subscription = await registration.pushManager.getSubscription();
                if (subscription) {
                    currentEndpoint = subscription.endpoint;
                }
            }
        }

        fetch("/api/notifications/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                title, 
                options,
                excludeEndpoint: currentEndpoint
            })
        }).catch(err => console.error("Cross-device sync failed", err));
    } catch (e) {
        console.error("Failed to broadcast notification:", e);
    }
}
