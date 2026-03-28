"use client";

import { useSettingsStore } from "@/lib/stores/settingsStore";
import { getMessages } from "./messages";

export function useI18n() {
    const language = useSettingsStore((state) => state.settings.language);

    return {
        language,
        t: getMessages(language),
    };
}
