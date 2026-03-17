import {
    BehaviorProfile,
    FocusSessionAnalytics,
    InsightCardData,
    PatternTrend,
} from "@/lib/types/behavior";

function getInsightWindowLabel(window: NonNullable<BehaviorProfile["bestFocusWindow"]>["data"]["window"]) {
    switch (window) {
        case "morning":
            return "morning";
        case "afternoon":
            return "afternoon";
        case "evening":
            return "evening";
        case "night":
            return "night";
        default:
            return "best window";
    }
}

function describeDuration(pattern: NonNullable<BehaviorProfile["optimalSessionLength"]>) {
    const { minMinutes, maxMinutes, medianMinutes } = pattern.data;
    if (pattern.data.bucket === "medium") {
        return `around ${medianMinutes} minutes`;
    }

    return `${minMinutes}-${maxMinutes} minutes`;
}

function describeTrend(direction: PatternTrend) {
    switch (direction) {
        case "improving":
            return "is getting steadier";
        case "declining":
            return "looks more fragile";
        case "stable":
            return "is holding steady";
        default:
            return "is holding";
    }
}

export function buildInsightCards(profile: BehaviorProfile): InsightCardData[] {
    const cards: InsightCardData[] = [];
    const canSurfacePersistentPatterns = profile.warmupStage === "ready";
    const canSurfaceComparativeSignals = profile.warmupStage !== "cold";

    if (canSurfacePersistentPatterns && profile.bestFocusWindow) {
        cards.push({
            id: "best_focus_window",
            patternKey: profile.bestFocusWindow.patternKey,
            type: "best_focus_window",
            tone: "positive",
            title: "Your strongest window",
            description: `${getInsightWindowLabel(profile.bestFocusWindow.data.window)} is where focus tends to hold with less friction.`,
            confidence: profile.bestFocusWindow.confidence,
            sampleSize: profile.bestFocusWindow.sampleSize,
        });
    }

    if (canSurfacePersistentPatterns && profile.optimalSessionLength) {
        cards.push({
            id: "optimal_session_length",
            patternKey: profile.optimalSessionLength.patternKey,
            type: "optimal_session_length",
            tone: "neutral",
            title: "Your sustainable session length",
            description: `${describeDuration(profile.optimalSessionLength)} looks like your most reliable range right now.`,
            confidence: profile.optimalSessionLength.confidence,
            sampleSize: profile.optimalSessionLength.sampleSize,
        });
    }

    const topFriction = profile.topFrictionSources[0];
    if (canSurfacePersistentPatterns && topFriction) {
        cards.push({
            id: "friction_source",
            patternKey: topFriction.patternKey,
            type: "friction_source",
            tone: "caution",
            title: "Where friction rises",
            description: `${topFriction.data.label} is showing up as a harder context to sustain right now.`,
            confidence: topFriction.confidence,
            sampleSize: topFriction.sampleSize,
        });
    }

    if (canSurfaceComparativeSignals && profile.consistencyTrend && profile.consistencyTrend.confidence >= 0.72) {
        const direction = profile.consistencyTrend.data.direction;
        cards.push({
            id: "consistency_trend",
            patternKey: profile.consistencyTrend.patternKey,
            type: "consistency_trend",
            tone: direction === "declining" ? "caution" : "positive",
            title: "Consistency trend",
            description: `Recent follow-through ${describeTrend(direction)} vs the previous window (${profile.consistencyTrend.data.delta > 0 ? "+" : ""}${profile.consistencyTrend.data.delta}).`,
            confidence: profile.consistencyTrend.confidence,
            sampleSize: profile.consistencyTrend.sampleSize,
        });
    }

    const recentImprovement = profile.recentImprovements[0];
    if (canSurfaceComparativeSignals && recentImprovement && recentImprovement.confidence >= 0.72) {
        cards.push({
            id: "recent_improvement",
            patternKey: recentImprovement.patternKey,
            type: "recent_improvement",
            tone: "positive",
            title: "A recent lift",
            description: recentImprovement.data.area === "friction"
                ? `Recent friction is down ${recentImprovement.data.delta} points vs last week.`
                : recentImprovement.data.area === "stability"
                    ? "Recent sessions recovered stability vs the previous window."
                    : recentImprovement.data.area === "recovery"
                        ? "You are returning to focus faster after disruptions."
                        : `Weekly consistency is up ${recentImprovement.data.delta} points.`,
            confidence: recentImprovement.confidence,
            sampleSize: recentImprovement.sampleSize,
        });
    }

    const activityPattern = profile.activityPatterns[0];
    if (activityPattern && activityPattern.confidence >= 0.68) {
        cards.push({
            id: activityPattern.patternKey,
            patternKey: activityPattern.patternKey,
            type: activityPattern.patternType,
            tone: activityPattern.patternType === "recovery_boost" || activityPattern.patternType === "preferred_light_execution_window"
                ? "positive"
                : activityPattern.patternType === "attendance_reliability"
                    ? "neutral"
                    : "caution",
            title: activityPattern.title,
            description: activityPattern.description,
            confidence: activityPattern.confidence,
            sampleSize: activityPattern.sampleSize,
        });
    }

    if (profile.activitySignals.attendanceReliability !== null && profile.activitySignals.attendanceReliability < 0.62) {
        cards.push({
            id: "attendance_reliability",
            patternKey: "activity_signal:attendance_reliability",
            type: "activity_signal",
            tone: "caution",
            title: "Attendance is less stable than it looks",
            description: "Classes, meetings or attendance-style blocks are not landing as consistently as they are being scheduled.",
            confidence: 0.7,
            sampleSize: Math.max(2, profile.activityAnalytics?.totalCount ?? 0),
        });
    }

    if (profile.activitySignals.preferredLightExecutionWindows[0] && cards.length < 5) {
        const preferredWindow = profile.activitySignals.preferredLightExecutionWindows[0];
        cards.push({
            id: "preferred_light_execution_window",
            patternKey: `activity_signal:${preferredWindow.window}`,
            type: "activity_signal",
            tone: "neutral",
            title: "A cleaner window for lighter work",
            description: `${preferredWindow.window} is reading as a better slot for admin or lighter execution blocks.`,
            confidence: preferredWindow.confidence,
            sampleSize: preferredWindow.sampleSize,
        });
    }

    return cards;
}

export function buildProfileSummary(profile: BehaviorProfile, recentAnalytics: FocusSessionAnalytics[]) {
    if (recentAnalytics.length === 0) {
        return "A few more sessions will make this profile sharper.";
    }

    if (profile.warmupStage !== "ready") {
        return "Agendo is calibrating your profile before locking in stronger patterns.";
    }

    if (profile.bestFocusWindow && profile.optimalSessionLength) {
        return "A stronger focus window and a more sustainable session length are already emerging.";
    }

    if (profile.topFrictionSources.length > 0) {
        return "A recurring friction context is already becoming clear.";
    }

    if (profile.activityPatterns.length > 0) {
        return "Agendo is also learning from meetings, recovery and lighter activities beyond Focus Mode.";
    }

    return "Your profile is gathering enough evidence to guide you more clearly.";
}
