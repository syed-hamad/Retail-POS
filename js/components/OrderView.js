// OrderView component for displaying and managing order details
const React = window.React;
const ReactDOM = window.ReactDOM;

function OrderView({ order, tableId, variant, onClose }) {
    const [showCheckout, setShowCheckout] = React.useState(false);
    const [availablePrinters, setAvailablePrinters] = React.useState([]);
    const [activePrinter, setActivePrinter] = React.useState(null);
    const [showPrinterDropdown, setShowPrinterDropdown] = React.useState(false);

    // Load printers on component mount
    React.useEffect(() => {
        if (window.BluetoothPrinting) {
            const printers = window.BluetoothPrinting.getSavedPrinters() || [];
            setAvailablePrinters(printers);

            const activeId = window.BluetoothPrinting.getActivePrinterId();
            const active = printers.find(p => p.id === activeId) ||
                printers.find(p => p.isDefault) ||
                (printers.length > 0 ? printers[0] : null);

            setActivePrinter(active);
        }
    }, []);

    // Function to switch active printer
    const handlePrinterSelect = (printer) => {
        if (window.BluetoothPrinting && printer) {
            window.BluetoothPrinting.setActivePrinterId(printer.id);
            setActivePrinter(printer);
        }
        setShowPrinterDropdown(false);
    };

    // Function to handle adding a new printer
    const handleAddNewPrinter = () => {
        if (window.BluetoothPrinting) {
            window.BluetoothPrinting.connect().then(() => {
                const updatedPrinters = window.BluetoothPrinting.getSavedPrinters() || [];
                setAvailablePrinters(updatedPrinters);

                const newActiveId = window.BluetoothPrinting.getActivePrinterId();
                const newActive = updatedPrinters.find(p => p.id === newActiveId);
                if (newActive) {
                    setActivePrinter(newActive);
                }
            }).catch(error => {
                console.error("Error connecting to printer:", error);
            });
        }
        setShowPrinterDropdown(false);
    };

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
            if (window.ModalManager && typeof window.ModalManager.showToast === 'function') {
                window.ModalManager.showToast(served ? "Item marked as served" : "Item marked as not served");
            } else {
                showToast(served ? "Item marked as served" : "Item marked as not served");
            }
        } catch (error) {
            console.error("Error updating serve status:", error);
            if (window.ModalManager && typeof window.ModalManager.showToast === 'function') {
                window.ModalManager.showToast("Failed to update serve status", { type: "error" });
            } else {
                showToast("Failed to update serve status", "error");
            }
        }
    };

    // Handle item quantity changes
    const handleQuantityChange = async (item, increment) => {
        try {
            if (increment) {
                await order.addItem(item);
            } else {
                // Verify the item still exists and has the current state before removing
                const currentOrder = order.items?.find(i => i.pid === item.pid);
                if (currentOrder) {
                    await order.removeItem(item);
                } else {
                    showToast("Item no longer exists in the order", "error");
                }
            }
        } catch (error) {
            console.error("Error updating quantity:", error);
            if (window.ModalManager && typeof window.ModalManager.showToast === 'function') {
                window.ModalManager.showToast("Failed to update quantity", { type: "error" });
            } else {
                showToast("Failed to update quantity", "error");
            }
        }
    };

    // Handle adding new items
    const handleAddNewItems = () => {
        // Check if POS component is available
        if (!window.POS) {
            console.error("POS component is not defined");
            if (window.ModalManager && typeof window.ModalManager.showToast === 'function') {
                window.ModalManager.showToast("Cannot open POS: component not available", { type: "error" });
            } else {
                showToast("Cannot open POS: component not available", "error");
            }
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
                ref: window.sdk.db.collection("Orders").doc(order.id)
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
            if (window.ModalManager && typeof window.ModalManager.showToast === 'function') {
                window.ModalManager.showToast("Failed to open POS", { type: "error" });
            } else {
                showToast("Failed to open POS", "error");
            }
        }
    };

    // Open checkout sheet
    const openCheckoutSheet = () => {
        if (window.ModalManager && typeof window.ModalManager.createSideDrawerModal === 'function' && window.CheckoutSheet) {
            // Create a container for the CheckoutSheet
            const checkoutContainer = document.createElement('div');
            checkoutContainer.id = 'checkout-sheet-container';
            document.body.appendChild(checkoutContainer);

            try {
                // Create a root element for React
                const root = ReactDOM.createRoot(checkoutContainer);

                // Render the CheckoutSheet inside the container
                root.render(
                    React.createElement(window.CheckoutSheet, {
                        order: order,
                        onClose: () => {
                            // Unmount and clean up
                            root.unmount();
                            if (document.body.contains(checkoutContainer)) {
                                document.body.removeChild(checkoutContainer);
                            }
                            // Refresh the order data
                            if (onClose) onClose();
                        }
                    })
                );

                // Create a modal using ModalManager
                const modal = window.ModalManager.createSideDrawerModal({
                    id: 'checkout-sheet-modal',
                    customContainer: checkoutContainer,
                    fullscreen: true,
                    onClosed: () => {
                        // Clean up React root when modal is closed
                        setTimeout(() => {
                            root.unmount();
                            if (document.body.contains(checkoutContainer)) {
                                document.body.removeChild(checkoutContainer);
                            }
                        }, 100);
                    }
                });
            } catch (error) {
                console.error("Error rendering CheckoutSheet:", error);
                if (document.body.contains(checkoutContainer)) {
                    document.body.removeChild(checkoutContainer);
                }
                if (window.ModalManager && typeof window.ModalManager.showToast === 'function') {
                    window.ModalManager.showToast("Failed to open checkout", { type: "error" });
                } else {
                    showToast("Failed to open checkout", "error");
                }
                setShowCheckout(true); // Fallback to the original modal
            }
        } else {
            setShowCheckout(true);
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-lg p-4 mb-4" style={{ backgroundColor: "#fff8f8", borderRadius: "16px" }}>
            {/* Order Header */}
            <div className="flex items-center justify-between mb-2">
                <div>
                    <div className="flex items-center">
                        <span className="text-lg font-bold text-gray-800">
                            Bill No: <span className="text-red-500">#{order.billNo}</span>
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
                    className="p-3 text-red-500 hover:bg-red-50 rounded-full transition-colors"
                    aria-label="Add new items"
                >
                    <i className="ph ph-plus-circle text-2xl" />
                </button>
            </div>

            {/* Printer Selection */}
            <div className="mb-4 relative">
                <div
                    className="flex items-center p-2 bg-red-50 rounded-lg cursor-pointer hover:bg-red-100 transition-colors"
                    onClick={() => setShowPrinterDropdown(!showPrinterDropdown)}
                >
                    <i className="ph ph-printer text-red-500 mr-2"></i>
                    <div className="flex-1 overflow-hidden">
                        <div className="text-sm font-medium text-gray-800 truncate">
                            {activePrinter ? activePrinter.name : 'No printer selected'}
                        </div>
                        <div className="text-xs text-gray-500">
                            {activePrinter && activePrinter.isDefault ? 'Default Printer' : 'Click to select printer'}
                        </div>
                    </div>
                    <i className={`ph ph-caret-${showPrinterDropdown ? 'up' : 'down'} text-gray-500`}></i>
                </div>

                {/* Printer Dropdown */}
                {showPrinterDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 max-h-56 overflow-y-auto">
                        {availablePrinters.length > 0 ? (
                            <>
                                {availablePrinters.map(printer => (
                                    <div
                                        key={printer.id}
                                        className={`px-3 py-2 flex items-center cursor-pointer ${activePrinter?.id === printer.id ? 'bg-red-50 text-red-500' : 'hover:bg-gray-50'}`}
                                        onClick={() => handlePrinterSelect(printer)}
                                    >
                                        <i className={`ph ph-printer mr-2 ${printer.isDefault ? 'text-red-500' : 'text-gray-500'}`}></i>
                                        <div className="flex-1">
                                            <div className="text-sm font-medium">{printer.name}</div>
                                            {printer.isDefault && <div className="text-xs text-gray-500">Default</div>}
                                        </div>
                                        {activePrinter?.id === printer.id && <i className="ph ph-check text-red-500"></i>}
                                    </div>
                                ))}
                            </>
                        ) : (
                            <div className="px-3 py-3 text-center text-gray-500 text-sm">No printers configured</div>
                        )}
                        <div className="border-t border-gray-100 mt-1 pt-1">
                            <div
                                className="px-3 py-2 flex items-center text-blue-600 hover:bg-blue-50 cursor-pointer"
                                onClick={handleAddNewPrinter}
                            >
                                <i className="ph ph-plus-circle mr-2"></i>
                                <span className="text-sm font-medium">Add New Printer</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Progress Bar */}
            <div className="mb-4">
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-red-500 transition-all duration-300"
                        style={{ width: `${(order.servedItems / order.totalItems) * 100}%` }}
                    />
                </div>
            </div>

            {/* Order Items */}
            <div className="space-y-3 mb-4">
                {order.items.map((item, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 hover:bg-pink-50 rounded-xl border border-gray-100 shadow-sm">
                        <input
                            type="checkbox"
                            checked={item.served}
                            onChange={(e) => handleServeStatusChange(item, e.target.checked)}
                            className="w-5 h-5 text-red-500 rounded border-gray-300 focus:ring-red-500"
                        />

                        <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100">
                            <img
                                src={item.thumb}
                                alt={item.title}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src = 'https://via.placeholder.com/150';
                                }}
                            />
                        </div>

                        <div className="flex-1">
                            <div className="font-medium text-gray-800">{item.title}</div>
                            <div className="text-sm text-gray-600">
                                <span className="font-medium text-red-500">₹{item.price}</span> • {item.cat || 'Uncategorized'}
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="bg-gray-100 rounded-full px-1 py-0.5 flex items-center gap-1">
                                <button
                                    onClick={() => handleQuantityChange(item, false)}
                                    className="w-7 h-7 flex items-center justify-center text-red-500 hover:bg-red-50 rounded-full"
                                >
                                    <i className="ph ph-minus text-lg" />
                                </button>
                                <span className="w-8 text-center font-medium">
                                    {item.qnt}
                                </span>
                                <button
                                    onClick={() => handleQuantityChange(item, true)}
                                    className="w-7 h-7 flex items-center justify-center text-red-500 hover:bg-red-50 rounded-full"
                                >
                                    <i className="ph ph-plus text-lg" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Order Summary */}
            <div className="border-t pt-4">
                <div className="flex justify-between text-lg font-bold">
                    <span>Sub Total:</span>
                    <span className="text-red-500">₹{order.subTotal}</span>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 mt-4">
                <button
                    onClick={() => {
                        // Use the centralized BluetoothPrinting method for KOT printing
                        if (window.BluetoothPrinting) {
                            window.BluetoothPrinting.printKOT(order.id);
                        } else {
                            console.error("BluetoothPrinting not available");
                            showToast("Printing service not available", "error");
                        }
                    }}
                    className="flex-1 py-2.5 border border-red-500 text-red-500 rounded-lg font-medium hover:bg-red-50 transition-colors"
                >
                    <i className="ph ph-printer mr-2"></i>
                    Print KOT
                </button>
                <button
                    onClick={openCheckoutSheet}
                    className="flex-1 py-2.5 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors"
                >
                    <i className="ph ph-credit-card mr-2"></i>
                    Checkout
                </button>
            </div>

            {/* Checkout Sheet */}
            {showCheckout && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 flex items-end z-50"
                    onClick={() => setShowCheckout(false)}
                >
                    <div
                        className="w-full bg-white rounded-t-2xl shadow-section"
                        onClick={e => e.stopPropagation()}
                    >
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