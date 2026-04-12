"use client";

import { useEffect } from "react";
import { trackHabitEvent } from "@/lib/services/habitService";

export function WidgetViewTracker() {
    useEffect(() => {
        void trackHabitEvent({
            name: "widget_viewed",
            surface: "widget",
        });
    }, []);

    return null;
}
