import type { Block, BlockType } from "@/lib/types/blocks";
import type {
    PlannerContextBundle,
    PlannerInterpretation,
    PlannerInterpretationItem,
    PlannerProposal,
    PlannerScheduledBlockSnapshot,
    PlannerRequest,
} from "@/lib/types/planner";
import { roundTo15 } from "@/lib/utils/blockUtils";
import { findNextFreeSlot } from "@/lib/utils/scheduling";

const MINUTE_MS = 60 * 1000;
const FIFTEEN_MIN_MS = 15 * MINUTE_MS;

type SchedulableBlock = Pick<Block, "id" | "title" | "type" | "status" | "startAt" | "endAt">;

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function toSchedulingBlock(block: SchedulableBlock | PlannerScheduledBlockSnapshot): SchedulableBlock {
    return {
        ...block,
        startAt: block.startAt instanceof Date ? block.startAt : new Date(block.startAt),
        endAt: block.endAt instanceof Date ? block.endAt : new Date(block.endAt),
    };
}

function normalizeBlocks(blocks: Array<SchedulableBlock | PlannerScheduledBlockSnapshot>) {
    return blocks.map((block) => toSchedulingBlock(block));
}

function sameDate(left: Date, right: Date) {
    return left.getFullYear() === right.getFullYear()
        && left.getMonth() === right.getMonth()
        && left.getDate() === right.getDate();
}

function buildTargetDate(date: string) {
    return new Date(`${date}T00:00:00`);
}

function windowStartHour(window: PlannerContextBundle["bestFocusWindow"]) {
    if (window === "morning") return 9;
    if (window === "afternoon") return 14;
    if (window === "evening") return 18;
    if (window === "night") return 21;
    return 9;
}

function buildAnchorStart(context: PlannerContextBundle) {
    const now = new Date(context.nowIso);
    const targetDate = buildTargetDate(context.targetDate);
    const anchor = buildTargetDate(context.targetDate);
    anchor.setHours(windowStartHour(context.bestFocusWindow), 0, 0, 0);

    if (sameDate(targetDate, now)) {
        const minimum = new Date(now.getTime() + FIFTEEN_MIN_MS);
        return roundTo15(anchor.getTime() > minimum.getTime() ? anchor : minimum);
    }

    return roundTo15(anchor);
}

function buildPlanSummary(args: {
    context: PlannerContextBundle;
    interpretation: PlannerInterpretation;
    drafts: PlannerProposal["drafts"];
    language: "en" | "es";
}): PlannerProposal {
    const { context, interpretation, drafts, language } = args;
    const totalDurationMin = drafts.reduce((total, draft) => total + draft.durationMin, 0);
    const explicitTimesCount = drafts.filter((draft) => draft.explicitTime).length;
    const guidedPlanningSuggested = drafts.length === 0
        || interpretation.items.length >= 4
        || (context.dailyLoadLevel === "overload" && drafts.length >= 2);

    const summary = drafts.length === 0
        ? (language === "es" ? "No vi una propuesta clara. Abrimos planning guiado." : "I could not shape a clear proposal. Guided planning can take over.")
        : interpretation.detectedOverload
            ? (language === "es" ? "Te deje una version mas liviana para arrancar sin sobrecargarte." : "I shaped a lighter version so you can start without overload.")
            : explicitTimesCount > 0
                ? (language === "es" ? "Respete los horarios claros y acomode lo demas alrededor." : "I kept the clear times and arranged the rest around them.")
                : (language === "es" ? "Protegi primero lo mas arrancable." : "I protected the most startable pieces first.");

    return {
        sessionId: "",
        inputId: "",
        proposalId: "",
        parentProposalId: null,
        variant: "initial",
        status: "active",
        createdAt: new Date().toISOString(),
        engine: "heuristic_v1",
        headline: language === "es" ? "Propuesta de Agendo" : "Agendo proposal",
        summary,
        targetDate: context.targetDate,
        context,
        interpretation,
        drafts,
        totalDurationMin,
        explicitTimesCount,
        guidedPlanningSuggested,
    };
}

function splitCaptureInput(input: string) {
    const normalized = input
        .replace(/\r/g, "")
        .replace(/[•·]/g, "\n")
        .replace(/[â€¢Â·]/g, "\n")
        .replace(/[;]+/g, "\n")
        .trim();

    const lineSplit = normalized
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

    if (lineSplit.length > 1) return lineSplit;

    return normalized
        .split(/,(?=\s*[^\s,])/g)
        .map((segment) => segment.trim())
        .filter(Boolean);
}

