import { fetchRecentActivityExperiences } from "@/lib/server/activityExperience";

function createSupabaseStub(error: { code: string; message: string; hint?: string | null }) {
    const query = {
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: null, error }),
    };

    return {
        from: vi.fn(() => ({
            select: vi.fn(() => query),
        })),
    };
}

describe("activity experience server fallback", () => {
    it("returns an empty list when the activity_experiences table is missing", async () => {
        const supabase = createSupabaseStub({
            code: "PGRST205",
            message: "Could not find the table 'public.activity_experiences' in the schema cache",
            hint: "Perhaps you meant the table 'public.daily_metrics'",
        });

        await expect(
            fetchRecentActivityExperiences(supabase as never, "user-1", {
                startDate: "2026-03-17",
                endDate: "2026-03-17",
            }),
        ).resolves.toEqual([]);
    });
});
