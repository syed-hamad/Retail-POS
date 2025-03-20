// ProfileContext.js - Manages seller profile data and related functions
const ProfileContext = React.createContext();

// Custom hook to use the profile context
function useProfile() {
    const context = React.useContext(ProfileContext);
    if (!context) {
        throw new Error('useProfile must be used within a ProfileProvider');
    }
    return context;
}

// Make functions available globally
window.useProfile = useProfile;
window.ProfileProvider = ProfileProvider;

// Provider component
function ProfileProvider({ children }) {
    const [profile, setProfile] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [tables, setTables] = React.useState([]);
    const [billNo, setBillNo] = React.useState(0);
    const [roles, setRoles] = React.useState([]);

    // Fetch profile data on mount
    React.useEffect(() => {
        fetchProfile();

        // Set up listener for profile changes
        const unsubscribe = listenToProfileChanges();
        return () => unsubscribe();
    }, []);

    // Fetch profile data
    const fetchProfile = async () => {
        try {
            setLoading(true);

            // Check if we already have profile data in UserSession
            if (UserSession.seller) {
                setProfile(UserSession.seller);
                setTables(UserSession.seller.tables || []);

                if (UserSession.seller.roles) {
                    setRoles(UserSession.seller.roles.map(role => Role.fromJson(role)));
                }

                fetchBillNo();
                setLoading(false);
                return;
            }

            // Otherwise fetch from SDK
            const profileDoc = await window.sdk.profile.get();

            if (!profileDoc.exists) {
                setError('Profile not found');
                setLoading(false);
                return;
            }

            const profileData = new ProfileInfo({
                id: profileDoc.id,
                ...profileDoc.data()
            });

            // Store seller ID in localStorage (equivalent to _setSession in Flutter)
            localStorage.setItem('SELLER_ID', profileData.id);

            // Set profile data
            setProfile(profileData);

            // Set tables
            setTables(profileData.tables || []);

            // Set roles
            if (profileData.roles) {
                setRoles(profileData.roles.map(role => Role.fromJson(role)));
            }

            // Update UserSession
            UserSession.seller = profileData;

            // Fetch bill number
            fetchBillNo();

            setLoading(false);
        } catch (err) {
            console.error('Error fetching profile:', err);
            setError('Failed to load profile');
            setLoading(false);
        }
    };

    // Listen to profile changes
    const listenToProfileChanges = () => {
        if (!profile?.id) return () => { };

        return window.sdk.collection('Sellers').doc(profile.id)
            .onSnapshot(
                (doc) => {
                    if (doc.exists) {
                        const updatedData = new ProfileInfo({
                            id: doc.id,
                            ...doc.data()
                        });

                        setProfile(updatedData);
                        setTables(updatedData.tables || []);

                        // Update roles
                        if (updatedData.roles) {
                            setRoles(updatedData.roles.map(role => Role.fromJson(role)));
                        }

                        // Update UserSession
                        UserSession.seller = updatedData;
                    }
                },
                (err) => {
                    console.error('Error listening to profile changes:', err);
                }
            );
    };

    // Fetch bill number
    const fetchBillNo = async (forceRenew = false) => {
        if (!forceRenew && localStorage.getItem('BILL_NO')) {
            setBillNo(parseInt(localStorage.getItem('BILL_NO')));
            return;
        }

        try {
            let newBillNo = 0;

            // Get the current seller document
            const sellerRef = window.sdk.collection('Sellers').doc(profile.id);
            const sellerDoc = await sellerRef.get();

            if (!sellerDoc.exists) return;

            const sellerData = sellerDoc.data();
            const lastBillDate = sellerData.lastBillDate?.toDate ?
                sellerData.lastBillDate.toDate() :
                new Date(sellerData.lastBillDate || 0);
            const now = new Date();

            // Check if last bill date is today
            if (lastBillDate && lastBillDate.getDate() === now.getDate() &&
                lastBillDate.getMonth() === now.getMonth() &&
                lastBillDate.getFullYear() === now.getFullYear()) {
                newBillNo = (sellerData.currentBillNo || 0);
            }

            // Increment bill number
            newBillNo++;

            // Update seller doc
            await sellerRef.update({
                currentBillNo: newBillNo,
                lastBillDate: now
            });

            // Update local storage
            localStorage.setItem('BILL_NO', newBillNo.toString());
            setBillNo(newBillNo);

            console.log(`Generated new bill no: ${newBillNo}`);
        } catch (err) {
            console.error('Error fetching bill number:', err);
            // If there's an error, use a fallback approach
            const fallbackBillNo = Math.floor(Date.now() / 1000) % 10000; // Use timestamp as fallback
            localStorage.setItem('BILL_NO', fallbackBillNo.toString());
            setBillNo(fallbackBillNo);
            console.log(`Using fallback bill no: ${fallbackBillNo}`);
        }
    };

    // Get bill number
    const getBillNo = () => {
        fetchBillNo(true); // Fetch a bill number for later use

        const storedBillNo = localStorage.getItem('BILL_NO');
        return storedBillNo ? parseInt(storedBillNo) : 0;
    };

    // Get store link
    const getStoreLink = () => {
        if (profile?.domains?.length > 0) {
            return `https://${profile.domains[0]}`;
        }
        return `https://${profile?.username || 'store'}.shopto.store`;
    };

    // Download QR code
    const downloadQr = (tableId) => {
        const url = tableId ?
            `${getStoreLink()}/getQR?id=${tableId}` :
            `${getStoreLink()}/getQR`;

        window.open(url, '_blank');

        // Track analytics
        console.log('Analytics: DOWNLOAD_QR');
    };

    // Check permissions
    const checkPermission = (module, action, silent = true) => {
        // Get current user email
        // Since auth is handled by the host platform, we can't use window.sdk.auth()
        // Instead, we'll use a different approach or assume the user has permission
        const currentEmail = localStorage.getItem('CURRENT_USER_EMAIL') || '';

        // SuperAdmin or admin can do anything
        if (isSuperAdmin() || isAdmin()) return true;

        if (!currentEmail) {
            console.log("checkPermission failed: currentEmail is null or empty");

            if (!silent) {
                showToast("You are not authorized!");
                // In React, we'd use navigation or history to go back
                // For now, just log it
                console.log("User not authorized, should go back");
            }
            return false;
        }

        // Find role for current user
        const role = roles.find(role => role.email === currentEmail);

        if (!role?.permissions) {
            console.log("checkPermission failed: No permissions found for role");

            if (!silent) {
                showToast("You are not authorized!");
                console.log("User not authorized, should go back");
            }
            return false;
        }

        // Check if user has the required permission
        const hasPermission = role.hasPermission(module, action);

        console.log(`checkPermission: User '${currentEmail}' has permission '${module}:${action}' -> ${hasPermission}`);

        if (!hasPermission && !silent) {
            showToast(`You don't have ${action} permission for ${module}`);
            console.log("User not authorized, should go back");
        }

        return hasPermission;
    };

    // Check if user is super admin
    const isSuperAdmin = () => {
        // Since auth is handled by the host platform, we can't use window.sdk.auth()
        // Instead, we'll use a different approach or assume the user has permission
        const currentEmail = localStorage.getItem('CURRENT_USER_EMAIL') || '';

        // Check if user is in super admin list (you'd need to define this)
        const isSuperAdminEmail = ['admin@shopto.app'].includes(currentEmail);

        return isSuperAdminEmail || (profile?.email === currentEmail);
    };

    // Check if user is admin
    const isAdmin = () => {
        // Since auth is handled by the host platform, we can't use window.sdk.auth()
        // Instead, we'll use a different approach or assume the user has permission
        const currentEmail = localStorage.getItem('CURRENT_USER_EMAIL') || '';
        return profile?.email === currentEmail;
    };

    // Send notification
    const sendNotification = async (title, msg, { img, fcmToken } = {}) => {
        try {
            await window.sdk.collection('Sellers')
                .doc(profile.id)
                .collection('notification')
                .add({
                    title,
                    msg,
                    img,
                    tokens: fcmToken ? [fcmToken] : [],
                    date: new Date()
                });

            return true;
        } catch (err) {
            console.error('Error sending notification:', err);
            return false;
        }
    };

    // Remove table
    const removeTable = async (tableId) => {
        if (!tables.some(t => t.title === tableId)) return false;

        try {
            const updatedTables = tables.filter(t => t.title !== tableId);

            await window.sdk.collection('Sellers')
                .doc(profile.id)
                .update({ tables: updatedTables });

            setTables(updatedTables);

            // Track analytics
            console.log('Analytics: REMOVE_TABLE');

            return true;
        } catch (err) {
            console.error('Error removing table:', err);
            return false;
        }
    };

    // Calculate account age
    const accountAge = () => {
        const now = new Date();
        const created = profile?.date?.toDate ?
            profile.date.toDate() :
            new Date(profile?.date || now);

        return now - created; // Returns milliseconds
    };

    // Value to be provided by the context
    const value = {
        profile,
        loading,
        error,
        tables,
        billNo,
        roles,
        fetchProfile,
        getBillNo,
        getStoreLink,
        downloadQr,
        checkPermission,
        isSuperAdmin,
        isAdmin,
        sendNotification,
        removeTable,
        accountAge,
        // Getters
        get username() { return profile?.username; },
        get email() { return profile?.email; },
        get phone() { return profile?.phone; },
        get businessName() { return profile?.businessName; },
        get address() { return profile?.address; },
        get avatar() { return profile?.avatar; },
        get gstIN() { return profile?.gstNo; },
        get upiId() { return profile?.upiId; },
        get isOnboarded() { return profile?.onboarded || false; },
        get gstEnabled() { return profile?.gstNo && profile.gstNo.length > 0; },
        get upiEnabled() { return profile?.upiId && profile.upiId.length > 0; },
        get kotEnabled() { return profile?.kotEnabled !== false; },
        get priceVariants() { return profile?.priceVariants || []; },
        get access() { return profile?.access || [profile?.email].filter(Boolean); },
        get paymentInfo() { return profile?.paymentInfo; },
        get printTemplate() { return profile?.printTemplate; }
    };

    return (
        <ProfileContext.Provider value={value}>
            {children}
        </ProfileContext.Provider>
    );
} 