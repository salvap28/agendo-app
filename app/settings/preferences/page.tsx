"use client";

import { useEffect } from "react";
import { useSettingsStore } from "@/lib/stores/settingsStore";
import { tryCreateClient } from "@/lib/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GlassSwitch } from "@/components/ui/glass-switch";
import { useI18n } from "@/lib/i18n/client";

export default function PreferencesTab() {
    const { settings, updateSetting, fetchSettings, isInitialized } = useSettingsStore();
    const { t } = useI18n();

    useEffect(() => {
        async function init() {
            const supabase = tryCreateClient();
            if (!supabase) return;

            if (!isInitialized) {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user?.id) {
                    await fetchSettings(session.user.id);
                }
            }
        }
        init();
    }, [isInitialized, fetchSettings]);

    return (
        <div suppressHydrationWarning className="flex flex-col gap-8 w-full">
            <div>
                <h1 className="text-3xl font-semibold mb-3">{t.settingsPreferences.title}</h1>
                <p className="text-foreground/60 text-base">{t.settingsPreferences.description}</p>
            </div>

            <div className="bg-white/5 border border-white/10 backdrop-blur-md rounded-3xl p-8 flex flex-col gap-10">
                <div className="flex flex-col gap-6">
                    <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">{t.settingsPreferences.calendarAndSystem}</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="flex flex-col gap-3">
                            <label className="text-sm text-foreground/80 font-medium">{t.settingsPreferences.firstDayOfWeek}</label>
                            <Select
                                value={settings.first_day_of_week.toString()}
                                onValueChange={(val) => updateSetting('first_day_of_week', parseInt(val) as 0 | 1)}
                            >
                                <SelectTrigger className="w-full bg-black/20 border-white/10 h-12 rounded-xl text-foreground">
                                    <SelectValue placeholder={t.settingsPreferences.selectDay} />
                                </SelectTrigger>
                                <SelectContent className="bg-[#0a0b12] border border-white/10 text-foreground">
                                    <SelectItem value="1">{t.settingsPreferences.monday}</SelectItem>
                                    <SelectItem value="0">{t.settingsPreferences.sunday}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex flex-col gap-3">
                            <label className="text-sm text-foreground/80 font-medium">{t.settingsPreferences.timeFormat}</label>
                            <Select
                                value={settings.time_format}
                                onValueChange={(val) => updateSetting('time_format', val as '12h' | '24h')}
                            >
                                <SelectTrigger className="w-full bg-black/20 border-white/10 h-12 rounded-xl text-foreground">
                                    <SelectValue placeholder={t.settingsPreferences.selectFormat} />
                                </SelectTrigger>
                                <SelectContent className="bg-[#0a0b12] border border-white/10 text-foreground">
                                    <SelectItem value="24h">{t.settingsPreferences.time24}</SelectItem>
                                    <SelectItem value="12h">{t.settingsPreferences.time12}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                <div className="w-full h-px bg-white/5"></div>

                <div className="flex flex-col gap-6">
                    <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">{t.settingsPreferences.focusSessions}</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="flex flex-col gap-3">
                            <label className="text-sm text-foreground/80 font-medium">{t.settingsPreferences.focusDefaultMinutes}</label>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center bg-black/20 border border-white/10 rounded-xl overflow-hidden h-12">
                                    <button
                                        onClick={() => updateSetting('focus_default_minutes', Math.max(1, settings.focus_default_minutes - 5))}
                                        className="h-full px-4 text-foreground/70 hover:text-foreground hover:bg-white/5 transition-colors border-r border-white/5"
                                    >
                                        -
                                    </button>
                                    <input
                                        type="text"
                                        value={settings.focus_default_minutes}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value);
                                            if (!isNaN(val)) updateSetting('focus_default_minutes', val);
                                        }}
                                        className="w-16 bg-transparent text-center text-lg focus:outline-none"
                                    />
                                    <button
                                        onClick={() => updateSetting('focus_default_minutes', Math.min(120, settings.focus_default_minutes + 5))}
                                        className="h-full px-4 text-foreground/70 hover:text-foreground hover:bg-white/5 transition-colors border-l border-white/5"
                                    >
                                        +
                                    </button>
                                </div>
                                <span className="text-base text-foreground/50 font-medium">{t.common.minuteShort}</span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            <label className="text-sm text-foreground/80 font-medium">{t.settingsPreferences.restDefaultMinutes}</label>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center bg-black/20 border border-white/10 rounded-xl overflow-hidden h-12">
                                    <button
                                        onClick={() => updateSetting('rest_default_minutes', Math.max(1, settings.rest_default_minutes - 1))}
                                        className="h-full px-4 text-foreground/70 hover:text-foreground hover:bg-white/5 transition-colors border-r border-white/5"
                                    >
                                        -
                                    </button>
                                    <input
                                        type="text"
                                        value={settings.rest_default_minutes}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value);
                                            if (!isNaN(val)) updateSetting('rest_default_minutes', val);
                                        }}
                                        className="w-16 bg-transparent text-center text-lg focus:outline-none"
                                    />
                                    <button
                                        onClick={() => updateSetting('rest_default_minutes', Math.min(60, settings.rest_default_minutes + 1))}
                                        className="h-full px-4 text-foreground/70 hover:text-foreground hover:bg-white/5 transition-colors border-l border-white/5"
                                    >
                                        +
                                    </button>
                                </div>
                                <span className="text-base text-foreground/50 font-medium">{t.common.minuteShort}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between items-center mt-6 bg-black/20 p-6 rounded-2xl border border-white/5 shadow-inner">
                        <div className="flex flex-col gap-2">
                            <h4 className="text-base font-medium text-foreground/90">{t.settingsPreferences.autoStartRest}</h4>
                            <p className="text-sm text-foreground/50 max-w-[80%]">{t.settingsPreferences.autoStartRestDescription}</p>
                        </div>
                        <GlassSwitch
                            checked={settings.auto_start_rest}
                            onCheckedChange={(val) => updateSetting('auto_start_rest', val)}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
