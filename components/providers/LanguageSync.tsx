"use client";

import { useEffect } from "react";
import { useSettingsStore } from "@/lib/stores/settingsStore";

export function LanguageSync() {
    const language = useSettingsStore((state) => state.settings.language);

    useEffect(() => {
        document.documentElement.lang = language;
        document.cookie = `agendo-language=${language}; path=/; max-age=31536000; samesite=lax`;
    }, [language]);

    return null;
}
