// prediction-strategies/strategy-kep-numbers.js
// Strategy: Focuses specifically on "kep" numbers (doubles like 11, 22, ..., 99).

self.StrategyKepNumbers = {
    name: 'Lô Kép',
    description: 'Phân tích tần suất và xu hướng của các cặp số kép.',
    weight: self.WorkerUtils.CONSTANTS.STRATEGY_WEIGHTS.KEP_NUMBERS,

    /**
     * Executes the kep number prediction strategy.
     * @param {DataAnalyzer} analyzer An instance of DataAnalyzer initialized with historical data.
     * @returns {Map<string, number>} A map where keys are lotto numbers and values are their scores.
     */
    predict: function(analyzer) {
        const scores = new Map();
        const allLottoNumbers = analyzer.allLottoNumbers;
        const allKepNumbers = allLottoNumbers.filter(num => self.WorkerUtils.isKep(num));
        allKepNumbers.forEach(num => scores.set(num, 0));

        // --- 1. Short-term Kep Frequency and Recency ---
        this._applyKepFrequencyScores(scores, analyzer);

        // --- 2. Yesterday's Kep Numbers / Related Kep Forms (Sat Kep) ---
        this._applyYesterdayKepScores(scores, analyzer);

        // --- 3. Long-term Kep Gan ---
        this._applyLongTermKepGanScores(scores, analyzer);

        // Ensure scores are capped
        allKepNumbers.forEach(num => {
            scores.set(num, Math.max(0, Math.min(scores.get(num) || 0, self.WorkerUtils.CONSTANTS.MAX_STRATEGY_SCORE)));
        });

        return scores; // Only kep numbers will have scores > 0
    },
// prediction-strategies/strategy-kep-numbers.js (CONTINUED)

    // --- Internal Helper Functions ---
    _applyKepFrequencyScores: function(scores, analyzer) {
        const kepFreqShort = analyzer.getKepNumbersFrequency(self.WorkerUtils.CONSTANTS.LOOKBACK.SHORT);
        kepFreqShort.forEach((count, num) => {
            scores.set(num, scores.get(num) + (count * 15)); // High boost for recent kep
        });
        const kepFreqMedium = analyzer.getKepNumbersFrequency(self.WorkerUtils.CONSTANTS.LOOKBACK.MEDIUM);
        kepFreqMedium.forEach((count, num) => {
            scores.set(num, scores.get(num) + (count * 5)); // Moderate boost for medium-term kep
        });
    },

    _applyYesterdayKepScores: function(scores, analyzer) {
        const yesterdayKep = analyzer.getLastDayKepNumbers();
        yesterdayKep.forEach(num => {
            scores.set(num, scores.get(num) + 40); // Direct hit from yesterday's kep

            // Also boost "sát kép" (numbers that are one digit away from a kép)
            const head = parseInt(num[0]); // For "11", head is 1
            const satKepHeadDigit = String((head + 1) % 10); // 11 -> 22 (chạm 2), or 00 (chạm 0)
            const satKepTailDigit = String((head - 1 + 10) % 10); // For 11 -> 00, 22
            
            // Example for 11: look for 01, 10, 12, 21, 00, 22
            // Simplification: only boost other kép numbers whose digits are from satcham
            const nextKep = String((head + 1) % 10).repeat(2);
            const prevKep = String((head - 1 + 10) % 10).repeat(2);

            if (nextKep !== num) scores.set(nextKep, scores.get(nextKep) + 20);
            if (prevKep !== num) scores.set(prevKep, scores.get(prevKep) + 20);

            // Boost "gan kép" - numbers whose digits combine to form a kép (e.g. 10 if 11 or 00)
            const ganKepLanded = analyzer.historyData.length > 0 ? analyzer.historyData[analyzer.historyData.length - 1].ganKepLanded : [];
            ganKepLanded.forEach(gnk => { scores.set(gnk, scores.get(gnk) + 15); });

        });
    },

    _applyLongTermKepGanScores: function(scores, analyzer) {
        const ganKepStatus = analyzer.getGanKepNumbers();
        ganKepStatus.forEach((data, num) => {
            // Give a significant boost to keps that are 'due' from a medium or long gan period.
            if (data.daysGone >= self.WorkerUtils.CONSTANTS.GAN_RANGE_MEDIUM[0] && data.daysGone <= self.WorkerUtils.CONSTANTS.GAN_RANGE_LONG[1]) {
                scores.set(num, scores.get(num) + 30);
            }
            // Small penalty for ultra-gan kep (less likely to hit)
            if (data.daysGone > self.WorkerUtils.CONSTANTS.GAN_RANGE_ULTRA_GAN[1]) {
                scores.set(num, scores.get(num) * 0.7);
            }
        });
    }
};

