// Initialize SDK
const sdk = window.shoptoTools.initialize({
    userId: 'AtBtXdOK6p1KwswKhEA6'
});

// Helper function to show toast messages
function showToast(message, type = 'success') {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg z-50 ${type === 'success' ? 'bg-green-500' : 'bg-red-500'
        } text-white`;
    toast.textContent = message;

    // Add to document
    document.body.appendChild(toast);

    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.add('opacity-0', 'transition-opacity', 'duration-500');
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 500);
    }, 3000);
} 