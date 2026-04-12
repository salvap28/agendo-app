import { calculateProfileCalibrationProgress } from "@/lib/server/personalIntelligence";

describe("calculateProfileCalibrationProgress", () => {
    it("keeps calibration modest when the signal is mostly inferred", () => {
        const progress = calculateProfileCalibrationProgress({
            overallConfidence: 0.98,
            recentAnalyticsCount: 18,
            confirmedActivityCount: 0,
            confirmedFocusReflectionCount: 0,
        });

        expect(progress).toBe(30);
    });

    it("rewards confirmed check-ins and focus reflections much more strongly", () => {
        const progress = calculateProfileCalibrationProgress({
            overallConfidence: 0.92,
            recentAnalyticsCount: 14,
            confirmedActivityCount: 12,
            confirmedFocusReflectionCount: 8,
        });

        expect(progress).toBe(98);
    });
});
