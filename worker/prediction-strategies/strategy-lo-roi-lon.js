// prediction-strategies/strategy-lo-roi-lon.js
// Strategy: Focuses on "lô rơi" (numbers that appeared recently and may reappear)
// and "lô lộn" (the reverse of a number that appeared recently).

self.StrategyLoRoiLon = {
    name: 'Lô Rơi & Lô Lộn Chuyên Sâu',
    description: 'Phân tích các loại lô rơi (trực tiếp), lô lộn (trực tiếp, chain) để tìm ra các con số tiềm năng.',
    weight: self.WorkerUtils.CONSTANTS.STRATEGY_WEIGHTS.LO_ROI_LON,

    /**
     * Executes the "lô rơi" and "lô lộn" prediction strategy.
     * @param {DataAnalyzer} analyzer An instance of DataAnalyzer initialized with historical data.
     * @returns {Map<string, number>} A map where keys are lotto numbers and values are their scores.
     */
    predict: function(analyzer) {
        const scores = new Map();
        const allLottoNumbers = analyzer.allLottoNumbers;
        allLottoNumbers.forEach(num => scores.set(num, 0));

        // --- 1. Lô Rơi (Numbers that dropped from recent days) ---
        this._applyLoRoiScores(scores, analyzer);

        // --- 2. Lô Lộn (Reversed numbers) ---
        this._applyLoLonScores(scores, analyzer);

        // --- 3. Sandwiched Numbers (Kẹp giữa) ---
        this._applySandwichedScores(scores, analyzer);

        // Ensure scores are capped
        allLottoNumbers.forEach(num => {
            scores.set(num, Math.max(0, Math.min(scores.get(num) || 0, self.WorkerUtils.CONSTANTS.MAX_STRATEGY_SCORE)));
        });

        return scores;
    },

    // --- Internal Helper Functions for this Strategy ---

    _applyLoRoiScores: function(scores, analyzer) {
        const loRoiCandidates = analyzer.getLoRoiCandidates(self.WorkerUtils.CONSTANTS.LOOKBACK.SHORT);
        
        loRoiCandidates.forEach((count, num) => {
            scores.set(num, scores.get(num) + (count * 15));
        });

        const lastDayNumbers = analyzer.getLastDayNumbers();
        lastDayNumbers.forEach(num => {
             scores.set(num, scores.get(num) + 25);
        });
    },

    _applyLoLonScores: function(scores, analyzer) {
        const loLonCandidates = analyzer.getLoLonCandidates(self.WorkerUtils.CONSTANTS.LOOKBACK.SHORT);
        
        loLonCandidates.forEach((count, num) => {
            scores.set(num, scores.get(num) + (count * 10));
        });

        const lastDayNumbers = analyzer.getLastDayNumbers();
        lastDayNumbers.forEach(num => {
            if (num[0] !== num[1]) {
                const reversedNum = self.WorkerUtils.reverseNumber(num);
                scores.set(reversedNum, scores.get(reversedNum) + 20);
            }
        });
    },

    _applySandwichedScores: function(scores, analyzer) {
        const sandwichedNumbers = analyzer.getSandwichedNumbers(self.WorkerUtils.CONSTANTS.LOOKBACK.SHORT);
        sandwichedNumbers.forEach(num => {
            scores.set(num, scores.get(num) + 35); // Significant boost for sandwiched
        });
    }
};
