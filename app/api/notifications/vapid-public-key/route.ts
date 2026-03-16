import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()
        || process.env.VAPID_PUBLIC_KEY?.trim()
        || null;

    return NextResponse.json(
        {
            configured: Boolean(publicKey),
            publicKey
        },
        {
            headers: {
                "Cache-Control": "no-store"
            }
        }
    );
}
