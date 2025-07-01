// prediction-strategies/strategy-paired-numbers.js
// Strategy: Focuses on "paired numbers" or "lô xiên" (numbers that tend to appear together)
// and successor patterns (number X tends to follow number Y).

self.StrategyPairedNumbers = {
    name: 'Xiên & Song Thủ',
    description: 'Xác định các cặp số có xu hướng xuất hiện cùng nhau hoặc theo chuỗi.',
    weight: self.WorkerUtils.CONSTANTS.STRATEGY_WEIGHTS.PAIRED_NUMBERS,

    /**
     * Executes the paired numbers prediction strategy.
     * @param {DataAnalyzer} analyzer An instance of DataAnalyzer.
     * @returns {Map<string, number>} A map where keys are lotto numbers and values are their scores.
     */
    predict: function(analyzer) {
        const scores = new Map();
        const allLottoNumbers = analyzer.allLottoNumbers;
        allLottoNumbers.forEach(num => scores.set(num, 0));

        // --- 1. Co-occurrence of numbers (direct pairs) ---
        this._applyDirectCoOccurenceScores(scores, analyzer);

        // --- 2. Successor Chains (A -> B patterns) ---
        this._applySuccessorScores(scores, analyzer);

        // --- 3. Reverse Co-occurrence (e.g., 12 and 21 appearing together) ---
        this._applyReverseCoOccurenceScores(scores, analyzer);

        // Ensure scores are capped
        allLottoNumbers.forEach(num => {
            scores.set(num, Math.max(0, Math.min(scores.get(num) || 0, self.WorkerUtils.CONSTANTS.MAX_STRATEGY_SCORE)));
        });

        return scores;
    },

    // --- Internal Helper Functions ---
    _applyDirectCoOccurenceScores: function(scores, analyzer) {
        const lastDayNumbers = analyzer.getLastDayNumbers();
        const allPairCoOccurrences = analyzer.getAllPairCoOccurrences(self.WorkerUtils.CONSTANTS.LOOKBACK.MEDIUM);

        lastDayNumbers.forEach(num1 => {
            const coOccurrencesForNum1 = allPairCoOccurrences.get(num1);
            if (coOccurrencesForNum1) {
                Array.from(coOccurrencesForNum1.entries())
                    .sort((a,b) => b[1] - a[1]) // Sort by highest co-occurrence
                    .slice(0,5) // Consider top 5 co-occurring numbers
                    .forEach(([num2, count]) => {
                        scores.set(num2, scores.get(num2) + (count * 5)); // Boost score
                    });
            }
        });
    },

    _applySuccessorScores: function(scores, analyzer) {
        const lastDayNumbers = analyzer.getLastDayNumbers();
        const successorFrequencies = analyzer.getSuccessorFrequencies(self.WorkerUtils.CONSTANTS.LOOKBACK.LONG);

        lastDayNumbers.forEach(prevNum => {
            const followers = successorFrequencies.get(prevNum);
            if (followers) {
                Array.from(followers.entries())
                    .sort((a,b) => b[1] - a[1])
                    .slice(0,3) // Consider top 3 followers
                    .forEach(([nextNum, count]) => {
                        scores.set(nextNum, scores.get(nextNum) + (count * 8)); // Boost score
                    });
            }
        });
    },

    _applyReverseCoOccurenceScores: function(scores, analyzer) {
        const reverseCoOccurrences = analyzer.getReverseCoOccurrences(self.WorkerUtils.CONSTANTS.LOOKBACK.SHORT);
        reverseCoOccurrences.forEach((count, num) => {
            scores.set(num, scores.get(num) + (count * 10)); // Numbers appearing with their reverse get a boost
        });
    }
};
