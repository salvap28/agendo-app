type EvidenceConfidenceArgs = {
    sampleSize: number;
    minSampleSize?: number;
    targetSampleSize?: number;
    variability: number;
    variabilityTolerance?: number;
    recencyDays: number;
    recencyWindowDays?: number;
    dominance: number;
    dominanceTarget?: number;
    consistency: number;
};

export function clampUnit(value: number) {
    return Math.min(1, Math.max(0, value));
}

export function roundToTwoDecimals(value: number) {
    return Math.round(value * 100) / 100;
}

export function average(values: number[]) {
    if (values.length === 0) return 0;
    return values.reduce((total, value) => total + value, 0) / values.length;
}

export function variance(values: number[]) {
    if (values.length <= 1) return 0;
    const mean = average(values);
    return average(values.map((value) => (value - mean) ** 2));
}

export function standardDeviation(values: number[]) {
    return Math.sqrt(variance(values));
}

export function calculateEvidenceConfidence({
    sampleSize,
    minSampleSize = 3,
    targetSampleSize = 8,
    variability,
    variabilityTolerance = 20,
    recencyDays,
    recencyWindowDays = 30,
    dominance,
    dominanceTarget = 14,
    consistency,
}: EvidenceConfidenceArgs) {
    const sampleScore = sampleSize < minSampleSize
        ? 0
        : clampUnit((sampleSize - minSampleSize + 1) / Math.max(1, targetSampleSize - minSampleSize + 1));
    const variabilityScore = clampUnit(1 - (variability / Math.max(1, variabilityTolerance)));
    const recencyScore = clampUnit(1 - (recencyDays / Math.max(1, recencyWindowDays)));
    const dominanceScore = clampUnit(dominance / Math.max(1, dominanceTarget));
    const consistencyScore = clampUnit(consistency);

    return roundToTwoDecimals(
        (sampleScore * 0.28) +
        (variabilityScore * 0.22) +
        (recencyScore * 0.18) +
        (dominanceScore * 0.18) +
        (consistencyScore * 0.14)
    );
}

export function meetsEvidenceThreshold(
    confidence: number,
    sampleSize: number,
    options?: {
        minConfidence?: number;
        minSampleSize?: number;
    }
) {
    const minConfidence = options?.minConfidence ?? 0.6;
    const minSampleSize = options?.minSampleSize ?? 3;
    return confidence >= minConfidence && sampleSize >= minSampleSize;
}
