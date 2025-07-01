// backtester.js
// Responsible for evaluating the prediction engine's performance against historical data.
// It simulates predictions over a historical period and calculates various accuracy and ROI metrics.

self.Backtester = self.Backtester || {};

/**
 * Runs a backtest of the prediction engine over a specified window of historical data.
 * For each day in the backtest window, it simulates a prediction using only the data
 * available up to the previous day, and then compares the prediction to the actual results.
 *
 * @param {Array<object>} fullHistoryData All prepared historical data from DataPreparer.
 * @returns {object} An object containing detailed backtest statistics.
 */
self.Backtester.runBacktest = function(fullHistoryData) {
    console.log("Backtester: Starting backtest simulation.");

    const MIN_HISTORY_FOR_PREDICTION = self.WorkerUtils.CONSTANTS.MIN_HISTORY_FOR_ANALYSIS;
    const BACKTEST_WINDOW = self.WorkerUtils.CONSTANTS.BACKTEST_WINDOW_SIZE;
    const HIGH_ACCURACY_THRESHOLD = self.WorkerUtils.CONSTANTS.HIGH_ACCURACY_THRESHOLD; // e.g., 10 / 16
    const PROFIT_THRESHOLD = self.WorkerUtils.CONSTANTS.PROFIT_THRESHOLD_DEFAULT; // e.g., 5 / 16 (for 16-number prediction)
    const NUM_PREDICTED_LOTTO_NUMBERS = self.WorkerUtils.CONSTANTS.NUM_PREDICTED_LOTTO_NUMBERS; // Expected 16 numbers

    // Check if there's enough history to even start backtesting
    if (fullHistoryData.length < MIN_HISTORY_FOR_PREDICTION + 1) { // Need at least 1 day for backtest + MIN_HISTORY for prediction
        return self.Backtester._getEmptyStats("Not enough history for backtest. Min history for prediction not met for even first test day.");
    }

    // Determine the actual start index for the backtest window
    // It should be `fullHistoryData.length - BACKTEST_WINDOW`, but ensuring there's enough
    // past data for `MIN_HISTORY_FOR_PREDICTION` for the *first* prediction.
    const maxTestableIndex = fullHistoryData.length - 1; // Last day available to test
    let actualBacktestStartIndex = maxTestableIndex - BACKTEST_WINDOW + 1;

    // Ensure the earliest day we test has enough 'training' data before it
    if (actualBacktestStartIndex < MIN_HISTORY_FOR_PREDICTION) {
        console.warn(`Backtester: Adjusted backtest start index. Using ${fullHistoryData.length - MIN_HISTORY_FOR_PREDICTION} days for backtest (from total ${fullHistoryData.length}).`);
        actualBacktestStartIndex = MIN_HISTORY_FOR_ANALYSIS;
    }

    let totalDaysTested = 0;
    let totalCorrectNumbers = 0;
    let daysWithHighAccuracy = 0;
    let daysMeetingProfitThreshold = 0;
    const dailyCorrectCounts = []; // Stores number of correct predictions for each tested day

    // --- ROI Calculation Parameters (Hypothetical for illustrative purposes) ---
    // These values are for simulating betting on the 16 predicted numbers.
    // Example for lô xiên 2 (2 numbers hit in same 16-number set): cost/reward varies.
    // For simplicity, we assume "lô" (single number prediction).
    const COST_PER_LOTTO_POINT = 23000; // VNĐ - Cost for 1 point/line on a single number.
    const REWARD_PER_LOTTO_POINT_HIT = 80000; // VNĐ - Reward for 1 point/line if number hits.
    
    // Assuming each of the 16 numbers is played for 1 point (or 1000 VNĐ "số").
    // This is a simplified "lô" model, not a complex "đề", "xiên", "ba càng".
    const COST_PER_DAY_PREDICTION = NUM_PREDICTED_LOTTO_NUMBERS * COST_PER_LOTTO_POINT;

    let totalInvestment = 0;
    let totalGains = 0;
    let dailyNetProfits = [];

    // Track detailed hits for each strategy (simplified - actual tracking is complex)
    // This would require PredictionEngine.predictNextDay to return per-strategy scores for hits.
    const strategyInfluenceTracker = new Map(self.PredictionEngine.strategies.map(s => [s.name, { totalInfluenceScore: 0, totalCorrectlyPredictedNumbers: 0 }]));


    // Iterate through the historical data, simulating a prediction for each day in the backtest window
    for (let i = actualBacktestStartIndex; i <= maxTestableIndex; i++) {
        // `trainingData` is the slice of history available BEFORE the day we are predicting (day `i`).
        const trainingData = fullHistoryData.slice(0, i);

        // Actual numbers that appeared on this day (`i`)
        const actualLandedNumbers = fullHistoryData[i].numbers;

        // Skip if training data is somehow insufficient for this specific day (shouldn't happen with `actualBacktestStartIndex`)
        if (trainingData.length < MIN_HISTORY_FOR_PREDICTION) {
            console.warn(`Backtester: Skipping day index ${i} during iteration due to insufficient training data (${trainingData.length} < ${MIN_HISTORY_FOR_PREDICTION}). This indicates an error in backtest window calculation.`);
            continue;
        }

        try {
            // Simulate the prediction: get the numbers that the engine would have predicted
            // Pass `trainingData` to `predictNextDay` to ensure it only sees *past* data.
            const simulatedPredictedNumbers = self.PredictionEngine.predictNextDay(trainingData); // Should return 16 numbers

            totalDaysTested++;
            totalInvestment += COST_PER_DAY_PREDICTION;

            let correctCount = 0;
            const correctlyPredictedNumbersToday = [];

            for (const predictedNum of simulatedPredictedNumbers) {
                if (actualLandedNumbers.includes(predictedNum)) {
                    correctCount++;
                    correctlyPredictedNumbersToday.push(predictedNum);
                }
            }
            totalCorrectNumbers += correctCount;
            totalGains += correctCount * REWARD_PER_LOTTO_POINT_HIT;
            dailyCorrectCounts.push(correctCount);
            dailyNetProfits.push((correctCount * REWARD_PER_LOTTO_POINT_HIT) - COST_PER_DAY_PREDICTION);

            if (correctCount >= HIGH_ACCURACY_THRESHOLD) {
                daysWithHighAccuracy++;
            }
            if (correctCount >= PROFIT_THRESHOLD) {
                daysMeetingProfitThreshold++;
            }

            // A more advanced strategy influence tracking would be here:
            // This would likely involve modifying PredictionEngine to return NOT just the 16 numbers,
            // but also the contribution level of *each strategy* to *each of those 16 numbers*.
            // Then, for each `correctlyPredictedNumberToday`, we could attribute its successful
            // prediction back to the strategies that scored it highly.
            /*
            const detailedPredictionResult = self.PredictionEngine._predictNextDayWithStrategyScores(trainingData); // Hypothetical function

            correctlyPredictedNumbersToday.forEach(hitNum => {
                const strategyContributionsForThisHit = detailedPredictionResult.strategyScoresMap.get(hitNum);
                if (strategyContributionsForThisHit) {
                    self.PredictionEngine.strategies.forEach(strategy => {
                        const directScoreFromStrategy = strategyContributionsForThisHit.get(strategy.name) || 0;
                        if (directScoreFromStrategy > 0) { // If this strategy contributed positively
                            const tracker = strategyInfluenceTracker.get(strategy.name);
                            tracker.totalInfluenceScore += directScoreFromStrategy; // Sum of scores for actual hits
                            tracker.totalCorrectlyPredictedNumbers += 1; // Mark this strategy as having contributed to a hit
                        }
                    });
                }
            });
            */
            // For now, `strategyInfluenceTracker` remains a placeholder or can track overall engagement.


        } catch (e) {
            console.error(`Backtester: Error simulating prediction for day index ${i}:`, e);
            // If any error occurs during prediction for a day, count it as a lost day for stats.
            totalDaysTested++;
            totalInvestment += COST_PER_DAY_PREDICTION; // Assume investment was made
            dailyCorrectCounts.push(0); // No correct numbers
            dailyNetProfits.push(-COST_PER_DAY_PREDICTION); // Full loss
        }
    }

    // Calculate final statistics
    const avgCorrectNumbers = totalDaysTested > 0 ? (totalCorrectNumbers / totalDaysTested) : 0;
    const highAccuracyRate = totalDaysTested > 0 ? (daysWithHighAccuracy / totalDaysTested) * 100 : 0;
    const profitRate = totalDaysTested > 0 ? (daysMeetingProfitThreshold / totalDaysTested) * 100 : 0;
    const netProfit = totalGains - totalInvestment;
    const roi = totalInvestment > 0 ? (netProfit / totalInvestment) * 100 : 0;

    // Aggregate strategy performance for reporting (still simplified)
    const finalStrategyPerformance = Array.from(strategyInfluenceTracker.entries()).map(([name, data]) => ({
        name: name,
        totalInfluenceScore: data.totalInfluenceScore,
        totalCorrectlyPredictedNumbers: data.totalCorrectlyPredictedNumbers,
        // Add more meaningful metrics if PredictionEngine had robust tracking
    }));

    console.log("Backtester: Backtest completed. Summary:", { totalDaysTested, avgCorrectNumbers: avgCorrectNumbers.toFixed(2), netProfit, roi: roi.toFixed(2) + '%' });

    return {
        accuracyStats: {
            totalDaysTested: totalDaysTested,
            avgCorrectNumbersPerDay: avgCorrectNumbers.toFixed(2),
            daysWithHighAccuracy: daysWithHighAccuracy,
            percentageDaysHighAccuracy: highAccuracyRate.toFixed(2), // Percentage of days meeting high accuracy threshold
            daysMeetingProfitThreshold: daysMeetingProfitThreshold,
            percentageDaysProfitable: profitRate.toFixed(2), // Percentage of days meeting profit threshold
            
            roi: roi.toFixed(2), // ROI percentage
            totalInvestment: totalInvestment.toLocaleString('vi-VN'), // Formatted VND
            totalGains: totalGains.toLocaleString('vi-VN'), // Formatted VND
            netProfit: netProfit.toLocaleString('vi-VN'), // Formatted VND

            dailyCorrectCounts: dailyCorrectCounts, // Raw array of correct counts per day
            dailyNetProfits: dailyNetProfits, // Raw array of net profit/loss per day
            
            strategyPerformance: finalStrategyPerformance, // Detailed (simplified) strategy performance
        }
    };
};

/**
 * Returns an empty set of statistics, useful when backtest cannot be performed.
 * @param {string} reason
 * @returns {object}
 */
self.Backtester._getEmptyStats = function(reason = "No data for backtest.") {
    console.warn(`Backtester: Returning empty stats: ${reason}`);
    return {
        accuracyStats: {
            totalDaysTested: 0, avgCorrectNumbersPerDay: 0, daysWithHighAccuracy: 0, percentageDaysHighAccuracy: 0,
            daysMeetingProfitThreshold: 0, percentageDaysProfitable: 0,
            roi: 'N/A', totalInvestment: 0, totalGains: 0, netProfit: 0,
            dailyCorrectCounts: [], dailyNetProfits: [], strategyPerformance: [], reason: reason
        }
    };
};
