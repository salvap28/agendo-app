import { FocusSession } from "@/lib/types/focus";

// Calculates a value between 0-100 indicating resistance and context switching
export function calculateFrictionScore(session: FocusSession): number {
    let friction = 0;

    // Direct signs of focus being broken
    friction += (session.pauseCount || 0) * 10;
    friction += (session.exitCount || 0) * 15;

    // Poorly defined tasks create huge mental friction
    const clarity = session.clarity || 3;
    if (clarity < 3) {
        friction += ((3 - clarity) * 15); 
    }

    // Delay in picking up the intended block vs real start (measured in ms)
    const delayMs = session.startDelayMs || 0;
    const delayMin = delayMs / 60000;
    if (delayMin > 5) { // graceful 5 min margin
        friction += Math.min(30, (delayMin - 5) * 2); 
    }

    return Math.min(100, Math.max(0, Math.round(friction)));
}
