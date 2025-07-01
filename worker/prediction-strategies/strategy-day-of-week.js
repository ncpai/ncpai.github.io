// prediction-strategies/strategy-day-of-week.js
// Strategy: Focuses on the unique patterns of numbers appearing on specific days of the week.

self.StrategyDayOfWeek = {
    name: 'Tần Suất Theo Thứ',
    description: 'Xác định các số có xu hướng xuất hiện nhiều/ít vào các ngày cụ thể trong tuần.',
    weight: self.WorkerUtils.CONSTANTS.STRATEGY_WEIGHTS.DAY_OF_WEEK,

    /**
     * Executes the day-of-week prediction strategy.
     * @param {DataAnalyzer} analyzer An instance of DataAnalyzer.
     * @returns {Map<string, number>} A map where keys are lotto numbers and values are their scores.
     */
    predict: function(analyzer) {
        const scores = new Map();
        const allLottoNumbers = analyzer.allLottoNumbers;
        allLottoNumbers.forEach(num => scores.set(num, 0));

        const dayOfWeekAvgFreq = analyzer.getDayOfWeekAverageFrequencies(self.WorkerUtils.CONSTANTS.LOOKBACK.EXTENDED);
        const nextDayOfWeek = (analyzer.historyData[analyzer.historyData.length - 1].date.getDay() + 1) % 7; // Get next day's dayOfWeek index

        const currentDayAvgFreq = dayOfWeekAvgFreq.get(nextDayOfWeek);
        if (!currentDayAvgFreq) return scores;

        // --- 1. Numbers traditionally hot for this day of week ---
        this._applyHotNumbersForDayOfWeek(scores, currentDayAvgFreq);

        // --- 2. Numbers traditionally cold for this day of week (and might be due) ---
        this._applyColdNumbersForDayOfWeek(scores, currentDayAvgFreq);

        // --- 3. Compare with overall average frequency ---
        this._applyDeviationFromOverallAverageScore(scores, analyzer, currentDayAvgFreq);

        // Ensure scores are capped
        allLottoNumbers.forEach(num => {
            scores.set(num, Math.max(0, Math.min(scores.get(num) || 0, self.WorkerUtils.CONSTANTS.MAX_STRATEGY_SCORE)));
        });

        return scores;
    },

    // --- Internal Helper Functions ---
    _applyHotNumbersForDayOfWeek: function(scores, currentDayAvgFreq) {
        const sortedByFreq = Array.from(currentDayAvgFreq.entries()).sort((a, b) => b[1] - a[1]);
        sortedByFreq.slice(0, 15).forEach(([num, avgFreq]) => { // Top 15 numbers historically hot for this day
            scores.set(num, scores.get(num) + (avgFreq * 30)); // Score based on avg freq
        });
    },

    _applyColdNumbersForDayOfWeek: function(scores, currentDayAvgFreq) {
        const sortedByFreq = Array.from(currentDayAvgFreq.entries()).sort((a, b) => a[1] - b[1]);
        sortedByFreq.slice(0, 10).forEach(([num, avgFreq]) => { // Top 10 numbers historically cold
            // A small boost if their historical frequency for this day is very low, but not zero.
            if (avgFreq > 0) {
                scores.set(num, scores.get(num) + 10);
            }
        });
    },

    _applyDeviationFromOverallAverageScore: function(scores, analyzer, currentDayAvgFreq) {
        const overallAverageFreqMap = analyzer.getNumbersFrequency(self.WorkerUtils.CONSTANTS.LOOKBACK.EXTENDED);
        const totalDays = self.WorkerUtils.CONSTANTS.LOOKBACK.EXTENDED;
        const totalOccurrences = 27 * totalDays;

        analyzer.allLottoNumbers.forEach(num => {
            const currentDayAvg = currentDayAvgFreq.get(num) || 0;
            const overallAvg = (overallAverageFreqMap.get(num) || 0) / totalDays;

            if (currentDayAvg > overallAvg * 1.5) { // If significantly higher than overall average
                scores.set(num, scores.get(num) + 20);
            } else if (currentDayAvg < overallAvg * 0.5 && overallAvg > 1) { // If significantly lower and not rare overall
                scores.set(num, scores.get(num) - 10); // Slight penalty
            }
        });
    }
};
