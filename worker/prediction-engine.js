// prediction-engine.js
// The core PredictionEngine orchestrates strategy combination, scoring, and final number selection.

self.PredictionEngine = self.PredictionEngine || {};

// List all active prediction strategy modules here.
self.PredictionEngine.strategies = [
    self.StrategyFrequency,
    self.StrategyGanNumbers,
    self.StrategyLoRoiLon,
    self.StrategyKepNumbers,
    self.StrategyDayOfWeek,
    self.StrategyBridgePatterns,
    self.StrategyPairedNumbers,
    self.StrategyTotalsChams,
    self.StrategyBongTuongSinh,
    self.StrategyCycleAnalysis,
    self.StrategyStatisticalAnomalies,
    self.StrategyZoneAnalysis,
    // Add more strategy modules here as they are developed
];

/**
 * Returns the count of active prediction strategies.
 * Used for reporting in the UI.
 * @returns {number}
 */
self.PredictionEngine.getActivatedStrategyCount = function() {
    return self.PredictionEngine.strategies.length;
};

/**
 * Generates the final set of predicted lotto numbers for the next day.
 * This is the highest-level prediction function called by worker.js.
 *
 * @param {Array<object>} historyData Prepared historical data (from DataPreparer).
 * @returns {Array<string>} An array of 16 predicted lotto numbers, sorted ascending.
 */
