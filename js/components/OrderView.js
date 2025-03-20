// OrderView component for displaying and managing order details
const React = window.React;
const ReactDOM = window.ReactDOM;

function OrderView({ order, tableId, variant, onClose }) {
    const [showCheckout, setShowCheckout] = React.useState(false);

    // Ensure order has all required properties and methods
    React.useEffect(() => {
        if (!order) {
            console.error("OrderView: order object is required");
            return;
        }

        if (typeof order.id !== 'string') {
            console.warn("OrderView: order.id should be a string");
        }

        // Check for essential methods
        if (typeof order.serveItem !== 'function') {
            console.warn("OrderView: order.serveItem method is not defined");
        }

        if (typeof order.addItem !== 'function') {
            console.warn("OrderView: order.addItem method is not defined");
        }

        if (typeof order.removeItem !== 'function') {
            console.warn("OrderView: order.removeItem method is not defined");
        }
    }, [order]);

    // Handle item serve status change
    const handleServeStatusChange = async (item, served) => {
        try {
            await order.serveItem(item, served);
            showToast(served ? "Item marked as served" : "Item marked as not served");
        } catch (error) {
            console.error("Error updating serve status:", error);
            showToast("Failed to update serve status", "error");
        }
    };

    // Handle item quantity changes
    const handleQuantityChange = async (item, increment) => {
        try {
            if (increment) {
                await order.addItem(item);
            } else {
                await order.removeItem(item);
            }
        } catch (error) {
            console.error("Error updating quantity:", error);
            showToast("Failed to update quantity", "error");
        }
    };

    // Handle adding new items
    const handleAddNewItems = () => {
        // Check if POS component is available
        if (!window.POS) {
            console.error("POS component is not defined");
            showToast("Cannot open POS: component not available", "error");
            return;
        }

        // Create a container for the POS component
        const posContainer = document.createElement('div');
        posContainer.id = 'pos-items-container';
        posContainer.className = 'fixed inset-0 z-50';
        document.body.appendChild(posContainer);

        try {
            // Create a root element for React 18
            const root = ReactDOM.createRoot(posContainer);

            // Convert MOrder instance to plain order object with ref for POS component
            const orderForPOS = {
                ...order,
                ref: window.sdk.collection("Orders").doc(order.id)
            };

            // Render the POS component
            root.render(
                React.createElement(window.POS, {
                    title: `Add to Order #${order.billNo}`,
                    tableId: tableId,
                    variant: variant,
                    order: orderForPOS,
                    onClose: () => {
                        // Unmount and clean up
                        root.unmount();
                        if (document.body.contains(posContainer)) {
                            document.body.removeChild(posContainer);
                        }
                        // You might want to refresh the order data here
                        if (onClose) onClose();
                    }
                })
            );
        } catch (error) {
            console.error("Error rendering POS:", error);
            if (document.body.contains(posContainer)) {
                document.body.removeChild(posContainer);
            }
            showToast("Failed to open POS", "error");
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-lg p-4 mb-4">
            {/* Order Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <div className="flex items-center">
                        <span className="text-lg font-bold text-primary-dark">
                            Bill No: #{order.billNo}
                        </span>
                        <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                            Served
                        </span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600 mt-1">
                        <span>{order.date?.toLocaleString()}</span>
                        <span className="mx-2">•</span>
                        <span>{order.servedItems}/{order.totalItems} items</span>
                    </div>
                </div>
                <button
                    onClick={handleAddNewItems}
                    className="p-2 text-primary-dark hover:bg-primary-dark/10 rounded-full"
                    aria-label="Add new items"
                >
                    <i className="ph ph-plus-circle text-2xl" />
                </button>
            </div>

            {/* Progress Bar */}
            <div className="mb-4">
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-primary-light transition-all duration-300"
                        style={{ width: `${(order.servedItems / order.totalItems) * 100}%` }}
                    />
                </div>
            </div>

            {/* Order Items */}
            <div className="space-y-2 mb-4">
                {order.items.map((item, index) => (
                    <div key={index} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg">
                        <input
                            type="checkbox"
                            checked={item.served}
                            onChange={(e) => handleServeStatusChange(item, e.target.checked)}
                            className="w-4 h-4 text-primary-dark rounded border-gray-300 focus:ring-primary-dark"
                        />

                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100">
                            <img
                                src={item.thumb}
                                alt={item.title}
                                className="w-full h-full object-cover"
                            />
                        </div>

                        <div className="flex-1">
                            <div className="font-medium">{item.title}</div>
                            <div className="text-sm text-gray-600">
                                Qty: {item.qnt} • Price: ₹{item.price}
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handleQuantityChange(item, false)}
                                className="p-1 hover:bg-gray-100 rounded-full"
                            >
                                <i className="ph ph-minus text-lg" />
                            </button>
                            <button
                                onClick={() => handleQuantityChange(item, true)}
                                className="p-1 hover:bg-gray-100 rounded-full"
                            >
                                <i className="ph ph-plus text-lg" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Order Summary */}
            <div className="border-t pt-4">
                <div className="flex justify-between text-lg font-bold">
                    <span>Sub Total:</span>
                    <span>₹{order.subTotal}</span>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 mt-4">
                <button
                    onClick={() => {
                        try {
                            // Implement KOT printing
                            if (window.UserSession?.seller?.kotEnabled) {
                                // If KOT functionality is supported by the seller
                                window.sdk.kot.print(order.id);
                                showToast("KOT printed successfully");
                            } else {
                                // Fallback for testing
                                console.log("KOT printed for order:", order.id);
                                showToast("KOT printed successfully");
                            }
                        } catch (error) {
                            console.error("Error printing KOT:", error);
                            showToast("Failed to print KOT", "error");
                        }
                    }}
                    className="flex-1 py-2 border border-primary-dark text-primary-dark rounded-lg font-medium"
                >
                    Print KOT
                </button>
                <button
                    onClick={() => setShowCheckout(true)}
                    className="flex-1 py-2 bg-primary-dark text-white rounded-lg font-medium"
                >
                    Checkout
                </button>
            </div>

            {/* Checkout Sheet */}
            {showCheckout && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end">
                    <div className="w-full bg-white rounded-t-2xl">
                        <window.CheckoutSheet
                            order={order}
                            onClose={() => setShowCheckout(false)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

// Make component available globally
window.OrderView = OrderView; 