import { Block } from "@/lib/types/blocks";

/**
 * Partial block input from the minimalist creation modal.
 */
export type MinimalBlockInput = {
    title: string;
    startAt: Date;
    endAt: Date;
    type?: Block["type"];
    recurrencePattern?: Block["recurrencePattern"];
};

/**
 * Applies initial planning metadata to a new block, ensuring a low-friction
 * creation experience while providing the planning engine with necessary defaults.
 * 
 * Future AI implementation:
 * This heuristic function can later be replaced or supplemented by an LLM
 * call that analyzes the user's past behavior and the block title to
 * accurately predict these values.
 */
export function enrichNewBlockWithPlanningMetadata(input: MinimalBlockInput): Partial<Block> & Pick<Block, "title" | "startAt" | "endAt"> {
    const titleLower = input.title.toLowerCase();
    
    // Default base values
    let priority: Block["priority"] = 3;
    let flexibility: Block["flexibility"] = "moderate";
    let intensity: Block["intensity"] = "medium";
    let splittable = true;
    let cognitivelyHeavy = false;

    // 1. High Priority & Fixed Time keywords
    // Events that typically cannot be moved and are very important
    if (/(examen|parcial|entrega|final|reunion|entrevista|doctor|medico|vuelo)/.test(titleLower)) {
        priority = 4;
        flexibility = "fixed";
    }

    // 2. High cognitive load keywords
    if (/(estudiar|aprender|investigar|desarrollar|analizar|codigo|code|escribir|tesis)/.test(titleLower)) {
        intensity = "high";
        cognitivelyHeavy = true;
    }

    // 3. Relaxed / divisible keywords
    if (/(repasar|leer|resumen|ordenar|limpiar|comprar|mail|rutina)/.test(titleLower)) {
        splittable = true;
        intensity = "light";
    }

    // 4. Time-specific bounding
    // If it's a very short block (< 30 minutes), it's probably not splittable
    const durationMinutes = (input.endAt.getTime() - input.startAt.getTime()) / 60000;
    if (durationMinutes <= 30) {
        splittable = false;
    }

    // 5. Type-based initial bounds (if provided)
    if (input.type === "deep_work") {
        intensity = "high";
        cognitivelyHeavy = true;
    } else if (input.type === "break" || input.type === "other") {
        priority = input.type === "break" ? 1 : 2;
    }

    return {
        ...input,
        priority,
        flexibility,
        intensity,
        splittable,
        cognitivelyHeavy,
        optional: false, // New manual tasks are strictly non-optional by default
    };
}
