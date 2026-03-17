import { create } from "zustand";
import { ActivityExperience, ActivityExperienceCheckoutInput } from "@/lib/types/activity";
import {
    fetchBlockActivityExperience,
    fetchDayActivityExperiences,
    inferBlockActivityExperience,
    recordBlockActivityCheckout,
} from "@/lib/services/activityExperienceService";

interface ActivityExperienceState {
    experiences: ActivityExperience[];
    isLoading: boolean;
    lastDayLoaded: string | null;
    fetchDayExperiences: (date: string) => Promise<void>;
    refreshBlockExperience: (blockId: string) => Promise<ActivityExperience | null>;
    inferBlockExperience: (blockId: string) => Promise<ActivityExperience | null>;
    recordCheckout: (blockId: string, checkout: ActivityExperienceCheckoutInput) => Promise<ActivityExperience | null>;
    upsertExperience: (experience: ActivityExperience | null) => void;
    getByBlockId: (blockId: string) => ActivityExperience | null;
}

function upsertList(list: ActivityExperience[], incoming: ActivityExperience | null) {
    if (!incoming) return list;
    const existingIndex = list.findIndex((experience) => experience.id === incoming.id || experience.sourceBlockId === incoming.sourceBlockId);
    if (existingIndex === -1) return [incoming, ...list];

    const next = [...list];
    next[existingIndex] = incoming;
    return next;
}

export const useActivityExperienceStore = create<ActivityExperienceState>((set, get) => ({
    experiences: [],
    isLoading: false,
    lastDayLoaded: null,

    fetchDayExperiences: async (date) => {
        set({ isLoading: true });
        try {
            const { experiences } = await fetchDayActivityExperiences(date);
            set({
                experiences,
                isLoading: false,
                lastDayLoaded: date,
            });
        } catch (error) {
            console.error("Failed to fetch day activity experiences", error);
            set({ isLoading: false });
        }
    },

    refreshBlockExperience: async (blockId) => {
        try {
            const { experience } = await fetchBlockActivityExperience(blockId);
            set((state) => ({
                experiences: upsertList(state.experiences, experience),
            }));
            return experience;
        } catch (error) {
            console.error("Failed to refresh block activity experience", error);
            return null;
        }
    },

    inferBlockExperience: async (blockId) => {
        try {
            const { experience } = await inferBlockActivityExperience(blockId);
            set((state) => ({
                experiences: upsertList(state.experiences, experience),
            }));
            return experience;
        } catch (error) {
            console.error("Failed to infer block activity experience", error);
            return null;
        }
    },

    recordCheckout: async (blockId, checkout) => {
        try {
            const { experience } = await recordBlockActivityCheckout(blockId, checkout);
            set((state) => ({
                experiences: upsertList(state.experiences, experience),
            }));
            return experience;
        } catch (error) {
            console.error("Failed to record activity checkout", error);
            return null;
        }
    },

    upsertExperience: (experience) => {
        set((state) => ({
            experiences: upsertList(state.experiences, experience),
        }));
    },

    getByBlockId: (blockId) => {
        return get().experiences.find((experience) => experience.sourceBlockId === blockId) ?? null;
    },
}));
