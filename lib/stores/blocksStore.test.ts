import { Block } from "@/lib/types/blocks";
import { useBlocksStore } from "@/lib/stores/blocksStore";

const { createClientMock, getClientUserMock } = vi.hoisted(() => ({
    createClientMock: vi.fn(),
    getClientUserMock: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
    createClient: createClientMock,
    getClientUser: getClientUserMock,
}));

describe("blocksStore", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-03-15T20:25:00.000Z"));
    });

    afterEach(() => {
        useBlocksStore.setState({ blocks: [], isLoaded: false });
        createClientMock.mockReset();
        getClientUserMock.mockReset();
        vi.useRealTimers();
    });

    it("synchronizes automatic statuses while preserving a block the user started early", async () => {
        const updateCalls: Array<{ status: string; ids: string[] }> = [];

        createClientMock.mockImplementation(() => ({
            from: () => ({
                update: ({ status }: { status: string }) => ({
                    in: async (_field: string, ids: string[]) => {
                        updateCalls.push({ status, ids });
                        return { error: null };
                    },
                }),
            }),
        }));

        const blocks: Block[] = [
            {
                id: "future",
                title: "Future block",
                type: "study",
                status: "active",
                startAt: new Date("2026-03-15T22:10:00.000Z"),
                endAt: new Date("2026-03-15T22:30:00.000Z"),
            },
            {
                id: "current",
                title: "Current block",
                type: "deep_work",
                status: "planned",
                startAt: new Date("2026-03-15T20:20:00.000Z"),
                endAt: new Date("2026-03-15T21:00:00.000Z"),
            },
            {
                id: "past",
                title: "Past block",
                type: "admin",
                status: "active",
                startAt: new Date("2026-03-15T18:00:00.000Z"),
                endAt: new Date("2026-03-15T19:00:00.000Z"),
            },
        ];

        useBlocksStore.setState({ blocks, isLoaded: true });

        await useBlocksStore.getState().syncStatusesWithCurrentTime();

        expect(useBlocksStore.getState().blocks.map((block) => block.status)).toEqual([
            "active",
            "active",
            "completed",
        ]);
        expect(updateCalls).toEqual(
            expect.arrayContaining([
                { status: "active", ids: ["current"] },
                { status: "completed", ids: ["past"] },
            ])
        );
        expect(updateCalls).not.toEqual(
            expect.arrayContaining([
                { status: "planned", ids: ["future"] },
            ])
        );
    });
});
