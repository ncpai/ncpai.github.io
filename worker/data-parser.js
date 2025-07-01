// data-parser.js
// Handles the parsing of raw text data input by the user into a structured format.

self.DataParser = self.DataParser || {};

/**
 * Parses raw text data provided by the user into a structured object.
 * The input format is expected to be:
 * XSMB [DayOfWeek] ngày DD-MM-YYYY
 * Đầu Đuôi
 * 0 X,Y,Z
 * 1 A,B
 * ...
 * Each "Đầu X Đuôi Y,Z" line is interpreted as numbers XY, XZ, etc. that landed.
 * Example: "0 2,5" means "02" and "05" landed.
 *
 * @param {string} rawData The raw text data string from the user input.
 * @returns {object} An object where keys are date strings (YYYY-MM-DD) and values are arrays of landed lotto numbers (string[]).
 * @throws {Error} If parsing encounters unrecoverable issues or invalid formats.
 */
self.DataParser.parseRawData = function(rawData) {
    const lines = rawData.split('\n');
    const dataByDate = {};
    let currentDateStr = null;

    const dateRegex = /XSMB\s+(?:Thứ\s+\S+\s+)?(?:.+)?ngay\s+(\d{1,2})-(\d{1,2})-(\d{4})/;
    const headTailRegex = /^(\d)\s+([\d,]+)/;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const dateMatch = line.match(dateRegex);
        if (dateMatch) {
            const day = dateMatch[1];
            const month = dateMatch[2];
            const year = dateMatch[3];
            currentDateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            if (dataByDate[currentDateStr]) {
                 console.warn(`DataParser: Duplicate entry found for date ${currentDateStr}. Overwriting previous data.`);
            }
            dataByDate[currentDateStr] = [];
            continue;
        }

        if (!currentDateStr) {
            if (headTailRegex.test(line)) {
                console.warn(`DataParser: Skipped data line '${line}' as no date was established yet.`);
            }
            continue;
        }

        if (line.toLowerCase().includes('đầu') && line.toLowerCase().includes('đuôi')) {
            continue;
        }

        const headTailMatch = line.match(headTailRegex);
        if (headTailMatch) {
            const headDigit = headTailMatch[1];
            const tailsString = headTailMatch[2];
            const tails = tailsString.split(',').map(s => s.trim());

            for (const tail of tails) {
                const fullNumber = headDigit + tail.padStart(1, '0');
                if (fullNumber.length === 2 && !isNaN(parseInt(fullNumber, 10))) {
                    dataByDate[currentDateStr].push(fullNumber);
                } else {
                    console.warn(`DataParser: Invalid number constructed '${fullNumber}' from line '${line}' on date ${currentDateStr}. Skipped.`);
                }
            }
        } else {
            console.warn(`DataParser: Unrecognized data format on line '${line}' for date ${currentDateStr}. Skipped.`);
        }
    }
    
    for (const date in dataByDate) {
        if (dataByDate[date].length > 0 && dataByDate[date].length !== 27) {
            console.warn(`DataParser: Date ${date} has ${dataByDate[date].length} numbers, expected 27.`);
        }
    }
    
    const sortedDates = Object.keys(dataByDate).sort();
    const sortedData = {};
    for(const date of sortedDates) {
        sortedData[date] = dataByDate[date];
    }

    return sortedData;
};

/**
 * Organizes the parsed data into a chronological array of objects.
 * Each object will represent a day's data, including the date object and the numbers that landed.
 * This function also ensures numbers are consistently 2-digit strings (e.g., "05" not "5").
 *
 * @param {object} parsedData Data in the format { 'YYYY-MM-DD': ['NN', 'MM'] }.
 * @returns {Array<object>} An array of objects: [{ date: Date, numbers: string[] }].
 */
self.DataParser.organizeData = function(parsedData) {
    const organized = [];
    for (const dateStr in parsedData) {
        const dateObj = new Date(dateStr + 'T12:00:00');

        if (isNaN(dateObj.getTime())) {
            console.error(`DataParser: Invalid date string parsed: ${dateStr}. Skipping this entry.`);
            continue;
        }

        const numbers = parsedData[dateStr]
            .map(n => String(n).padStart(2, '0'))
            .filter(n => n.length === 2 && !isNaN(parseInt(n, 10)));

        organized.push({ date: dateObj, numbers: numbers });
    }

    organized.sort((a, b) => a.date.getTime() - b.date.getTime());

    return organized;
};
