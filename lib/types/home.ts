export type HomeState =
    | "no_block"
    | "upcoming_block"
    | "active_block"
    | "completed_block";

export interface FocusBlock {
    id: string;
    title: string;
    timeRange: string;
    type: "Deep Work" | "Meeting" | "Gym" | "Study" | "Routine";
    status: "pending" | "active" | "completed";
}

export interface HomeData {
    state: HomeState;
    greeting: string;
    block?: FocusBlock;
    insight?: string;
}
