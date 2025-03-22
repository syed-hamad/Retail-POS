// CheckoutSheet component for handling order checkout
function CheckoutSheet({ cart, clearCallback, tableId, checkout, orderId, priceVariant, onClose }) {
    const [discount, setDiscount] = React.useState(0);
    const [instructions, setInstructions] = React.useState('');
    const [showDiscountModal, setShowDiscountModal] = React.useState(false);
    const [percentMode, setPercentMode] = React.useState(false);
    const [discountInput, setDiscountInput] = React.useState('');
    const [isProcessing, setIsProcessing] = React.useState(false);
    const [paymentMode, setPaymentMode] = React.useState('CASH'); // CASH, DIGITAL, CREDIT
    const [showInstructionsModal, setShowInstructionsModal] = React.useState(false);

    // Calculate cart totals
    const cartSubTotal = React.useMemo(() => {
        if (!cart) return 0;
        return Object.values(cart).reduce((total, item) => total + (item.product.price * item.quantity), 0);
    }, [cart]);

    // Calculate charges (taxes, etc.)
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

        // Add exclusive charges
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
    const handleCheckout = async (mode) => {
        if (Object.keys(cart).length === 0) {
            showToast("Your cart is empty", "error");
            return;
        }

        // Update payment mode if specified
        if (mode) {
            setPaymentMode(mode);
        }

        setIsProcessing(true);

        try {
            // Ensure orderId exists or create a new one
            const targetOrderId = orderId || window.sdk.collection("Orders").doc().id;
            const orderRef = window.sdk.collection("Orders").doc(targetOrderId);

            // Convert cart items to Order items format
            const items = Object.values(cart).map(cartItem => {
                try {
                    return window.Item.fromProduct(cartItem.product, cartItem.quantity);
                } catch (err) {
                    console.error("Error creating item from product:", err);
                    // Create fallback item if fromProduct fails
                    return {
                        data: {
                            pid: cartItem.product.id,
                            title: cartItem.product.title,
                            thumb: cartItem.product.imgs?.[0] || null,
                            cat: cartItem.product.cat || "Other",
                            mrp: cartItem.product.mrp || cartItem.product.price,
                            price: cartItem.product.price,
                            veg: cartItem.product.veg || false,
                served: false,
                            qnt: cartItem.quantity
                        }
                    };
                }
            });

            // Validate charges format
            const validCharges = charges.map(charge => {
                if (typeof charge.toJson === 'function') {
                    return charge;
                } else {
                    // Create a simple charge object if toJson not available
                    return {
                        name: charge.name,
                        value: charge.value,
                        type: charge.type || 'fixed',
                        inclusive: charge.inclusive || false,
                        toJson: function () {
                            return {
                                name: this.name,
                                value: this.value,
                                type: this.type,
                                inclusive: this.inclusive
                            };
                        }
                    };
                }
            });

            // Create or update the order data
            let orderData;

            try {
                // Try using MOrder.fromItems first
                const order = window.MOrder.fromItems(
                    targetOrderId,
                    items,
                    discount,
                    priceVariant,
                    tableId,
                    instructions.trim(),
                    validCharges
                );
                orderData = order.data;

                // Add payment mode
                orderData.payMode = paymentMode;
            } catch (err) {
                console.error("Error creating MOrder:", err);

                // Fallback for direct data creation
                const now = new Date();
                const seller = window.UserSession?.seller;
                const billNo = seller?.getBillNo ? seller.getBillNo() : Math.floor(Math.random() * 1000000);

                orderData = {
                    id: targetOrderId,
                    billNo: billNo,
                    items: items.map(item => item.data || item),
                    sellerId: seller?.id,
                priceVariant: priceVariant,
                tableId: tableId,
                discount: discount,
                    paid: true,
                status: [
                    {
                        label: "PLACED",
                            date: now
                    },
                    {
                        label: "KITCHEN",
                            date: now
                    }
                ],
                currentStatus: {
                    label: "KITCHEN",
                        date: now
                },
                    charges: validCharges.map(c => typeof c.toJson === 'function' ? c.toJson() : c),
                    payMode: paymentMode,
                instructions: instructions.trim(),
                    date: now
                };
            }

            if (!orderId) {
                // Create new order
                await orderRef.set(orderData);
            } else {
                // Update existing order
                // FIX: Use a manual approach instead of arrayUnion which might be undefined
                const existingDoc = await orderRef.get();
                const existingData = existingDoc.exists ? existingDoc.data() : {};

                const updateData = {
                    // Manually merge items arrays rather than using arrayUnion
                    items: [
                        ...(existingData.items || []),
                        ...items.map(e => e.data || e)
                    ],
                    discount: (existingData.discount || 0) + discount
                };

                if (instructions.trim()) {
                    updateData.instructions = instructions.trim();
                }

                if (checkout) {
                    // If checkout mode, mark as paid
                    updateData.paid = true;
                    updateData.payMode = paymentMode;
                }

                await orderRef.update(updateData);
            }

            // Show success message
            showToast(checkout ? "Order completed!" : "Order placed successfully!");

            // Clear cart and close
            clearCallback && clearCallback();
            onClose && onClose();
        } catch (error) {
            console.error("Checkout error:", error);
            showToast("Failed to process order: " + (error.message || "Unknown error"), "error");
            setIsProcessing(false);
        }
    };

    // Handle discount application
    const applyDiscount = (amount) => {
        if (isNaN(amount) || amount < 0) {
            showToast("Please enter a valid discount amount", "error");
            return;
        }

        if (amount > cartSubTotal) {
            showToast("Discount cannot be greater than subtotal", "error");
            setDiscount(0);
        } else {
            setDiscount(amount);
            showToast(`Discount of ₹${amount.toFixed(2)} applied`, "success");
        }
        setShowDiscountModal(false);
    };

    if (Object.keys(cart).length === 0) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50" onClick={() => onClose?.()}>
            <div
                className="bg-white rounded-xl shadow-lg w-full max-w-md md:max-w-lg mx-4 overflow-hidden flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
                style={{ backgroundColor: "#fffcfc" }}
            >
                {/* Header */}
                <div className="sticky top-0 z-10 bg-white" style={{ backgroundColor: "#fff8f8" }}>
                    <div className="flex items-center justify-between p-4 border-b relative">
                        <div className="flex items-center">
                            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-3">
                                <i className="ph ph-shopping-cart text-red-600 text-xl"></i>
                    </div>
                            <h2 className="text-xl font-semibold text-gray-800">Checkout</h2>
                </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowDiscountModal(true)}
                                className="p-2 hover:bg-red-50 rounded-full transition-colors"
                                title="Apply Discount"
                            >
                                <i className="ph ph-tag text-red-600"></i>
                            </button>
                            <button
                                onClick={() => onClose?.()}
                                className="p-2 hover:bg-red-50 rounded-full transition-colors"
                                aria-label="Close"
                            >
                                <i className="ph ph-x text-red-600"></i>
                            </button>
                        </div>
                </div>

                    {/* Order Info */}
                    <div className="bg-pink-50 px-4 py-2 border-b flex justify-between items-center">
                        <div className="text-sm text-gray-600 flex items-center">
                            <i className="ph ph-shopping-bag text-red-500 mr-1"></i>
                            {Object.values(cart).reduce((total, item) => total + item.quantity, 0)} items
                        </div>
                        <div className="text-sm text-gray-600 flex items-center">
                            <i className="ph ph-calendar text-red-500 mr-1"></i>
                            {formatDate(new Date())}
                        </div>
                    </div>
                </div>

                {/* Main content - Scrollable area */}
                <div className="overflow-y-auto flex-1" style={{ scrollbarWidth: 'thin', backgroundColor: "#fffcfc" }}>
                    {/* Items list */}
                    <div className="p-4">
                        <h3 className="font-medium text-gray-700 mb-3">Order Items</h3>
                        <div className="space-y-3">
                    {Object.values(cart).map((item, index) => (
                                <div key={index} className="flex items-start p-3 bg-white rounded-xl shadow-sm hover:shadow transition-shadow duration-200">
                                    <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden mr-3 flex-shrink-0">
                                        {item.product.imgs && item.product.imgs.length > 0 ? (
                                            <img
                                                src={item.product.imgs[0]}
                                                alt={item.product.title}
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    e.target.onerror = null;
                                                    e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="%23ccc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
                                                }}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <i className="ph ph-image text-gray-400 text-xl" />
                        </div>
                                        )}
                        </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-gray-900 text-lg">{item.product.title}</div>
                                        <div className="text-sm text-gray-600 mt-0.5">
                                            {item.quantity} × ₹{item.product.price}
                                        </div>
                                        {item.product.veg !== undefined && (
                                            <div className="mt-1">
                                                <span className={`inline-block w-4 h-4 border ${item.product.veg ? 'border-green-500' : 'border-red-500'} p-0.5 rounded-sm`}>
                                                    <span className={`block w-full h-full rounded-sm ${item.product.veg ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                                </span>
                            </div>
                        )}
                                    </div>
                                    <div className="font-medium text-right whitespace-nowrap text-red-600">
                                        ₹{(item.quantity * item.product.price).toFixed(2)}
                        </div>
                        </div>
                            ))}
                    </div>
                </div>

                {/* Instructions */}
                    <div className="px-4 pb-4">
                        <h3 className="font-medium text-gray-700 mb-2">Special Instructions</h3>
                <textarea
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="Add any special instructions here"
                            className="w-full p-3 border border-gray-200 rounded-lg resize-none text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-400 bg-white"
                            rows="2"
                    maxLength={300}
                />
            </div>
        </div>

                {/* Order summary - Fixed at bottom */}
                <div className="bg-white border-t shadow-md" style={{ backgroundColor: "#fff8f8" }}>
                    <div className="p-4">
                        <div className="space-y-2">
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
                                <span className="text-red-600">₹{cartTotal.toFixed(2)}</span>
                            </div>
                        </div>

                        {/* Action buttons */}
                        {!checkout ? (
                            <div className="mt-4">
                                <button
                                    onClick={() => handleCheckout()}
                                    disabled={isProcessing}
                                    className={`w-full bg-red-500 text-white py-3 rounded-lg font-medium flex items-center justify-center hover:bg-red-600 transition-colors ${isProcessing ? 'opacity-75 cursor-not-allowed' : ''}`}
                                >
                                    {isProcessing ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            <span>Place Order</span>
                                            <i className="ph ph-arrow-right ml-2" />
                                        </>
                                    )}
                                </button>
                            </div>
                        ) : (
                            <div className="mt-4 space-y-3">
                                {/* KOT Button (when in checkout mode) */}
                                <button
                                    onClick={() => {
                                        try {
                                            if (window.UserSession?.seller?.kotEnabled) {
                                                window.sdk.kot.print(orderId);
                                            }
                                            showToast("KOT Printed Successfully");
                                        } catch (error) {
                                            console.error("Error printing KOT:", error);
                                            showToast("Failed to print KOT", "error");
                                        }
                                    }}
                                    className="w-full py-3 border border-red-500 text-red-500 rounded-lg font-medium flex items-center justify-center hover:bg-red-50 transition-colors"
                                >
                                    <i className="ph ph-printer mr-2" />
                                    Print KOT
                                </button>

                                {/* Payment options - Now these directly complete the order */}
                                <h3 className="font-medium text-center text-gray-700 mb-2">Select Payment Method</h3>
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        onClick={() => handleCheckout('CASH')}
                                        disabled={isProcessing}
                                        className={`bg-red-500 text-white py-3 px-2 rounded-lg font-medium flex flex-col items-center justify-center hover:bg-red-600 transition-colors ${isProcessing ? 'opacity-75 cursor-not-allowed' : ''} ${paymentMode === 'CASH' ? 'ring-2 ring-red-300' : ''}`}
                                    >
                                        <i className="ph ph-money text-xl mb-1" />
                                        <span className="text-sm">Cash</span>
                                    </button>
                                    <button
                                        onClick={() => handleCheckout('DIGITAL')}
                                        disabled={isProcessing}
                                        className={`bg-red-500 text-white py-3 px-2 rounded-lg font-medium flex flex-col items-center justify-center hover:bg-red-600 transition-colors ${isProcessing ? 'opacity-75 cursor-not-allowed' : ''} ${paymentMode === 'DIGITAL' ? 'ring-2 ring-red-300' : ''}`}
                                    >
                                        <i className="ph ph-credit-card text-xl mb-1" />
                                        <span className="text-sm">UPI/Card</span>
                                    </button>
                                    <button
                                        onClick={() => handleCheckout('CREDIT')}
                                        disabled={isProcessing}
                                        className={`bg-red-500 text-white py-3 px-2 rounded-lg font-medium flex flex-col items-center justify-center hover:bg-red-600 transition-colors ${isProcessing ? 'opacity-75 cursor-not-allowed' : ''} ${paymentMode === 'CREDIT' ? 'ring-2 ring-red-300' : ''}`}
                                    >
                                        <i className="ph ph-notebook text-xl mb-1" />
                                        <span className="text-sm">Credit</span>
                                    </button>
                                </div>

                                {/* Processing state indicator (replaces the Complete Order button) */}
                                {isProcessing && (
                                    <div className="mt-3 py-3 bg-gray-100 rounded-lg text-center text-gray-700">
                                        <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                                        Processing payment...
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Discount Modal */}
            {showDiscountModal && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-60" onClick={() => setShowDiscountModal(false)}>
                    <div className="bg-white rounded-xl p-5 w-full max-w-md shadow-xl animate-fadeIn" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-5">
                            <h3 className="text-xl font-semibold">Apply Discount</h3>
                            <button
                                onClick={() => setShowDiscountModal(false)}
                                className="p-2 hover:bg-gray-100 rounded-full"
                            >
                                <i className="ph ph-x text-gray-600"></i>
                            </button>
                        </div>

                        {/* Toggle between percentage and fixed amount */}
                        <div className="flex items-center justify-between bg-gray-100 rounded-lg p-1 mb-4">
                            <button
                                className={`flex-1 py-2 rounded-md text-center ${!percentMode ? 'bg-white shadow-sm font-medium' : ''}`}
                                onClick={() => setPercentMode(false)}
                            >
                                Fixed Amount
                            </button>
                            <button
                                className={`flex-1 py-2 rounded-md text-center ${percentMode ? 'bg-white shadow-sm font-medium' : ''}`}
                                onClick={() => setPercentMode(true)}
                            >
                                Percentage (%)
                                </button>
                            </div>

                        {/* Input field */}
                        <div className="mb-5">
                            <label className="block text-sm text-gray-600 mb-2">
                                {percentMode ? 'Discount Percentage' : 'Discount Amount'}
                            </label>
                            <div className="flex items-center border rounded-lg overflow-hidden shadow-sm">
                                <span className="px-3 py-2 bg-gray-100 text-gray-500">
                                    {percentMode ? '%' : '₹'}
                                </span>
                            <input
                                type="number"
                                    value={discountInput}
                                    onChange={(e) => setDiscountInput(e.target.value)}
                                    placeholder="0"
                                    className="flex-1 px-3 py-2 outline-none"
                                />
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                                {percentMode
                                    ? 'Enter percentage between 1-100'
                                    : `Maximum discount: ₹${cartSubTotal}`}
                            </p>
                        </div>

                        {/* Summary */}
                        <div className="bg-gray-50 rounded-lg p-4 mb-5">
                            <div className="flex justify-between mb-1">
                                <span className="text-gray-600">Subtotal:</span>
                                <span>₹{cartSubTotal}</span>
                            </div>
                            <div className="flex justify-between mb-1 text-green-600">
                                <span>Discount:</span>
                                <span>
                                    - ₹{
                                        percentMode
                                            ? ((parseFloat(discountInput) || 0) * cartSubTotal / 100).toFixed(2)
                                            : (Math.min(parseFloat(discountInput) || 0, cartSubTotal)).toFixed(2)
                                    }
                                </span>
                            </div>
                            <div className="flex justify-between font-medium text-lg pt-2 border-t">
                                <span>Final Total:</span>
                                <span>
                                    ₹{
                                        percentMode
                                            ? (cartSubTotal - ((parseFloat(discountInput) || 0) * cartSubTotal / 100)).toFixed(2)
                                            : (cartSubTotal - Math.min(parseFloat(discountInput) || 0, cartSubTotal)).toFixed(2)
                                    }
                                </span>
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDiscountModal(false)}
                                className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={applyDiscount}
                                className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg"
                            >
                                Apply Discount
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Instructions Modal */}
            {showInstructionsModal && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-60"
                    onClick={() => setShowInstructionsModal(false)}
                >
                    <div
                        className="bg-white rounded-xl p-5 w-full max-w-md shadow-xl animate-fadeIn"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center mb-5">
                            <h3 className="text-xl font-semibold">Order Instructions</h3>
                            <button
                                onClick={() => setShowInstructionsModal(false)}
                                className="p-2 hover:bg-gray-100 rounded-full"
                            >
                                <i className="ph ph-x text-gray-600"></i>
                            </button>
                        </div>

                        <div className="mb-5">
                            <textarea
                                value={instructions}
                                onChange={(e) => setInstructions(e.target.value)}
                                placeholder="Add any special instructions for this order..."
                                className="w-full p-3 border rounded-lg h-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            ></textarea>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowInstructionsModal(false)}
                                className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    // Just close the modal, instructions are already saved in state
                                    setShowInstructionsModal(false);
                                }}
                                className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg"
                            >
                                Save Instructions
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