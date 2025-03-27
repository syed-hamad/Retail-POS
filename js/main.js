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