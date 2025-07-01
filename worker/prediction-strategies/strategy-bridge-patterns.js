// prediction-strategies/strategy-bridge-patterns.js
// Strategy: Identifies "bridge" (cầu) patterns, which are sequences or relationships
// between numbers that appear consistently over time.

self.StrategyBridgePatterns = {
    name: 'Đánh Cầu Chuyên Sâu',
    description: 'Phân tích các loại cầu chạy đều theo chu kỳ, cầu chạm và các mẫu cầu đặc biệt khác.',
    weight: self.WorkerUtils.CONSTANTS.STRATEGY_WEIGHTS.BRIDGE_PATTERNS,

    /**
     * Executes the bridge patterns prediction strategy.
     * @param {DataAnalyzer} analyzer An instance of DataAnalyzer.
     * @returns {Map<string, number>} A map where keys are lotto numbers and values are their scores.
     */
    predict: function(analyzer) {
        const scores = new Map();
        const allLottoNumbers = analyzer.allLottoNumbers;
        allLottoNumbers.forEach(num => scores.set(num, 0));

        // --- 1. Consistent Period Bridges ---
        this._applyConsistentPeriodBridgeScores(scores, analyzer);

        // --- 2. Cham Bridges (Head/Tail patterns) ---
        this._applyChamBridgeScores(scores, analyzer);

        // --- 3. Total Bridges (Sum of digits patterns) ---
        this._applyTotalBridgeScores(scores, analyzer);

        // Ensure scores are capped
        allLottoNumbers.forEach(num => {
            scores.set(num, Math.max(0, Math.min(scores.get(num) || 0, self.WorkerUtils.CONSTANTS.MAX_STRATEGY_SCORE)));
        });

        return scores;
    },

    // --- Internal Helper Functions ---
    _applyConsistentPeriodBridgeScores: function(scores, analyzer) {
        // Find bridges that have run a minimum of 3 times with a period of 1-7 days
        const consistentBridges = analyzer.getConsistentPeriodBridge(3, 7, self.WorkerUtils.CONSTANTS.LOOKBACK.LONG);
        consistentBridges.forEach(num => {
            scores.set(num, scores.get(num) + 50); // Strong boost
        });
        // Also check for longer, but rarer, consistent bridges
        const longerBridges = analyzer.getConsistentPeriodBridge(2, 14, self.WorkerUtils.CONSTANTS.LOOKBACK.VERY_LONG);
        longerBridges.forEach(num => {
            scores.set(num, scores.get(num) + 25);
        });
    },

    _applyChamBridgeScores: function(scores, analyzer) {
        const chamCandidates = analyzer.getChamBridgeCandidates(self.WorkerUtils.CONSTANTS.LOOKBACK.SHORT, 30); // 30% threshold for "strong" cham
        chamCandidates.forEach((chamScore, num) => {
            scores.set(num, scores.get(num) + (chamScore * 0.7)); // Apply 70% of analyzer's score
        });

        // Also check for cham 'gan' (chạm lâu không về)
        const allHeads = Array.from({length:10}, (_,i) => String(i));
        const lastDayHeads = analyzer.getLastDayHeads();
        const lastDayTails = analyzer.getLastDayTails();

        allHeads.forEach(headDigit => {
            if (!lastDayHeads.has(headDigit)) { // If this head didn't come yesterday
                let daysSinceLast = 0;
                for (let i = analyzer.historyData.length - 1; i >= 0; i--) {
                    if (analyzer.historyData[i].headsLanded.includes(headDigit)) break;
                    daysSinceLast++;
                }
                if (daysSinceLast >= 5) { // If head hasn't appeared for 5+ days (a mini-gan)
                    analyzer.allLottoNumbers.forEach(num => {
                        if (num[0] === headDigit) scores.set(num, scores.get(num) + 10);
                    });
                }
            }
        });
        // Similar logic for tails
    },

    _applyTotalBridgeScores: function(scores, analyzer) {
        const totalFreq = analyzer.getTotalsFrequency(self.WorkerUtils.CONSTANTS.LOOKBACK.SHORT);
        const ganTotals = analyzer.getGanTotalsStatus();

        // Boost numbers whose total is currently "strong" (high frequency)
        totalFreq.forEach((freq, total) => {
            if (freq > (27 * self.WorkerUtils.CONSTANTS.LOOKBACK.SHORT / 19) * 1.5) { // If total is 50% above average
                analyzer.allLottoNumbers.forEach(num => {
                    if (self.WorkerUtils.calculateTotal(num) === total) {
                        scores.set(num, scores.get(num) + 15);
                    }
                });
            }
        });

        // Boost numbers whose total is 'gan' and due
        ganTotals.forEach((data, total) => {
            if (data.daysGone >= 7 && data.daysGone <= 20) { // If total is in sweet spot gan
                analyzer.allLottoNumbers.forEach(num => {
                    if (self.WorkerUtils.calculateTotal(num) === total) {
                        scores.set(num, scores.get(num) + 20);
                    }
                });
            }
        });
    }
};
