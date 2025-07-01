// prediction-strategies/strategy-bong-tuong-sinh.js
// Strategy: Applies "Bóng Ngũ Hành" (Five Elements/Shadow Numbers) principles.

self.StrategyBongTuongSinh = {
    name: 'Bóng & Ngũ Hành',
    description: 'Dự đoán dựa trên mối quan hệ tương sinh tương khắc và bóng số của các số lô.',
    weight: self.WorkerUtils.CONSTANTS.STRATEGY_WEIGHTS.BONG_TUONG_SINH,

    /**
     * Executes the Bong Tuong Sinh prediction strategy.
     * @param {DataAnalyzer} analyzer An instance of DataAnalyzer.
     * @returns {Map<string, number>} A map where keys are lotto numbers and values are their scores (0-100).
     */
    predict: function(analyzer) {
        const scores = new Map();
        const allLottoNumbers = analyzer.allLottoNumbers;
        allLottoNumbers.forEach(num => scores.set(num, 0));

        // --- Indicator 1: Direct Bong Co-occurrence ---
        this._applyBongCoOccurrenceScores(scores, analyzer);

        // --- Indicator 2: Bong of Last Day's Numbers ---
        this._applyLastDayBongScores(scores, analyzer);

        // --- Indicator 3: Bong of Head/Tail Digits ---
        this._applyBongChamScores(scores, analyzer);

        // --- Indicator 4: Gan Goc / Gan Bong ---
        this._applyGanBongScores(scores, analyzer);

        // Ensure scores are capped
        allLottoNumbers.forEach(num => {
            scores.set(num, Math.max(0, Math.min(scores.get(num) || 0, self.WorkerUtils.CONSTANTS.MAX_STRATEGY_SCORE)));
        });

        return scores;
    },

    // --- Internal Helper Functions ---
    _applyBongCoOccurrenceScores: function(scores, analyzer) {
        const bongCoOccurrences = analyzer.getBongNumberCoOccurrences(self.WorkerUtils.CONSTANTS.LOOKBACK.SHORT);
        bongCoOccurrences.forEach((count, num) => {
            scores.set(num, scores.get(num) + (count * 15));
        });
    },

    _applyLastDayBongScores: function(scores, analyzer) {
        const lastDayNumbers = analyzer.getLastDayNumbers();
        lastDayNumbers.forEach(num => {
            const bongNum = self.WorkerUtils.getLotoBong(num);
            if (bongNum && bongNum !== num) {
                scores.set(bongNum, scores.get(bongNum) + 30);
            }
        });
    },

    _applyBongChamScores: function(scores, analyzer) {
        const lastDayHeads = analyzer.getLastDayHeads();
        const lastDayTails = analyzer.getLastDayTails();

        analyzer.allLottoNumbers.forEach(num => {
            const head = num[0];
            const tail = num[1];
            const bongHead = self.WorkerUtils.getBongSo(head);
            const bongTail = self.WorkerUtils.getBongSo(tail);

            if (lastDayHeads.has(bongHead)) {
                scores.set(num, scores.get(num) + 10);
            }
            if (lastDayTails.has(bongTail)) {
                scores.set(num, scores.get(num) + 10);
            }
        });
    },

    _applyGanBongScores: function(scores, analyzer) {
        const ganStatus = analyzer.getGanStatus();
        analyzer.allLottoNumbers.forEach(num => {
            const bongNum = self.WorkerUtils.getLotoBong(num);
            if (bongNum && bongNum !== num) {
                const bongGanData = ganStatus.get(bongNum);
                if (bongGanData && bongGanData.daysGone >= 15 && bongGanData.daysGone <= 30) {
                    scores.set(num, scores.get(num) + 20);
                }
            }
        });
    }
};
