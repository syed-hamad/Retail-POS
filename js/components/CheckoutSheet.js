// CheckoutSheet component for handling order checkout
function CheckoutSheet({ cart, clearCallback, tableId, checkout, orderId, priceVariant, onClose }) {
    const [discount, setDiscount] = React.useState(0);
    const [instructions, setInstructions] = React.useState('');
    const [showDiscountModal, setShowDiscountModal] = React.useState(false);
    const [percentMode, setPercentMode] = React.useState(false);
    const [discountInput, setDiscountInput] = React.useState('');

    // Calculate cart totals
    const cartSubTotal = React.useMemo(() => {
        if (!cart) return 0;
        return Object.values(cart).reduce((total, item) => total + (item.product.price * item.quantity), 0);
    }, [cart]);

    // Calculate charges (taxes, etc.) - Moving this before cartTotal to fix the reference order
    const charges = React.useMemo(() => {
        const finalCharges = [];

        if (!cart) return finalCharges;

        Object.values(cart).forEach(item => {
            const price = item.product.price;
            const qty = item.quantity;
            const total = price * qty;

            // Add product-specific charges - using optional chaining to prevent errors
            const productCharges = item.product.charges || [];
            productCharges.forEach(charge => {
                let amount = 0;
                let percentage = 0;

                if (charge.value && charge.value.includes('%')) {
                    // Percentage charge
                    const value = charge.value.replace('%', '').trim();
                    if (value) {
                        percentage = parseFloat(value);
                    }

                    if (charge.inclusive) {
                        amount = (total * percentage) / (100 + percentage);
                    } else {
                        amount = (total * percentage) / 100;
                    }

                    charge.name = `${charge.name.trim()} (${percentage}%)`;
                } else {
                    // Fixed amount charge
                    if (charge.value) {
                        amount = parseFloat(charge.value);
                    }
                }

                if (amount === 0) return;

                const existingCharge = finalCharges.find(c => c.name === charge.name);
                if (existingCharge) {
                    existingCharge.value = (parseFloat(existingCharge.value) + amount).toFixed(2);
                } else {
                    finalCharges.push({
                        ...charge,
                        value: amount.toFixed(2)
                    });
                }
            });
        });

        return finalCharges;
    }, [cart]);

    const cartTotal = React.useMemo(() => {
        let total = cartSubTotal - discount;

        // Add exclusive charges - with null check
        if (charges && charges.length > 0) {
            charges.forEach(charge => {
                if (!charge.inclusive && charge.value) {
                    total += parseFloat(charge.value);
                }
            });
        }

        return total;
    }, [cartSubTotal, discount, charges]);

    // Format date properly
    const formatDate = (dateStr) => {
        if (!dateStr) return "Just now";

        try {
            const date = new Date(dateStr);
            // Check if date is valid
            if (isNaN(date.getTime())) return "Just now";

            // Format the date
            return date.toLocaleString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        } catch (error) {
            console.error("Error formatting date:", error);
            return "Just now";
        }
    };

    // Handle checkout
    const handleCheckout = async () => {
        if (Object.keys(cart).length === 0) return;

        try {
            const orderRef = window.sdk.collection("Orders").doc(orderId);
            const items = Object.values(cart).map(cartItem =>
                window.Item.fromProduct(cartItem.product, cartItem.quantity)
            );

            const order = window.MOrder.fromItems(
                orderRef.id,
                items,
                discount,
                priceVariant,
                tableId,
                instructions.trim(),
                charges
            );

            if (!orderId) {
                await orderRef.set(order.data);
            } else {
                await orderRef.update({
                    items: window.sdk.FieldValue.arrayUnion(order.items.map(e => e.data)),
                    discount: window.sdk.FieldValue.increment(order.discount),
                    instructions: order.instructions
                });
            }

            // Clear cart and close
            clearCallback();
            onClose?.();

            showToast(checkout ? "Order completed!" : "Order placed successfully!");
        } catch (error) {
            console.error("Checkout error:", error);
            showToast("Failed to process order", "error");
        }
    };

    // Handle discount application
    const applyDiscount = (amount) => {
        if (amount > cartSubTotal) {
            showToast("Discount cannot be greater than total amount", "error");
            setDiscount(0);
        } else {
            setDiscount(amount);
        }
        setShowDiscountModal(false);
    };

    if (Object.keys(cart).length === 0) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => onClose?.()}>
            <div className="bg-white rounded-xl shadow-lg w-full max-w-md md:max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b relative">
                    <div className="flex items-center">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                            <i className="ph ph-storefront text-blue-600"></i>
                        </div>
                        <h2 className="text-xl font-semibold">Checkout</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowDiscountModal(true)}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <i className="ph ph-tag text-gray-600"></i>
                        </button>
                        <button
                            onClick={() => onClose?.()}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                            aria-label="Close"
                        >
                            <i className="ph ph-x text-gray-600"></i>
                        </button>
                    </div>
                </div>

                {/* Progress info */}
                <div className="bg-gray-50 px-4 py-2 border-b flex justify-between items-center">
                    <div className="text-sm text-gray-600">
                        {Object.values(cart).reduce((total, item) => total + item.quantity, 0)} items
                    </div>
                    <div className="text-sm text-gray-600">
                        Date: {formatDate(new Date())}
                    </div>
                </div>

                {/* Single scrollable content area */}
                <div className="overflow-y-auto" style={{ maxHeight: "calc(80vh - 200px)" }}>
                    {/* Items list */}
                    <div className="p-4">
                        {Object.values(cart).map((item, index) => (
                            <div key={index} className="flex items-center justify-between py-3 border-b last:border-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-gray-100 rounded overflow-hidden">
                                        {item.product.imgs && item.product.imgs.length > 0 ? (
                                            <img
                                                src={item.product.imgs[0]}
                                                alt={item.product.title}
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    e.target.onerror = null;
                                                    e.target.src = 'https://via.placeholder.com/48';
                                                }}
                                            />
                                        ) : (
                                            <i className="ph ph-image flex items-center justify-center h-full text-gray-400 text-xl" />
                                        )}
                                    </div>
                                    <div>
                                        <div className="font-medium">{item.product.title}</div>
                                        <div className="text-sm text-gray-600">
                                            Qty: <span className="font-medium">{item.quantity}</span> × ₹{item.product.price}
                                        </div>
                                    </div>
                                </div>
                                <div className="font-medium">
                                    ₹{(item.quantity * item.product.price).toFixed(2)}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Instructions */}
                    <div className="px-4 mb-4">
                        <textarea
                            value={instructions}
                            onChange={(e) => setInstructions(e.target.value)}
                            placeholder="Add any special instructions here"
                            className="w-full p-3 border rounded-lg resize-none text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            rows="2"
                            maxLength={300}
                        />
                    </div>
                </div>

                {/* Order summary */}
                <div className="bg-white border-t p-4">
                    <div className="space-y-2 mb-4">
                        <div className="flex justify-between">
                            <span className="text-gray-600">Sub Total</span>
                            <span>₹{cartSubTotal.toFixed(2)}</span>
                        </div>

                        {/* Charges */}
                        {charges && charges.length > 0 && (
                            <div className="flex justify-between text-gray-600">
                                <span>Tax & Charges</span>
                                <div className="text-right">
                                    {charges.map((charge, index) => (
                                        <div key={index}>
                                            ₹{charge.value}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {discount > 0 && (
                            <div className="flex justify-between text-green-600">
                                <span>Discount</span>
                                <span>- ₹{discount.toFixed(2)}</span>
                            </div>
                        )}

                        <div className="flex justify-between font-bold text-lg pt-2 border-t mt-2">
                            <span>Total:</span>
                            <span className="text-primary">₹{cartTotal.toFixed(2)}</span>
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-3 mt-4">
                        {!checkout ? (
                            <button
                                onClick={handleCheckout}
                                className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium flex items-center justify-center hover:bg-blue-700 transition-colors"
                            >
                                <span>Place Order</span>
                                <i className="ph ph-arrow-right ml-2" />
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={() => {
                                        try {
                                            // Print KOT
                                            if (window.UserSession?.seller?.kotEnabled) {
                                                window.sdk.kot.print(orderId);
                                            }
                                            showToast("KOT Printed");
                                        } catch (error) {
                                            console.error("Error printing KOT:", error);
                                            showToast("Failed to print KOT", "error");
                                        }
                                    }}
                                    className="px-5 py-3 border border-blue-600 text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors"
                                >
                                    Print KOT
                                </button>
                                <button
                                    onClick={handleCheckout}
                                    className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                                >
                                    Checkout
                                </button>
                            </>
                        )}
                    </div>

                    {checkout && (
                        <div className="flex gap-3 mt-3">
                            <button
                                onClick={handleCheckout}
                                className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium flex items-center justify-center hover:bg-blue-700 transition-colors"
                            >
                                <i className="ph ph-credit-card mr-2" />
                                <span>UPI/Card</span>
                            </button>
                            <button
                                onClick={handleCheckout}
                                className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium flex items-center justify-center hover:bg-blue-700 transition-colors"
                            >
                                <i className="ph ph-money mr-2" />
                                <span>Cash</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Discount Modal */}
            {showDiscountModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60" onClick={() => setShowDiscountModal(false)}>
                    <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold">Add Discount</h3>
                            <button
                                onClick={() => setShowDiscountModal(false)}
                                className="p-2 hover:bg-gray-100 rounded-full"
                            >
                                <i className="ph ph-x text-gray-600"></i>
                            </button>
                        </div>

                        <div className="flex items-center gap-2 mb-4">
                            <div className="flex border rounded-lg overflow-hidden">
                                <button
                                    className={`px-4 py-2 ${percentMode ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}
                                    onClick={() => setPercentMode(true)}
                                >
                                    %
                                </button>
                                <button
                                    className={`px-4 py-2 ${!percentMode ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}
                                    onClick={() => setPercentMode(false)}
                                >
                                    ₹
                                </button>
                            </div>

                            <input
                                type="number"
                                value={discountInput}
                                onChange={(e) => setDiscountInput(e.target.value)}
                                placeholder={`Discount ${percentMode ? '%' : '₹'}`}
                                className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowDiscountModal(false)}
                                className="flex-1 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    const amount = parseFloat(discountInput);
                                    if (percentMode) {
                                        applyDiscount((amount * cartSubTotal / 100));
                                    } else {
                                        applyDiscount(amount);
                                    }
                                }}
                                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Apply
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Make component available globally
window.CheckoutSheet = CheckoutSheet; 