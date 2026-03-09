export async function requestNotificationPermission() {
    if (!("Notification" in window)) {
        console.warn("This browser does not support desktop notification");
        return false;
    }

    if (Notification.permission === "granted") {
        return true;
    }

    if (Notification.permission !== "denied") {
        const permission = await Notification.requestPermission();
        return permission === "granted";
    }

    return false;
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
