// Dashboard Component
function Dashboard() {
    const { profile: seller, tables: profileTables } = window.useProfile ? window.useProfile() : { profile: null, tables: [] };
    const [tables, setTables] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [isProfileOpen, setIsProfileOpen] = React.useState(false);
    const [showCompletedOrders, setShowCompletedOrders] = React.useState(false);
    const [completedOrders, setCompletedOrders] = React.useState([]);
    const [qrOrders, setQrOrders] = React.useState([]);
    const [loadingQrOrders, setLoadingQrOrders] = React.useState(true);
    const [errorQrOrders, setErrorQrOrders] = React.useState(null);
    const [loadedItemCount, setLoadedItemCount] = React.useState(50); // Initially load 50 items
    const [isLoadingMore, setIsLoadingMore] = React.useState(false);
    const qrOrdersScrollRef = React.useRef(null);
    const [isAddTableModalOpen, setIsAddTableModalOpen] = React.useState(false);
    const [isRenameRoomModalOpen, setIsRenameRoomModalOpen] = React.useState(false);
    const [selectedTableId, setSelectedTableId] = React.useState(null);
    const [selectedVariant, setSelectedVariant] = React.useState(null);
    const [orders, setOrders] = React.useState([]);
    const [loadingCompletedOrders, setLoadingCompletedOrders] = React.useState(true);
    const [errorCompletedOrders, setErrorCompletedOrders] = React.useState(null);
    const [isOrderRoomOpen, setIsOrderRoomOpen] = React.useState(false);
    const [selectedRoomTableId, setSelectedRoomTableId] = React.useState(null);
    const [selectedRoomVariant, setSelectedRoomVariant] = React.useState(null);

    // State for date filtering in completed orders
    const [dateFilter, setDateFilter] = React.useState('7days'); // Options: today, yesterday, 7days, custom
    const [customDateRange, setCustomDateRange] = React.useState({
        startDate: null,
        endDate: null
    });

    // Function to show the add table modal
    const showAddTableModal = () => {
        setIsAddTableModalOpen(true);
    };

    // Function to show the rename room modal
    const showRenameRoomModal = (tableId, variant) => {
        setSelectedTableId(tableId);
        setSelectedVariant(variant);
        setIsRenameRoomModalOpen(true);
    };

    // Function to remove a table
    const removeTable = async (tableId) => {
        try {
            // Confirm before removing
            if (!confirm(`Are you sure you want to remove table ${tableId}?`)) {
                return;
            }

            // Get current tables from seller
            const currentTables = seller?.tables || [];

            // Remove the table
            const updatedTables = currentTables.filter(table => table.title !== tableId);

            // Update seller document in Firestore
            await sdk.profile.update({
                tables: updatedTables
            });

            showToast('Table removed successfully');

            // Analytics tracking (if needed)
            // analytics.track("REMOVE_TABLE");
        } catch (err) {
            console.error('Error removing table:', err);
            showToast('Failed to remove table. Please try again.');
        }
    };

    // Helper function to calculate start date based on filter
    const calculateStartDate = (filter, customStart = null) => {
        const now = new Date();
        const customStartDate = parseDate(customStart);

        switch (filter) {
            case 'today':
                return new Date(now.getFullYear(), now.getMonth(), now.getDate());
            case 'yesterday':
                const yesterday = new Date(now);
                yesterday.setDate(yesterday.getDate() - 1);
                return new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
            case '7days':
                const sevenDaysAgo = new Date(now);
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
                return new Date(sevenDaysAgo.getFullYear(), sevenDaysAgo.getMonth(), sevenDaysAgo.getDate());
            case 'custom':
                return customStartDate || now;
            default:
                return new Date(now.getFullYear(), now.getMonth(), now.getDate());
        }
    };

    // Helper function to calculate end date based on filter
    const calculateEndDate = (filter, customEnd = null) => {
        const now = new Date();
        const customEndDate = parseDate(customEnd);

        switch (filter) {
            case 'today':
                return now;
            case 'yesterday':
                const yesterday = new Date(now);
                yesterday.setDate(yesterday.getDate() - 1);
                return new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);
            case '7days':
                return now;
            case 'custom':
                return customEndDate || now;
            default:
                return now;
        }
    };

    // Handle room click
    const handleRoomClick = (tableId, variant) => {
        setSelectedRoomTableId(tableId);
        setSelectedRoomVariant(variant);
        setIsOrderRoomOpen(true);

        // Log analytics event
        console.log(`Opening OrderRoom for ${tableId ? `Table ${tableId}` : variant}`);
    };

    // Load tables and orders data
    React.useEffect(() => {
        async function fetchData() {
            try {
                const ordersSnapshot = await sdk.collection("Orders")
                    .orderBy("date", "desc")
                    .limit(100)
                    .get();

                const allOrders = ordersSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                // Filter orders by status - only show orders with KITCHEN status
                // This matches the Flutter implementation: .where("currentStatus.label", isEqualTo: OrderStatus.KITCHEN.name)
                const kitchenOrders = allOrders.filter(order => {
                    return order.currentStatus?.label === 'KITCHEN';
                });

                pp('All orders:', allOrders.length);
                pp('Kitchen orders:', kitchenOrders.length);

                // Use real tables from seller object instead of fake data
                const realTables = seller?.tables || [];

                // Convert seller tables to the format we need
                const formattedTables = realTables.map(table => ({
                    id: table.id || table.title,
                    title: table.title,
                    desc: table.desc,
                    type: table.type || 'dine_in',
                    section: table.section || 'ac'
                }));

                // Add default tables for aggregators if they don't exist
                const defaultAggregators = [
                    { id: 'default', title: 'Default', type: 'qr' },
                    { id: 'zomato', title: 'Zomato', type: 'aggregator' },
                    { id: 'swiggy', title: 'Swiggy', type: 'aggregator' }
                ];

                // Combine real tables with default aggregators
                // Only add default aggregators if they don't already exist in real tables
                const combinedTables = [
                    ...formattedTables,
                    ...defaultAggregators.filter(agg =>
                        !formattedTables.some(t => t.id === agg.id)
                    )
                ];

                // Group orders by table ID and also by order source for aggregators
                const tableOrders = kitchenOrders.reduce((acc, order) => {
                    // First, handle regular table assignments
                    if (order.tableId) {
                        if (!acc[order.tableId]) {
                            acc[order.tableId] = [];
                        }
                        acc[order.tableId].push(order);
                    }

                    // Then, handle aggregator assignments based on orderSource
                    if (order.orderSource) {
                        const source = order.orderSource.toLowerCase();

                        // Handle Zomato orders
                        if (source === 'zomato') {
                            if (!acc['zomato']) {
                                acc['zomato'] = [];
                            }
                            acc['zomato'].push(order);
                        }

                        // Handle Swiggy orders
                        else if (source === 'swiggy') {
                            if (!acc['swiggy']) {
                                acc['swiggy'] = [];
                            }
                            acc['swiggy'].push(order);
                        }

                        // Handle other online orders as Default
                        else if (source === 'online' || source === 'default') {
                            if (!acc['default']) {
                                acc['default'] = [];
                            }
                            acc['default'].push(order);
                        }
                    }

                    // If no tableId and no orderSource, put in Default
                    if (!order.tableId && !order.orderSource) {
                        if (!acc['default']) {
                            acc['default'] = [];
                        }
                        acc['default'].push(order);
                    }

                    return acc;
                }, {});

                const tablesWithOrders = combinedTables.map(table => {
                    // Get orders for this table
                    const tableOrdersList = tableOrders[table.id] || [];

                    // Find the oldest order date for color-coding
                    let oldestOrderDate = null;
                    if (tableOrdersList.length > 0) {
                        oldestOrderDate = tableOrdersList
                            .map(o => o.currentStatus?.date)
                            .reduce((a, b) => {
                                const dateA = parseDate(a);
                                const dateB = parseDate(b);
                                return dateA && dateB && dateA < dateB ? a : b;
                            }, tableOrdersList[0].currentStatus?.date);
                    }

                    return {
                        ...table,
                        orders: tableOrdersList,
                        duration: oldestOrderDate ? getTimeDuration(oldestOrderDate) : null
                    };
                });

                setTables(tablesWithOrders);
                setLoading(false);
            } catch (err) {
                console.error('Error fetching table data:', err);
                setError('Failed to load table data');
                setLoading(false);
            }
        }

        fetchData();

        // Set up interval to fetch orders every 30 seconds
        const interval = setInterval(fetchData, 30000);

        // Cleanup interval on component unmount
        return () => clearInterval(interval);
    }, [seller]);

    // Fetch QR orders
    React.useEffect(() => {
        // Initial fetch
        fetchOrders();

        // Set up interval to fetch orders every 30 seconds
        const interval = setInterval(fetchOrders, 30000);

        // Cleanup interval on component unmount
        return () => clearInterval(interval);
    }, []); // Empty dependency array means this runs once on mount

    // Fetch orders based on current filter
    React.useEffect(() => {
        if (showCompletedOrders) {
            fetchCompletedOrders();
        }
    }, [dateFilter, customDateRange, showCompletedOrders]);

    const fetchOrders = async () => {
        try {
            setLoadingQrOrders(true);
            // Fetch last 100 orders to ensure we don't miss any
            const ordersSnapshot = await sdk.collection("Orders")
                .orderBy("date", "desc")
                .limit(100)
                .get();

            const fetchedOrders = ordersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Filter QR orders (orders with status "PLACED")
            const filteredQrOrders = fetchedOrders.filter(order =>
                order.currentStatus?.label === "PLACED"
            );

            setQrOrders(filteredQrOrders);
            setLoadingQrOrders(false);

            // Debug log
            console.log('All orders:', fetchedOrders);
            console.log('QR orders:', filteredQrOrders);
        } catch (err) {
            console.error('Error fetching orders:', err);
            setErrorQrOrders('Failed to fetch orders');
            setLoadingQrOrders(false);
        }
    };

    // Fetch completed orders with date filtering
    const fetchCompletedOrders = async () => {
        try {
            setLoadingCompletedOrders(true);

            // Calculate date range based on selected filter
            const startDate = calculateStartDate(dateFilter, customDateRange.startDate);
            const endDate = calculateEndDate(dateFilter, customDateRange.endDate);

            // Fetch orders
            const ordersSnapshot = await sdk.collection("Orders")
                .orderBy("date", "desc")
                .limit(100)
                .get();

            const fetchedOrders = ordersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Filter by completion status and date range
            const filteredOrders = fetchedOrders.filter(order => {
                // Check if completed
                if (!order.completed) return false;

                // Get order date
                const orderDate = parseDate(order.date);
                if (!orderDate) return false;

                // Check if within date range
                return orderDate >= startDate && orderDate <= endDate;
            });

            setCompletedOrders(filteredOrders);
            setLoadingCompletedOrders(false);
        } catch (err) {
            console.error('Error fetching completed orders:', err);
            setErrorCompletedOrders('Failed to fetch completed orders');
            setLoadingCompletedOrders(false);
        }
    };

    // Handle date range selection for custom filter
    const handleDateRangeSelect = (startDate, endDate) => {
        setCustomDateRange({ startDate, endDate });
        setDateFilter('custom');
    };

    // Add a refresh function
    const refreshOrders = () => {
        fetchOrders();
    };

    // Handle scroll to load more items
    const handleScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target;

        // Check if scrolled to bottom and not already loading
        if (scrollHeight - scrollTop <= clientHeight * 1.2 && !isLoadingMore && qrOrders.length >= loadedItemCount) {
            setIsLoadingMore(true);

            // Increase the limit and fetch more orders
            setLoadedItemCount(prev => prev + 50);

            // Reset loading state after a delay
            setTimeout(() => {
                setIsLoadingMore(false);
            }, 2000);
        }
    };

    // Add order handling functions
    const handleAcceptOrder = async (orderId) => {
        try {
            const orderRef = sdk.collection("Orders").doc(orderId);
            const orderDoc = await orderRef.get();

            if (!orderDoc.exists) {
                throw new Error('Order not found');
            }

            const order = orderDoc.data();

            // Create status entry
            const statusEntry = {
                label: 'processing',
                date: new Date()
            };

            // Update the order status
            await orderRef.update({
                currentStatus: statusEntry,
                status: [...(order.status || []), statusEntry]
            });

            refreshOrders();
        } catch (err) {
            console.error('Error accepting order:', err);
        }
    };

    const handleRejectOrder = async (orderId) => {
        try {
            const orderRef = sdk.collection("Orders").doc(orderId);
            const orderDoc = await orderRef.get();

            if (!orderDoc.exists) {
                throw new Error('Order not found');
            }

            const order = orderDoc.data();

            // Create status entry
            const statusEntry = {
                label: 'cancelled',
                date: new Date()
            };

            // Update the order status
            await orderRef.update({
                currentStatus: statusEntry,
                status: [...(order.status || []), statusEntry]
            });

            refreshOrders();
        } catch (err) {
            console.error('Error rejecting order:', err);
        }
    };

    const handleDeleteOrder = async (orderId) => {
        try {
            if (confirm('Are you sure you want to delete this order?')) {
                await sdk.collection("Orders").doc(orderId).delete();
                refreshOrders();
            }
        } catch (err) {
            console.error('Error deleting order:', err);
        }
    };

    const handlePrintBill = (orderId) => {
        console.log('Print bill for order:', orderId);
        // Implement print bill functionality
    };

    const filteredTables = React.useMemo(() => {
        return tables.filter(table => {
            if (table.type === 'dine_in') return true;
            if (table.type === 'qr' && table.orders.length > 0) return true;
            if (table.type === 'aggregator' && table.orders.length > 0) return true;
            return false;
        });
    }, [tables]);

    // Group dining tables by section
    const groupedDiningTables = React.useMemo(() => {
        return filteredTables.reduce((acc, table) => {
            if (table.type !== 'dine_in') return acc;
            if (!acc[table.section]) {
                acc[table.section] = [];
            }
            acc[table.section].push(table);
            return acc;
        }, {});
    }, [filteredTables]);

    // Render the dashboard
    return (
        <div className="p-4">
            {/* Orders Dashboard */}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center">
                        <i className="ph ph-storefront text-red-500 mr-2"></i>
                        Orders Dashboard
                    </h2>
                    <button
                        onClick={() => setShowCompletedOrders(!showCompletedOrders)}
                        className="px-3 py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-2 shadow-sm"
                    >
                        <i className={`ph ${showCompletedOrders ? 'ph-x' : 'ph-check-circle'}`}></i>
                        <span>{showCompletedOrders ? 'Back to Dashboard' : 'View Completed Orders'}</span>
                    </button>
                </div>
                {!showCompletedOrders && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <DashboardCard
                            icon="ph-chart-line-up"
                            title="Today's Orders"
                            value="25"
                            trend="+15%"
                            color="primary"
                        />
                        <DashboardCard
                            icon="ph-currency-dollar"
                            title="Today's Revenue"
                            value="₹ 12,500"
                            trend="+8%"
                            color="success"
                        />
                        <DashboardCard
                            icon="ph-users"
                            title="New Customers"
                            value="4"
                            trend="-3%"
                            color="warning"
                        />
                    </div>
                )}
            </div>

            {showCompletedOrders ? (
                /* Completed Orders View */
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                            <i className="ph ph-check-circle text-red-500 mr-2"></i>
                            Completed Orders
                        </h2>

                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <select
                                    value={dateFilter}
                                    onChange={(e) => setDateFilter(e.target.value)}
                                    className="appearance-none bg-white border border-gray-300 text-gray-700 py-2 px-4 pr-8 rounded-lg leading-tight focus:outline-none focus:border-red-500"
                                >
                                    <option value="today">Today</option>
                                    <option value="yesterday">Yesterday</option>
                                    <option value="7days">Last 7 Days</option>
                                    <option value="custom">Custom Range</option>
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                                    <i className="ph ph-caret-down"></i>
                                </div>
                            </div>

                            <button
                                className="px-3 py-2 text-red-500 border border-red-500 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-2"
                                onClick={() => fetchCompletedOrders()}
                            >
                                <i className="ph ph-arrows-clockwise"></i>
                                <span>Refresh</span>
                            </button>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-red-100 overflow-hidden" style={{ backgroundColor: "#fff8f8" }}>
                        <div className="p-4 space-y-4">
                            {loadingCompletedOrders ? (
                                <div className="text-center py-10">
                                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-500 mx-auto"></div>
                                    <p className="mt-3 text-gray-600">Loading completed orders...</p>
                                </div>
                            ) : errorCompletedOrders ? (
                                <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-4">
                                    <p>{errorCompletedOrders}</p>
                                </div>
                            ) : completedOrders.length === 0 ? (
                                <div className="text-center py-10">
                                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <i className="ph ph-check-circle text-2xl text-red-500"></i>
                                    </div>
                                    <h3 className="text-lg font-medium text-gray-700 mb-1">No Completed Orders</h3>
                                    <p className="text-gray-500">Completed orders will appear here</p>
                                </div>
                            ) : (
                                completedOrders.map(order => (
                                    <OrderGroupTile
                                        key={order.id}
                                        order={order}
                                        onPrintBill={() => handlePrintBill(order.id)}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                /* Main Dashboard View */
                <>
                    {/* Order Channels Section */}
                    <div className="mb-6 bg-white rounded-xl shadow-sm overflow-hidden border border-red-100" style={{ backgroundColor: "#fff8f8" }}>
                        <div className="px-4 py-3 border-b border-red-50">
                            <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                                <i className="ph ph-globe text-red-500 mr-2"></i>
                                Order Channels
                            </h2>
                        </div>
                        <div className="p-4">
                            {loading ? (
                                <div className="text-center py-10">
                                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-500 mx-auto"></div>
                                    <p className="mt-3 text-gray-600">Loading online orders...</p>
                                </div>
                            ) : error ? (
                                <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-4">
                                    <p>{error}</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {tables
                                        .filter(table => table.type === 'aggregator' || table.type === 'qr')
                                        .map(table => (
                                            <div
                                                key={table.id}
                                                className="cursor-pointer"
                                                onClick={() => handleRoomClick(table.id, table.variant)}
                                            >
                                                <DashboardTile
                                                    tableId={table.id}
                                                    variant={table.variant}
                                                    orders={table.orders}
                                                    onTap={() => handleRoomClick(table.id, table.variant)}
                                                />
                                            </div>
                                        ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Dine-In Section */}
                    <div className="mb-6 bg-white rounded-xl shadow-sm overflow-hidden border border-red-100" style={{ backgroundColor: "#fff8f8" }}>
                        <div className="px-4 py-3 border-b border-red-50 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                                <i className="ph ph-coffee text-red-500 mr-2"></i>
                                Dine In
                            </h2>
                            <button
                                className="px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center gap-1.5 text-sm"
                                onClick={showAddTableModal}
                            >
                                <i className="ph ph-plus"></i>
                                <span>Add Table</span>
                            </button>
                        </div>
                        <div className="p-4">
                            {loading ? (
                                <div className="text-center py-10">
                                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-500 mx-auto"></div>
                                    <p className="mt-3 text-gray-600">Loading tables...</p>
                                </div>
                            ) : error ? (
                                <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-4">
                                    <p>{error}</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {tables
                                        .filter(table => table.type === 'dine_in')
                                        .map(table => (
                                            <div
                                                key={table.id}
                                                className="cursor-pointer"
                                                onClick={() => handleRoomClick(table.id, table.variant)}
                                            >
                                                <TableCard
                                                    title={table.title}
                                                    orders={table.orders}
                                                    duration={table.duration}
                                                    onTap={() => handleRoomClick(table.id, table.variant)}
                                                    onLongPress={() => showRenameRoomModal(table.id, table.variant)}
                                                />
                                            </div>
                                        ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* QR Orders Section */}
                    <div className="mb-6 bg-white rounded-xl shadow-sm overflow-hidden border border-red-100" style={{ backgroundColor: "#fff8f8" }}>
                        <div className="px-4 py-3 border-b border-red-50 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                                <i className="ph ph-qr-code text-red-500 mr-2"></i>
                                QR Orders
                            </h2>
                            <button
                                className="px-3 py-1.5 text-red-500 border border-red-500 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-1.5 text-sm"
                                onClick={refreshOrders}
                            >
                                <i className="ph ph-arrows-clockwise"></i>
                                <span>Refresh</span>
                            </button>
                        </div>
                        <div className="p-4" ref={qrOrdersScrollRef} onScroll={handleScroll}>
                            {loadingQrOrders ? (
                                <div className="text-center py-10">
                                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-500 mx-auto"></div>
                                    <p className="mt-3 text-gray-600">Loading QR orders...</p>
                                </div>
                            ) : errorQrOrders ? (
                                <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-4">
                                    <p>{errorQrOrders}</p>
                                </div>
                            ) : qrOrders.length === 0 ? (
                                <div className="text-center py-10">
                                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <i className="ph ph-qr-code text-2xl text-red-500"></i>
                                    </div>
                                    <h3 className="text-lg font-medium text-gray-700 mb-1">No QR Orders Found</h3>
                                    <p className="text-gray-500">QR orders from your customers will appear here</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {qrOrders.map(order => (
                                        <OrderGroupTile
                                            key={order.id}
                                            order={order}
                                            onAccept={() => handleAcceptOrder(order.id)}
                                            onReject={() => handleRejectOrder(order.id)}
                                            onDelete={() => handleDeleteOrder(order.id)}
                                            onPrintBill={() => handlePrintBill(order.id)}
                                        />
                                    ))}

                                    {isLoadingMore && (
                                        <div className="text-center py-4">
                                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-500 mx-auto"></div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* Modals */}
            <AddTableModal
                isOpen={isAddTableModalOpen}
                onClose={() => setIsAddTableModalOpen(false)}
                seller={seller}
            />

            <RenameRoomModal
                isOpen={isRenameRoomModalOpen}
                onClose={() => setIsRenameRoomModalOpen(false)}
                tableId={selectedTableId}
                variant={selectedVariant}
                seller={seller}
            />

            <OrderRoom
                isOpen={isOrderRoomOpen}
                onClose={() => setIsOrderRoomOpen(false)}
                tableId={selectedRoomTableId}
                variant={selectedRoomVariant}
                seller={seller}
            />
        </div>
    );
} 