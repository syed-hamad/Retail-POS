// Dashboard Component
function Dashboard() {
    const { profile: seller, tables: profileTables } = window.useProfile ? window.useProfile() : { profile: null, tables: [] };
    const [tables, setTables] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [isProfileOpen, setIsProfileOpen] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState('dashboard'); // Default to Dashboard tab
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
        fetchCompletedOrders();
    }, [dateFilter, customDateRange]);

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

    if (loading) {
        return (
            <div className="p-4 text-center">
                <div className="animate-spin inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 text-center text-red-600">{error}</div>
        );
    }

    return (
        <div className="flex flex-col h-screen">
            {/* Header with tabs */}
            <div className="bg-white border-b">
                <div className="flex items-center px-2">
                    <button
                        onClick={() => setIsProfileOpen(true)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-full"
                    >
                        <i className="ph ph-list text-xl"></i>
                    </button>

                    <div className="flex-1 overflow-x-auto py-2 px-2">
                        <div className="flex space-x-2">
                            <button
                                onClick={() => setActiveTab('qr_orders')}
                                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === 'qr_orders'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                            >
                                <i className="ph ph-sparkle text-lg"></i>
                                QR Orders
                            </button>
                            <button
                                onClick={() => setActiveTab('dashboard')}
                                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === 'dashboard'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                            >
                                <i className="ph ph-bowl-food text-lg"></i>
                                Dashboard
                            </button>
                            <button
                                onClick={() => setActiveTab('completed')}
                                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === 'completed'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                            >
                                <i className="ph ph-check-circle text-lg"></i>
                                Completed
                            </button>
                        </div>
                    </div>

                    <button
                        className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden hover:bg-gray-200 transition-colors border border-gray-200"
                        onClick={() => setIsProfileOpen(true)}
                    >
                        {seller?.avatar ? (
                            <img
                                src={seller.avatar}
                                alt={seller?.businessName}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <i className="ph ph-storefront text-xl text-gray-400" />
                        )}
                    </button>
                </div>
            </div>

            {/* Profile Menu */}
            {window.ProfileMenu && (
                <window.ProfileMenu
                    seller={seller}
                    isOpen={isProfileOpen}
                    onClose={() => setIsProfileOpen(false)}
                />
            )}

            {/* Add Table Modal */}
            {window.AddTableModal && (
                <window.AddTableModal
                    isOpen={isAddTableModalOpen}
                    onClose={() => setIsAddTableModalOpen(false)}
                    seller={seller}
                />
            )}

            {/* Rename Room Modal */}
            {window.RenameRoomModal && (
                <window.RenameRoomModal
                    isOpen={isRenameRoomModalOpen}
                    onClose={() => setIsRenameRoomModalOpen(false)}
                    tableId={selectedTableId}
                    variant={selectedVariant}
                    seller={seller}
                />
            )}

            {/* OrderRoom Modal */}
            {window.OrderRoom && (
                <window.OrderRoom
                    isOpen={isOrderRoomOpen}
                    onClose={() => setIsOrderRoomOpen(false)}
                    tableId={selectedRoomTableId}
                    variant={selectedRoomVariant}
                    seller={seller}
                />
            )}

            {/* Content based on active tab */}
            <div className="flex-1 overflow-hidden">
                {activeTab === 'qr_orders' && (
                    <div
                        className="h-full overflow-y-auto px-4 py-2"
                        onScroll={handleScroll}
                        ref={qrOrdersScrollRef}
                    >
                        {loadingQrOrders ? (
                            <div className="p-4 text-center">
                                <div className="animate-spin inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
                            </div>
                        ) : errorQrOrders ? (
                            <div className="p-4 text-center text-red-600">{errorQrOrders}</div>
                        ) : qrOrders.length === 0 ? (
                            <NoOrdersFound />
                        ) : (
                            <div>
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
                                    <div className="p-4 text-center">
                                        <div className="animate-spin inline-block w-6 h-6 border-3 border-primary border-t-transparent rounded-full" />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'dashboard' && (
                    <div className="h-full overflow-y-auto px-4 py-4">
                        <div className="mb-6">
                            <h2 className="text-xl font-bold mb-4">Orders Dashboard</h2>
                            <div className="grid grid-cols-2 gap-4">
                                {['Default', ...(seller?.priceVariants?.map(v => v.title) || [])].map(variant => (
                                    <DashboardTile
                                        key={variant}
                                        variant={variant}
                                        orders={tables
                                            .flatMap(t => t.orders)
                                            .filter(o => o.priceVariant === variant)
                                        }
                                        onTap={() => handleRoomClick(null, variant)}
                                        onLongPress={() => showRenameRoomModal(null, variant)}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Dine In Tables */}
                        <div className="mb-4">
                            <h2 className="text-xl font-bold mb-4">Dine In</h2>
                            {tables.filter(t => t.type === 'dine_in').length === 0 ? (
                                <NoOrdersFound />
                            ) : (
                                <div className="grid grid-cols-3 gap-4 mb-6">
                                    {tables
                                        .filter(t => t.type === 'dine_in')
                                        .map(table => (
                                            <TableCard
                                                key={table.id}
                                                title={table.title}
                                                orders={table.orders}
                                                duration={table.duration}
                                                onTap={() => handleRoomClick(table.title, null)}
                                                onLongPress={() => showRenameRoomModal(table.title, null)}
                                            />
                                        ))
                                    }
                                </div>
                            )}
                        </div>

                        {/* Add Table Button */}
                        <div className="flex justify-center mt-6">
                            <button
                                className="px-6 py-2 border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-2"
                                onClick={showAddTableModal}
                            >
                                <i className="ph ph-plus"></i>
                                <span>New Table</span>
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'completed' && (
                    <div className="h-full flex flex-col overflow-hidden">
                        {/* Date filter tabs */}
                        <div className="border-b">
                            <div className="flex overflow-x-auto px-2">
                                <button
                                    onClick={() => setDateFilter('today')}
                                    className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${dateFilter === 'today'
                                        ? 'border-blue-600 text-blue-600'
                                        : 'border-transparent text-gray-600 hover:text-gray-800'
                                        }`}
                                >
                                    Today
                                </button>
                                <button
                                    onClick={() => setDateFilter('yesterday')}
                                    className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${dateFilter === 'yesterday'
                                        ? 'border-blue-600 text-blue-600'
                                        : 'border-transparent text-gray-600 hover:text-gray-800'
                                        }`}
                                >
                                    Yesterday
                                </button>
                                <button
                                    onClick={() => setDateFilter('7days')}
                                    className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${dateFilter === '7days'
                                        ? 'border-blue-600 text-blue-600'
                                        : 'border-transparent text-gray-600 hover:text-gray-800'
                                        }`}
                                >
                                    7 Days
                                </button>
                                <button
                                    onClick={() => {
                                        setDateFilter('custom');
                                        // If no custom date range is set, initialize with today
                                        if (!customDateRange.startDate) {
                                            const today = new Date();
                                            setCustomDateRange({
                                                startDate: today,
                                                endDate: today
                                            });
                                        }
                                    }}
                                    className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${dateFilter === 'custom'
                                        ? 'border-blue-600 text-blue-600'
                                        : 'border-transparent text-gray-600 hover:text-gray-800'
                                        }`}
                                >
                                    Custom
                                </button>
                            </div>
                        </div>

                        {/* Custom date range selector */}
                        {dateFilter === 'custom' && (
                            <div className="bg-gray-50 p-4 flex flex-wrap items-center gap-4">
                                <div>
                                    <label className="block text-sm text-gray-600 mb-1">Start Date</label>
                                    <input
                                        type="date"
                                        className="px-3 py-2 border rounded-lg"
                                        value={customDateRange.startDate ? formatDate(customDateRange.startDate, 'short') : ''}
                                        onChange={(e) => {
                                            const date = parseDate(e.target.value);
                                            setCustomDateRange(prev => ({
                                                ...prev,
                                                startDate: date
                                            }));
                                        }}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-600 mb-1">End Date</label>
                                    <input
                                        type="date"
                                        className="px-3 py-2 border rounded-lg"
                                        value={customDateRange.endDate ? formatDate(customDateRange.endDate, 'short') : ''}
                                        onChange={(e) => {
                                            const date = parseDate(e.target.value);
                                            setCustomDateRange(prev => ({
                                                ...prev,
                                                endDate: date
                                            }));
                                        }}
                                    />
                                </div>
                                <div className="flex-1"></div>
                                <button
                                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                                    onClick={() => fetchCompletedOrders()}
                                >
                                    Apply
                                </button>
                            </div>
                        )}

                        {/* Orders list */}
                        <div className="flex-1 overflow-y-auto px-4 py-2">
                            {loadingCompletedOrders ? (
                                <div className="p-4 text-center">
                                    <div className="animate-spin inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
                                </div>
                            ) : errorCompletedOrders ? (
                                <div className="p-4 text-center text-red-600">{errorCompletedOrders}</div>
                            ) : completedOrders.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20">
                                    <i className="ph ph-inbox text-5xl text-gray-300 mb-5"></i>
                                    <p className="text-xl text-gray-500 text-center">
                                        No orders found for the selected date range.
                                    </p>
                                    {dateFilter === 'custom' && (
                                        <button
                                            className="mt-6 px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                                            onClick={() => {
                                                // Reset custom date range to today
                                                const today = new Date();
                                                setCustomDateRange({
                                                    startDate: today,
                                                    endDate: today
                                                });
                                            }}
                                        >
                                            Change Date
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div>
                                    {completedOrders.map(order => (
                                        <OrderGroupTile
                                            key={order.id}
                                            order={order}
                                            onDelete={() => handleDeleteOrder(order.id)}
                                            onPrintBill={() => handlePrintBill(order.id)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
} 