function inferType(input: string): BlockType {
    const normalized = input.toLowerCase();

    if (/(gym|entren|correr|pesas|pierna|pecho|espalda|cardio)/.test(normalized)) return "gym";
    if (/(reunion|llamada|call|meet|meeting|entrevista)/.test(normalized)) return "meeting";
    if (/(mail|mails|correo|admin|tramite|factura|pago|ordenar|limpiar|comprar)/.test(normalized)) return "admin";
    if (/(descanso|break|almuerzo|comer|merienda|siesta)/.test(normalized)) return "break";
    if (/(estudi|leer|repasar|clase|parcial|resumen|tesis|apunte)/.test(normalized)) return "study";
    if (/(codigo|code|program|desarroll|escribir|investig|analizar|proyecto|tdc|tp)/.test(normalized)) return "deep_work";
    return "other";
}

function cleanTitle(input: string) {
    return input
        .replace(/(?:a\s+las|alas|at)?\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/gi, " ")
        .replace(/\b\d+(?:[.,]\d+)?\s*(?:h|hs|hora|horas)\b/gi, " ")
        .replace(/\b\d+\s*(?:m|min|mins|minuto|minutos)\b/gi, " ")
        .replace(/\b(?:hoy|today|despues|after|luego|then|manana|mañana|tomorrow)\b/gi, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^[,\-:]+|[,\-:]+$/g, "")
        .trim();
}

export function humanizeBlockTitle(title: string) {
    const compact = title.trim().replace(/\s+/g, " ");
    if (!compact) return title;

    const looksUppercase = compact === compact.toUpperCase() && /[A-Z]/.test(compact);
    if (!looksUppercase) return compact;

    return compact
        .split(" ")
        .map((part) => {
            if (!part) return part;
            if (part.length <= 3 || /\d/.test(part)) return part.toUpperCase();
            return `${part.charAt(0)}${part.slice(1).toLowerCase()}`;
        })
        .join(" ");
}

function detectOverload(input: string) {
    return /(cansad|agotad|quemad|saturad|sin energia|sin energía|tired|exhausted|overwhelmed|burned out)/i.test(input);
}

function inferConstraints(input: string) {
    const constraints: string[] = [];
    if (/(?:a\s+las|alas|at)?\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/i.test(input)) constraints.push("explicit_time");
    if (/(manana|mañana|tomorrow|viernes|viernes|friday|lunes|monday|martes|tuesday|miercoles|miércoles|wednesday|jueves|thursday|sabado|sábado|saturday|domingo|sunday)/i.test(input)) constraints.push("date_reference");
    if (detectOverload(input)) constraints.push("overload_signal");
    return constraints;
}

function parseExplicitStart(input: string, targetDate: string, now: Date) {
    const normalized = input.toLowerCase();
    const match = normalized.match(/(?:a\s+las|alas|at)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
    if (!match) return null;

    const rawHours = Number.parseInt(match[1], 10);
    const rawMinutes = match[2] ? Number.parseInt(match[2], 10) : 0;
    const meridiem = match[3] ?? null;

    if (!Number.isFinite(rawHours) || rawHours > 23 || rawMinutes > 59) return null;

    let hours = rawHours;
    if (meridiem === "pm" && hours < 12) hours += 12;
    if (meridiem === "am" && hours === 12) hours = 0;

    const candidate = buildTargetDate(targetDate);
    candidate.setHours(hours, rawMinutes, 0, 0);

    if (sameDate(candidate, now) && candidate.getTime() < now.getTime() - (10 * MINUTE_MS)) return null;
    return candidate;
}

function parseDurationMin(input: string, fallbackType: BlockType, context: PlannerContextBundle) {
    let total = 0;
    const normalized = input.toLowerCase();

    const hoursMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:h|hs|hora|horas)\b/);
    if (hoursMatch) {
        total += Math.round(Number.parseFloat(hoursMatch[1].replace(",", ".")) * 60);
    }

    const minutesMatch = normalized.match(/(\d+)\s*(?:m|min|mins|minuto|minutos)\b/);
    if (minutesMatch) {
        total += Number.parseInt(minutesMatch[1], 10);
    }

    if (total > 0) return total;

    if ((fallbackType === "deep_work" || fallbackType === "study") && context.recommendedFocusDurationMin) {
        return clamp(context.recommendedFocusDurationMin, 30, 120);
    }

    if (fallbackType === "deep_work" || fallbackType === "study") return 90;
    if (fallbackType === "gym") return 60;
    if (fallbackType === "meeting") return 45;
    if (fallbackType === "admin") return 30;
    if (fallbackType === "break") return 15;
    return 45;
}

