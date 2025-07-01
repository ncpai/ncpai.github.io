// worker-utils.js
// Provides common utility functions, constants, and basic statistical tools for the Web Worker environment.

self.WorkerUtils = self.WorkerUtils || {};

// --- 1. Constants (Expanded) ---
Object.assign(self.WorkerUtils, {
    CONSTANTS: {
        // Core Prediction Parameters
        NUM_PREDICTED_LOTTO_NUMBERS: 16,
        MIN_HISTORY_FOR_ANALYSIS: 200, // Minimum days of historical data now increased for deeper analysis
        BACKTEST_WINDOW_SIZE: 150, // Number of days to use for backtesting (from the end of history)

        // Default Lookback Periods for Analysis (in days)
        LOOKBACK: {
            VERY_SHORT: 3,
            SHORT: 7,
            MEDIUM: 30,
            LONG: 60,
            VERY_LONG: 120, // Increased for deeper historical trends
            EXTENDED: 200, // Used for very long-term frequency or specific deep pattern
        },

        // Scoring and Weighting (Initial values - will be refined by backtesting/tuning)
        STRATEGY_WEIGHTS: {
            FREQUENCY: 0.13,
            GAN_NUMBERS: 0.11,
            LO_ROI_LON: 0.09,
            KEP_NUMBERS: 0.07,
            DAY_OF_WEEK: 0.07,
            BRIDGE_PATTERNS: 0.15,
            PAIRED_NUMBERS: 0.08,
            TOTALS_CHAMS: 0.08,
            BONG_TUONG_SINH: 0.06,
            CYCLE_ANALYSIS: 0.09,
            STATISTICAL_ANOMALIES: 0.04,
            ZONE_ANALYSIS: 0.03,
            // (These weights should ideally sum up to 1 for easier understanding, but PredictionEngine handles scaling)
        },
        
        // Performance Thresholds
        HIGH_ACCURACY_THRESHOLD: 10, // Number of correct predictions for "high accuracy"
        PROFIT_THRESHOLD_DEFAULT: 5, // Default for "profitable day" in backtest
        
        // Scoring Mechanism
        MAX_STRATEGY_SCORE: 100, // Max score a single strategy can assign to a number

        // Lo Gan Boundaries (in days)
        GAN_RANGE_SHORT: [1, 6],
        GAN_RANGE_MEDIUM: [7, 15],
        GAN_RANGE_LONG: [16, 30],
        GAN_RANGE_SUPER_GAN: [31, 60], // Numbers that have been gan for a very long time
        GAN_RANGE_ULTRA_GAN: [61, 90], // Even longer gan, rarer to hit

        // Number Characteristics
        ALL_LOTTO_NUMBERS: Array.from({ length: 100 }, (_, i) => String(i).padStart(2, '0')),
    },

    // --- 2. Utility Functions (Expanded) ---

    // Basic List Operations (for sets/arrays of 2-digit numbers)
    generateAllLottoNumbers: function() { return this.CONSTANTS.ALL_LOTTO_NUMBERS; },
    getIntersection: (arr1, arr2) => new Set([...new Set(arr1)].filter(x => new Set(arr2).has(x))),
    getUnion: (arr1, arr2) => new Set([...arr1, ...arr2]),
    getDifference: (arr1, arr2) => { const set2 = new Set(arr2); return new Set([...arr1].filter(x => !set2.has(x))); },

    // Number Transformations
    stringToNumber: (numStr) => parseInt(numStr, 10),
    reverseNumber: (numStr) => (numStr.length === 2 && numStr[0] !== numStr[1]) ? (numStr[1] + numStr[0]) : numStr,
    calculateTotal: (numStr) => (numStr.length === 2) ? (parseInt(numStr[0]) + parseInt(numStr[1])) : -1,
    getCham: (numStr) => (numStr.length === 2) ? {head: parseInt(numStr[0]), tail: parseInt(numStr[1])} : {head: -1, tail: -1},
    isKep: (numStr) => (numStr.length === 2 && numStr[0] === numStr[1]), // Convenience function

    // Statistical Utilities
    sumArray: (arr) => arr.reduce((acc, val) => acc + val, 0),
    averageArray: (arr) => arr.length === 0 ? 0 : this.sumArray(arr) / arr.length,
    medianArray: (arr) => {
        if (!arr || arr.length === 0) return 0;
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    },
    standardDeviation: (arr) => {
        if (!arr || arr.length < 2) return 0;
        const mean = self.WorkerUtils.averageArray(arr); // Use self.WorkerUtils for consistency in worker scope
        const sumOfSquares = arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0);
        return Math.sqrt(sumOfSquares / (arr.length - 1)); // Sample standard deviation
    },
    
    // Ngu Hanh (Five Element theory) - Mapping numbers to their "bóng" (shadow)
    // 1-6 (Mộc), 2-7 (Hỏa), 3-8 (Kim), 4-9 (Thủy), 5-0 (Thổ)
    BONG_SO_MAP: {
        '0': '5', '1': '6', '2': '7', '3': '8', '4': '9',
        '5': '0', '6': '1', '7': '2', '8': '3', '9': '4'
    },
    getBongSo: function(digit) {
        return this.BONG_SO_MAP[digit] || null;
    },
    getLotoBong: function(numStr) { // Returns the "bóng" number (e.g., 12 -> 67)
        if (numStr.length !== 2) return null;
        const bongHead = this.getBongSo(numStr[0]);
        const bongTail = this.getBongSo(numStr[1]);
        if (bongHead === null || bongTail === null) return null;
        return bongHead + bongTail;
    },

    // Date/Time utilities
    getDayOfWeekName: (dayIndex) => ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'][dayIndex],

    // Scoring helpers
    weightedAverage: (values, weights) => {
        if (!values || !weights || values.length !== weights.length || values.length === 0) return 0;
        const sumWeighted = values.reduce((acc, val, i) => acc + val * weights[i], 0);
        const sumWeights = weights.reduce((acc, val) => acc + val, 0);
        return sumWeights === 0 ? 0 : sumWeighted / sumWeights;
    },

    // Random Utilities
    getRandomArbitrary: (min, max) => Math.random() * (max - min) + min,
    getRandomInt: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
    shuffleArray: (array) => {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
});

Object.freeze(self.WorkerUtils.CONSTANTS);
