// UserSession utility for managing user session and profile data
class UserSession {
    static session = null; // Equivalent to SharedPreferences in Dart
    static seller = null; // ProfileInfo object
    static initialized = false;
    static permissions = null; // Cache for user permissions

    // Initialize the session
    static async init() {
        // Check if SDK is available
        if (typeof window.sdk === 'undefined') {
            console.warn("SDK not available yet, UserSession initialization delayed");
            // Wait for the page to fully load before trying again
            window.addEventListener('load', () => {
                setTimeout(() => UserSession.init(), 100);
            });
            return;
        }

        // Prevent multiple initializations
        if (UserSession.initialized) return;
        UserSession.initialized = true;

        console.log("Initializing UserSession...");

        // Load session data from localStorage
        UserSession.session = localStorage;

        try {
            // Fetch user data if we have a seller ID
            await UserSession.fetchUser();

            // Fetch IP info for country/currency
            await UserSession.fetchIP();

            // Initialize permissions
            await UserSession.initPermissions();

            console.log("UserSession initialized successfully");
        } catch (err) {
            console.error("Error during UserSession initialization:", err);
        }
    }

    // Initialize user permissions
    static async initPermissions() {
        try {
            if (window.sdk?.permissions) {
                // Get all permissions for the current user
                UserSession.permissions = await window.sdk.permissions.getUserPermissions();
                console.log("User permissions loaded:", UserSession.permissions);
            }
        } catch (err) {
            console.error("Error loading user permissions:", err);
            UserSession.permissions = [];
        }
    }

    // Check if the user has a specific permission
    static async hasPermission(permissionId) {
        try {
            // If we haven't cached permissions yet, get them now
            if (!UserSession.permissions) {
                await UserSession.initPermissions();
            }

            // Check if it's in our cached permissions
            if (UserSession.permissions && UserSession.permissions.includes(permissionId)) {
                return true;
            }

            // If not in cache or we're not sure, check directly with SDK
            if (window.sdk?.permissions) {
                return await window.sdk.permissions.hasPermission(permissionId);
            }

            return false;
        } catch (err) {
            console.error(`Error checking permission '${permissionId}':`, err);
            return false;
        }
    }

    // Map module/action format to permission ID format
    static getPermissionId(module, action) {
        return `${module.toLowerCase()}_${action.toLowerCase()}`;
    }

    // Check permission by module and action
    static async checkPermission(module, action, silent = true) {
        const permissionId = UserSession.getPermissionId(module, action);
        const hasPermission = await UserSession.hasPermission(permissionId);

        if (!hasPermission && !silent && window.showToast) {
            window.showToast(`You don't have permission for this action`);
        }

        return hasPermission;
    }

    // Fetch user profile data
    static async fetchUser() {
        try {
            const sid = UserSession.session.getItem("SELLER_ID");
            if (!sid) {
                console.log("No seller ID found in session");
                return;
            }

            console.log(`Fetching user profile for seller ID: ${sid}`);

            // Fetch seller profile from Firestore
            const doc = await window.sdk.db.collection('Sellers').doc(sid).get();
            if (doc.exists) {
                // We need to wait until ProfileInfo is defined
                if (typeof window.ProfileInfo === 'undefined') {
                    console.warn("ProfileInfo not available yet, using raw data");
                    UserSession.seller = {
                        id: doc.id,
                        ...doc.data()
                    };
                } else {
                    UserSession.seller = window.ProfileInfo.fromDoc(doc);
                }
                console.log("User profile fetched successfully");
            } else {
                console.log("No seller document found for ID:", sid);
            }
        } catch (err) {
            console.error("Error fetching user:", err);
        }
    }

    // Fetch IP information for country and currency
    static async fetchIP() {
        // Skip if we already have country and currency
        if (UserSession.session.getItem("COUNTRY") &&
            UserSession.session.getItem("CURRENCY")) {
            return;
        }

        try {
            const response = await fetch("https://ip-api.io/json/");
            const locationData = await response.json();

            UserSession.session.setItem("COUNTRY", locationData.country_code || "IN");
            UserSession.session.setItem("CURRENCY", locationData.currencySymbol || "₹");
        } catch (err) {
            console.error("Unable to fetch country:", err);
            // Set defaults if fetch fails
            UserSession.session.setItem("COUNTRY", "IN");
            UserSession.session.setItem("CURRENCY", "₹");
        }
    }

    // Get country code
    static getCountry() {
        return UserSession.session?.getItem("COUNTRY") || "IN";
    }

    // Check if user is in India
    static inIndia() {
        return UserSession.getCountry() === "IN";
    }

    // Get currency symbol
    static getCurrency() {
        const currency = UserSession.session?.getItem("CURRENCY");
        return currency || "₹";
    }

    // Run a function only once (based on a flag in session)
    static runOnce(check) {
        if (UserSession.session.getItem(check) === null) {
            UserSession.session.setItem(check, "true");
            return true;
        }
        return false;
    }

    // Run after a certain count
    static runAfter(check, count) {
        let c = parseInt(UserSession.session.getItem(check) || "0");

        if (c < count) {
            UserSession.session.setItem(check, (c + 1).toString());
            return false;
        }

        return true;
    }

    // Run every nth time
    static runEvery(check, count) {
        let c = parseInt(UserSession.session.getItem(check) || "0");

        if (c < count) {
            UserSession.session.setItem(check, (c + 1).toString());
            return false;
        }

        UserSession.session.setItem(check, "1");
        return true;
    }

    // Check if seller is logged in
    static isSellerLoggedIn() {
        return UserSession.seller?.id != null;
    }
}

// Make UserSession available globally
window.UserSession = UserSession;

// Initialize UserSession when the script loads, but with a slight delay to ensure SDK is loaded
setTimeout(() => {
    UserSession.init().catch(err => console.error("Error initializing UserSession:", err));
}, 100); 