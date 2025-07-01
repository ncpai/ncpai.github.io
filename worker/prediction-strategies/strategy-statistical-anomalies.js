// prediction-strategies/strategy-statistical-anomalies.js
// Strategy: Identifies numbers with abnormal statistical behavior (sudden spikes, extreme coldness).

self.StrategyStatisticalAnomalies = {
    name: 'Bất Thường Thống Kê',
    description: 'Tìm kiếm các con số có biến động tần suất đột ngột hoặc nằm ngoài các ngưỡng thống kê bình thường.',
    weight: self.WorkerUtils.CONSTANTS.STRATEGY_WEIGHTS.STATISTICAL_ANOMALIES,

    predict: function(analyzer) {
        const scores = new Map(analyzer.allLottoNumbers.map(num => [num, 0]));

        // --- Indicator 1: Rapidly Warming Numbers ---
        this._applyRapidlyWarmingScores(scores, analyzer);

        // --- Indicator 2: Overdue Gan Numbers (based on historical gan cycle) ---
        this._applyOverdueGanBasedOnHistoryScores(scores, analyzer);

        // --- Indicator 3: Unusually Frequent Consecutive Appearances ---
        this._applyConsecutiveAppearanceScores(scores, analyzer);

        // --- Indicator 4: Numbers associated with very rare occurrences (e.g., specific totals) ---
        this._applyRareTotalAssociationScores(scores, analyzer);

        // Cap scores
        analyzer.allLottoNumbers.forEach(num => scores.set(num, Math.max(0, Math.min(scores.get(num) || 0, self.WorkerUtils.CONSTANTS.MAX_STRATEGY_SCORE))));
        return scores;
    },

    // --- Internal Helper Functions ---
    _applyRapidlyWarmingScores: function(scores, analyzer) {
        analyzer.allLottoNumbers.forEach(num => {
            const longTermPercentile = analyzer.getNumberFrequencyPercentile(num, self.WorkerUtils.CONSTANTS.LOOKBACK.LONG);
            const shortTermPercentile = analyzer.getNumberFrequencyPercentile(num, self.WorkerUtils.CONSTANTS.LOOKBACK.VERY_SHORT);
            const ganData = analyzer.getGanStatus().get(num);

            if (longTermPercentile < 20 && shortTermPercentile > 70 && ganData.daysGone > 5) {
                scores.set(num, scores.get(num) + 60);
            }
        });
    },

    _applyOverdueGanBasedOnHistoryScores: function(scores, analyzer) {
        const detailedGanAnalysis = analyzer.getHistoricalGanAnalysis();
        detailedGanAnalysis.forEach((data, num) => {
            if (data.ganLengths.length > 2) {
                const avgGan = data.avgGan;
                const stdDevGan = data.stdDevGan;

                if (data.lastGanPeriod > (avgGan + stdDevGan * 1.5)) {
                    scores.set(num, scores.get(num) + 40);
                }
            }
        });
    },

    _applyConsecutiveAppearanceScores: function(scores, analyzer) {
        const consecutiveAppearances = analyzer.getConsecutiveAppearance();
        consecutiveAppearances.forEach((count, num) => {
            if (count === 2) scores.set(num, scores.get(num) + 20);
            if (count >= 3) scores.set(num, scores.get(num) + 50);
        });
    },

    _applyRareTotalAssociationScores: function(scores, analyzer) {
        const lastDayTotals = analyzer.getLastDayTotals();
        const totalFreqExt = analyzer.getTotalsFrequency(self.WorkerUtils.CONSTANTS.LOOKBACK.EXTENDED);
        lastDayTotals.forEach(total => {
            // If total appeared less than 10% of the time in long history
            if (totalFreqExt.get(total) < (self.WorkerUtils.CONSTANTS.LOOKBACK.EXTENDED * 0.1)) {
                analyzer.allLottoNumbers.forEach(num => {
                    if (self.WorkerUtils.calculateTotal(num) === total) {
                        scores.set(num, scores.get(num) + 25);
                    }
                });
            }
        });
    }
};
