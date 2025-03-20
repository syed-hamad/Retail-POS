// ProfileInfo model for seller profile data
class ProfileInfo {
    constructor(data = {}) {
        // Basic profile information
        this.id = data.id || '';
        this.businessName = data.businessName || '';
        this.username = data.username || '';
        this.email = data.email || '';
        this.phone = data.phone || '';
        this.address = data.address || '';
        this.avatar = data.avatar || '';
        this.date = data.date ? new Date(data.date) : new Date();

        // Business details
        this.gstNo = data.gstNo || '';
        this.upiId = data.upiId || '';
        this.kotEnabled = data.kotEnabled !== false; // Default to true
        this.onboarded = data.onboarded || false;

        // Access and permissions
        this.access = data.access || [];
        this.roles = data.roles || [];

        // Store configuration
        this.tables = data.tables || [];
        this.priceVariants = data.priceVariants || [];
        this.domains = data.domains || [];
        this.paymentInfo = data.paymentInfo || {};
        this.printTemplate = data.printTemplate || {};

        // Stats and metrics
        this.currentBillNo = data.currentBillNo || 0;
        this.lastBillDate = data.lastBillDate ? new Date(data.lastBillDate) : null;
    }

    // Create a ProfileInfo from Firestore document
    static fromDoc(doc) {
        if (!doc || !doc.exists) return null;

        const data = doc.data();
        return new ProfileInfo({
            id: doc.id,
            ...data,
            date: data.date ? data.date.toDate ? data.date.toDate() : new Date(data.date) : new Date(),
            lastBillDate: data.lastBillDate ? data.lastBillDate.toDate ? data.lastBillDate.toDate() : new Date(data.lastBillDate) : null
        });
    }

    // Convert ProfileInfo to JSON
    toJson() {
        return {
            id: this.id,
            businessName: this.businessName,
            username: this.username,
            email: this.email,
            phone: this.phone,
            address: this.address,
            avatar: this.avatar,
            date: this.date,
            gstNo: this.gstNo,
            upiId: this.upiId,
            kotEnabled: this.kotEnabled,
            onboarded: this.onboarded,
            access: this.access,
            roles: this.roles,
            tables: this.tables,
            priceVariants: this.priceVariants,
            domains: this.domains,
            paymentInfo: this.paymentInfo,
            printTemplate: this.printTemplate,
            currentBillNo: this.currentBillNo,
            lastBillDate: this.lastBillDate
        };
    }

    // Check if GST is enabled
    get gstEnabled() {
        return this.gstNo && this.gstNo.length > 0;
    }

    // Check if UPI is enabled
    get upiEnabled() {
        return this.upiId && this.upiId.length > 0;
    }

    // Get store link
    getStoreLink() {
        if (this.domains && this.domains.length > 0) {
            return `https://${this.domains[0]}`;
        }
        return `https://${this.username || 'store'}.shopto.store`;
    }

    // Check if user has permission
    hasPermission(module, action) {
        // Find role for current user
        // Since auth is handled by the host platform, we can't use window.sdk.auth()
        // Instead, we'll use a different approach or assume the user has permission
        
        // For now, we'll assume the user has permission
        // In a real implementation, you might get the current user from a different source
        const currentEmail = localStorage.getItem('CURRENT_USER_EMAIL') || '';
        
        // Check if user is admin (has full access)
        if (this.email === currentEmail) return true;

        // Find role for current user
        const role = this.roles.find(role => role.email === currentEmail);
        if (!role?.permissions) return false;

        // Check if user has the required permission
        return role.permissions.some(p =>
            p.module === module && p.actions.includes(action)
        );
    }
}

// Make ProfileInfo available globally
window.ProfileInfo = ProfileInfo; 