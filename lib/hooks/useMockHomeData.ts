import { HomeData, HomeState } from "../types/home";

// CHANGE THIS TO TEST DIFFERENT STATES
const MOCK_STATE: HomeState = "upcoming_block";

export function useMockHomeData(): HomeData {

    // Base Greeting logic
    const hour = new Date().getHours();
    let greetingTime = "Good morning";
    if (hour >= 12 && hour < 20) greetingTime = "Good afternoon";
    if (hour >= 20 || hour < 5) greetingTime = "Good evening";

    const greeting = `${greetingTime}, Salva.`;

    const mockBlock = {
        id: "1",
        title: "Project Review & Planning",
        timeRange: "10:00 AM - 11:30 AM",
        type: "Deep Work" as const,
    };

    switch (MOCK_STATE) {
        case "no_block":
            return {
                state: "no_block",
                greeting,
                insight: "You usually have high energy around 10 AM. Great time to plan.",
            };

        case "upcoming_block":
            return {
                state: "upcoming_block",
                greeting,
                block: { ...mockBlock, status: "pending" },
                insight: "Last time you prepared for this review, you saved 20 mins.",
            };

        case "active_block":
            return {
                state: "active_block",
                greeting,
                block: { ...mockBlock, status: "active" },
                insight: "Focus mode is on. Notifications silenced.",
            };

        case "completed_block":
            return {
                state: "completed_block",
                greeting,
                block: { ...mockBlock, status: "completed" },
                insight: "Great session! You maintained focus for 85 minutes.",
            };

        default:
            return { state: "no_block", greeting };
    }
}
