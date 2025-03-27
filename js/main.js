// Main JS App Entry Point

// Load utility scripts
// Dynamically load Bluetooth Printing utility
const loadBluetoothPrintingUtil = () => {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'js/utils/BluetoothPrinting.js';
        script.onload = () => resolve();
        script.onerror = (error) => reject(new Error(`Failed to load Bluetooth Printing utility: ${error}`));
        document.head.appendChild(script);
    });
};

// Load utilities before rendering the app
loadBluetoothPrintingUtil()
    .catch(err => console.warn('Bluetooth printing service not loaded:', err))
    .finally(() => {
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
    }); 