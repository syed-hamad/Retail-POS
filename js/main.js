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
if (window.BluetoothPrinting && typeof window.BluetoothPrinting.initialize === 'function') {
    // Wait a short time to ensure everything is loaded
    setTimeout(() => {
        try {
            window.BluetoothPrinting.initialize();
            console.log('BluetoothPrinting service initialized');
        } catch (err) {
            console.error('Error initializing BluetoothPrinting service:', err);
        }
    }, 2000);
} 