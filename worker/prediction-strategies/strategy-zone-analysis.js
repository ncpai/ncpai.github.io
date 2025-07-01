// prediction-strategies/strategy-zone-analysis.js
// Strategy: Analyzes which "zones" of numbers (e.g., 00-24, 25-49) are currently hot or cold.

self.StrategyZoneAnalysis = {
    name: 'Phân Tích Miền',
    description: 'Dự đoán dựa trên xu hướng các miền số (ví dụ: miền thấp 00-24, miền cao 75-99) đang có tần suất xuất hiện cao hoặc thấp.',
    weight: self.WorkerUtils.CONSTANTS.STRATEGY_WEIGHTS.ZONE_ANALYSIS,

    predict: function(analyzer) {
        const scores = new Map(analyzer.allLottoNumbers.map(num => [num, 0]));
        const zones = ['Zone1', 'Zone2', 'Zone3', 'Zone4'];

        // --- Indicator 1: Hot Zones ---
        this._applyHotZoneScores(scores, analyzer, zones);

        // --- Indicator 2: Cold Zones (and potential for rebound) ---
        this._applyColdZoneAdjustments(scores, analyzer, zones);

        // Cap scores
        analyzer.allLottoNumbers.forEach(num => scores.set(num, Math.max(0, Math.min(scores.get(num) || 0, self.WorkerUtils.CONSTANTS.MAX_STRATEGY_SCORE))));
        return scores;
    },

    // --- Internal Helper Functions ---
    _applyHotZoneScores: function(scores, analyzer, zones) {
        const shortTermZoneFreq = analyzer.getZoneFrequencies(self.WorkerUtils.CONSTANTS.LOOKBACK.VERY_SHORT);
        const longTermZoneFreq = analyzer.getZoneFrequencies(self.WorkerUtils.CONSTANTS.LOOKBACK.LONG);

        zones.forEach(zone => {
            const shortFreq = shortTermZoneFreq.get(zone) || 0;
            const longFreq = longTermZoneFreq.get(zone) || 0;

            const expectedZoneFreqShort = (27 * self.WorkerUtils.CONSTANTS.LOOKBACK.VERY_SHORT) / 4;
            const expectedZoneFreqLong = (27 * self.WorkerUtils.CONSTANTS.LOOKBACK.LONG) / 4;

            let zoneBoost = 0;
            if (shortFreq > expectedZoneFreqShort * 1.5 && longFreq > expectedZoneFreqLong * 1.2) {
                zoneBoost = 60; // Very hot zone, consistently overperforming
            } else if (shortFreq > expectedZoneFreqShort * 1.3 && longFreq <= expectedZoneFreqLong * 1.2) {
                zoneBoost = 40; // Recently hot zone, maybe a new trend
            }

            if (zoneBoost > 0) {
                analyzer.allLottoNumbers.forEach(num => {
                    if (analyzer.getZoneForNumber(num) === zone) {
                        scores.set(num, scores.get(num) + zoneBoost);
                    }
                });
            }
        });
    },

    _applyColdZoneAdjustments: function(scores, analyzer, zones) {
        const shortTermZoneFreq = analyzer.getZoneFrequencies(self.WorkerUtils.CONSTANTS.LOOKBACK.VERY_SHORT);
        const longTermZoneFreq = analyzer.getZoneFrequencies(self.WorkerUtils.CONSTANTS.LOOKBACK.LONG);

        zones.forEach(zone => {
            const shortFreq = shortTermZoneFreq.get(zone) || 0;
            const longFreq = longTermZoneFreq.get(zone) || 0;

            const expectedZoneFreqShort = (27 * self.WorkerUtils.CONSTANTS.LOOKBACK.VERY_SHORT) / 4;
            const expectedZoneFreqLong = (27 * self.WorkerUtils.CONSTANTS.LOOKBACK.LONG) / 4;

            if (shortFreq < expectedZoneFreqShort * 0.5 && longFreq < expectedZoneFreqLong * 0.8) {
                analyzer.allLottoNumbers.forEach(num => {
                    if (analyzer.getZoneForNumber(num) === zone) {
                        scores.set(num, scores.get(num) * 0.5); // Penalty if consistently cold
                    }
                });
            } else if (longFreq < expectedZoneFreqLong * 0.6) { // If very cold long term but not short term, may be due for rebound
                 analyzer.allLottoNumbers.forEach(num => {
                    if (analyzer.getZoneForNumber(num) === zone) {
                        // Boost for a potentially "due" cold zone
                        scores.set(num, scores.get(num) + 15);
                    }
                });
            }
        });
    }
};
