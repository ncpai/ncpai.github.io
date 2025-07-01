// prediction-strategies/strategy-totals-chams.js
// Strategy: Focuses on the "totals" (sum of digits) and "chams" (individual digits)
// statistical patterns.

self.StrategyTotalsChams = {
    name: 'Tổng & Chạm Số (Vị Trí)',
    description: 'Dự đoán dựa trên xu hướng các tổng số và các cặp số chạm (đầu/đuôi) nổi bật.',
    weight: self.WorkerUtils.CONSTANTS.STRATEGY_WEIGHTS.TOTALS_CHAMS,

    /**
     * Executes the totals and chams prediction strategy.
     * @param {DataAnalyzer} analyzer An instance of DataAnalyzer.
     * @returns {Map<string, number>} A map where keys are lotto numbers and values are their scores (0-100).
     */
    predict: function(analyzer) {
        const scores = new Map();
        const allLottoNumbers = analyzer.allLottoNumbers;
        allLottoNumbers.forEach(num => scores.set(num, 0));

        // --- Indicator 1: Hot Totals ---
        this._applyHotTotalsScores(scores, analyzer);

        // --- Indicator 2: Gan Totals ---
        this._applyGanTotalsScores(scores, analyzer);

        // --- Indicator 3: Strong Cham Digits (Head/Tail) ---
        this._applyStrongChamScores(scores, analyzer);

        // --- Indicator 4: Last Day Cham ---
        this._applyLastDayChamScores(scores, analyzer);

        // Ensure scores are capped
        allLottoNumbers.forEach(num => {
            scores.set(num, Math.max(0, Math.min(scores.get(num) || 0, self.WorkerUtils.CONSTANTS.MAX_STRATEGY_SCORE)));
        });

        return scores;
    },

    // --- Internal Helper Functions ---
    _applyHotTotalsScores: function(scores, analyzer) {
        const totalFreq = analyzer.getTotalsFrequency(self.WorkerUtils.CONSTANTS.LOOKBACK.MEDIUM);
        const sortedTotals = Array.from(totalFreq.entries()).sort((a, b) => b[1] - a[1]);
        sortedTotals.slice(0, 5).forEach(([total, count], index) => {
            analyzer.allLottoNumbers.forEach(num => {
                if (self.WorkerUtils.calculateTotal(num) === total) {
                    scores.set(num, scores.get(num) + (count * 1.5) + (5 - index) * 2); // Boost based on total frequency
                }
            });
        });
    },

    _applyGanTotalsScores: function(scores, analyzer) {
        const ganTotalsStatus = analyzer.getGanTotalsStatus();
        ganTotalsStatus.forEach((data, total) => {
            if (data.daysGone >= 10 && data.daysGone <= 25) { // Optimal gan total range
                analyzer.allLottoNumbers.forEach(num => {
                    if (self.WorkerUtils.calculateTotal(num) === total) {
                        scores.set(num, scores.get(num) + 20); // Strong boost
                    }
                });
            }
        });
    },

    _applyStrongChamScores: function(scores, analyzer) {
        const chamScores = analyzer.getChamBridgeCandidates(self.WorkerUtils.CONSTANTS.LOOKBACK.SHORT, 25);
        chamScores.forEach((score, num) => {
            scores.set(num, scores.get(num) + score * 0.8);
        });
    },

    _applyLastDayChamScores: function(scores, analyzer) {
        const lastDayHeads = analyzer.getLastDayHeads();
        const lastDayTails = analyzer.getLastDayTails();
        analyzer.allLottoNumbers.forEach(num => {
            if (lastDayHeads.has(num[0])) scores.set(num, scores.get(num) + 10);
            if (lastDayTails.has(num[1])) scores.get(num, scores.get(num) + 10);
        });
    },
};
