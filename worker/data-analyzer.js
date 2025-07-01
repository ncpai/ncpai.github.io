// data-analyzer.js
// This module defines the DataAnalyzer class, which provides comprehensive methods
// for performing statistical analysis on historical lottery data.
// It acts as the backbone for all prediction strategies.

self.DataAnalyzer = class DataAnalyzer {
    constructor(historyData) {
        if (!historyData || historyData.length === 0) {
            throw new Error("DataAnalyzer: historyData cannot be empty.");
        }
        this.historyData = historyData; // Prepared historical data from DataPreparer
        this.allLottoNumbers = self.WorkerUtils.generateAllLottoNumbers();
        this.currentDayIndex = this.historyData.length; // Index AFTER the last historical day
    }

    /**
     * Helper to get a slice of prepared history data.
     * @param {number} daysLookback Number of days to look back from the end of history.
     * @returns {Array<object>} A slice of the historical data, or full history if lookback is too large.
     */
    _getHistorySlice(daysLookback) {
        if (daysLookback === 0) return [];
        return this.historyData.slice(Math.max(0, this.historyData.length - daysLookback));
    }

    // --- Core Frequency & Appearance Analysis (Expanded) ---

    /**
     * Calculates the frequency of each 2-digit number within a specified lookback period.
     * @param {number} daysLookback The number of days to look back.
     * @returns {Map<string, number>} Lotto number -> total occurrences.
     */
    getNumbersFrequency(daysLookback = self.WorkerUtils.CONSTANTS.LOOKBACK.MEDIUM) {
        const frequencyMap = new Map(this.allLottoNumbers.map(num => [num, 0]));
        const recentHistory = this._getHistorySlice(daysLookback);
        recentHistory.forEach(dayInfo => dayInfo.numbers.forEach(num => frequencyMap.set(num, frequencyMap.get(num) + 1)));
        return frequencyMap;
    }

    /**
     * Identifies "Hot" numbers (most frequent).
     * @param {number} topN Number of hot numbers.
     * @param {number} daysLookback Days to look back.
     * @returns {Array<string>} Array of hot numbers.
     */
    getHotNumbers(topN = 10, daysLookback = self.WorkerUtils.CONSTANTS.LOOKBACK.SHORT) {
        const freqMap = this.getNumbersFrequency(daysLookback);
        return Array.from(freqMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, topN).map(entry => entry[0]);
    }

    /**
     * Identifies "Cold" numbers (least frequent).
     * @param {number} topN Number of cold numbers.
     * @param {number} daysLookback Days to look back.
     * @returns {Array<string>} Array of cold numbers.
     */
    getColdNumbers(topN = 10, daysLookback = self.WorkerUtils.CONSTANTS.LOOKBACK.MEDIUM) {
        const freqMap = this.getNumbersFrequency(daysLookback);
        const coldList = Array.from(freqMap.entries()).sort((a, b) => a[1] - b[1]);
        const minFreq = coldList[0] ? coldList[0][1] : 0;
        return coldList.filter(entry => entry[1] === minFreq).slice(0,topN).map(entry => entry[0]);
    }

    // --- Gan (Long-Absence) Analysis (Expanded) ---

    /**
     * Determines the "gan" status (days since last appearance) for all numbers.
     * @returns {Map<string, {daysGone: number, lastSeenDate: Date | null, lastSeenIndex: number}>}
     */
    getGanStatus() {
        const ganMap = new Map();
        const lastAppearanceMap = new Map();

        this.historyData.forEach((dayInfo, index) => {
            dayInfo.uniqueNumbers.forEach(num => lastAppearanceMap.set(num, index));
        });

        this.allLottoNumbers.forEach(num => {
            const lastSeenIndex = lastAppearanceMap.get(num);
            const daysGone = (lastSeenIndex !== undefined) ? (this.currentDayIndex - lastSeenIndex - 1) : this.currentDayIndex;
            const lastSeenDate = (lastSeenIndex !== undefined) ? this.historyData[lastSeenIndex].date : null;
            ganMap.set(num, { daysGone: daysGone, lastSeenDate: lastSeenDate, lastSeenIndex: lastSeenIndex !== undefined ? lastSeenIndex : -1 });
        });
        return ganMap;
    }
    
    /**
     * Gets a list of "gan" numbers sorted by their absence duration, filtered by gan range.
     * @param {number} minDaysGan Minimum days to be considered "gan".
     * @param {number} maxDaysGan Maximum days to be considered "gan" (optional).
     * @param {number} topN Max number of gan loto to return.
     * @returns {Array<{number: string, daysGone: number}>}
     */
    getFilteredGanNumbers(minDaysGan = 1, maxDaysGan = Infinity, topN = Infinity) {
        const ganStatus = this.getGanStatus();
        return Array.from(ganStatus.entries())
            .map(([num, data]) => ({ number: num, ...data }))
            .filter(item => item.daysGone >= minDaysGan && item.daysGone <= maxDaysGan)
            .sort((a, b) => b.daysGone - a.daysGone)
            .slice(0, topN);
    }

    // --- Lo Rơi (Drop Numbers) and Lo Lộn (Reversed Numbers) Analysis (Expanded) ---

    /**
     * Identifies "lô rơi" (numbers that fall from previous days).
     * @param {number} daysLookback Number of previous days to check for drops.
     * @param {boolean} mustBeConsecutive If true, only counts if it dropped every day available.
     * @returns {Map<string, number>} Candidates mapping number to count of occurrences as drop.
     */
    getLoRoiCandidates(daysLookback = self.WorkerUtils.CONSTANTS.LOOKBACK.SHORT, mustBeConsecutive = false) {
        const loRoiCounts = new Map();
        const historySlice = this._getHistorySlice(daysLookback + 1); // Need slice +1 to check against prior day

        if (historySlice.length < 2) return loRoiCounts;

        this.allLottoNumbers.forEach(num => {
            let dropCount = 0;
            let lastFound = true; 
            for (let i = 1; i < historySlice.length; i++) {
                const currentDay = historySlice[i].uniqueNumbers;
                const prevDay = historySlice[i-1].uniqueNumbers;

                if (prevDay.includes(num)) {
                    if (currentDay.includes(num)) {
                        dropCount++;
                    } else if (mustBeConsecutive) {
                        lastFound = false;
                        break;
                    }
                }
            }
            if (dropCount > 0 && !(mustBeConsecutive && !lastFound)) {
                loRoiCounts.set(num, dropCount);
            }
        });
        return loRoiCounts;
    }

    /**
     * Identifies "lo lộn" (numbers whose reverse appeared recently).
     * @param {number} daysLookback Number of previous days to check.
     * @param {boolean} bidirectional If true, also checks if num appeared when reverse appeared.
     * @returns {Map<string, number>} Candidates mapping reversed number to count of occurrences.
     */
    getLoLonCandidates(daysLookback = self.WorkerUtils.CONSTANTS.LOOKBACK.SHORT, bidirectional = false) {
        const loLonCounts = new Map();
        const historySlice = this._getHistorySlice(daysLookback);

        historySlice.forEach(dayInfo => {
            dayInfo.uniqueNumbers.forEach(num => {
                const reversedNum = self.WorkerUtils.reverseNumber(num);
                if (reversedNum !== num) { // Not a kép
                    loLonCounts.set(reversedNum, (loLonCounts.get(reversedNum) || 0) + 1);
                    if (bidirectional && dayInfo.uniqueNumbers.includes(reversedNum)) {
                         loLonCounts.set(num, (loLonCounts.get(num) || 0) + 1);
                    }
                }
            });
        });
        return loLonCounts;
    }


    // --- Kép (Double) Analysis (Expanded) ---

    /**
     * Gathers all kép numbers (00, 11, ..., 99) and their frequencies within a lookback period.
     * @param {number} daysLookback
     * @returns {Map<string, number>} Frequencies of kép numbers.
     */
    getKepNumbersFrequency(daysLookback = self.WorkerUtils.CONSTANTS.LOOKBACK.MEDIUM) {
        const kepNumbers = this.allLottoNumbers.filter(num => self.WorkerUtils.isKep(num));
        const kepFreq = new Map(kepNumbers.map(k => [k, 0]));
        const recentHistory = this._getHistorySlice(daysLookback);
        recentHistory.forEach(dayInfo => dayInfo.kepNumbersLanded.forEach(kep => kepFreq.set(kep, kepFreq.get(kep) + 1)));
        return kepFreq;
    }

    /**
     * Tracks the "gan" status for kép numbers.
     * @returns {Map<string, {daysGone: number}>} Map of kép number to its 'gan' status.
     */
    getGanKepNumbers() {
        const kepNumbers = this.allLottoNumbers.filter(num => self.WorkerUtils.isKep(num));
        const ganStatus = this.getGanStatus();
        const ganKepMap = new Map();
        kepNumbers.forEach(kep => {
            ganKepMap.set(kep, ganStatus.get(kep));
        });
        return ganKepMap;
    }

    // --- Day of Week Specific Analysis (Expanded) ---

    /**
     * Calculates the frequency of each number for each day of the week, total counts.
     * @param {number} daysLookback
     * @returns {Map<number, Map<string, number>>} Map: DayOfWeek (0-6) -> Number -> Frequency
     */
    getDayOfWeekTotalFrequencies(daysLookback = self.WorkerUtils.CONSTANTS.LOOKBACK.EXTENDED) {
        const dayOfWeekFreq = new Map(Array.from({ length: 7 }, (_, i) => [i, new Map(this.allLottoNumbers.map(num => [num, 0]))]));
        const historySlice = this._getHistorySlice(daysLookback);

        historySlice.forEach(dayInfo => {
            const dayOfWeek = dayInfo.dayOfWeek;
            dayInfo.numbers.forEach(num => dayOfWeekFreq.get(dayOfWeek).set(num, dayOfWeekFreq.get(dayOfWeek).get(num) + 1));
        });
        return dayOfWeekFreq;
    }

    /**
     * Calculates the average frequency of numbers for each day of the week.
     * This considers the number of times that specific day occured in lookback period.
     * @param {number} daysLookback
     * @returns {Map<number, Map<string, number>>} Map: DayOfWeek (0-6) -> Number -> Average Frequency
     */
    getDayOfWeekAverageFrequencies(daysLookback = self.WorkerUtils.CONSTANTS.LOOKBACK.EXTENDED) {
        const dayOfWeekTotalFreq = this.getDayOfWeekTotalFrequencies(daysLookback);
        const dayOfWeekOccurrences = new Map(Array.from({ length: 7 }, (_, i) => [i, 0]));
        this._getHistorySlice(daysLookback).forEach(dayInfo => dayOfWeekOccurrences.set(dayInfo.dayOfWeek, dayOfWeekOccurrences.get(dayInfo.dayOfWeek) + 1));

        const dayOfWeekAvgFreq = new Map();
        dayOfWeekTotalFreq.forEach((numFreqMap, dayOfWeek) => {
            const avgMap = new Map();
            const occurrences = dayOfWeekOccurrences.get(dayOfWeek);
            if (occurrences > 0) {
                numFreqMap.forEach((count, num) => avgMap.set(num, count / occurrences));
            }
            dayOfWeekAvgFreq.set(dayOfWeek, avgMap);
        });
        return dayOfWeekAvgFreq;
    }

    // --- Bridge (Cau) Patterns Analysis (Expanded) ---

    /**
     * Detects "cầu chạy đều" pattern: Number X appears on Day N, N+period, N+2*period...
     * @param {number} minOccurrences Minimum times pattern must repeat.
     * @param {number} maxPeriod Max period length to consider.
     * @param {number} daysLookback Days to check pattern within.
     * @returns {Set<string>} Numbers identified by consistent period patterns.
     */
    getConsistentPeriodBridge(minOccurrences = 3, maxPeriod = 7, daysLookback = self.WorkerUtils.CONSTANTS.LOOKBACK.LONG) {
        const bridgeCandidates = new Set();
        const numberAppearanceIndices = new Map(this.allLottoNumbers.map(num => [num, []]));
        const historySlice = this._getHistorySlice(daysLookback);
        const startIndex = this.historyData.length - historySlice.length;

        historySlice.forEach((dayInfo, relativeIndex) => dayInfo.uniqueNumbers.forEach(num => numberAppearanceIndices.get(num).push(startIndex + relativeIndex)));

        numberAppearanceIndices.forEach((indices, num) => {
            if (indices.length >= minOccurrences) {
                for (let period = 1; period <= maxPeriod; period++) {
                    for (let i = 0; i <= indices.length - minOccurrences; i++) {
                        let isConsistent = true;
                        for (let j = 0; j < minOccurrences - 1; j++) {
                            if (indices[i + j + 1] - indices[i + j] !== period) {
                                isConsistent = false;
                                break;
                            }
                        }
                        if (isConsistent) {
                            const lastIndexInPattern = indices[i + minOccurrences - 1];
                            const potentialNextIndex = lastIndexInPattern + period;
                            if (potentialNextIndex === this.currentDayIndex) {
                                bridgeCandidates.add(num);
                                break;
                            }
                        }
                    }
                }
            }
        });
        return bridgeCandidates;
    }

    /**
     * Identifies "chạm" (single digit head/tail) bridge patterns.
     * Finds numbers based on dominant head or tail digits in recent history.
     * @param {number} daysLookback
     * @param {number} thresholdPercentage Percentage of occurrences to be considered "strong".
     * @returns {Map<string, number>} Map of number -> score based on cham strength.
     */
    getChamBridgeCandidates(daysLookback = self.WorkerUtils.CONSTANTS.LOOKBACK.SHORT, thresholdPercentage = 25) {
        const chamScores = new Map(this.allLottoNumbers.map(num => [num, 0]));
        const headCounts = new Map(Array.from({ length: 10 }, (_, i) => [String(i), 0]));
        const tailCounts = new Map(Array.from({ length: 10 }, (_, i) => [String(i), 0]));
        const recentHistory = this._getHistorySlice(daysLookback);

        let totalNumbersInHistory = 0; // Total count of numbers (27 per day)
        recentHistory.forEach(day => {
            day.numbers.forEach(num => {
                headCounts.set(num[0], headCounts.get(num[0]) + 1);
                tailCounts.set(num[1], tailCounts.get(num[1]) + 1);
                totalNumbersInHistory++;
            });
        });

        // Determine strong chams
        const strongHeads = new Set();
        headCounts.forEach((count, digit) => {
            if (totalNumbersInHistory > 0 && (count / totalNumbersInHistory) * 100 >= thresholdPercentage) {
                strongHeads.add(digit);
            }
        });
        const strongTails = new Set();
        tailCounts.forEach((count, digit) => {
            if (totalNumbersInHistory > 0 && (count / totalNumbersInHistory) * 100 >= thresholdPercentage) {
                strongTails.add(digit);
            }
        });

        // Score numbers based on strong chams
        this.allLottoNumbers.forEach(num => {
            let score = 0;
            if (strongHeads.has(num[0])) score += 30;
            if (strongTails.has(num[1])) score += 30;
            if (strongHeads.has(num[0]) && strongTails.has(num[1]) && num[0] === num[1]) score += 10;
            
            chamScores.set(num, score);
        });
        return chamScores;
    }
    
    // --- Paired Numbers (Lô Xiên) Analysis (Expanded) ---

    /**
     * Calculates the "correlation" for all pairs of numbers appearing together.
     * @param {number} daysLookback
     * @returns {Map<string, Map<string, number>>} num1 -> num2 -> co-occurrence count.
     */
    getAllPairCoOccurrences(daysLookback = self.WorkerUtils.CONSTANTS.LOOKBACK.MEDIUM) {
        const coOccurrencesMap = new Map();
        this.allLottoNumbers.forEach(n1 => coOccurrencesMap.set(n1, new Map()));

        const historySlice = this._getHistorySlice(daysLookback);
        historySlice.forEach(dayInfo => {
            const uniqueNumbersSorted = [...dayInfo.uniqueNumbers].sort();
            uniqueNumbersSorted.forEach((numA, idxA) => {
                uniqueNumbersSorted.forEach((numB, idxB) => {
                    if (idxA >= idxB) return; // Only count each pair once
                    const key1 = numA;
                    const key2 = numB;
                    const currentMap1 = coOccurrencesMap.get(key1);
                    const currentMap2 = coOccurrencesMap.get(key2);

                    currentMap1.set(key2, (currentMap1.get(key2) || 0) + 1);
                    currentMap2.set(key1, (currentMap2.get(key1) || 0) + 1); // Symmetric
                });
            });
        });
        return coOccurrencesMap;
    }

    /**
     * Checks for numbers that tend to appear as successors to others (Markov Chain like behavior).
     * @param {number} daysLookback
     * @returns {Map<string, Map<string, number>>} Map: PreviousNumber -> Map<NextNumber, Count>
     */
    getSuccessorFrequencies(daysLookback = self.WorkerUtils.CONSTANTS.LOOKBACK.LONG) {
        const successorMap = new Map(); // prevNum -> (nextNum -> count)
        const historySlice = this._getHistorySlice(daysLookback);

        for (let i = 0; i < historySlice.length - 1; i++) {
            const currentDayNumbers = new Set(historySlice[i].uniqueNumbers);
            const nextDayNumbers = new Set(historySlice[i + 1].uniqueNumbers);

            currentDayNumbers.forEach(prevNum => {
                if (!successorMap.has(prevNum)) {
                    successorMap.set(prevNum, new Map());
                }
                const followers = successorMap.get(prevNum);
                nextDayNumbers.forEach(nextNum => {
                    followers.set(nextNum, (followers.get(nextNum) || 0) + 1);
                });
            });
        }
        return successorMap;
    }

    // --- Totals (Sum of Digits) & Cham (Individual Digits) Analysis (Expanded) ---

    /**
     * Calculates frequencies of all possible sums (0-18) within a lookback period.
     * @param {number} daysLookback
     * @returns {Map<number, number>} Map of sum (0-18) -> frequency.
     */
    getTotalsFrequency(daysLookback = self.WorkerUtils.CONSTANTS.LOOKBACK.LONG) {
        const totalFreq = new Map(Array.from({ length: 19 }, (_, i) => [i, 0])); // Totals 0 (for 00) to 18 (for 99)
        const recentHistory = this._getHistorySlice(daysLookback);
        recentHistory.forEach(dayInfo => dayInfo.totalsLanded.forEach(total => totalFreq.set(total, totalFreq.get(total) + 1)));
        return totalFreq;
    }

// data-analyzer.js (CONTINUED)

    /**
     * Identifies "gan" totals (sums that haven't appeared for a long time).
     * @returns {Map<number, {daysGone: number, lastSeenDate: Date | null}>}
     */
    getGanTotalsStatus() {
        const ganTotalsMap = new Map();
        const lastAppearanceMap = new Map();

        this.historyData.forEach((dayInfo, index) => dayInfo.totalsLanded.forEach(total => lastAppearanceMap.set(total, index)));

        // All possible totals from 0 to 18
        for (let i = 0; i <= 18; i++) {
            const lastSeenIndex = lastAppearanceMap.get(i) || -1; // Use -1 if never seen
            const daysGone = (lastSeenIndex !== -1) ? (this.currentDayIndex - lastSeenIndex - 1) : this.currentDayIndex;
            const lastSeenDate = (lastSeenIndex !== -1) ? this.historyData[lastSeenIndex].date : null;
            ganTotalsMap.set(i, { daysGone: daysGone, lastSeenDate: lastSeenDate });
        }
        return ganTotalsMap;
    }

    // --- Cycle Analysis (Expanded & More Detailed) ---

    /**
     * Provides detailed cycle analysis for each lotto number.
     * @param {number} minCycleCount Minimum number of cycles to consider pattern stable.
     * @returns {Map<string, {appearances: number[], avgCycle: number, lastSeenIndex: number, daysSinceLast: number, cycles: number[], nextDueApprox: number, consistencyScore: number, cycleVariance: number}>}
     */
    getNumberCycleAnalysis(minCycleCount = 3) {
        const cycleInfo = new Map(this.allLottoNumbers.map(num => [num, {
            appearances: [], avgCycle: 0, lastSeenIndex: -1, daysSinceLast: -1,
            cycles: [], nextDueApprox: -1, consistencyScore: 0, cycleVariance: 0
        }]));

        this.historyData.forEach((dayInfo, index) => dayInfo.uniqueNumbers.forEach(num => cycleInfo.get(num).appearances.push(index)));

        const currentDayIndex = this.historyData.length;
        cycleInfo.forEach((info, num) => {
            if (info.appearances.length >= 2) {
                for (let i = 1; i < info.appearances.length; i++) info.cycles.push(info.appearances[i] - info.appearances[i - 1]);
                info.avgCycle = self.WorkerUtils.averageArray(info.cycles);
                info.cycleVariance = self.WorkerUtils.standardDeviation(info.cycles);
                info.consistencyScore = (info.cycleVariance === 0 || isNaN(info.cycleVariance)) ? 1 : (1 / (1 + info.cycleVariance));
                info.nextDueApprox = info.appearances[info.appearances.length - 1] + info.avgCycle;
            }
            // Ensure lastSeenIndex is set to the absolute index, not relative
            if (info.appearances.length > 0) info.lastSeenIndex = info.appearances[info.appearances.length-1];
            
            if (info.lastSeenIndex !== -1) info.daysSinceLast = currentDayIndex - info.lastSeenIndex - 1;
            else info.daysSinceLast = currentDayIndex; // Never seen
        });
        return cycleInfo;
    }

    // --- Bóng Numbers Analysis ---
    /**
     * Checks how often a number and its "bóng" counterpart appear within a specified lookback.
     * @param {number} daysLookback
     * @returns {Map<string, number>} Map of number -> score based on how often it appeared with its 'bóng'.
     */
    getBongNumberCoOccurrences(daysLookback = self.WorkerUtils.CONSTANTS.LOOKBACK.MEDIUM) {
        const bongCoOccurrences = new Map(this.allLottoNumbers.map(num => [num, 0]));
        const recentHistory = this._getHistorySlice(daysLookback);

        recentHistory.forEach(dayInfo => {
            dayInfo.uniqueNumbers.forEach(num => {
                const bongNum = self.WorkerUtils.getLotoBong(num);
                if (bongNum && bongNum !== num && dayInfo.uniqueNumbers.includes(bongNum)) {
                    bongCoOccurrences.set(num, bongCoOccurrences.get(num) + 1);
                    bongCoOccurrences.set(bongNum, bongCoOccurrences.get(bongNum) + 1);
                }
            });
        });
        return bongCoOccurrences;
    }

    /**
     * Identifies numbers that frequently appear with their reverse (e.g., 12 & 21).
     * @param {number} daysLookback
     * @returns {Map<string, number>} Number -> count of times it appeared with its reverse.
     */
    getReverseCoOccurrences(daysLookback = self.WorkerUtils.CONSTANTS.LOOKBACK.MEDIUM) {
        const reverseCoOccurrences = new Map(this.allLottoNumbers.map(num => [num, 0]));
        const recentHistory = this._getHistorySlice(daysLookback);

        recentHistory.forEach(dayInfo => {
            dayInfo.uniqueNumbers.forEach(num => {
                const reversedNum = self.WorkerUtils.reverseNumber(num);
                if (reversedNum !== num && dayInfo.uniqueNumbers.includes(reversedNum)) {
                    reverseCoOccurrences.set(num, reverseCoOccurrences.get(num) + 1);
                    reverseCoOccurrences.set(reversedNum, reverseCoOccurrences.get(reversedNum) + 1);
                }
            });
        });
        return reverseCoOccurrences;
    }

    // --- Complex Sequence & Pattern Analysis ---

    /**
     * Identifies numbers that are "kẹp giữa" (sandwiched) in a sequence, e.g., A, X, A in recent history.
     * Currently looks for `numA (day-N), numX (day-N+1), numA (day-N+2)` for all unique numbers.
     * @param {number} daysLookback The lookback window to find such patterns.
     * @returns {Set<string>} Numbers identified as "kẹp giữa".
     */
    getSandwichedNumbers(daysLookback = self.WorkerUtils.CONSTANTS.LOOKBACK.SHORT) {
        const sandwichedCandidates = new Set();
        const historySlice = this._getHistorySlice(daysLookback);
        if (historySlice.length < 3) return sandwichedCandidates;

        for (let i = 0; i <= historySlice.length - 3; i++) {
            const dayA = new Set(historySlice[i].uniqueNumbers);
            const dayX = new Set(historySlice[i + 1].uniqueNumbers);
            const dayB = new Set(historySlice[i + 2].uniqueNumbers);

            dayA.forEach(numA => {
                if (dayB.has(numA)) { // If numA appeared, then appeared again 2 days later
                    dayX.forEach(numX => {
                        // If numX appeared in between, consider it sandwiched by numA's occurrences.
                        // This logic is a simplification, real "kẹp" usually refers to positional.
                        sandwichedCandidates.add(numX);
                    });
                }
            });
        }
        return sandwichedCandidates;
    }


    /**
     * Analyzes the pattern of "2 nháy", "3 nháy" (appearing multiple times in a day).
     * @param {number} daysLookback
     * @returns {Map<string, {twoHits: number, threeHits: number}>} Number -> counts of 2/3 hit days.
     */
    getMultiHitFrequencies(daysLookback = self.WorkerUtils.CONSTANTS.LOOKBACK.LONG) {
        const multiHitStats = new Map(this.allLottoNumbers.map(num => [num, { twoHits: 0, threeHits: 0 }]));
        const recentHistory = this._getHistorySlice(daysLookback);

        recentHistory.forEach(dayInfo => {
            dayInfo.twoHits.forEach(num => {
                if (multiHitStats.has(num)) multiHitStats.get(num).twoHits++;
            });
            dayInfo.threeHits.forEach(num => {
                if (multiHitStats.has(num)) multiHitStats.get(num).threeHits++;
            });
        });
        return multiHitStats;
    }

    // --- Special Number Types Analysis ---

    /**
     * Tracks the frequency of numbers with specific properties (e.g., total = 0, total = 9, total = 10, total = 18).
     * @param {number} daysLookback
     * @returns {Map<string, {total0:number, total9:number, total10:number, total18:number}>}
     */
    getSpecialTotalFrequencies(daysLookback = self.WorkerUtils.CONSTANTS.LOOKBACK.LONG) {
        const specialTotalFreq = new Map(this.allLottoNumbers.map(num => [num, { total0:0, total9:0, total10:0, total18:0 }]));
        const recentHistory = this._getHistorySlice(daysLookback);

        recentHistory.forEach(dayInfo => {
            dayInfo.uniqueNumbers.forEach(num => {
                const total = self.WorkerUtils.calculateTotal(num);
                const stats = specialTotalFreq.get(num);
                if (stats) { // Ensure mapping exists for the number
                    if (total === 0) stats.total0++;
                    if (total === 9) stats.total9++;
                    if (total === 10) stats.total10++;
                    if (total === 18) stats.total18++;
                }
            });
        });
        return specialTotalFreq;
    }

    // --- Advanced Statistical/Trend Analysis ---

    /**
     * Calculates percentile for number appearances.
     * @param {string} number The lotto number to check.
     * @param {number} daysLookback
     * @returns {number} The percentile rank of the number's frequency (0-100).
     */
    getNumberFrequencyPercentile(number, daysLookback = self.WorkerUtils.CONSTANTS.LOOKBACK.LONG) {
        const freqMap = this.getNumbersFrequency(daysLookback);
        const allFrequencies = Array.from(freqMap.values()).filter(f => f >= 0); // Include 0 frequencies if some numbers never appeared
        if (allFrequencies.length === 0) return 0;
        
        const sortedFrequencies = [...allFrequencies].sort((a, b) => a - b);
        const numberFreq = freqMap.get(number) || 0;

        let count = 0;
        for (let i = 0; i < sortedFrequencies.length; i++) {
            if (sortedFrequencies[i] <= numberFreq) {
                count++;
            } else {
                break;
            }
        }
        return (count / sortedFrequencies.length) * 100;
    }

    /**
     * Identifies groups of 'hot' or 'cold' numbers by analyzing trends in frequency over time.
     * @param {'hot' | 'cold'} type 'hot' or 'cold'.
     * @param {number} threshold The percentile threshold to consider (e.g., 80 for top 20%).
     * @param {number} shortLookback Short term period.
     * @param {number} longLookback Long term period.
     * @returns {Map<string, number>} Number -> score indicating its trend (positive for hot, negative for cold).
     */
    getTrendNumbers(type = 'hot', threshold = 80, shortLookback = self.WorkerUtils.CONSTANTS.LOOKBACK.VERY_SHORT, longLookback = self.WorkerUtils.CONSTANTS.LOOKBACK.LONG) {
        const trendScores = new Map(this.allLottoNumbers.map(num => [num, 0]));

        this.allLottoNumbers.forEach(num => {
            const shortTermPercentile = this.getNumberFrequencyPercentile(num, shortLookback);
            const longTermPercentile = this.getNumberFrequencyPercentile(num, longLookback);

            if (type === 'hot') {
                if (shortTermPercentile >= threshold && longTermPercentile >= threshold - 10) { // Consistently hot
                    trendScores.set(num, 100);
                } else if (shortTermPercentile >= threshold && longTermPercentile < threshold - 10) { // Suddenly hot
                    trendScores.set(num, 70);
                }
            } else { // type === 'cold'
                // For 'cold', threshold means bottom X% (e.g., 20 for bottom 20%).
                // Inverse the threshold for percentile comparison:
                const coldThreshold = 100 - threshold;
                if (shortTermPercentile <= coldThreshold && longTermPercentile <= coldThreshold + 10) { // Consistently cold
                    trendScores.set(num, -100);
                } else if (shortTermPercentile <= coldThreshold && longTermPercentile > coldThreshold + 10) { // Suddenly cold (cooling down)
                    trendScores.set(num, -70);
                }
            }
        });
        return trendScores;
    }

    // --- Consecutive Appearance Analysis ---
    /**
     * Finds numbers that appear in consecutive days (e.g., 12, then 12 again on the next day).
     * @param {number} maxConsecutiveDays Max length of consecutive appearance to check (e.g., 2 for two days, 3 for three days).
     * @returns {Map<string, number>} Number -> max consecutive days it appeared, ending yesterday.
     */
    getConsecutiveAppearance(maxConsecutiveDays = 3) {
        const consecutiveMap = new Map(this.allLottoNumbers.map(num => [num, 0]));

        if (this.historyData.length < maxConsecutiveDays) return consecutiveMap; // Not enough history to check max days

        this.allLottoNumbers.forEach(num => {
            let currentConsecutive = 0;
            // Check backwards from the last day in history
            for (let i = 1; i <= maxConsecutiveDays && (this.historyData.length - i) >= 0; i++) {
                if (this.historyData[this.historyData.length - i].uniqueNumbers.includes(num)) {
                    currentConsecutive++;
                } else {
                    break;
                }
            }
            if (currentConsecutive > 0) {
                 consecutiveMap.set(num, currentConsecutive);
            }
        });
        return consecutiveMap;
    }

    // --- Detailed Gan History Analysis ---
    /**
     * Analyzes historical "gan" periods for each number to predict next gan length.
     * @returns {Map<string, {ganLengths: number[], avgGan: number, stdDevGan: number, lastGanPeriod: number}>}
     */
    getHistoricalGanAnalysis() {
        const ganHistoryMap = new Map(this.allLottoNumbers.map(num => [num, {
            ganLengths: [], // Lengths of non-appearance periods
            avgGan: 0,
            stdDevGan: 0,
            lastGanPeriod: 0 // How long the *most recent* gan period lasted (up to the current day)
        }]));

        this.allLottoNumbers.forEach(num => {
            let lastAppearanceIndex = -1;
            let currentConsecutiveAbsence = 0; // Tracks current gan period
            const historyForNum = ganHistoryMap.get(num);

            for (let i = 0; i < this.historyData.length; i++) {
                if (this.historyData[i].uniqueNumbers.includes(num)) {
                    if (lastAppearanceIndex !== -1) { // If it appeared before, record the gan length
                        historyForNum.ganLengths.push(currentConsecutiveAbsence);
                    }
                    lastAppearanceIndex = i;
                    currentConsecutiveAbsence = 0; // Reset gan counter
                } else {
                    currentConsecutiveAbsence++;
                }
            }
            // The "lastGanPeriod" is the duration since its last appearance until the end of recorded history
            if (lastAppearanceIndex !== -1) {
                historyForNum.lastGanPeriod = currentConsecutiveAbsence;
            } else { // If never seen in history
                historyForNum.lastGanPeriod = this.historyData.length;
            }

            if (historyForNum.ganLengths.length > 0) {
                historyForNum.avgGan = self.WorkerUtils.averageArray(historyForNum.ganLengths);
                historyForNum.stdDevGan = self.WorkerUtils.standardDeviation(historyForNum.ganLengths);
            }
        });
        return ganHistoryMap;
    }

    // --- Zone Analysis (Miền numbers) ---

    /**
     * Divides numbers into zones and analyzes frequency of zones.
     * Zone definition:
     * - Zone 1: 00-24
     * - Zone 2: 25-49
     * - Zone 3: 50-74
     * - Zone 4: 75-99
     * @param {number} daysLookback
     * @returns {Map<string, number>} Zone name -> total occurrences of numbers in that zone.
     */
    getZoneFrequencies(daysLookback = self.WorkerUtils.CONSTANTS.LOOKBACK.MEDIUM) {
        const zoneFreq = new Map([['Zone1',0], ['Zone2',0], ['Zone3',0], ['Zone4',0]]);
        const recentHistory = this._getHistorySlice(daysLookback);

        recentHistory.forEach(dayInfo => {
            dayInfo.uniqueNumbers.forEach(numStr => {
                const num = parseInt(numStr, 10);
                if (num >= 0 && num <= 24) zoneFreq.set('Zone1', zoneFreq.get('Zone1') + 1);
                else if (num >= 25 && num <= 49) zoneFreq.set('Zone2', zoneFreq.get('Zone2') + 1);
                else if (num >= 50 && num <= 74) zoneFreq.set('Zone3', zoneFreq.get('Zone3') + 1);
                else if (num >= 75 && num <= 99) zoneFreq.set('Zone4', zoneFreq.get('Zone4') + 1);
            });
        });
        return zoneFreq;
    }

    /**
     * Determines which zone a number belongs to.
     * @param {string} numStr
     * @returns {string | null} Zone name or null.
     */
    getZoneForNumber(numStr) {
        const num = parseInt(numStr, 10);
        if (num >= 0 && num <= 24) return 'Zone1';
        if (num >= 25 && num <= 49) return 'Zone2';
        if (num >= 50 && num <= 74) return 'Zone3';
        if (num >= 75 && num <= 99) return 'Zone4';
        return null;
    }

    // --- Special Number Characteristics Analysis (e.g., date-based, single digits) ---

    /**
     * Finds numbers that appear frequently on a specific day of the month.
     * Requires the 'date' property in historyData.
     * @param {number} specificDateDay Day of the month (1-31).
     * @param {number} daysLookback
     * @returns {Map<string, number>} Number -> frequency on that specific date day.
     */
    getDateDayFrequency(specificDateDay, daysLookback = self.WorkerUtils.CONSTANTS.LOOKBACK.EXTENDED) {
        const freqMap = new Map(this.allLottoNumbers.map(num => [num, 0]));
        const recentHistory = this._getHistorySlice(daysLookback);

        recentHistory.forEach(dayInfo => {
            if (dayInfo.date.getDate() === specificDateDay) {
                dayInfo.uniqueNumbers.forEach(num => {
                    freqMap.set(num, freqMap.get(num) + 1);
                });
            }
        });
        return freqMap;
    }

    // --- Last Day's Data Convenience Getters (Expanded) ---
    getLastDayNumbers() { return this.historyData.length > 0 ? this.historyData[this.historyData.length - 1].uniqueNumbers : []; }
    getSecondLastDayNumbers() { return this.historyData.length > 1 ? this.historyData[this.historyData.length - 2].uniqueNumbers : []; }
    getThirdLastDayNumbers() { return this.historyData.length > 2 ? this.historyData[this.historyData.length - 3].uniqueNumbers : []; }

    getLastDayHeads() { return this.historyData.length > 0 ? new Set(this.historyData[this.historyData.length - 1].headsLanded) : new Set(); }
    getLastDayTails() { return this.historyData.length > 0 ? new Set(this.historyData[this.historyData.length - 1].tailsLanded) : new Set(); }
    getLastDayTotals() { return this.historyData.length > 0 ? new Set(this.historyData[this.historyData.length - 1].totalsLanded) : new Set(); }
    getLastDayKepNumbers() { return this.historyData.length > 0 ? this.historyData[this.historyData.length - 1].kepNumbersLanded : []; }

    getAllLottoNumbers() {
        return this.allLottoNumbers;
    }

};
