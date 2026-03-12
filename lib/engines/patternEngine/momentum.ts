// Calculates the combined Day Momentum score (0-100)
// The formula attempts to build a balanced view: activity & health
export function calculateMomentumDay(
    progressScore: number,
    consistencyScore: number,
    frictionScore: number,
    emotionScore: number
): number {
    // Current weighting as per V1 specs: 
    // 40% progress, 25% consistency, -20% friction, 15% emotion
    // Note: since friction is negative, we add a base offset to balance it
    let momentum = (progressScore * 0.40) + 
                   (consistencyScore * 0.25) - 
                   (frictionScore * 0.20) + 
                   (emotionScore * 0.15) + 
                   15; // Base offset to recover from strict friction penalty
                   
    return Math.min(100, Math.max(0, Math.round(momentum)));
}

// Calculates long-term momentum taking into account past momentum points (0-100)
export function calculateMomentumTotal(pastMetrics: {date: string, momentum_day: number}[]): number {
    if (!pastMetrics || pastMetrics.length === 0) return 0;

    let weekSum = 0;
    let weekCount = 0;
    let monthSum = 0;
    let monthCount = 0;

    const now = new Date();
    
    // Graceful degradation: we will weigh recent days higher (60%) than the month overall (40%)
    pastMetrics.forEach(m => {
        const d = new Date(m.date);
        const diffDays = (now.getTime() - d.getTime()) / (1000 * 3600 * 24);
        
        // Convert null metrics gracefully
        const val = m.momentum_day || 0;
        
        if (diffDays <= 7) {
            weekSum += val;
            weekCount++;
        }
        if (diffDays <= 21) {
            monthSum += val;
            monthCount++;
        }
    });

    const weekAvg = weekCount > 0 ? weekSum / weekCount : 0;
    const monthAvg = monthCount > 0 ? monthSum / monthCount : 0;

    if (weekCount === 0 && monthCount === 0) return 0;

    const total = (weekAvg * 0.6) + (monthAvg * 0.4);
    
    return Math.min(100, Math.max(0, Math.round(total)));
}
