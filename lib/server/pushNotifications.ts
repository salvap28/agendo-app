import webpush, { WebPushError } from "web-push";

export type PushSubscriptionRow = {
    id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
};

function normalize(value: string | undefined | null) {
    return value?.trim() || null;
}

export function getVapidConfiguration() {
    const publicKey = normalize(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)
        || normalize(process.env.VAPID_PUBLIC_KEY);
    const privateKey = normalize(process.env.VAPID_PRIVATE_KEY);

    return {
        publicKey,
        privateKey,
        configured: Boolean(publicKey && privateKey),
    };
}

export function configureWebPush() {
    const { publicKey, privateKey, configured } = getVapidConfiguration();
    if (!configured || !publicKey || !privateKey) {
        return null;
    }

    webpush.setVapidDetails("mailto:admin@agendo.app", publicKey, privateKey);
    return { publicKey, privateKey };
}

function readPushErrorBody(error: unknown) {
    if (!error || typeof error !== "object") return "";
    const candidate = error as { body?: unknown };
    return typeof candidate.body === "string" ? candidate.body : "";
}

function readPushErrorStatus(error: unknown) {
    if (!error || typeof error !== "object") return null;
    const candidate = error as { statusCode?: unknown };
    return typeof candidate.statusCode === "number" ? candidate.statusCode : null;
}

export function shouldDeletePushSubscription(error: unknown) {
    const statusCode = readPushErrorStatus(error);
    const body = readPushErrorBody(error);

    if (statusCode === 404 || statusCode === 410) return true;
    if (statusCode === 401 || statusCode === 403) return true;

    if (statusCode === 400) {
        return body.includes("VapidPkHashMismatch")
            || body.includes("authorization header do not correspond")
            || body.includes("InvalidToken")
            || body.includes("invalid token")
            || body.includes("expired");
    }

    return false;
}

export function formatPushError(error: unknown) {
    if (error instanceof WebPushError) {
        return {
            statusCode: error.statusCode,
            body: error.body,
            headers: error.headers,
            endpoint: error.endpoint,
        };
    }

    if (error instanceof Error) {
        return {
            message: error.message,
        };
    }

    return { error };
}
