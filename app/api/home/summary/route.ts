import { NextResponse } from "next/server";

export async function GET() {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    const data = {
        greeting: {
            name: "Alex", // In a real app, this would come from auth session
        },
        today: {
            summary: "You have 3 critical tasks and 2 meetings remaining today.",
            progress: 0.65,
        },
        stats: {
            completedTasks: 12,
            upcomingEvents: 4,
        },
    };

    return NextResponse.json(data);
}
