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
    const [dashboardMetrics, setDashboardMetrics] = React.useState({
        todayOrders: 0,
        todayRevenue: 0,
        newCustomers: 0,
        avgOrderValue: 0,
        avgServiceTime: 0,
        todayOrdersTrend: 0,
        todayRevenueTrend: 0,
        newCustomersTrend: 0,
        avgOrderValueTrend: 0,
        avgServiceTimeTrend: 0
    });

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

    // Calculate dashboard metrics from orders data
    const calculateDashboardMetrics = (allOrders) => {
        try {
            // Create date objects for today and yesterday
            const now = new Date();
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);

            // Filter orders for today and yesterday
            const todayOrders = allOrders.filter(order => {
                const orderDate = parseDate(order.date);
                return orderDate && orderDate >= startOfToday;
            });

            const yesterdayOrders = allOrders.filter(order => {
                const orderDate = parseDate(order.date);
                return orderDate && orderDate >= startOfYesterday && orderDate < startOfToday;
            });

            // Calculate today's metrics
            const todayOrdersCount = todayOrders.length;

            // Calculate revenue (only from paid orders)
            const todayRevenue = todayOrders
                .filter(order => order.paid === true)
                .reduce((sum, order) => {
                    // Calculate total from items
                    const itemsTotal = order.items?.reduce((total, item) => {
                        return total + ((item.price || 0) * (item.quantity || item.qnt || 1));
                    }, 0) || 0;

                    return sum + itemsTotal;
                }, 0);

            // Calculate yesterday's metrics for trend comparison
            const yesterdayOrdersCount = yesterdayOrders.length;
            const yesterdayRevenue = yesterdayOrders
                .filter(order => order.paid === true)
                .reduce((sum, order) => {
                    const itemsTotal = order.items?.reduce((total, item) => {
                        return total + ((item.price || 0) * (item.quantity || item.qnt || 1));
                    }, 0) || 0;

                    return sum + itemsTotal;
                }, 0);

            // Get unique customer count for today
            const todayCustomerIds = new Set(todayOrders
                .filter(order => order.customer?.id)
                .map(order => order.customer.id));
            const newCustomersCount = todayCustomerIds.size;

            // Yesterday's unique customers
            const yesterdayCustomerIds = new Set(yesterdayOrders
                .filter(order => order.customer?.id)
                .map(order => order.customer.id));
            const yesterdayNewCustomersCount = yesterdayCustomerIds.size;

            // Calculate average order value for today's paid orders
            const paidTodayOrders = todayOrders.filter(order => order.paid === true);
            const avgOrderValue = paidTodayOrders.length > 0
                ? todayRevenue / paidTodayOrders.length
                : 0;

            // Calculate avg order value for yesterday
            const paidYesterdayOrders = yesterdayOrders.filter(order => order.paid === true);
            const yesterdayAvgOrderValue = paidYesterdayOrders.length > 0
                ? yesterdayRevenue / paidYesterdayOrders.length
                : 1; // Avoid division by zero in trend calculation

            // Calculate service time (from PLACED to COMPLETED)
            let totalServiceTimeMinutes = 0;
            let serviceTimeOrderCount = 0;

            todayOrders.forEach(order => {
                if (order.status && Array.isArray(order.status)) {
                    const placedStatus = order.status.find(s => s.label === "PLACED");
                    const completedStatus = order.status.find(s => s.label === "COMPLETED");

                    if (placedStatus && completedStatus) {
                        const placedDate = parseDate(placedStatus.date);
                        const completedDate = parseDate(completedStatus.date);

                        if (placedDate && completedDate) {
                            const serviceTimeMinutes = (completedDate - placedDate) / (1000 * 60);
                            totalServiceTimeMinutes += serviceTimeMinutes;
                            serviceTimeOrderCount++;
                        }
                    }
                }
            });

            const avgServiceTime = serviceTimeOrderCount > 0
                ? totalServiceTimeMinutes / serviceTimeOrderCount
                : 0;

            // Calculate trends (percentage change from yesterday)
            const calculateTrend = (today, yesterday) => {
                if (yesterday === 0) return today > 0 ? 100 : 0;
                return ((today - yesterday) / yesterday) * 100;
            };

            const todayOrdersTrend = calculateTrend(todayOrdersCount, yesterdayOrdersCount);
            const todayRevenueTrend = calculateTrend(todayRevenue, yesterdayRevenue);
            const newCustomersTrend = calculateTrend(newCustomersCount, yesterdayNewCustomersCount);
            const avgOrderValueTrend = calculateTrend(avgOrderValue, yesterdayAvgOrderValue);

            // For service time, a negative trend is actually good (faster service)
            let avgServiceTimeTrend = 0;

            // Calculate yesterday's average service time
            let yesterdayTotalServiceTimeMinutes = 0;
            let yesterdayServiceTimeOrderCount = 0;

            yesterdayOrders.forEach(order => {
                if (order.status && Array.isArray(order.status)) {
                    const placedStatus = order.status.find(s => s.label === "PLACED");
                    const completedStatus = order.status.find(s => s.label === "COMPLETED");

                    if (placedStatus && completedStatus) {
                        const placedDate = parseDate(placedStatus.date);
                        const completedDate = parseDate(completedStatus.date);

                        if (placedDate && completedDate) {
                            const serviceTimeMinutes = (completedDate - placedDate) / (1000 * 60);
                            yesterdayTotalServiceTimeMinutes += serviceTimeMinutes;
                            yesterdayServiceTimeOrderCount++;
                        }
                    }
                }
            });

            const yesterdayAvgServiceTime = yesterdayServiceTimeOrderCount > 0
                ? yesterdayTotalServiceTimeMinutes / yesterdayServiceTimeOrderCount
                : 1; // Avoid division by zero

            // For service time, a negative trend is actually good (faster service)
            avgServiceTimeTrend = calculateTrend(avgServiceTime, yesterdayAvgServiceTime) * -1;

            return {
                todayOrders: todayOrdersCount,
                todayRevenue: todayRevenue,
                newCustomers: newCustomersCount,
                avgOrderValue: avgOrderValue,
                avgServiceTime: avgServiceTime,
                todayOrdersTrend: todayOrdersTrend,
                todayRevenueTrend: todayRevenueTrend,
                newCustomersTrend: newCustomersTrend,
                avgOrderValueTrend: avgOrderValueTrend,
                avgServiceTimeTrend: avgServiceTimeTrend
            };
        } catch (err) {
            console.error('Error calculating dashboard metrics:', err);
            return {
                todayOrders: 0,
                todayRevenue: 0,
                newCustomers: 0,
                avgOrderValue: 0,
                avgServiceTime: 0,
                todayOrdersTrend: 0,
                todayRevenueTrend: 0,
                newCustomersTrend: 0,
                avgOrderValueTrend: 0,
                avgServiceTimeTrend: 0
            };
        }
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

                // Calculate dashboard metrics
                const metrics = calculateDashboardMetrics(allOrders);
                setDashboardMetrics(metrics);

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

                // Get price variants to add as pseudo-tables for the Order Channels section
                // This follows the Flutter code's ordersDash() function
                const priceVariants = (seller?.priceVariants || [])
                    .map(v => v.title)
                    .filter(Boolean);

                // Add default variants for aggregators if they don't exist
                // Always add the default variant as first item, like in the Flutter code
                const defaultAggregators = [
                    { id: 'default', title: 'Default', type: 'qr' },
                    ...priceVariants.filter(v => v !== 'Default').map(v => ({
                        id: v,
                        title: v,
                        type: 'price_variant'
                    })),
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

                // Process each order to ensure it has the orderSource property
                // This mimics the getter in the MOrder class of Flutter
                kitchenOrders.forEach(order => {
                    order.orderSource = order.priceVariant || order.tableId;
                });

                // Group orders by table ID and variant/orderSource to match Flutter behavior
                const tableOrders = kitchenOrders.reduce((acc, order) => {
                    // First, handle regular table assignments
                    if (order.tableId) {
                        if (!acc[order.tableId]) {
                            acc[order.tableId] = [];
                        }
                        acc[order.tableId].push(order);
                    }

                    // Handle price variants exactly like in Flutter
                    if (order.priceVariant) {
                        if (!acc[order.priceVariant]) {
                            acc[order.priceVariant] = [];
                        }
                        acc[order.priceVariant].push(order);
                    } else if (!order.tableId) {
                        // No priceVariant and no tableId means it's a Default order
                        if (!acc['default']) {
                            acc['default'] = [];
                        }
                        acc['default'].push(order);
                    }

                    // Special handling for Zomato & Swiggy orders
                    if (order.orderSource === 'zomato') {
                        if (!acc['zomato']) {
                            acc['zomato'] = [];
                        }
                        acc['zomato'].push(order);
                    } else if (order.orderSource === 'swiggy') {
                        if (!acc['swiggy']) {
                            acc['swiggy'] = [];
                        }
                        acc['swiggy'].push(order);
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
            setErrorQrOrders(null);

            // Create a query for the Orders collection
            const ordersQuery = window.sdk.collection("Orders")
                .orderBy("date", "desc")
                .limit(100);

            // Execute the query
            const ordersSnapshot = await ordersQuery.get();

            if (!ordersSnapshot || !ordersSnapshot.docs) {
                throw new Error("Failed to fetch orders data");
            }

            const fetchedOrders = ordersSnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    // Ensure date is properly handled
                    date: parseDate(data.date)
                };
            });

            // Store all orders for metrics calculations 
            setOrders(fetchedOrders);

            // Filter QR orders (orders with status "PLACED")
            const filteredQrOrders = fetchedOrders.filter(order => {
                return order.currentStatus?.label === "PLACED";
            });

            setQrOrders(filteredQrOrders);
            setLoadingQrOrders(false);

            // Log order counts for debugging
            console.log(`Fetched ${fetchedOrders.length} orders, ${filteredQrOrders.length} pending QR orders`);

            return fetchedOrders;
        } catch (err) {
            console.error('Error fetching orders:', err);
            setErrorQrOrders(`Failed to fetch orders: ${err.message}`);
            setLoadingQrOrders(false);
            return [];
        }
    };

    // Fetch completed orders with date filtering
    const fetchCompletedOrders = async () => {
        try {
            setLoadingCompletedOrders(true);
            setErrorCompletedOrders(null);

            // Calculate date range based on selected filter
            const startDate = calculateStartDate(dateFilter, customDateRange.startDate);
            const endDate = calculateEndDate(dateFilter, customDateRange.endDate);

            // Create the query - we can't filter by date range directly in Firestore
            // because the dates might be in different formats, so we fetch and filter client-side
            const ordersQuery = window.sdk.collection("Orders")
                .orderBy("date", "desc")
                .limit(100);

            const ordersSnapshot = await ordersQuery.get();

            if (!ordersSnapshot || !ordersSnapshot.docs) {
                throw new Error("Failed to fetch completed orders data");
            }

            const fetchedOrders = ordersSnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    // Ensure date is properly handled
                    date: parseDate(data.date)
                };
            });

            // Filter by completion status and date range
            const filteredOrders = fetchedOrders.filter(order => {
                // Check if completed or paid
                const isCompleted = order.currentStatus?.label === "COMPLETED" || order.paid === true;
                if (!isCompleted) return false;

                // Get order date
                const orderDate = order.date;
                if (!orderDate) return false;

                // Check if within date range
                return orderDate >= startDate && orderDate <= endDate;
            });

            // Sort by date descending (newest first)
            filteredOrders.sort((a, b) => {
                const dateA = a.date;
                const dateB = b.date;
                return dateB - dateA;
            });

            setCompletedOrders(filteredOrders);
            setLoadingCompletedOrders(false);

            console.log(`Fetched ${fetchedOrders.length} orders, ${filteredOrders.length} completed in selected date range`);
        } catch (err) {
            console.error('Error fetching completed orders:', err);
            setErrorCompletedOrders(`Failed to fetch completed orders: ${err.message}`);
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
            setLoadingQrOrders(true);

            const orderRef = window.sdk.collection("Orders").doc(orderId);
            const orderDoc = await orderRef.get();

            if (!orderDoc.exists) {
                throw new Error('Order not found');
            }

            const order = orderDoc.data();

            // Create status entry for processing
            const statusEntry = {
                label: 'PROCESSING',
                date: new Date()
            };

            // Update the order status
            await orderRef.update({
                currentStatus: statusEntry,
                status: [...(order.status || []), statusEntry]
            });

            // Show success message
            showToast("Order accepted successfully");

            // Refresh orders data
            await fetchOrders();

        } catch (err) {
            console.error('Error accepting order:', err);
            showToast(`Failed to accept order: ${err.message}`, "error");
        } finally {
            setLoadingQrOrders(false);
        }
    };

    const handleRejectOrder = async (orderId) => {
        try {
            setLoadingQrOrders(true);

            const orderRef = window.sdk.collection("Orders").doc(orderId);
            const orderDoc = await orderRef.get();

            if (!orderDoc.exists) {
                throw new Error('Order not found');
            }

            const order = orderDoc.data();

            // Create status entry for rejected
            const statusEntry = {
                label: 'CANCELLED',
                date: new Date()
            };

            // Update the order status
            await orderRef.update({
                currentStatus: statusEntry,
                status: [...(order.status || []), statusEntry]
            });

            // Show success message
            showToast("Order rejected successfully");

            // Refresh orders data
            await fetchOrders();

        } catch (err) {
            console.error('Error rejecting order:', err);
            showToast(`Failed to reject order: ${err.message}`, "error");
        } finally {
            setLoadingQrOrders(false);
        }
    };

    const handleDeleteOrder = async (orderId) => {
        try {
            if (!confirm('Are you sure you want to delete this order?')) {
                return;
            }

            setLoadingQrOrders(true);

            // Delete the order from Firestore
            await window.sdk.collection("Orders").doc(orderId).delete();

            // Show success message
            showToast("Order deleted successfully");

            // Refresh orders data
            await fetchOrders();

        } catch (err) {
            console.error('Error deleting order:', err);
            showToast(`Failed to delete order: ${err.message}`, "error");
        } finally {
            setLoadingQrOrders(false);
        }
    };

    const handlePrintBill = async (orderId) => {
        try {
            const orderRef = window.sdk.collection("Orders").doc(orderId);
            const orderDoc = await orderRef.get();

            if (!orderDoc.exists) {
                throw new Error('Order not found');
            }

            // Check if bill printing is available in SDK
            if (window.sdk.bill && typeof window.sdk.bill.print === 'function') {
                await window.sdk.bill.print(orderId);
                showToast("Bill printed successfully");
            } else if (window.sdk.kot && typeof window.sdk.kot.print === 'function') {
                // Fallback to KOT printing if bill printing is not available
                await window.sdk.kot.print(orderId);
                showToast("KOT printed successfully");
            } else {
                // Fallback for development/testing
                console.log('Print bill for order:', orderId);
                showToast("Print simulation: Bill printed successfully");
            }
        } catch (err) {
            console.error('Error printing bill:', err);
            showToast(`Failed to print bill: ${err.message}`, "error");
        }
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

    // Format a number with commas
    const formatNumber = (num) => {
        return num.toLocaleString('en-IN');
    };

    // Format a currency value
    const formatCurrency = (amount) => {
        return '₹ ' + amount.toLocaleString('en-IN', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
    };

    // Render the dashboard
    return (
        <div className="pb-24 md:pb-4 px-4 mt-4">
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
                                    className="appearance-none bg-gradient-to-r from-white to-gray-50 border border-gray-200 text-gray-700 py-1.5 px-4 pr-8 rounded-lg leading-tight focus:outline-none focus:border-red-500 text-sm"
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
                                className="px-2 py-1.5 text-red-500 border border-gray-200 bg-gradient-to-r from-white to-gray-50 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-1.5 text-sm"
                                onClick={() => fetchCompletedOrders()}
                            >
                                <i className="ph ph-arrows-clockwise"></i>
                                <span>Refresh</span>
                            </button>

                            <button
                                onClick={() => setShowCompletedOrders(false)}
                                className="px-2 py-1.5 bg-gradient-to-r from-white to-gray-50 border border-gray-200 text-red-500 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-1.5 text-sm shadow-sm"
                            >
                                <i className="ph ph-x"></i>
                                <span>Back</span>
                            </button>
                        </div>
                    </div>

                    <div className="bg-section-bg rounded-xl shadow-section overflow-hidden border border-gray-200">
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
                                    <div className="w-16 h-16 bg-gradient-to-br from-red-100 to-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
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
                    {/* Orders Dashboard */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-xl font-bold text-gray-800 flex items-center">
                                <i className="ph ph-storefront text-red-500 mr-2"></i>
                                Orders Dashboard
                            </h2>

                            <button
                                onClick={() => setShowCompletedOrders(true)}
                                className="px-2 py-1.5 bg-gradient-to-r from-white to-gray-50 border border-gray-200 text-red-500 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-1.5 text-sm shadow-sm"
                            >
                                <i className="ph ph-check-circle"></i>
                                <span>Completed Orders</span>
                            </button>
                        </div>

                        <div className="overflow-x-auto overflow-visible pb-2 -mx-4 px-4">
                            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1.5 md:gap-4 min-w-[300px]">
                                <DashboardCard
                                    icon="ph-chart-line-up"
                                    title="Today's Orders"
                                    value={formatNumber(dashboardMetrics.todayOrders)}
                                    trend={`${dashboardMetrics.todayOrdersTrend >= 0 ? '+' : ''}${dashboardMetrics.todayOrdersTrend.toFixed(1)}%`}
                                    color={dashboardMetrics.todayOrdersTrend >= 0 ? "primary" : "warning"}
                                    compact={true}
                                />
                                <DashboardCard
                                    icon="ph-currency-dollar"
                                    title="Today's Revenue"
                                    value={formatCurrency(dashboardMetrics.todayRevenue)}
                                    trend={`${dashboardMetrics.todayRevenueTrend >= 0 ? '+' : ''}${dashboardMetrics.todayRevenueTrend.toFixed(1)}%`}
                                    color={dashboardMetrics.todayRevenueTrend >= 0 ? "success" : "warning"}
                                    compact={true}
                                />
                                <DashboardCard
                                    icon="ph-users"
                                    title="New Customers"
                                    value={formatNumber(dashboardMetrics.newCustomers)}
                                    trend={`${dashboardMetrics.newCustomersTrend >= 0 ? '+' : ''}${dashboardMetrics.newCustomersTrend.toFixed(1)}%`}
                                    color={dashboardMetrics.newCustomersTrend >= 0 ? "primary" : "warning"}
                                    compact={true}
                                />
                                <DashboardCard
                                    icon="ph-shopping-cart"
                                    title="Avg. Order Value"
                                    value={formatCurrency(dashboardMetrics.avgOrderValue)}
                                    trend={`${dashboardMetrics.avgOrderValueTrend >= 0 ? '+' : ''}${dashboardMetrics.avgOrderValueTrend.toFixed(1)}%`}
                                    color={dashboardMetrics.avgOrderValueTrend >= 0 ? "info" : "warning"}
                                    compact={true}
                                    className="hidden md:flex"
                                />
                                <DashboardCard
                                    icon="ph-clock"
                                    title="Avg. Service Time"
                                    value={`${Math.round(dashboardMetrics.avgServiceTime)} min`}
                                    trend={`${dashboardMetrics.avgServiceTimeTrend >= 0 ? '+' : ''}${dashboardMetrics.avgServiceTimeTrend.toFixed(1)}%`}
                                    color={dashboardMetrics.avgServiceTimeTrend >= 0 ? "success" : "warning"}
                                    compact={true}
                                    className="hidden lg:flex"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Order Channels Section */}
                    <div className="mb-6 bg-section-bg rounded-xl shadow-section overflow-hidden border border-gray-200">
                        <div className="px-3 py-3 border-b border-gray-200 flex items-center">
                            <i className="ph ph-globe text-red-500 text-xl mr-2"></i>
                            <h2 className="text-lg font-semibold text-gray-800">Order Channels</h2>
                        </div>
                        <div className="p-3">
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
                                <div className="overflow-x-auto -mx-3 px-3 pb-2">
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5 md:gap-2 min-w-[280px] md:min-w-0">
                                        {tables
                                            .filter(table => table.type === 'aggregator' || table.type === 'qr')
                                            .map(table => (
                                                <div
                                                    key={table.id}
                                                    className="cursor-pointer h-full"
                                                    onClick={() => handleRoomClick(table.id, table.variant)}
                                                >
                                                    <div className={`bg-gradient-to-br rounded-xl p-2.5 md:p-3 border border-gray-200 shadow-sm hover:shadow-md transition-all h-full ${table.id === 'default' ? 'from-gray-50 to-white' :
                                                        table.id === 'zomato' ? 'from-red-50 to-white' :
                                                            table.id === 'swiggy' ? 'from-orange-50 to-white' :
                                                                'from-card-bg to-white'
                                                        }`}>
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-7 h-7 md:w-9 md:h-9 rounded-lg bg-gradient-to-br from-white to-white/80 flex items-center justify-center shadow-sm flex-shrink-0">
                                                                <i className={`ph ${table.id === 'default' ? 'ph-globe text-gray-500' :
                                                                    table.id === 'zomato' ? 'ph-pizza text-red-500' :
                                                                        table.id === 'swiggy' ? 'ph-bicycle text-orange-500' :
                                                                            'ph-globe text-gray-500'
                                                                    } text-base md:text-lg`}></i>
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <h3 className="text-sm md:text-base font-bold text-gray-800 line-clamp-1">
                                                                    {table.id.charAt(0).toUpperCase() + table.id.slice(1)}
                                                                </h3>
                                                                <div className="flex items-center text-xs md:text-sm flex-wrap gap-y-1 mt-1">
                                                                    {table.orders.length > 0 ? (
                                                                        <span className="text-red-500 font-medium truncate flex items-center">
                                                                            <i className="ph ph-shopping-bag text-xs mr-1"></i>
                                                                            {table.orders.length} {table.orders.length === 1 ? 'order' : 'orders'}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-gray-500 truncate flex items-center">
                                                                            <i className="ph ph-tray-empty text-xs mr-1"></i>
                                                                            No orders
                                                                        </span>
                                                                    )}
                                                                    {table.duration && (
                                                                        <span className="text-xs text-gray-500 ml-auto flex items-center">
                                                                            <i className="ph ph-clock text-red-500 text-xs mr-1"></i>
                                                                            {table.duration.display}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                    <div className="md:hidden text-center text-xs text-gray-400 mt-1 flex items-center justify-center">
                                        <i className="ph ph-arrows-horizontal mr-1 text-gray-300"></i>
                                        <span>Swipe to see more</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Dine-In Section */}
                    <div className="mb-6 bg-section-bg rounded-xl shadow-section overflow-hidden border border-gray-200">
                        <div className="px-3 py-3 border-b border-gray-200 flex items-center justify-between">
                            <div className="flex items-center">
                                <i className="ph ph-coffee text-red-500 text-xl mr-2"></i>
                                <h2 className="text-lg font-semibold text-gray-800">Dine In</h2>
                            </div>
                            <button
                                className="px-2 py-1.5 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-lg hover:from-red-700 hover:to-red-600 transition-colors flex items-center gap-1.5 text-sm"
                                onClick={showAddTableModal}
                            >
                                <i className="ph ph-plus"></i>
                                <span>Add Table</span>
                            </button>
                        </div>
                        <div className="p-3">
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
                                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-1.5 md:gap-4 overflow-visible">
                                    {tables
                                        .filter(table => table.type === 'dine_in')
                                        .map(table => (
                                            <div
                                                key={table.id}
                                                className="cursor-pointer h-full"
                                                onClick={() => handleRoomClick(table.id, table.variant)}
                                            >
                                                <TableCard
                                                    title={table.title}
                                                    orders={table.orders}
                                                    duration={table.duration}
                                                    onTap={() => handleRoomClick(table.id, table.variant)}
                                                    onLongPress={() => showRenameRoomModal(table.id, table.variant)}
                                                    compact={true}
                                                />
                                            </div>
                                        ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* QR Orders Section */}
                    <div className="mb-6 bg-section-bg rounded-xl shadow-section overflow-hidden border border-gray-200">
                        <div className="px-3 py-3 border-b border-gray-200 flex items-center justify-between">
                            <div className="flex items-center">
                                <i className="ph ph-qr-code text-red-500 text-xl mr-2"></i>
                                <h2 className="text-lg font-semibold text-gray-800">QR Orders</h2>
                            </div>
                            <button
                                className="px-2 py-1.5 text-red-500 border border-gray-200 bg-gradient-to-r from-white to-gray-50 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-1.5 text-sm"
                                onClick={refreshOrders}
                            >
                                <i className="ph ph-arrows-clockwise"></i>
                                <span>Refresh</span>
                            </button>
                        </div>

                        {/* Desktop Summary Row - Only visible on md and larger screens */}
                        <div className="hidden md:flex border-b border-gray-100 bg-gradient-to-r from-warm-bg to-white">
                            <div className="grid grid-cols-4 gap-4 p-4 w-full">
                                <div className="flex items-center gap-2">
                                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-red-50 to-white flex items-center justify-center shadow-sm flex-shrink-0">
                                        <i className="ph ph-timer text-red-500 text-lg"></i>
                                    </div>
                                    <div>
                                        <div className="text-xs text-gray-500">Pending Orders</div>
                                        <div className="text-lg font-bold text-gray-800">{qrOrders.length}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-green-50 to-white flex items-center justify-center shadow-sm flex-shrink-0">
                                        <i className="ph ph-check-circle text-green-500 text-lg"></i>
                                    </div>
                                    <div>
                                        <div className="text-xs text-gray-500">Accepted Today</div>
                                        <div className="text-lg font-bold text-gray-800">
                                            {(() => {
                                                // Filter orders accepted today
                                                const today = new Date();
                                                today.setHours(0, 0, 0, 0);
                                                const acceptedToday = orders.filter(order => {
                                                    // Check if order has 'PROCESSING' status
                                                    if (!order.status || !Array.isArray(order.status)) return false;

                                                    // Find the processing status entry
                                                    const processingStatus = order.status.find(
                                                        s => s.label && s.label.toUpperCase() === 'PROCESSING'
                                                    );

                                                    if (!processingStatus || !processingStatus.date) return false;

                                                    // Check if it was accepted today
                                                    const statusDate = parseDate(processingStatus.date);
                                                    return statusDate && statusDate >= today;
                                                });

                                                return acceptedToday.length;
                                            })()}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-50 to-white flex items-center justify-center shadow-sm flex-shrink-0">
                                        <i className="ph ph-clock-countdown text-orange-500 text-lg"></i>
                                    </div>
                                    <div>
                                        <div className="text-xs text-gray-500">Avg. Accept Time</div>
                                        <div className="text-lg font-bold text-gray-800">
                                            {(() => {
                                                // Calculate average acceptance time for orders today
                                                const today = new Date();
                                                today.setHours(0, 0, 0, 0);

                                                let totalAcceptTimeMinutes = 0;
                                                let acceptedOrderCount = 0;

                                                orders.forEach(order => {
                                                    if (!order.status || !Array.isArray(order.status)) return;

                                                    // Find the placed and processing status entries
                                                    const placedStatus = order.status.find(
                                                        s => s.label && s.label.toUpperCase() === 'PLACED'
                                                    );

                                                    const processingStatus = order.status.find(
                                                        s => s.label && s.label.toUpperCase() === 'PROCESSING'
                                                    );

                                                    if (!placedStatus || !processingStatus) return;

                                                    const placedDate = parseDate(placedStatus.date);
                                                    const processingDate = parseDate(processingStatus.date);

                                                    if (!placedDate || !processingDate) return;

                                                    // Only consider orders accepted today
                                                    if (processingDate < today) return;

                                                    // Calculate time difference in minutes
                                                    const acceptTimeMinutes = (processingDate - placedDate) / (1000 * 60);

                                                    // Only consider valid times (greater than 0 and less than 1 day)
                                                    if (acceptTimeMinutes > 0 && acceptTimeMinutes < 1440) {
                                                        totalAcceptTimeMinutes += acceptTimeMinutes;
                                                        acceptedOrderCount++;
                                                    }
                                                });

                                                if (acceptedOrderCount === 0) return "N/A";

                                                const avgAcceptTime = Math.round(totalAcceptTimeMinutes / acceptedOrderCount);
                                                return `${avgAcceptTime} min`;
                                            })()}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-50 to-white flex items-center justify-center shadow-sm flex-shrink-0">
                                        <i className="ph ph-money text-blue-500 text-lg"></i>
                                    </div>
                                    <div>
                                        <div className="text-xs text-gray-500">Avg. Order Value</div>
                                        <div className="text-lg font-bold text-gray-800">
                                            {(() => {
                                                // Calculate average order value for QR orders
                                                if (qrOrders.length === 0) return "₹0";

                                                const totalValue = qrOrders.reduce((sum, order) => {
                                                    const itemsTotal = order.items?.reduce((total, item) => {
                                                        return total + ((item.price || 0) * (item.quantity || item.qnt || 1));
                                                    }, 0) || 0;

                                                    return sum + itemsTotal;
                                                }, 0);

                                                const avgValue = Math.round(totalValue / qrOrders.length);
                                                return `₹${avgValue}`;
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            </div>
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
                                    <div className="w-16 h-16 bg-gradient-to-br from-red-100 to-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <i className="ph ph-qr-code text-2xl text-red-500"></i>
                                    </div>
                                    <h3 className="text-lg font-medium text-gray-700 mb-1">No QR Orders Found</h3>
                                    <p className="text-gray-500">QR orders from your customers will appear here</p>
                                </div>
                            ) : (
                                <div>
                                    <div className="overflow-x-auto md:overflow-visible">
                                        <div className="space-y-3 min-w-[100%] md:min-w-0">
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
                                    </div>
                                    <div className="md:hidden text-center text-xs text-gray-400 mt-3 flex items-center justify-center">
                                        <i className="ph ph-arrows-horizontal mr-1 text-gray-300"></i>
                                        <span>Swipe horizontally on orders if needed</span>
                                    </div>
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