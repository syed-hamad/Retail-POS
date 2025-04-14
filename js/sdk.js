// Initialize SDK with required permissions
const permissions = [
    {
        id: "products_view",
        name: "View Products",
        description: "View products in the inventory"
    },
    {
        id: "products_edit",
        name: "Edit Products",
        description: "Add, edit, or delete products"
    },
    {
        id: "orders_view",
        name: "View Orders",
        description: "View and manage orders"
    },
    {
        id: "orders_edit",
        name: "Edit Orders",
        description: "Create, edit, or delete orders"
    },
    {
        id: "customers_view",
        name: "View Customers",
        description: "View customer information"
    },
    {
        id: "customers_edit",
        name: "Edit Customers",
        description: "Add, edit, or delete customers"
    },
    {
        id: "profile_edit",
        name: "Edit Profile",
        description: "Edit store profile settings"
    },
    {
        id: "analytics_view",
        name: "View Analytics",
        description: "View sales analytics and reports"
    }
];

// Create SDK instance with permission schema
const sdk = new window.ShoptoSDK(permissions);

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

// Export the SDK and showToast utility
window.sdk = sdk;
window.showToast = showToast;

// Log analytics event for app initialization
if (sdk.analytics) {
    sdk.analytics.logEvent('app_initialized', {
        timestamp: new Date().toISOString()
    });
} 