// script.js
// Main client-side script for interacting with the UI and Web Worker.

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const dataInput = document.getElementById('dataInput');
    const processDataBtn = document.getElementById('processDataBtn');
    const loadingAnimation = document.getElementById('loadingAnimation');
    const predictionResultDiv = document.getElementById('predictionResult');

    // --- Backtest Stats Elements ---
    const summaryTotalDays = document.getElementById('summaryTotalDays');
    const summaryStrategyCount = document.getElementById('summaryStrategyCount');
    const summaryProcessingTime = document.getElementById('summaryProcessingTime');

    const btTotalDays = document.getElementById('btTotalDays');
    const btAvgHit = document.getElementById('btAvgHit');
    const btHighAccuracyDays = document.getElementById('btHighAccuracyDays');
    const btHighAccuracyRate = document.getElementById('btHighAccuracyRate');
    const btWinRate = document.getElementById('btWinRate');
    const btHistory = document.getElementById('btHistory');
    const strategyContributionList = document.getElementById('strategyContributionList');

    let worker = null; // Variable to hold the Web Worker instance
    let startTime = null; // To track processing time

    // --- Event Listener for the Process Button ---
    processDataBtn.addEventListener('click', () => {
        const rawData = dataInput.value.trim();
        if (!rawData) {
            alert('Vui lòng dán dữ liệu lịch sử XSMB vào ô nhập liệu để bắt đầu phân tích!');
            return;
        }

        // --- UI Updates: Show Loading, Disable Button, Clear Previous Results ---
        loadingAnimation.style.display = 'block';
        processDataBtn.disabled = true;
        predictionResultDiv.innerHTML = '';
        resetAllStatsDisplay(); // Clear all previous stats
        startTime = performance.now(); // Start timer

        // --- Web Worker Initialization and Communication ---
        // Terminate existing worker if any, to ensure a fresh start
        if (worker) {
            worker.terminate();
            worker = null; // Clear reference
        }
        
        // Create a new Web Worker instance
        worker = new Worker('worker.js');

        // Listen for messages from the Web Worker
        worker.onmessage = (event) => {
            const { type, payload } = event.data;

            // Stop timer and update UI: Hide Loading, Enable Button
            const endTime = performance.now();
            const processingTimeMs = endTime - startTime;
            loadingAnimation.style.display = 'none';
            processDataBtn.disabled = false;
            summaryProcessingTime.textContent = `${(processingTimeMs / 1000).toFixed(2)} giây`;

            if (type === 'predictionResult') {
                const { predictedNumbers, accuracyStats, analysisSummary } = payload;
                
                // Display Predicted Numbers
                if (predictedNumbers && predictedNumbers.length > 0) {
                    let numbersHtml = 'Dự đoán: ';
                    predictedNumbers.forEach(num => {
                        numbersHtml += `<span>${num}</span>`;
                    });
                    predictionResultDiv.innerHTML = numbersHtml;
                } else {
                    predictionResultDiv.innerHTML = 'Không thể đưa ra dự đoán chi tiết với dữ liệu hiện có. Vui lòng kiểm tra lại dữ liệu nhập vào.';
                }

                // Display Analysis Summary
                summaryTotalDays.textContent = analysisSummary.totalHistoryDays || 'N/A';
                summaryStrategyCount.textContent = analysisSummary.activeStrategyCount || 'N/A';

                // Display Backtest Statistics
                if (accuracyStats) {
                    btTotalDays.textContent = accuracyStats.totalDays || 0;
                    btAvgHit.textContent = (accuracyStats.avgCorrectNumbers || 0).toFixed(2);
                    btHighAccuracyDays.textContent = accuracyStats.daysWithHighAccuracy || 0;
                    btHighAccuracyRate.textContent = `${(accuracyStats.successRate || 0).toFixed(2)}%`;
                    
                    // Assuming break-even/profit when >= 5 numbers hit
                    const winRateThreshold = 5;
                    const daysWithWin = accuracyStats.correctNumbersHistory.filter(count => count >= winRateThreshold).length;
                    const winRate = accuracyStats.totalDays > 0 ? (daysWithWin / accuracyStats.totalDays) * 100 : 0;
                    btWinRate.textContent = `${winRate.toFixed(2)}% (ít nhất ${winRateThreshold} số trúng)`;

                    // Display backtest history (e.g., "7, 5, 10, 8, ...")
                    btHistory.textContent = accuracyStats.correctNumbersHistory.slice(-50).join(', ') + (accuracyStats.correctNumbersHistory.length > 50 ? ' ...' : '');

                    // Display Strategy Contribution (if provided by worker)
                    if (accuracyStats.strategyContributions && accuracyStats.strategyContributions.length > 0) {
                        strategyContributionList.innerHTML = ''; // Clear previous list
                        accuracyStats.strategyContributions.sort((a, b) => b.totalScore - a.totalScore).forEach(strategy => {
                            const li = document.createElement('li');
                            li.innerHTML = `<strong>${strategy.name}:</strong> <span>Điểm trung bình: ${(strategy.totalScore / strategy.runs).toFixed(2)}</span>`;
                            strategyContributionList.appendChild(li);
                        });
                    } else {
                        strategyContributionList.innerHTML = '<li>Không có dữ liệu đóng góp chiến lược.</li>';
                    }

                } else {
                    resetBacktestStats(); // Reset if no accuracy stats are returned
                }

            } else if (type === 'error') {
                predictionResultDiv.innerHTML = `<span style="color: red;">Lỗi: ${payload}</span>`;
                resetAllStatsDisplay();
            } else if (type === 'parsingError') {
                predictionResultDiv.innerHTML = `<span style="color: orange;">Lỗi phân tích dữ liệu: ${payload}. Vui lòng kiểm tra định dạng dữ liệu đầu vào.</span>`;
                resetAllStatsDisplay();
            }
        };

        // Handle errors that prevent the worker from starting or running
        worker.onerror = (error) => {
            console.error('Web Worker encountered an unhandled error:', error);
            loadingAnimation.style.display = 'none';
            processDataBtn.disabled = false;
            predictionResultDiv.innerHTML = `<span style="color: red;">Đã xảy ra lỗi nghiêm trọng trong quá trình tính toán. Vui lòng thử lại.</span>`;
            resetAllStatsDisplay();
        };

        // --- Send Data to Worker ---
        worker.postMessage({ type: 'processData', data: rawData });
    });

    // --- Helper Functions for UI Reset ---
    function resetAllStatsDisplay() {
        summaryTotalDays.textContent = 'N/A';
        summaryStrategyCount.textContent = 'N/A';
        summaryProcessingTime.textContent = 'N/A';
        resetBacktestStats();
    }

    function resetBacktestStats() {
        btTotalDays.textContent = 'N/A';
        btAvgHit.textContent = 'N/A';
        btHighAccuracyDays.textContent = 'N/A';
        btHighAccuracyRate.textContent = 'N/A';
        btWinRate.textContent = 'N/A';
        btHistory.textContent = 'N/A';
        strategyContributionList.innerHTML = '<li>Đang chờ dữ liệu...</li>';
    }
});
