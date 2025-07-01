// prediction-strategies/strategy-gan-numbers.js
// Strategy: Identifies "gan" numbers (long-absent numbers) as potential candidates,
// with refined scoring based on different "gan" ranges and historical behavior.

self.StrategyGanNumbers = {
    name: 'Lô Gan Chuyên Sâu',
    description: 'Phân tích kỹ lưỡng các số lô khan theo từng ngưỡng thời gian vắng mặt, từ ngắn đến siêu gan.',
    weight: self.WorkerUtils.CONSTANTS.STRATEGY_WEIGHTS.GAN_NUMBERS,

    /**
     * Executes the gan number prediction strategy.
     * @param {DataAnalyzer} analyzer An instance of DataAnalyzer initialized with historical data.
     * @returns {Map<string, number>} A map where keys are lotto numbers and values are their scores (0-100).
     */
    predict: function(analyzer) {
        const scores = new Map();
        const allLottoNumbers = analyzer.allLottoNumbers;
        allLottoNumbers.forEach(num => scores.set(num, 0));

        const ganStatus = analyzer.getGanStatus();
        const historicalGanAnalysis = analyzer.getHistoricalGanAnalysis();

        // Apply scores based on different gan ranges
        this._applyGanScoresByRange(scores, ganStatus, self.WorkerUtils.CONSTANTS.GAN_RANGE_SHORT, 10, 0.5);
        this._applyGanScoresByRange(scores, ganStatus, self.WorkerUtils.CONSTANTS.GAN_RANGE_MEDIUM, 40, 1.5);
        this._applyGanScoresByRange(scores, ganStatus, self.WorkerUtils.CONSTANTS.GAN_RANGE_LONG, 60, 2.0);
        this._applyGanScoresByRange(scores, ganStatus, self.WorkerUtils.CONSTANTS.GAN_RANGE_SUPER_GAN, 25, 0.8);
        this._applyGanScoresByRange(scores, ganStatus, self.WorkerUtils.CONSTANTS.GAN_RANGE_ULTRA_GAN, 10, 0.5); // Very long gan

        // Indicator: Numbers that are "lô gan trở lại"
        this._applyRecentGanReturnersScore(scores, analyzer);

        // Indicator: Numbers whose current gan period is approaching their average historical gan
        this._applyApproachingAverageGanScore(scores, ganStatus, historicalGanAnalysis);

        // Indicator: Penalize numbers that have just hit after a long gan (less likely to hit again immediately)
        this._applyRecentHitFromGanPenalty(scores, ganStatus);

        allLottoNumbers.forEach(num => {
            scores.set(num, Math.max(0, Math.min(scores.get(num) || 0, self.WorkerUtils.CONSTANTS.MAX_STRATEGY_SCORE)));
        });

        return scores;
    },

    // --- Internal Helper Functions for this Strategy ---

    _applyGanScoresByRange: function(scores, ganStatus, range, baseScore, dayMultiplier) {
        const [minDays, maxDays] = range;
        ganStatus.forEach((data, num) => {
            const daysGone = data.daysGone;
            if (daysGone >= minDays && daysGone <= maxDays) {
                const scoreToAdd = baseScore + (daysGone - minDays) * dayMultiplier;
                scores.set(num, scores.get(num) + scoreToAdd);
            }
        });
    },
    
    _applyRecentGanReturnersScore: function(scores, analyzer) {
        const history = analyzer.historyData;
        const lookbackDaysForReturn = self.WorkerUtils.CONSTANTS.LOOKBACK.SHORT;
        const minimumGanBeforeReturn = self.WorkerUtils.CONSTANTS.GAN_RANGE_MEDIUM[0];
        
        for (let i = history.length - lookbackDaysForReturn; i < history.length; i++) {
            if (i <= 0) continue;

            const currentDayNumbers = new Set(history[i].uniqueNumbers);
            const tempAnalyzer = new analyzer.constructor(history.slice(0, i));
            const tempGanStatus = tempAnalyzer.getGanStatus();

            currentDayNumbers.forEach(num => {
                const data = tempGanStatus.get(num);
                if (data && data.daysGone >= minimumGanBeforeReturn) {
                    scores.set(num, scores.get(num) + 20);
                }
            });
        }
    },

    _applyApproachingAverageGanScore: function(scores, ganStatus, historicalGanAnalysis) {
        ganStatus.forEach((currentGanData, num) => {
            const histData = historicalGanAnalysis.get(num);
            if (histData && histData.ganLengths.length > 1) { // Need at least 2 historical gan periods
                const daysGone = currentGanData.daysGone;
                const avgGan = histData.avgGan;
                const stdDevGan = histData.stdDevGan;

                // If current gan is near or slightly above average, but within 1 standard deviation
                if (daysGone >= avgGan - stdDevGan && daysGone <= avgGan + stdDevGan && daysGone > 0) {
                    // Stronger boost if daysGone is very close to avgGan
                    const proximityScore = 30 * (1 - Math.abs(daysGone - avgGan) / (stdDevGan || avgGan));
                    scores.set(num, scores.get(num) + proximityScore);
                }
            }
        });
    },

    _applyRecentHitFromGanPenalty: function(scores, ganStatus) {
        // Find numbers that hit yesterday and were gan for a long time before that.
        // These numbers are typically 'cooling down' after a hit.
        ganStatus.forEach((data, num) => {
            if (data.daysGone === 0 && data.lastSeenIndex !== -1) { // It hit yesterday
                const prevGanPeriodLength = data.lastSeenIndex > 0 ? // How long it was gan before this hit
                    self.WorkerUtils.averageArray(
                        (self.DataAnalyzer.prototype.getHistoricalGanAnalysis.call( // Re-evaluate historical gan before this last hit
                            new self.DataAnalyzer(this.historyData.slice(0, data.lastSeenIndex))
                        )).get(num).ganLengths
                    ) : 0; // Simplified calculation for previous gan period

                if (prevGanPeriodLength >= self.WorkerUtils.CONSTANTS.GAN_RANGE_MEDIUM[0]) {
                    scores.set(num, scores.get(num) * 0.5); // Reduce score significantly
                }
            }
        });
    }
};
