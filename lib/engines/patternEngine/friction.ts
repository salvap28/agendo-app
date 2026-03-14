import { FocusSession } from "@/lib/types/focus";

// Calculates a value between 0-100 indicating resistance and context switching
export function calculateFrictionScore(session: FocusSession): number {
    let friction = 0;

    // Direct signs of focus being broken (Exits are heavy context switches)
    friction += (session.pauseCount || 0) * 15;
    friction += (session.exitCount || 0) * 20;

    // Poorly defined tasks create huge mental friction
    const clarity = session.clarity || 3;
    if (clarity < 3) {
        // If clarity is 1, adds 40 friction. If 2, adds 20.
        friction += ((3 - clarity) * 20); 
    }

    // Delay in picking up the intended block vs real start (measured in ms)
    const delayMs = session.startDelayMs || 0;
    const delayMin = delayMs / 60000;
    if (delayMin > 3) { // tighter 3 min margin
        friction += Math.min(40, (delayMin - 3) * 3); 
    }

    return Math.min(100, Math.max(0, Math.round(friction)));
}
