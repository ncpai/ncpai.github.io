// data-preparer.js
// Takes parsed and organized historical data and prepares it for deep analysis
// by adding extensive derived properties and enriching each day's entry.

self.DataPreparer = self.DataPreparer || {};

/**
 * Prepares historical data by enriching each day's entry with comprehensive derived properties.
 * These properties are pre-calculated to facilitate faster and more complex analysis in DataAnalyzer.
 *
 * @param {Array<object>} organizedData An array of objects: [{ date: Date, numbers: string[] }].
 * @returns {Array<object>} The enriched array of data.
 */
self.DataPreparer.prepareHistoricalData = function(organizedData) {
    if (!organizedData || organizedData.length === 0) {
        console.warn("DataPreparer: No organized data provided to prepare.");
        return [];
    }

    const preparedData = [];

    organizedData.forEach(dayEntry => {
        const { date, numbers } = dayEntry;

        // Basic Info
        const dayOfWeek = date.getDay(); // 0 for Sunday
        const uniqueNumbers = [...new Set(numbers)]; // Unique numbers landed on this day

        // Frequency of numbers within THIS DAY (e.g., 2-nhay, 3-nhay)
        const dailyFrequencyMap = new Map();
        numbers.forEach(num => dailyFrequencyMap.set(num, (dailyFrequencyMap.get(num) || 0) + 1));
        const twoHits = Array.from(dailyFrequencyMap.entries()).filter(([_, count]) => count >= 2).map(([num, _]) => num);
        const threeHits = Array.from(dailyFrequencyMap.entries()).filter(([_, count]) => count >= 3).map(([num, _]) => num);

        // Kép Analysis
        const kepNumbersLanded = uniqueNumbers.filter(num => self.WorkerUtils.isKep(num));
        const satKepLanded = uniqueNumbers.filter(num => { // Numbers sharing one digit with a Kep (e.g., if 11, then 10, 12, 01, 21)
            if (self.WorkerUtils.isKep(num)) return false; // Exclude itself
            return kepNumbersLanded.some(kep => num[0] === kep[0] || num[1] === kep[1]);
        });
        const ganKepLanded = uniqueNumbers.filter(num => { // Numbers with digits that correspond to Kep numbers (e.g., 10 or 01 if 00 or 11 are involved)
            const head = parseInt(num[0]);
            const tail = parseInt(num[1]);
            // Example: numbers like 10, 01, 21, 12, etc., where digits are near each other.
            // Simplified this to "neighboring digits" kép based on common interpretation of gan kép
            return (Math.abs(head - tail) === 1 || head === tail); // Includes direct kep for simplicity
        });

        // Totals (sum of digits) Analysis
        const totalsLanded = new Set();
        const totalCounts = new Map(Array.from({ length: 19 }, (_, i) => [i, 0])); // 0-18 possible totals
        uniqueNumbers.forEach(numStr => {
            const total = self.WorkerUtils.calculateTotal(numStr);
            totalsLanded.add(total);
            totalCounts.set(total, totalCounts.get(total) + 1);
        });

        // Head and Tail Digit Analysis
        const headsLanded = new Set();
        const tailsLanded = new Set();
        const headCounts = new Map(Array.from({ length: 10 }, (_, i) => [String(i), 0]));
        const tailCounts = new Map(Array.from({ length: 10 }, (_, i) => [String(i), 0]));
        uniqueNumbers.forEach(numStr => {
            const head = numStr[0];
            const tail = numStr[1];
            headsLanded.add(head);
            tailsLanded.add(tail);
            headCounts.set(head, headCounts.get(head) + 1);
            tailCounts.set(tail, tailCounts.get(tail) + 1);
        });
        
        // Reverse Numbers Analysis (Pairs like 12-21)
        const reversedPairsLanded = uniqueNumbers.filter(num => {
            const reversed = self.WorkerUtils.reverseNumber(num);
            return reversed !== num && uniqueNumbers.includes(reversed);
        });

        // Bóng Numbers Analysis (based on Ngu Hanh)
        const bongNumbersLanded = uniqueNumbers.filter(num => {
            const bong = self.WorkerUtils.getLotoBong(num);
            return bong && bong !== num && uniqueNumbers.includes(bong);
        });


        preparedData.push({
            date: date,
            dayOfWeek: dayOfWeek,
            numbers: numbers, // Original numbers including duplicates
            uniqueNumbers: uniqueNumbers, // Only unique numbers
            dailyFrequencyMap: dailyFrequencyMap, // Freq of numbers within this day
            twoHits: twoHits, // Numbers that appeared 2+ times
            threeHits: threeHits, // Numbers that appeared 3+ times

            // Kép related properties
            kepNumbersLanded: kepNumbersLanded,
            satKepLanded: satKepLanded,
            ganKepLanded: ganKepLanded,

            // Totals related properties
            totalsLanded: [...totalsLanded], // Unique sums of digits
            totalCounts: totalCounts, // Freq of each total for this day

            // Head and Tail properties
            headsLanded: [...headsLanded], // Unique head digits
            tailsLanded: [...tailsLanded], // Unique tail digits
            headCounts: headCounts, // Freq of each head digit
            tailCounts: tailCounts, // Freq of each tail digit

            // Relationship patterns
            reversedPairsLanded: reversedPairsLanded, // Numbers and their actual reverse counterpart in the same day
            bongNumbersLanded: bongNumbersLanded, // Numbers and their "bóng" counterpart in the same day
        });
    });

    return preparedData;
};