self.PredictionEngine.predictNextDay = function(historyData) {
    console.log("PredictionEngine: Starting prediction process.");

    if (!historyData || historyData.length < self.WorkerUtils.CONSTANTS.MIN_HISTORY_FOR_ANALYSIS) {
        throw new Error(`Dữ liệu lịch sử không đủ để tạo dự đoán chuyên sâu. Cần ít nhất ${self.WorkerUtils.CONSTANTS.MIN_HISTORY_FOR_ANALYSIS} ngày.`);
    }

    // Initialize the DataAnalyzer with the complete historical data
    const analyzer = new self.DataAnalyzer(historyData);
    const allLottoNumbers = self.WorkerUtils.generateAllLottoNumbers(); // "00" to "99"

    // --- Create a global score board for all numbers ---
    // This map will accumulate scores from all strategies.
    // Initialize all scores to 0.
    const overallScores = new Map(allLottoNumbers.map(num => [num, 0]));

    // --- Phase 1: Run each prediction strategy and accumulate scores based on their weight ---
    // prediction-engine.js (CONTINUED)

self.PredictionEngine = self.PredictionEngine || {};

// List all active prediction strategy modules here.
self.PredictionEngine.strategies = [
    self.StrategyFrequency,
    self.StrategyGanNumbers,
    self.StrategyLoRoiLon,
    self.StrategyKepNumbers,
    self.StrategyDayOfWeek,
    self.StrategyBridgePatterns,
    self.StrategyPairedNumbers,
    self.StrategyTotalsChams,
    self.StrategyBongTuongSinh,
    self.StrategyCycleAnalysis,
    self.StrategyStatisticalAnomalies,
    self.StrategyZoneAnalysis,
    // Add more strategy modules here as they are developed
];

/**
 * Returns the count of active prediction strategies.
 * Used for reporting in the UI.
 * @returns {number}
 */
self.PredictionEngine.getActivatedStrategyCount = function() {
    return self.PredictionEngine.strategies.length;
};

/**
 * Generates the final set of predicted lotto numbers for the next day.
 * This is the highest-level prediction function called by worker.js.
 *
 * @param {Array<object>} historyData Prepared historical data (from DataPreparer).
 * @returns {Array<string>} An array of 16 predicted lotto numbers, sorted ascending.
 */
self.PredictionEngine.predictNextDay = function(historyData) {
    console.log("PredictionEngine: Starting prediction process.");

    if (!historyData || historyData.length < self.WorkerUtils.CONSTANTS.MIN_HISTORY_FOR_ANALYSIS) {
        throw new Error(`Dữ liệu lịch sử không đủ để tạo dự đoán chuyên sâu. Cần ít nhất ${self.WorkerUtils.CONSTANTS.MIN_HISTORY_FOR_ANALYSIS} ngày.`);
    }

    const analyzer = new self.DataAnalyzer(historyData);
    const allLottoNumbers = self.WorkerUtils.generateAllLottoNumbers();

    const overallScores = new Map(allLottoNumbers.map(num => [num, 0]));

    // --- Phase 1: Run each prediction strategy and accumulate scores based on their weight ---
    self.PredictionEngine.strategies.forEach(strategy => {
        try {
            console.log(`PredictionEngine: Running strategy "${strategy.name}"...`);
            const strategyScores = strategy.predict(analyzer);

            strategyScores.forEach((score, num) => {
                const currentOverallScore = overallScores.get(num);
                overallScores.set(num, currentOverallScore + (score * strategy.weight));
            });
            console.log(`PredictionEngine: Strategy "${strategy.name}" completed.`);
        } catch (e) {
            console.error(`PredictionEngine: Error running strategy "${strategy.name}":`, e);
        }
    });

    // --- Phase 2: Apply Global Adjustments/Filters to Overall Scores ---
    // These adjustments are applied AFTER all strategies have given their initial scores.
    this._applyGlobalScoreAdjustments(overallScores, analyzer);

    // --- Phase 3: Selection and Diversification ---
    let finalPredictedNumbers = this._selectAndDiversifyNumbers(overallScores, analyzer);

    // --- Phase 4: Final Validation and Sorting ---
    // Ensure exactly 16 unique numbers and sort them.
    finalPredictedNumbers = [...new Set(finalPredictedNumbers)];

    // If for some reason we don't have enough numbers after diversification, fill up by highest score
    if (finalPredictedNumbers.length < self.WorkerUtils.CONSTANTS.NUM_PREDICTED_LOTTO_NUMBERS) {
        const remainingCandidates = Array.from(overallScores.entries())
            .filter(([num, _]) => !finalPredictedNumbers.includes(num))
            .sort((a, b) => b[1] - a[1]); // Sort remaining by score descending

        for (let i = 0; finalPredictedNumbers.length < self.WorkerUtils.CONSTANTS.NUM_PREDICTED_LOTTO_NUMBERS && i < remainingCandidates.length; i++) {
            finalPredictedNumbers.push(remainingCandidates[i][0]);
        }
        console.warn(`PredictionEngine: Needed to fill ${self.WorkerUtils.CONSTANTS.NUM_PREDICTED_LOTTO_NUMBERS - finalPredictedNumbers.length} numbers using fallback.`);
    }

    return finalPredictedNumbers.slice(0, self.WorkerUtils.CONSTANTS.NUM_PREDICTED_LOTTO_NUMBERS).sort((a, b) => parseInt(a) - parseInt(b));
};


// --- Internal Helper Functions for PredictionEngine ---

/**
 * Applies global score adjustments to numbers (e.g., penalties for recently appeared, boosts for rare patterns).
 * This phase fine-tunes scores after initial strategy aggregation.
 * @param {Map<string, number>} overallScores The map of aggregated scores from all strategies.
 * @param {DataAnalyzer} analyzer The DataAnalyzer instance.
 */
self.PredictionEngine._applyGlobalScoreAdjustments = function(overallScores, analyzer) {
    const lastDayNumbers = analyzer.getLastDayNumbers();
    const secondLastDayNumbers = analyzer.getSecondLastDayNumbers();
    const thirdLastDayNumbers = analyzer.getThirdLastDayNumbers();
    const allLottoNumbers = analyzer.allLottoNumbers;
    
    // Get gan status for current day
    const ganStatus = analyzer.getGanStatus();

    allLottoNumbers.forEach(num => {
        let score = overallScores.get(num) || 0;

        // **Penalty 1: Recently appeared numbers (less likely to re-hit immediately for most cases)**
        // This is a common heuristic: very recent hits often indicate temporary exhaustion.
        if (lastDayNumbers.includes(num)) {
            score *= 0.5; // Reduce by 50% if appeared yesterday
            console.log(`Adj: ${num} appeared yesterday, score reduced to ${score}`);
        } else if (secondLastDayNumbers.includes(num)) {
            score *= 0.8; // Reduce by 20% if appeared 2 days ago
            console.log(`Adj: ${num} appeared 2 days ago, score reduced to ${score}`);
        }
        // Exception: If a number is a "lô rơi" candidate (from specific strategies), its score might be re-boosted.
        // This means the penalty here makes sense because only strong "lô rơi" numbers will overcome it.

        // **Penalty 2: Exceptionally "gan" numbers with consistently low predictive scores**
        // If a number has been gan for an extremely long time AND still has a low combined score,
        // it might be a truly "dead" number for now.
        const daysGone = ganStatus.get(num).daysGone;
        if (daysGone > self.WorkerUtils.CONSTANTS.GAN_RANGE_ULTRA_GAN[1] && score < 20) { // arbitrary low score threshold
            score *= 0.2; // Reduce drastically
            console.log(`Adj: ${num} is ultra-gan and low scoring, drastic reduction to ${score}`);
        }

        // **Boost 1: Numbers that have crossed a critical "gan" threshold**
        // E.g., if it just came out of a medium-gan period, it might continue to hit.
        if (daysGone > self.WorkerUtils.CONSTANTS.GAN_RANGE_MEDIUM[0] &&
            daysGone <= self.WorkerUtils.CONSTANTS.GAN_RANGE_MEDIUM[1] &&
            score > 0 // Only boost if it already has some score
        ) {
            score += 10; // Small boost for numbers in the "sweet spot" of gan release
            console.log(`Adj: ${num} in medium-gan sweet spot, score boosted to ${score}`);
        }

        // **Boost 2: Numbers whose "bóng" or "lộn" was recently popular (implies a shift in "flow")**
        const reversedNum = self.WorkerUtils.reverseNumber(num);
        const bongNum = self.WorkerUtils.getLotoBong(num);

        if (reversedNum !== num && lastDayNumbers.includes(reversedNum)) {
             score += 15; // If its reverse appeared yesterday, give a solid boost
             console.log(`Adj: ${num}'s reverse appeared yesterday, score boosted by 15 to ${score}`);
        }
        if (bongNum && bongNum !== num && lastDayNumbers.includes(bongNum)) {
            score += 10; // If its bóng appeared yesterday, give a moderate boost
            console.log(`Adj: ${num}'s bong appeared yesterday, score boosted by 10 to ${score}`);
        }

        // **Global Normalization (Optional but good practice)**
        // If scores vary wildly, a final normalization step can ensure they fit a range,
        // though strategy weights should ideally handle this.
        // For simplicity, we just ensure non-negativity.
        overallScores.set(num, Math.max(0, score));
    });
};

/**
 * Selects the top N numbers while applying diversification rules to ensure a balanced set.
 * This prevents the model from predicting too many numbers of the same head, tail, or type.
 * @param {Map<string, number>} overallScores Final aggregated scores for all numbers.
 * @param {DataAnalyzer} analyzer The DataAnalyzer instance to query properties.
 * @returns {Array<string>} The diversified list of predicted numbers.
 */
self.PredictionEngine._selectAndDiversifyNumbers = function(overallScores, analyzer) {
    const desiredCount = self.WorkerUtils.CONSTANTS.NUM_PREDICTED_LOTTO_NUMBERS; // Target 16 numbers
    const allLottoNumbers = analyzer.allLottoNumbers;

    // Sort all numbers by their score in descending order
    // Create a new array from the entries to avoid modifying the original map iteration
    const sortedCandidates = Array.from(overallScores.entries()).sort((a, b) => b[1] - a[1]);
    
    let selectedNumbers = new Set(); // Use a Set for quick lookups and to ensure uniqueness
    let tempPredictionPool = []; // A temporary pool to build from

    // Step 1: Initial pass - pick top 'X' numbers unconditionally
    // Pick slightly more than needed, to allow for diversification filtering later.
    // E.g., pick top 25-30 candidates to filter down to 16.
    const initialPoolSize = Math.min(desiredCount * 2, sortedCandidates.length); // Up to twice the desired count
    for (let i = 0; i < initialPoolSize; i++) {
        tempPredictionPool.push(sortedCandidates[i][0]);
    }
    
    // Step 2: Apply diversification rules (iteratively select from the high-scoring pool)
    const headCounts = new Map(Array.from({ length: 10 }, (_, i) => [String(i), 0]));
    const tailCounts = new Map(Array.from({ length: 10 }, (_, i) => [String(i), 0}));
    const totalCounts = new Map(Array.from({ length: 19 }, (_, i) => [String(i), 0])); // Totals 0-18
    
    const MAX_HEAD_PER_CATEGORY = 3; // Max 3 numbers with the same head
    const MAX_TAIL_PER_CATEGORY = 3; // Max 3 numbers with the same tail
    const MAX_TOTAL_PER_CATEGORY = 2; // Max 2 numbers with the same total

    // Iterate through the sorted candidates (highest score first)
    for (const num of tempPredictionPool) {
        if (selectedNumbers.size >= desiredCount) {
             break; // Stop if we already have enough numbers
        }

        const head = num[0];
        const tail = num[1];
        const total = String(self.WorkerUtils.calculateTotal(num));

        const currentHeadCount = headCounts.get(head) || 0;
        const currentTailCount = tailCounts.get(tail) || 0;
        const currentTotalCount = totalCounts.get(total) || 0;

        let meetsDiversityCriteria = true;

        if (currentHeadCount >= MAX_HEAD_PER_CATEGORY) {
            meetsDiversityCriteria = false;
        }
        if (currentTailCount >= MAX_TAIL_PER_CATEGORY) {
            meetsDiversityCriteria = false;
        }
        if (currentTotalCount >= MAX_TOTAL_PER_CATEGORY) {
            meetsDiversityCriteria = false;
        }

        // Allow breaking diversity rules for a small percentage of top numbers
        // This ensures very high-scoring numbers are not ignored fully.
        const PERCENT_TO_ALLOW_BREACH = 0.25; // 25% of the desired count (4 numbers for 16 prediction)
        if (selectedNumbers.size < desiredCount * PERCENT_TO_ALLOW_BREACH) {
            meetsDiversityCriteria = true; // For the top few, prioritize score over strict diversity
        }
        
        if (meetsDiversityCriteria && !selectedNumbers.has(num)) {
            selectedNumbers.add(num);
            headCounts.set(head, currentHeadCount + 1);
            tailCounts.set(tail, currentTailCount + 1);
            totalCounts.set(total, currentTotalCount + 1);
        } else {
            // console.log(`Skipped ${num} for diversity: Head:${currentHeadCount}/${MAX_HEAD_PER_CATEGORY}, Tail:${currentTailCount}/${MAX_TAIL_PER_CATEGORY}, Total:${currentTotalCount}/${MAX_TOTAL_PER_CATEGORY}`);
        }
    }

    // Step 3: Fallback - If not enough numbers picked due to strict diversity, loosen rules slightly
    // This rarely happens if the initial pool is large enough, but good for robustness.
    let fallbackCounter = 0;
    while (selectedNumbers.size < desiredCount && fallbackCounter < sortedCandidates.length) {
        const num = sortedCandidates[fallbackCounter][0];
        if (!selectedNumbers.has(num)) {
            selectedNumbers.add(num); // Add the next highest scoring number, regardless of diversity
        }
        fallbackCounter++;
    }

    console.log(`PredictionEngine: Selected ${selectedNumbers.size} numbers after diversification.`);
    return Array.from(selectedNumbers);
};

// ... Further potential refinements:
// - _dynamicStrategyWeightAdjustment(backtestResults): A more advanced feature where weights are tuned via historical performance.
// - _hardRuleFiltering(candidates): For example, remove numbers known to be "blacklisted" or specific fixed rules.
