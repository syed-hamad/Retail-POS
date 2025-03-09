// Dashboard Component
function Dashboard({ seller }) {
    const [tables, setTables] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [isProfileOpen, setIsProfileOpen] = React.useState(false);
    const [activeHomeTab, setActiveHomeTab] = React.useState('qr_orders'); // Default to QR Orders tab
    const [isCompletedOrdersOpen, setIsCompletedOrdersOpen] = React.useState(false);
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
            await sdk.sellers.update(seller.id, {
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

    // Handle room click
    const handleRoomClick = (tableId, variant) => {
        pp(`Room clicked: ${tableId || variant}`);
        // In a real implementation, this would navigate to the room details page
    };

    // Completed Orders Side Panel
    const CompletedOrdersPanel = ({ isOpen, onClose }) => {
        if (!isOpen) return null;

        return (
            <div className="fixed inset-0 z-50 bg-black bg-opacity-50" onClick={onClose}>
                <div className="absolute right-0 top-0 h-full w-96 bg-white shadow-lg overflow-y-auto" onClick={e => e.stopPropagation()}>
                    <div className="p-6">
                        {/* Profile Header */}
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border-2 border-gray-200">
                                {seller?.avatar ? (
                                    <img src={seller.avatar} alt={seller?.businessName} className="w-full h-full object-cover" />
                                ) : (
                                    <i className="ph ph-storefront text-4xl text-gray-400" />
                                )}
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-medium text-gray-900">
                                    {seller?.businessName || 'Loading...'}
                                </h3>
                                {seller?.phone && (
                                    <p className="text-sm text-gray-500">{seller.phone}</p>
                                )}
                            </div>
                            <button className="p-2 hover:bg-gray-100 rounded-full" onClick={onClose}>
                                <i className="ph ph-x text-xl text-gray-600" />
                            </button>
                        </div>

                        {/* Profile Details */}
                        <div className="space-y-4">
                            {seller?.address && (
                                <div className="flex items-start gap-3">
                                    <i className="ph ph-map-pin text-gray-400" />
                                    <p className="text-sm text-gray-600">{seller.address}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    React.useEffect(() => {
        async function fetchData() {
            try {
                const allOrders = await sdk.orders.list(100);

                // Filter orders by date - only show orders from the last 7 days
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

                // Filter orders by date and completion status
                const recentOrders = allOrders.filter(order => {
                    // Get the order date
                    const orderDate = order.date ?
                        (order.date.toDate ? order.date.toDate() : new Date(order.date)) :
                        null;

                    // If no date, skip this order
                    if (!orderDate) return false;

                    // Check if the order is from the last 7 days
                    return orderDate >= sevenDaysAgo;
                });

                pp('All orders:', allOrders.length);
                pp('Recent orders (last 7 days):', recentOrders.length);

                const activeOrders = recentOrders.filter(order => !order.completed);
                const completed = recentOrders.filter(order => order.completed);

                pp('Active orders:', activeOrders.length);
                pp('Completed orders:', completed.length);

                setCompletedOrders(completed);

                // Get kitchen orders (orders with KITCHEN status)
                const kitchenOrders = activeOrders.filter(order => {
                    // Check if the order has a currentStatus property
                    if (!order.currentStatus || !order.currentStatus.label) {
                        return false;
                    }

                    // Check if the status is KITCHEN
                    return order.currentStatus.label === 'KITCHEN';
                });

                // Group orders by table ID and also by order source for aggregators
                // Only include KITCHEN status orders in the dashboard
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

                const tablesWithOrders = combinedTables.map(table => {
                    // Get orders for this table
                    const tableOrdersList = tableOrders[table.id] || [];

                    // Find the oldest order date for color-coding
                    let oldestOrderDate = null;
                    if (tableOrdersList.length > 0) {
                        oldestOrderDate = tableOrdersList
                            .map(o => o.currentStatus?.date)
                            .reduce((a, b) => new Date(a) < new Date(b) ? a : b, tableOrdersList[0].currentStatus?.date);
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
    }, [seller]);

    // Fetch QR Orders (PLACED status from last 7 days)
    React.useEffect(() => {
        async function fetchQrOrders() {
            setLoadingQrOrders(true);
            try {
                // Calculate date range for last 7 days
                const now = new Date();
                const startDate = new Date(now);
                startDate.setDate(now.getDate() - 6); // Last 7 days (including today)
                startDate.setHours(0, 0, 0, 0); // Start of the day

                // For now, we'll use the SDK's mock data
                const allOrders = await sdk.orders.list(loadedItemCount);

                // Filter orders by status and date
                const placedOrders = allOrders.filter(order => {
                    const orderDate = order.date?.toDate ? order.date.toDate() : new Date(order.date);
                    return order.currentStatus?.label === "PLACED" &&
                        orderDate >= startDate &&
                        orderDate <= now;
                });

                // Sort by date (newest first)
                placedOrders.sort((a, b) => {
                    const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
                    const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
                    return dateB - dateA;
                });

                setQrOrders(placedOrders);
                setLoadingQrOrders(false);
            } catch (err) {
                console.error('Error fetching QR orders:', err);
                setErrorQrOrders('Failed to load QR orders');
                setLoadingQrOrders(false);
            }
        }

        if (activeHomeTab === 'qr_orders') {
            fetchQrOrders();
        }
    }, [activeHomeTab, loadedItemCount]);

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

    const filteredTables = React.useMemo(() => {
        switch (activeHomeTab) {
            case 'dining':
                return tables.filter(table => table.type === 'dine_in');
            case 'qr':
                return tables.filter(table => table.type === 'qr');
            case 'delivery':
                return tables.filter(table => table.type === 'aggregator');
            default:
                return tables;
        }
    }, [tables, activeHomeTab]);

    // Group dining tables by section
    const groupedDiningTables = React.useMemo(() => {
        if (activeHomeTab !== 'dining') return null;
        return filteredTables.reduce((acc, table) => {
            if (!acc[table.section]) {
                acc[table.section] = [];
            }
            acc[table.section].push(table);
            return acc;
        }, {});
    }, [filteredTables, activeHomeTab]);

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
        <div className="p-4">
            {/* Header with tabs */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setActiveHomeTab('qr_orders')}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${activeHomeTab === 'qr_orders' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                        <i className="ph ph-qr-code text-lg" />
                        QR Orders
                    </button>
                    <button
                        onClick={() => setActiveHomeTab('dashboard')}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${activeHomeTab === 'dashboard' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                        <i className="ph ph-layout-dashboard text-lg" />
                        Dashboard
                    </button>
                </div>
                <button
                    onClick={() => setIsCompletedOrdersOpen(true)}
                    className="px-3 py-1.5 text-sm text-gray-600 hover:text-blue-600 flex items-center gap-1.5"
                >
                    <i className="ph ph-check-circle text-lg" />
                    {`${completedOrders.length}`}
                </button>
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

            {/* Profile Menu */}
            <ProfileMenu
                seller={seller}
                isOpen={isProfileOpen}
                onClose={() => setIsProfileOpen(false)}
            />

            {/* Completed Orders Panel */}
            <CompletedOrdersPanel
                isOpen={isCompletedOrdersOpen}
                onClose={() => setIsCompletedOrdersOpen(false)}
            />

            {/* Add Table Modal */}
            <AddTableModal
                isOpen={isAddTableModalOpen}
                onClose={() => setIsAddTableModalOpen(false)}
                seller={seller}
            />

            {/* Rename Room Modal */}
            <RenameRoomModal
                isOpen={isRenameRoomModalOpen}
                onClose={() => setIsRenameRoomModalOpen(false)}
                tableId={selectedTableId}
                variant={selectedVariant}
                seller={seller}
            />

            {/* Content based on active tab */}
            {activeHomeTab === 'qr_orders' ? (
                <div
                    className="overflow-y-auto px-2"
                    style={{ maxHeight: 'calc(100vh - 150px)' }}
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
                                <OrderGroupTile key={order.id} order={order} />
                            ))}
                            {isLoadingMore && (
                                <div className="p-4 text-center">
                                    <div className="animate-spin inline-block w-6 h-6 border-3 border-primary border-t-transparent rounded-full" />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                <div className="overflow-y-auto px-2" style={{ maxHeight: 'calc(100vh - 150px)' }}>
                    <div className="py-4">
                        {/* Orders Dashboard - Price Variants */}
                        <div className="mb-6">
                            <div className="grid grid-cols-2 gap-4">
                                {['Default', ...(seller?.priceVariants?.map(v => v.title) || [])].map(variant => (
                                    <DashboardTile
                                        key={variant}
                                        variant={variant}
                                        orders={tables
                                            .filter(t => t.type === 'dine_in')
                                            .flatMap(t => t.orders)
                                            .filter(o => o.priceVariant === variant && o.currentStatus?.label === 'KITCHEN')
                                        }
                                        onTap={() => handleRoomClick(null, variant)}
                                        onLongPress={() => showRenameRoomModal(null, variant)}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Dine In Tables */}
                        <h2 className="text-2xl font-bold mb-4">Dine In</h2>
                        {tables.filter(t => t.type === 'dine_in').length === 0 ? (
                            <div className="opacity-30 py-8 flex flex-col items-center justify-center">
                                <i className="ph ph-table text-5xl text-blue-800 mb-4"></i>
                                <p className="text-xl font-bold text-blue-800">No tables added yet</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 gap-4 mb-6">
                                {tables
                                    .filter(t => t.type === 'dine_in')
                                    .map(table => (
                                        <DashboardTile
                                            key={table.id}
                                            tableId={table.title}
                                            orders={table.orders.filter(o => o.currentStatus?.label === 'KITCHEN')}
                                            onTap={() => handleRoomClick(table.title, null)}
                                            onLongPress={() => showRenameRoomModal(table.title, null)}
                                        />
                                    ))
                                }
                            </div>
                        )}

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
                </div>
            )}
        </div>
    );
} 