export function buildPlannerInterpretation(args: {
    request: PlannerRequest;
    context: PlannerContextBundle;
}): PlannerInterpretation {
    const segments = splitCaptureInput(args.request.input);
    const now = args.request.nowIso ? new Date(args.request.nowIso) : new Date(args.context.nowIso);
    const detectedOverload = detectOverload(args.request.input);

    const items: PlannerInterpretationItem[] = segments.map((segment) => {
        const source = segment.trim();
        const type = inferType(source);
        const explicitStart = parseExplicitStart(source, args.context.targetDate, now);
        const overloadHint = detectOverload(source);
        const title = humanizeBlockTitle(cleanTitle(source) || source);

        return {
            source,
            title,
            type,
            durationMin: Math.max(15, parseDurationMin(source, type, args.context)),
            explicitStartAt: explicitStart?.toISOString() ?? null,
            explicitTime: Boolean(explicitStart),
            focusRequired: type === "deep_work" || type === "study",
            overloadHint,
            constraints: inferConstraints(source),
        };
    }).filter((item) => item.source.length > 0);

    return {
        rawInput: args.request.input,
        source: args.request.source,
        targetDate: args.context.targetDate,
        items,
        detectedOverload,
    };
}

export function buildHeuristicPlannerProposal(args: {
    request: PlannerRequest;
    context: PlannerContextBundle;
    language?: "en" | "es";
}): PlannerProposal {
    const language = args.language ?? "es";
    const interpretation = buildPlannerInterpretation(args);
    const existing = normalizeBlocks(args.context.scheduledBlocks);
    const drafts: PlannerProposal["drafts"] = [];
    let cursor = buildAnchorStart(args.context);

    for (const item of interpretation.items) {
        const source = item.source.trim();
        if (!source) continue;

        const nextDurationMin = interpretation.detectedOverload && item.focusRequired && !item.explicitTime
            ? clamp(Math.round(item.durationMin * 0.7), 20, 60)
            : item.durationMin;
        const desiredStart = item.explicitStartAt ? new Date(item.explicitStartAt) : cursor;
        const slot = findNextFreeSlot(existing, desiredStart, nextDurationMin);
        if (!slot) continue;

        drafts.push({
            clientId: crypto.randomUUID(),
            source,
            title: item.title,
            type: item.type,
            durationMin: nextDurationMin,
            startAt: slot.startAt.toISOString(),
            endAt: slot.endAt.toISOString(),
            explicitTime: item.explicitTime,
            reason: item.explicitTime
                ? (language === "es" ? "Respeta el horario detectado." : "Keeps the detected time.")
                : interpretation.detectedOverload
                    ? (language === "es" ? "Arranca liviano para que sea viable." : "Starts lighter so it stays viable.")
                    : (language === "es" ? "Protege la siguiente ventana libre." : "Protects the next free window."),
        });

        existing.push({
            id: `draft-${drafts.length}`,
            title: item.title,
            type: item.type,
            startAt: slot.startAt,
            endAt: slot.endAt,
            status: "planned",
        });
        cursor = roundTo15(new Date(slot.endAt.getTime() + FIFTEEN_MIN_MS));
    }

    return buildPlanSummary({
        context: args.context,
        interpretation,
        drafts,
        language,
    });
}

export function lightenPlannerProposal(proposal: PlannerProposal, language: "en" | "es" = "es"): PlannerProposal {
    const drafts = proposal.drafts.map((draft) => {
        const durationMin = Math.max(20, Math.round(draft.durationMin * 0.75));
        const startAt = new Date(draft.startAt);
        return {
            ...draft,
            durationMin,
            endAt: new Date(startAt.getTime() + (durationMin * MINUTE_MS)).toISOString(),
            reason: language === "es" ? "Version mas liviana." : "Lighter version.",
        };
    });

    const next = buildPlanSummary({
        context: proposal.context,
        interpretation: proposal.interpretation,
        drafts,
        language,
    });
    return {
        ...next,
        sessionId: proposal.sessionId,
        inputId: proposal.inputId,
        parentProposalId: proposal.proposalId || proposal.parentProposalId,
        variant: "lightened",
    };
}

