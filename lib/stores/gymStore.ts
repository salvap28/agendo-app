import { create } from 'zustand';
import { createClient, getClientUser } from '@/lib/supabase/client';
import { WorkoutRoutine } from '@/lib/types/focus';

interface GymState {
    routines: WorkoutRoutine[];
    isLoading: boolean;
    isInitialized: boolean;
    fetchRoutines: () => Promise<void>;
    addRoutine: (routine: Omit<WorkoutRoutine, 'id' | 'created_at' | 'user_id'>) => Promise<void>;
    updateRoutine: (id: string, updates: Partial<WorkoutRoutine>) => Promise<void>;
    deleteRoutine: (id: string) => Promise<void>;
}

export const useGymStore = create<GymState>((set, get) => ({
    routines: [],
    isLoading: false,
    isInitialized: false,

    fetchRoutines: async () => {
        set({ isLoading: true });
        const supabase = createClient();
        const user = await getClientUser(supabase);
        if (!user) { set({ isLoading: false }); return; }

        const { data, error } = await supabase
            .from('gym_routines')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (!error && data) {
            set({ routines: data as WorkoutRoutine[], isInitialized: true });
        }
        set({ isLoading: false });
    },

    addRoutine: async (routine) => {
        const supabase = createClient();
        const user = await getClientUser(supabase);
        if (!user) return;

        const newRoutine = {
            ...routine,
            user_id: user.id,
        };

        const tempId = crypto.randomUUID();
        set((state) => ({
            routines: [{ ...newRoutine, id: tempId, created_at: new Date().toISOString() } as WorkoutRoutine, ...state.routines]
        }));

        const { data, error } = await supabase
            .from('gym_routines')
            .insert(newRoutine)
            .select()
            .single();

        if (!error && data) {
            set((state) => ({
                routines: state.routines.map(r => r.id === tempId ? (data as WorkoutRoutine) : r)
            }));
        } else {
            console.error('Failed to save routine:', error);
            set((state) => ({
                routines: state.routines.filter(r => r.id !== tempId)
            }));
        }
    },

    updateRoutine: async (id, updates) => {
        const supabase = createClient();

        set((state) => ({
            routines: state.routines.map(r => r.id === id ? { ...r, ...updates } : r)
        }));

        const { error } = await supabase
            .from('gym_routines')
            .update(updates)
            .eq('id', id);

        if (error) {
            console.error('Failed to update routine:', error);
            get().fetchRoutines();
        }
    },

    deleteRoutine: async (id) => {
        const supabase = createClient();

        set((state) => ({
            routines: state.routines.filter(r => r.id !== id)
        }));

        const { error } = await supabase
            .from('gym_routines')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Failed to delete routine:', error);
            get().fetchRoutines();
        }
    }
}));
