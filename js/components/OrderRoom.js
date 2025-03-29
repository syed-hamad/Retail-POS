// OrderRoom Component for Shopto
function OrderRoom({ tableId, variant, orderStatus = "KITCHEN", onClose }) {
    const [orders, setOrders] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    const menuRef = React.useRef(null);

    // Check permissions on mount
    React.useEffect(() => {
        if (!window.UserSession?.seller?.hasPermission("Orders", "Edit")) {
            showToast("You don't have permission to edit orders", "error");
            onClose();
        }
    }, []);

    // Set up real-time listener for orders
    // Note: Any order status changes will be automatically reflected in the UI
    // since we're using a real-time listener that monitors the currentStatus.label field
    React.useEffect(() => {
        let unsubscribe = () => { };

        try {
            console.log(`Setting up real-time listener for ${orderStatus} orders in ${tableId ? `Table ${tableId}` : variant}`);

            // Create query similar to the Flutter implementation
            let query = window.sdk.collection("Orders")
                .where("currentStatus.label", "==", orderStatus);

            // Different query approach based on source
            if (tableId) {
                // Table query - simple equality check on tableId
                query = query.where("tableId", "==", tableId);
            } else if (variant === 'Default') {
                // Default channel - needs to show orders with no tableId and no priceVariant
                // This requires a compound query to ensure we only get unassigned orders
                try {
                    query = window.sdk.collection("Orders")
                        .where("currentStatus.label", "==", orderStatus)
                        .where("tableId", "==", null) // Orders without a table assignment
                        .where("priceVariant", "in", [null, "Default"]); // Orders with no variant or Default variant
                } catch (err) {
                    // If this fails, try a simpler query and filter client-side
                    console.warn("Using simpler query for Default channel and filtering client-side:", err);
                    query = window.sdk.collection("Orders")
                        .where("currentStatus.label", "==", orderStatus);
                }
            } else if (variant) {
                // Specific channel query - match on priceVariant
                query = query.where("priceVariant", "==", variant);
            }

            // Ensure we order by date for consistency
            query = query.orderBy("date", "desc");

            // Set up real-time listener
            unsubscribe = query.onSnapshot(
                (snapshot) => {
                    let ordersList = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    })).filter(order => order.items && order.items.length > 0);

                    // If we had to use a simpler query for the Default channel, filter client-side
                    if (variant === 'Default' && !query._query.filters.some(f => f.field && f.field.segments && f.field.segments.includes('priceVariant'))) {
                        ordersList = ordersList.filter(order =>
                            !order.tableId && (!order.priceVariant || order.priceVariant === 'Default')
                        );
                    }

                    setOrders(ordersList);
                    setLoading(false);
                    console.log(`Real-time update: ${ordersList.length} ${orderStatus} orders for ${tableId ? `Table ${tableId}` : variant}`);
                },
                (err) => {
                    console.error('Error listening to orders:', err);
                    setError(`Failed to load orders: ${err.message}`);
                    setLoading(false);
                }
            );
        } catch (err) {
            console.error('Error setting up orders listener:', err);
            setError(`Failed to set up orders listener: ${err.message}`);
            setLoading(false);
        }

        // Clean up listener when component unmounts
        return () => {
            console.log(`Cleaning up order listener for ${tableId ? `Table ${tableId}` : variant}`);
            unsubscribe();
        };
    }, [tableId, variant, orderStatus]);

    // Handle showing QR code
    const handleShowQR = () => {
        if (window.UserSession?.seller?.downloadQr) {
            window.UserSession.seller.downloadQr(tableId);
        } else {
            const storeLink = window.UserSession?.seller?.getStoreLink() || '';
            const url = tableId ? `${storeLink}/getQR?id=${tableId}` : `${storeLink}/getQR`;
            window.open(url, '_blank');
        }
        setIsMenuOpen(false);
    };

    // Handle table deletion
    const confirmDelete = () => {
        // Show confirmation dialog
        if (confirm(`Are you sure you want to delete ${tableId ? `table ${tableId}` : variant}?`)) {
            if (window.UserSession?.seller?.removeTable) {
                window.UserSession.seller.removeTable(tableId || '');
                showToast('Table deleted successfully');
                onClose();
            } else {
                showToast('Delete functionality not available');
            }
        }
        setIsMenuOpen(false);
    };

    // Handle adding new order
    const handleAddNewOrder = () => {
        // Show POS component
        const posMount = document.createElement('div');
        document.body.appendChild(posMount);

        ReactDOM.render(
            React.createElement(window.POS, {
                title: variant || `Table ${tableId}`,
                tableId: tableId,
                variant: variant,
                onClose: () => {
                    ReactDOM.unmountComponentAtNode(posMount);
                    document.body.removeChild(posMount);
                }
            }),
            posMount
        );
    };

    // Render the no orders widget
    const NoOrdersWidget = () => (
        <div className="flex flex-col items-center justify-center py-20">
            <div className="opacity-50 mb-8">
                <i className="ph ph-shopping-bag text-5xl text-blue-800 mb-4"></i>
                <p className="text-xl font-bold text-blue-800 text-center">No orders yet here</p>
            </div>
            <button
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                onClick={handleAddNewOrder}
            >
                <i className="ph ph-plus-circle"></i>
                <span>Add New Order</span>
            </button>
        </div>
    );

    // Render the context menu
    const ContextMenu = () => (
        <div className="relative" ref={menuRef}>
            <button
                className="p-2 hover:bg-gray-100 rounded-full"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
                <i className="ph ph-dots-three-vertical text-xl"></i>
            </button>
            {isMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-20">
                    <div className="py-1">
                        <button
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                            onClick={handleShowQR}
                        >
                            <i className="ph ph-qr-code mr-2"></i>
                            Show QR
                        </button>
                        <button
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                            onClick={confirmDelete}
                        >
                            <i className="ph ph-trash mr-2"></i>
                            Delete table
                        </button>
                    </div>
                </div>
            )}
        </div>
    );

    // Add click event listener to close menu when clicking outside
    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    if (loading) {
        return (
            <div className="p-4 text-center">
                <div className="animate-spin inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 text-center text-red-600">
                {error}
            </div>
        );
    }

    return (
        <div className="bg-gray-50 min-h-screen">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b z-10">
                <div className="p-4 flex items-center justify-between">
                    <h2 className="text-xl font-semibold">
                        {variant || `Table ${tableId}`}
                    </h2>
                    <div className="flex items-center gap-2">
                        <ContextMenu />
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-full"
                        >
                            <i className="ph ph-x text-xl"></i>
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="p-4">
                {orders.length === 0 ? (
                    <NoOrdersWidget />
                ) : (
                    <div className="space-y-6">
                        {orders.map(order => (
                            <OrderView
                                key={order.id}
                                order={order}
                                tableId={tableId}
                                variant={variant}
                            />
                        ))}
                        <button
                            className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                            onClick={handleAddNewOrder}
                        >
                            <i className="ph ph-plus-circle"></i>
                            Add New Order
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// Export the component
window.OrderRoom = OrderRoom; 