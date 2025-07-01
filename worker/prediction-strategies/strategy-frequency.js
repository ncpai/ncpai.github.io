// prediction-strategies/strategy-frequency.js
// Strategy: Focuses on the frequency of numbers appearing in recent history,
// with nuanced scoring for hot, cold, and consistently appearing numbers.

self.StrategyFrequency = {
    name: 'Tần Suất Tổng Hợp',
    description: 'Đánh giá các con số dựa trên tần suất xuất hiện trong nhiều khung thời gian, phân biệt số nóng, lạnh và trung bình.',
    weight: self.WorkerUtils.CONSTANTS.STRATEGY_WEIGHTS.FREQUENCY,

    /**
     * Executes the frequency-based prediction strategy.
     * Combines multiple frequency indicators for a comprehensive score.
     * @param {DataAnalyzer} analyzer An instance of DataAnalyzer initialized with historical data.
     * @returns {Map<string, number>} A map where keys are lotto numbers and values are their scores (0-100).
     */
    predict: function(analyzer) {
        const scores = new Map();
        const allLottoNumbers = analyzer.allLottoNumbers;
        allLottoNumbers.forEach(num => scores.set(num, 0)); // Initialize all scores to 0

        const totalDaysInHistory = analyzer.historyData.length;

        // --- Indicator 1: Short-term HOT numbers (Last 3/7 Days) ---
        this._applyHotNumberScores(scores, analyzer, self.WorkerUtils.CONSTANTS.LOOKBACK.VERY_SHORT, 30, 2.0);
        this._applyHotNumberScores(scores, analyzer, self.WorkerUtils.CONSTANTS.LOOKBACK.SHORT, 20, 1.5);

        // --- Indicator 2: Medium & Long-term Consistency (Last 30/90 Days) ---
        this._applyConsistentFrequencyScores(scores, analyzer, self.WorkerUtils.CONSTANTS.LOOKBACK.MEDIUM, 15, 0.8);
        this._applyConsistentFrequencyScores(scores, analyzer, self.WorkerUtils.CONSTANTS.LOOKBACK.LONG, 10, 0.5);

        // --- Indicator 3: COLD Numbers as Potential (if not too cold) ---
        this._applyColdNumberPenalties(scores, analyzer, self.WorkerUtils.CONSTANTS.LOOKBACK.VERY_LONG, 0.4); // Significant penalty for truly cold numbers
        this._applyColdNumberBoosts(scores, analyzer, self.WorkerUtils.CONSTANTS.LOOKBACK.MEDIUM, 0.2); // Small boost for 'medium cold' numbers

        // --- Indicator 4: Appearance Rate vs. Expected Rate ---
        const longTermFreq = analyzer.getNumbersFrequency(self.WorkerUtils.CONSTANTS.LOOKBACK.EXTENDED);
        allLottoNumbers.forEach(num => {
            const observedFreq = longTermFreq.get(num) || 0;
            const expectedFreq = (27 * totalDaysInHistory) / allLottoNumbers.length;

            if (expectedFreq > 0) {
                const deviation = observedFreq - expectedFreq;
                if (deviation > 0) {
                    scores.set(num, scores.get(num) + Math.min(20, deviation * 0.5));
                } else if (deviation < -5) {
                    scores.set(num, scores.get(num) + Math.max(-15, deviation * 0.2));
                }
            }
        });
        
        // --- Indicator 5: Multi-hit Frequencies (2 nháy, 3 nháy) ---
        const multiHitStats = analyzer.getMultiHitFrequencies(self.WorkerUtils.CONSTANTS.LOOKBACK.LONG);
        multiHitStats.forEach((stats, num) => {
            scores.set(num, scores.get(num) + (stats.twoHits * 5) + (stats.threeHits * 15));
        });

        // Ensure scores are within a reasonable range (0-MAX_STRATEGY_SCORE)
        allLottoNumbers.forEach(num => {
            scores.set(num, Math.max(0, Math.min(scores.get(num) || 0, self.WorkerUtils.CONSTANTS.MAX_STRATEGY_SCORE)));
        });

        return scores;
    },

    // --- Internal Helper Functions for this Strategy ---

    _applyHotNumberScores: function(scores, analyzer, lookbackDays, topN, scoreMultiplier) {
        const freqMap = analyzer.getNumbersFrequency(lookbackDays);
        const sorted = Array.from(freqMap.entries()).sort((a, b) => b[1] - a[1]);
        sorted.slice(0, topN).forEach(([num, count], index) => {
            const baseScore = (count / lookbackDays / 27) * self.WorkerUtils.CONSTANTS.MAX_STRATEGY_SCORE;
            scores.set(num, scores.get(num) + (baseScore * scoreMultiplier) + (topN - index) * 0.5);
        });
    },

    _applyConsistentFrequencyScores: function(scores, analyzer, lookbackDays, topN, scoreMultiplier) {
        const freqMap = analyzer.getNumbersFrequency(lookbackDays);
        const sorted = Array.from(freqMap.entries()).sort((a, b) => b[1] - a[1]);
        sorted.slice(0, topN).forEach(([num, count], index) => {
            const consistencyScore = (count / (27 * lookbackDays)) * self.WorkerUtils.CONSTANTS.MAX_STRATEGY_SCORE;
            scores.set(num, scores.get(num) + (consistencyScore * scoreMultiplier) + (topN - index) * 0.2);
        });
    },

    _applyColdNumberPenalties: function(scores, analyzer, lookbackDays, penaltyFactor) {
        const coldNumbers = analyzer.getColdNumbers(20, lookbackDays);
        coldNumbers.forEach(num => {
            scores.set(num, scores.get(num) * penaltyFactor);
        });
    },

    _applyColdNumberBoosts: function(scores, analyzer, lookbackDays, boostValue) {
        const allNumbersFreq = analyzer.getNumbersFrequency(lookbackDays);
        const sortedByFreq = Array.from(allNumbersFreq.entries()).sort((a, b) => a[1] - b[1]);

        const mediumColdSlice = sortedByFreq.slice(Math.floor(sortedByFreq.length * 0.2), Math.floor(sortedByFreq.length * 0.4));
        mediumColdSlice.forEach(([num, count]) => {
            if (count > 0) {
                scores.set(num, scores.get(num) + boostValue * 10);
            }
        });
    }
};
