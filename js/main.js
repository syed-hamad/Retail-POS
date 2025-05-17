// Main JS App Entry Point

// Render the main App component
ReactDOM.createRoot(document.getElementById('root')).render(
    <ProfileProvider>
        <OrderProvider>
            <App />
        </OrderProvider>
    </ProfileProvider>
);

// Initialize UserSession after the app is rendered
if (window.UserSession) {
    window.UserSession.init().catch(err => console.error("Error initializing UserSession from main.js:", err));
}

// Initialize BluetoothPrinting service if available
function initializeBluetoothPrinting(retryCount = 0) {
    console.log(`Attempting to initialize BluetoothPrinting (attempt ${retryCount + 1})`);

    if (window.BluetoothPrinting && typeof window.BluetoothPrinting.initialize === 'function') {
        try {
            window.BluetoothPrinting.initialize();
            console.log('BluetoothPrinting service initialized successfully');
            // Force a global flag that we can check
            window._bluetoothPrintingInitialized = true;
        } catch (err) {
            console.error('Error initializing BluetoothPrinting service:', err);
        }
    } else {
        console.warn('BluetoothPrinting not available yet');
        if (retryCount < 5) {
            // Retry with exponential backoff
            const delay = Math.pow(2, retryCount) * 500;
            console.log(`Will retry in ${delay}ms...`);
            setTimeout(() => initializeBluetoothPrinting(retryCount + 1), delay);
        } else {
            console.error('Failed to initialize BluetoothPrinting after multiple attempts');
        }
    }
}

// Start initialization after a short delay
setTimeout(initializeBluetoothPrinting, 1000); 