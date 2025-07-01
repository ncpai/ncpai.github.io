// worker.js
// The main Web Worker script that orchestrates data processing and prediction.

// Import all necessary scripts for the worker scope.
// The order is important due to dependencies (e.g., DataAnalyzer needs WorkerUtils).
try {
    importScripts(
        'worker-utils.js',
        'data-parser.js',
        'data-preparer.js',
        'data-analyzer.js',

        // Prediction Strategies - these depend on DataAnalyzer and WorkerUtils
        'prediction-strategies/strategy-frequency.js',
        'prediction-strategies/strategy-gan-numbers.js',
        'prediction-strategies/strategy-lo-roi-lon.js',
        'prediction-strategies/strategy-kep-numbers.js',
        'prediction-strategies/strategy-day-of-week.js',
        'prediction-strategies/strategy-bridge-patterns.js',
        'prediction-strategies/strategy-paired-numbers.js',
        'prediction-strategies/strategy-totals-chams.js',
        'prediction-strategies/strategy-bong-tuong-sinh.js',
        'prediction-strategies/strategy-cycle-analysis.js',
        'prediction-strategies/strategy-statistical-anomalies.js',
        'prediction-strategies/strategy-zone-analysis.js',
        // Add more strategy files here as they are developed

        'prediction-engine.js', // Depends on all strategies and analyzer
        'backtester.js' // Depends on PredictionEngine and others
    );
    console.log("Worker: All necessary scripts loaded successfully.");
} catch (e) {
    console.error("Worker: Error loading scripts via importScripts(). Please check file paths and network.", e);
    // Post a fatal error message back to the main thread
    self.postMessage({ type: 'error', payload: `[FATAL] Error loading worker scripts: ${e.message}` });
    self.close(); // Terminate the worker if critical scripts can't load
}

/**
 * Event listener for messages from the main thread.
 * Handles different types of commands (e.g., 'processData', 'runBacktest').
 */
self.onmessage = async function(event) {
    const { type, payload } = event.data;
    console.log(`Worker: Received message of type "${type}".`);

    try {
        switch (type) {
            case 'processData':
                const rawData = payload.rawData;
                self.postMessage({ type: 'status', payload: 'Đang phân tích dữ liệu lịch sử...' });

                // 1. Parse raw text data
                const parsedData = self.DataParser.parseRawData(rawData);
                
                // 2. Organize and sort data chronologically
                let organizedData = self.DataParser.organizeData(parsedData);
                
                // 3. Prepare/enrich the historical data with derived properties
                const preparedData = self.DataPreparer.prepareHistoricalData(organizedData);

                if (preparedData.length === 0) {
                     self.postMessage({ type: 'error', payload: 'Không tìm thấy dữ liệu hợp lệ trong tập tin đã cung cấp. Vui lòng kiểm tra định dạng.' });
                     return;
                }

                // Make the prepared data globally available in the worker context if needed, or pass it.
                // For now, we'll just pass it through.

                self.postMessage({ type: 'status', payload: `Đã chuẩn bị ${preparedData.length} ngày dữ liệu.` });
                
                // 4. Run the prediction engine
                self.postMessage({ type: 'status', payload: 'Đang tạo dự đoán...' });
                const predictedNumbers = self.PredictionEngine.predictNextDay(preparedData);
                
                self.postMessage({
                    type: 'predictionResult',
                    payload: {
                        predictedNumbers: predictedNumbers,
                        historyLength: preparedData.length,
                        activeStrategies: self.PredictionEngine.getActivatedStrategyCount()
                    }
                });
                break;

            case 'runBacktest':
                const backtestRawData = payload.rawData;
                self.postMessage({ type: 'status', payload: 'Đang chạy Backtest trên dữ liệu lịch sử...' });

                const backtestParsed = self.DataParser.parseRawData(backtestRawData);
                let backtestOrganized = self.DataParser.organizeData(backtestParsed);
                const backtestPrepared = self.DataPreparer.prepareHistoricalData(backtestOrganized);

                if (backtestPrepared.length === 0) {
                    self.postMessage({ type: 'error', payload: 'Không có đủ dữ liệu lịch sử để chạy Backtest. Vui lòng cung cấp thêm.' });
                    return;
                }

                const backtestResults = self.Backtester.runBacktest(backtestPrepared);

                self.postMessage({
                    type: 'backtestResult',
                    payload: backtestResults
                });
                break;

            default:
                console.warn(`Worker: Unknown message type received: ${type}`);
                self.postMessage({ type: 'error', payload: `Lệnh không xác định: ${type}` });
        }
    } catch (error) {
        console.error("Worker: Error during message processing:", error);
        self.postMessage({ type: 'error', payload: `Lỗi xử lý dữ liệu: ${error.message}` });
    }
};

console.log("Worker: Script loaded and ready for messages.");
