// Payment Mode Enum for Shopto
const PaymentMode = {
    CASH: "CASH",
    CARD: "CARD",
    UPI: "UPI",
    ONLINE: "ONLINE",
    WALLET: "WALLET",

    // Get payment mode label for display
    getLabel(mode) {
        switch (mode) {
            case this.CASH: return "Cash";
            case this.CARD: return "Card";
            case this.UPI: return "UPI";
            case this.ONLINE: return "Online";
            case this.WALLET: return "Wallet";
            default: return mode;
        }
    },

    // Get payment mode icon class
    getIcon(mode) {
        switch (mode) {
            case this.CASH: return "ph ph-money";
            case this.CARD: return "ph ph-credit-card";
            case this.UPI: return "ph ph-qr-code";
            case this.ONLINE: return "ph ph-bank";
            case this.WALLET: return "ph ph-wallet";
            default: return "ph ph-currency-inr";
        }
    }
};

// Export the PaymentMode enum
window.PaymentMode = PaymentMode; 