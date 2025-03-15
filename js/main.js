// Render the main App component
ReactDOM.createRoot(document.getElementById('root')).render(
    <ProfileProvider>
        <App />
    </ProfileProvider>
);

// Initialize UserSession after the app is rendered
if (window.UserSession) {
    window.UserSession.init().catch(err => console.error("Error initializing UserSession from main.js:", err));
} 