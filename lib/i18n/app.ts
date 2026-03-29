import { enUS, es } from "date-fns/locale";
import type { Locale } from "date-fns";
import type { ActivityOutcome, EnergyImpact, PerceivedValue } from "@/lib/types/activity";
import type { BlockStatus, BlockType, RecurrencePattern } from "@/lib/types/blocks";
import type { AppLanguage } from "./messages";

const DATE_FNS_LOCALES: Record<AppLanguage, Locale> = {
    en: enUS,
    es,
};

const INTL_LOCALES: Record<AppLanguage, string> = {
    en: "en-US",
    es: "es-AR",
};

const BLOCK_TYPE_LABELS: Record<AppLanguage, Record<BlockType | "free", string>> = {
    en: {
        deep_work: "Deep Work",
        meeting: "Meeting",
        gym: "Training",
        study: "Study",
        admin: "Admin",
        break: "Break",
        other: "Focus",
        free: "Free Focus",
    },
    es: {
        deep_work: "Deep Work",
        meeting: "Reunión",
        gym: "Entrenamiento",
        study: "Estudio",
        admin: "Admin",
        break: "Descanso",
        other: "Foco",
        free: "Focus libre",
    },
};

const BLOCK_STATUS_LABELS: Record<AppLanguage, Record<BlockStatus, string>> = {
    en: {
        planned: "Planned",
        active: "In progress",
        completed: "Completed",
        canceled: "Canceled",
    },
    es: {
        planned: "Planificado",
        active: "En progreso",
        completed: "Completado",
        canceled: "Cancelado",
    },
};

const RECURRENCE_LABELS: Record<AppLanguage, Record<RecurrencePattern["type"] | "none", string>> = {
    en: {
        none: "Does not repeat",
        daily: "Every day",
        weekly: "Every week",
        custom: "Custom",
    },
    es: {
        none: "No se repite",
        daily: "Todos los días",
        weekly: "Cada semana",
        custom: "Personalizado",
    },
};

const WEEKDAY_NAMES_SUNDAY_FIRST: Record<AppLanguage, string[]> = {
    en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    es: ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"],
};

const WEEKDAY_INITIALS_SUNDAY_FIRST: Record<AppLanguage, string[]> = {
    en: ["S", "M", "T", "W", "T", "F", "S"],
    es: ["D", "L", "M", "X", "J", "V", "S"],
};

const WEEKDAY_INITIALS_MONDAY_FIRST: Record<AppLanguage, string[]> = {
    en: ["M", "T", "W", "T", "F", "S", "S"],
    es: ["L", "M", "X", "J", "V", "S", "D"],
};

const ACTIVITY_OUTCOME_LABELS: Record<AppLanguage, Record<ActivityOutcome, string>> = {
    en: {
        attended: "Attended",
        completed: "Done",
        partial: "Partial",
        joined_late: "Joined late",
        left_early: "Left early",
        skipped: "Skipped",
        cancelled: "Cancelled",
        postponed: "Postponed",
        rescheduled: "Rescheduled",
        interrupted: "Interrupted",
        unknown: "Unknown",
    },
    es: {
        attended: "Asistí",
        completed: "Hecho",
        partial: "Parcial",
        joined_late: "LleguÃ© tarde",
        left_early: "Me fui antes",
        skipped: "Omitido",
        cancelled: "Cancelado",
        postponed: "Pospuesto",
        rescheduled: "Reprogramado",
        interrupted: "Interrumpido",
        unknown: "Sin clasificar",
    },
};

const ENERGY_IMPACT_LABELS: Record<AppLanguage, Record<EnergyImpact, string>> = {
    en: {
        restorative: "Restored",
        neutral: "Neutral",
        demanding: "Demanding",
        draining: "Drained",
        energizing: "Energized",
        unknown: "Unknown",
    },
    es: {
        restorative: "Recuperado",
        neutral: "Neutral",
        demanding: "Demandante",
        draining: "Drenado",
        energizing: "Activado",
        unknown: "Sin clasificar",
    },
};

const PERCEIVED_VALUE_LABELS: Record<AppLanguage, Record<PerceivedValue, string>> = {
    en: {
        low: "Low",
        medium: "Medium",
        high: "High",
        unknown: "Unknown",
    },
    es: {
        low: "Bajo",
        medium: "Medio",
        high: "Alto",
        unknown: "Sin clasificar",
    },
};

export function getDateFnsLocale(language: AppLanguage) {
    return DATE_FNS_LOCALES[language];
}

export function getIntlLocale(language: AppLanguage) {
    return INTL_LOCALES[language];
}

export function getBlockTypeLabel(language: AppLanguage, type: BlockType | "free") {
    return BLOCK_TYPE_LABELS[language][type];
}

export function getBlockStatusLabel(language: AppLanguage, status: BlockStatus) {
    return BLOCK_STATUS_LABELS[language][status];
}

export function getRecurrenceLabel(
    language: AppLanguage,
    recurrence: RecurrencePattern["type"] | "none",
) {
    return RECURRENCE_LABELS[language][recurrence];
}

export function getWeekdayNamesSundayFirst(language: AppLanguage) {
    return WEEKDAY_NAMES_SUNDAY_FIRST[language];
}

export function getWeekdayInitialsSundayFirst(language: AppLanguage) {
    return WEEKDAY_INITIALS_SUNDAY_FIRST[language];
}

export function getWeekdayInitialsMondayFirst(language: AppLanguage) {
    return WEEKDAY_INITIALS_MONDAY_FIRST[language];
}

export function getActivityOutcomeLabel(language: AppLanguage, outcome: ActivityOutcome) {
    return ACTIVITY_OUTCOME_LABELS[language][outcome];
}

export function getEnergyImpactLabel(language: AppLanguage, impact: EnergyImpact) {
    return ENERGY_IMPACT_LABELS[language][impact];
}

export function getPerceivedValueLabel(language: AppLanguage, value: PerceivedValue) {
    return PERCEIVED_VALUE_LABELS[language][value];
}
