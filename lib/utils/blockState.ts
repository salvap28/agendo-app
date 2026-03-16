import { Block, BlockStatus } from "@/lib/types/blocks";
import { FocusSession } from "@/lib/types/focus";

type BlockTiming = Pick<Block, "status" | "startAt" | "endAt">;
type BlockIdentity = Pick<Block, "id">;

export interface BlockRuntimeState {
    effectiveStatus: BlockStatus;
    isActiveNow: boolean;
    isCompleted: boolean;
    isPlanned: boolean;
    isCanceled: boolean;
    isSessionBlock: boolean;
    isFocusRunning: boolean;
    hasPausedFocus: boolean;
}

export function getBlockEffectiveStatus(block: BlockTiming, now = new Date()): BlockStatus {
    if (block.status === "canceled") return "canceled";
    if (block.status === "completed") return "completed";
    if (block.status === "active") {
        return now >= block.endAt ? "completed" : "active";
    }
    if (now < block.startAt) return "planned";
    if (now >= block.endAt) return "completed";
    return "active";
}

export function isBlockActiveNow(block: BlockTiming, now = new Date()): boolean {
    return getBlockEffectiveStatus(block, now) === "active";
}

export function isFocusSessionForBlock(session: FocusSession | null | undefined, blockId: string): boolean {
    return session?.mode === "block" && session.blockId === blockId;
}

export function isRunningFocusForBlock(session: FocusSession | null | undefined, blockId: string): boolean {
    return isFocusSessionForBlock(session, blockId) && Boolean(session?.isActive);
}

export function hasPausedFocusForBlock(session: FocusSession | null | undefined, blockId: string): boolean {
    return isFocusSessionForBlock(session, blockId) && !session?.isActive;
}

export function getBlockRuntimeState(
    block: BlockTiming & BlockIdentity,
    session?: FocusSession | null,
    now = new Date()
): BlockRuntimeState {
    const effectiveStatus = getBlockEffectiveStatus(block, now);

    return {
        effectiveStatus,
        isActiveNow: effectiveStatus === "active",
        isCompleted: effectiveStatus === "completed",
        isPlanned: effectiveStatus === "planned",
        isCanceled: effectiveStatus === "canceled",
        isSessionBlock: isFocusSessionForBlock(session, block.id),
        isFocusRunning: isRunningFocusForBlock(session, block.id),
        hasPausedFocus: hasPausedFocusForBlock(session, block.id),
    };
}

export function sortBlocksByStart<T extends Pick<Block, "startAt">>(blocks: T[]): T[] {
    return [...blocks].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}
