import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { tryCreateClient } from '@/lib/supabase/client';

export interface UserSettings {
    theme_color: string;
    performance_mode: boolean;
    first_day_of_week: 0 | 1; // 0: Sunday, 1: Monday
    time_format: '12h' | '24h';
    focus_default_minutes: number;
    rest_default_minutes: number;
    auto_start_rest: boolean;
    notify_block_reminders: boolean;
    notify_focus_timer: boolean;
    notify_gym_rest: boolean;
    notify_daily_briefing: boolean;
}

const defaultSettings: UserSettings = {
    theme_color: '#3B82F6', // Default blue-ish
    performance_mode: false,
    first_day_of_week: 1, // Default Monday
    time_format: '24h',
    focus_default_minutes: 25,
    rest_default_minutes: 5,
    auto_start_rest: false,
    notify_block_reminders: true,
    notify_focus_timer: true,
    notify_gym_rest: true,
    notify_daily_briefing: true,
};

function mergeSettings(data?: Partial<UserSettings> | null): UserSettings {
    return {
        ...defaultSettings,
        ...(data ?? {}),
    };
}

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : error;
}

interface SettingsState {
    settings: UserSettings;
    isLoading: boolean;
    isInitialized: boolean;
    updateSetting: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => Promise<void>;
    fetchSettings: (userId: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            settings: defaultSettings,
            isLoading: false,
            isInitialized: false,

            fetchSettings: async (userId: string) => {
                if (!userId) return;
                set({ isLoading: true });
                const supabase = tryCreateClient();

                if (!supabase) {
                    set({ isLoading: false, isInitialized: true });
                    return;
                }

                try {
                    const { data, error } = await supabase
                        .from('user_settings')
                        .select('*')
                        .eq('user_id', userId)
                        .single();

                    if (error) {
                        if (error.code === 'PGRST116') {
                            // Row doesn't exist yet, insert default settings
                            const { data: newData, error: insertError } = await supabase
                                .from('user_settings')
                                .insert([{ user_id: userId, ...defaultSettings }])
                                .select()
                                .single();

                            if (!insertError && newData) {
                                set({ settings: mergeSettings(newData as Partial<UserSettings>) });
                            }
                        } else {
                            // If table is missing, just ignore and use defaults.
                            if (error.code !== '42P01' && !error.message?.includes('schema cache')) {
                                console.error('Error al cargar configuración:', error.message || error);
                            }
                        }
                    } else if (data) {
                        set({ settings: mergeSettings(data as Partial<UserSettings>) });
                    }
                } catch (error: unknown) {
                    console.error('Error general en fetchSettings:', getErrorMessage(error));
                } finally {
                    set({ isLoading: false, isInitialized: true });
                }
            },

            updateSetting: async (key, value) => {
                // Optimistic UI update
                set((state) => ({
                    settings: {
                        ...state.settings,
                        [key]: value,
                    },
                }));

                const supabase = tryCreateClient();
                if (!supabase) return;

                const { data: { session } } = await supabase.auth.getSession();
                const userId = session?.user?.id;

                if (!userId) return;

                try {
                    const { error } = await supabase
                        .from('user_settings')
                        .update({ [key]: value })
                        .eq('user_id', userId);

                    if (error && error.code !== '42P01' && !error.message?.includes('schema cache')) {
                        console.error('Error al guardar configuración en BD:', error.message || error);
                    }
                } catch (error: unknown) {
                    console.error('Error general en updateSetting:', getErrorMessage(error));
                }
            },
        }),
        {
            name: 'agendo-settings',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({ settings: state.settings }), // Only persist settings to localStorage
        }
    )
);