export function regeneratePlannerProposal(args: {
    proposal: PlannerProposal;
    scheduledBlocks: Array<SchedulableBlock | PlannerScheduledBlockSnapshot>;
    nowIso?: string;
    language?: "en" | "es";
}): PlannerProposal {
    const language = args.language ?? "es";
    const context = {
        ...args.proposal.context,
        nowIso: args.nowIso ?? args.proposal.context.nowIso,
        scheduledBlocks: normalizeBlocks(args.scheduledBlocks).map((block) => ({
            id: block.id,
            title: block.title,
            type: block.type,
            status: block.status,
            startAt: block.startAt.toISOString(),
            endAt: block.endAt.toISOString(),
        })),
    } satisfies PlannerContextBundle;

    const scheduled = normalizeBlocks(context.scheduledBlocks);
    const fixedDrafts = args.proposal.drafts
        .filter((draft) => draft.explicitTime)
        .sort((left, right) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime());
    const flexibleDrafts = args.proposal.drafts
        .filter((draft) => !draft.explicitTime)
        .sort((left, right) => left.durationMin - right.durationMin);
    let cursor = buildAnchorStart(context);

    fixedDrafts.forEach((draft, index) => {
        scheduled.push({
            id: `fixed-${index}`,
            title: draft.title,
            type: draft.type,
            status: "planned",
            startAt: new Date(draft.startAt),
            endAt: new Date(draft.endAt),
        });
    });

    const regenerated = flexibleDrafts.map((draft, index) => {
        const slot = findNextFreeSlot(scheduled, cursor, draft.durationMin);
        if (!slot) return null;
        const nextDraft = {
            ...draft,
            startAt: slot.startAt.toISOString(),
            endAt: slot.endAt.toISOString(),
            reason: language === "es" ? "Reacomodado sobre una ventana libre." : "Reshaped around a free window.",
        };
        scheduled.push({
            id: `flex-${index}`,
            title: nextDraft.title,
            type: nextDraft.type,
            status: "planned",
            startAt: new Date(nextDraft.startAt),
            endAt: new Date(nextDraft.endAt),
        });
        cursor = roundTo15(new Date(slot.endAt.getTime() + FIFTEEN_MIN_MS));
        return nextDraft;
    }).filter((draft): draft is PlannerProposal["drafts"][number] => Boolean(draft));

    const next = buildPlanSummary({
        context,
        interpretation: args.proposal.interpretation,
        drafts: [...fixedDrafts, ...regenerated].sort((left, right) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime()),
        language,
    });
    return {
        ...next,
        sessionId: args.proposal.sessionId,
        inputId: args.proposal.inputId,
        parentProposalId: args.proposal.proposalId || args.proposal.parentProposalId,
        variant: "regenerated",
    };
}

export function adjustPlannerProposalDraft(args: {
    proposal: PlannerProposal;
    draftIndex: number;
    mode: "earlier" | "later" | "shorter";
    scheduledBlocks: Array<SchedulableBlock | PlannerScheduledBlockSnapshot>;
    language?: "en" | "es";
}): PlannerProposal {
    const language = args.language ?? "es";
    const current = args.proposal.drafts[args.draftIndex];
    if (!current) return args.proposal;

    const otherDraftBlocks = args.proposal.drafts
        .filter((_, index) => index !== args.draftIndex)
        .map((draft, index) => ({
            id: `draft-${index}`,
            title: draft.title,
            type: draft.type,
            status: "planned" as const,
            startAt: new Date(draft.startAt),
            endAt: new Date(draft.endAt),
        }));
    const scheduledBlocks = [
        ...normalizeBlocks(args.scheduledBlocks),
        ...otherDraftBlocks,
    ];

    if (args.mode === "shorter") {
        const durationMin = Math.max(20, current.durationMin - 15);
        const slot = findNextFreeSlot(scheduledBlocks, new Date(current.startAt), durationMin);
        if (!slot) return args.proposal;

        const drafts = args.proposal.drafts.map((draft, index) => (
            index === args.draftIndex
                ? {
                    ...draft,
                    durationMin,
                    startAt: slot.startAt.toISOString(),
                    endAt: slot.endAt.toISOString(),
                    reason: language === "es" ? "Acortado para bajar friccion." : "Shortened to lower friction.",
                }
                : draft
        ));

        const next = buildPlanSummary({
            context: args.proposal.context,
            interpretation: args.proposal.interpretation,
            drafts,
            language,
        });
        return {
            ...next,
            sessionId: args.proposal.sessionId,
            inputId: args.proposal.inputId,
            parentProposalId: args.proposal.proposalId || args.proposal.parentProposalId,
            variant: "edited",
        };
    }

    const delta = args.mode === "earlier" ? -15 : 15;
    const desiredStart = new Date(new Date(current.startAt).getTime() + (delta * MINUTE_MS));
    const slot = findNextFreeSlot(scheduledBlocks, desiredStart, current.durationMin);
    if (!slot) return args.proposal;

    const drafts = args.proposal.drafts.map((draft, index) => (
        index === args.draftIndex
            ? {
                ...draft,
                startAt: slot.startAt.toISOString(),
                endAt: slot.endAt.toISOString(),
                reason: args.mode === "earlier"
                    ? (language === "es" ? "Movido un poco antes." : "Moved a bit earlier.")
                    : (language === "es" ? "Movido un poco despues." : "Moved a bit later."),
            }
            : draft
    ));

    const next = buildPlanSummary({
        context: args.proposal.context,
        interpretation: args.proposal.interpretation,
        drafts,
        language,
    });
    return {
        ...next,
        sessionId: args.proposal.sessionId,
        inputId: args.proposal.inputId,
        parentProposalId: args.proposal.proposalId || args.proposal.parentProposalId,
        variant: "edited",
    };
}
