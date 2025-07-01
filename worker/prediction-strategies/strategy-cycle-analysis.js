// prediction-strategies/strategy-cycle-analysis.js
// Strategy: Analyzes the appearance cycles of numbers and predicts upcoming hits
// based on their historical periodicity.

self.StrategyCycleAnalysis = {
    name: 'Phân Tích Chu Kỳ',
    description: 'Dự đoán các số lô dựa trên tần suất và độ đều đặn của chu kỳ xuất hiện trong lịch sử.',
    weight: self.WorkerUtils.CONSTANTS.STRATEGY_WEIGHTS.CYCLE_ANALYSIS,

    /**
     * Executes the cycle analysis prediction strategy.
     * @param {DataAnalyzer} analyzer An instance of DataAnalyzer.
     * @returns {Map<string, number>} A map where keys are lotto numbers and values are their scores (0-100).
     */
    predict: function(analyzer) {
        const scores = new Map();
        const allLottoNumbers = analyzer.allLottoNumbers;
        allLottoNumbers.forEach(num => scores.set(num, 0));

        const cycleData = analyzer.getNumberCycleAnalysis(3);

        cycleData.forEach((info, num) => {
            if (info.appearances.length === 0) return;

            let cycleScore = 0;

            // --- Indicator 1: Numbers at or near their average cycle point (due to hit) ---
            this._applyDueCycleScores(scores, num, info, analyzer);

            // --- Indicator 2: Numbers whose "daysGone" is long, but their cycle is also long ---
            this._applyOverdueLongCycleScores(scores, num, info);

            // --- Indicator 3: Numbers with very stable and short cycles ---
            this._applyStableShortCycleScores(scores, num, info);

            scores.set(num, scores.get(num) + cycleScore);
        });

        // Ensure scores are capped
        allLottoNumbers.forEach(num => {
            scores.set(num, Math.max(0, Math.min(scores.get(num) || 0, self.WorkerUtils.CONSTANTS.MAX_STRATEGY_SCORE)));
        });

        return scores;
    },

    // --- Internal Helper Functions ---
    _applyDueCycleScores: function(scores, num, info, analyzer) {
        if (info.avgCycle > 0 && info.consistencyScore > 0.6) {
            const expectedNextAppearanceDayIndex = info.appearances[info.appearances.length - 1] + info.avgCycle;
            const daysUntilDue = expectedNextAppearanceDayIndex - analyzer.currentDayIndex;

            if (daysUntilDue >= -2 && daysUntilDue <= 3) {
                const proximityScore = 50 * info.consistencyScore * (1 - Math.abs(daysUntilDue) / Math.max(1, info.avgCycle));
                scores.set(num, scores.get(num) + proximityScore);
            }
        }
    },

    _applyOverdueLongCycleScores: function(scores, num, info) {
        if (info.daysSinceLast >= info.avgCycle * 1.5 && info.avgCycle >= 10 && info.consistencyScore > 0.5) {
            scores.set(num, scores.get(num) + 25);
        }
    },

    _applyStableShortCycleScores: function(scores, num, info) {
        if (info.avgCycle < 5 && info.consistencyScore > 0.8 && info.appearances.length > 5) {
            scores.set(num, scores.get(num) + 30);
        }
    }
};
