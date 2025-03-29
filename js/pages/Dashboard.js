// Dashboard Component
function Dashboard() {
    const { profile: seller, tables: profileTables } = window.useProfile ? window.useProfile() : { profile: null, tables: [] };
    const {
        activeOrders,
        completedOrders,
        isLoading,
        error: orderError,
        getOrdersByTableAndChannel,
        loadCompletedOrders
    } = window.useOrders ? window.useOrders() : {
        activeOrders: [],
        completedOrders: [],
        isLoading: true,
        error: null,
        getOrdersByTableAndChannel: () => ({ tableOrders: {}, channelOrders: {} }),
        loadCompletedOrders: () => { }
    };

    const [error, setError] = React.useState(null);
    const [isProfileOpen, setIsProfileOpen] = React.useState(false);
    const [showCompletedOrders, setShowCompletedOrders] = React.useState(false);
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
    const [kitchenOrders, setKitchenOrders] = React.useState([]); // New state for KITCHEN orders only
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

    // Computed state for tables and channels
    const [tables, setTables] = React.useState([]);
    const [channels, setChannels] = React.useState([]);

    // State for date filtering in completed orders
    const [dateFilter, setDateFilter] = React.useState('7days'); // Options: today, yesterday, 7days, custom
    const [customDateRange, setCustomDateRange] = React.useState({
        startDate: null,
        endDate: null
    });

    // Add a state to store unsubscribe functions
    const [kitchenOrdersUnsubscribe, setKitchenOrdersUnsubscribe] = React.useState(null);
    const [completedOrdersUnsubscribe, setCompletedOrdersUnsubscribe] = React.useState(null);

    // Add state for the unsubscribe function
    const [placedOrdersUnsubscribe, setPlacedOrdersUnsubscribe] = React.useState(null);

    // Get the OrderContext data to update tables and channels
    React.useEffect(() => {
        // Depend on locally fetched 'kitchenOrders' state instead of 'orders'
        if (!seller || !kitchenOrders) return;

        console.log(`[Kitchen useEffect] Processing ${kitchenOrders.length} KITCHEN orders...`);

        try {
            // No need to filter - kitchenOrders already contains only KITCHEN status orders
            const relevantOrders = kitchenOrders;

            // --- Manual Grouping Logic ---
            const tableOrdersMap = {};
            const channelOrdersMap = {};

            relevantOrders.forEach(order => {
                // Filter out orders without items
                if (!order.items || order.items.length === 0) return;

                const tableId = order.tableId;
                const priceVariant = order.priceVariant; // Might be null, undefined, or ""

                // Log every order in processing for debugging
                console.log(`[Dashboard Grouping] Order ID: ${order.id}, TableID: ${tableId || 'null/undefined'}, Variant: '${priceVariant || ''}' (Type: ${typeof priceVariant})`);

                // 1. Handle table assignments first
                if (tableId) {
                    if (!tableOrdersMap[tableId]) {
                        tableOrdersMap[tableId] = [];
                    }
                    tableOrdersMap[tableId].push(order);
                    console.log(`[Dashboard Grouping]   Assigned to Table: ${tableId}`);
                }
                // 2. Handle specific price variant channels (if no tableId and variant is meaningful)
                else if (priceVariant && priceVariant !== '') {
                    if (!channelOrdersMap[priceVariant]) {
                        channelOrdersMap[priceVariant] = [];
                    }
                    channelOrdersMap[priceVariant].push(order);
                    console.log(`[Dashboard Grouping]   Assigned to Channel: ${priceVariant}`);
                }
                // 3. Handle Default channel (if no tableId and no meaningful priceVariant)
                else {
                    if (!channelOrdersMap['Default']) {
                        channelOrdersMap['Default'] = [];
                    }
                    channelOrdersMap['Default'].push(order);
                    console.log(`[Dashboard Grouping]   Assigned to Channel: Default`);
                }
            });
            // --- End Manual Grouping Logic ---

            // Summarize the final assignment counts
            console.log(`[Dashboard Grouping Summary] Final assignments:`);
            console.log(`  - Total orders processed: ${relevantOrders.length}`);
            console.log(`  - Tables: ${Object.keys(tableOrdersMap).length} tables with orders`);
            console.log(`  - Channels: ${Object.keys(channelOrdersMap).length} channels with orders`);
            if (channelOrdersMap['Default']) {
                console.log(`  - Default channel: ${channelOrdersMap['Default'].length} orders`);
            } else {
                console.log(`  - Default channel: Not created (no orders)`);
            }

            // Get price variants from seller profile
            const priceVariants = (seller?.priceVariants || [])
                .map(v => v.title)
                .filter(Boolean);

            // Always ensure we have a Default variant for channel creation
            if (!priceVariants.includes('Default')) {
                priceVariants.unshift('Default');
            }

            // Create channel definitions based on defined price variants
            const normalizedNames = new Set();
            const orderChannels = [];

            priceVariants.forEach(variant => {
                const normalizedName = variant.toLowerCase();
                if (!normalizedNames.has(normalizedName)) {
                    normalizedNames.add(normalizedName);
                    orderChannels.push({
                        id: variant, // Use the variant title as ID
                        title: variant,
                        type: 'price_variant',
                        isChannel: true
                    });
                }
            });

            // Convert seller tables to the format we need
            const formattedTables = (seller?.tables || []).map(table => ({
                id: table.id || table.title, // Use title as fallback id
                title: table.title,
                desc: table.desc,
                type: table.type || 'dine_in',
                section: table.section || 'main', // Provide a default section
                isTable: true
            }));

            // Assign orders to tables using the map
            const tablesWithOrders = formattedTables.map(table => {
                const tableOrdersList = tableOrdersMap[table.id] || []; // Use table.id for lookup
                let oldestOrderDate = null;
                if (tableOrdersList.length > 0) {
                    oldestOrderDate = tableOrdersList
                        .map(o => o.currentStatus?.date)
                        .filter(Boolean) // Ensure date exists before parsing/comparing
                        .reduce((oldest, current) => {
                            const oldestD = parseDate(oldest);
                            const currentD = parseDate(current);
                            // Handle cases where parseDate might return null
                            if (!currentD) return oldest;
                            if (!oldestD) return current;
                            return oldestD < currentD ? oldest : current;
                        }); // No need for initial value if we filter nulls first
                }

                return {
                    ...table,
                    orders: tableOrdersList,
                    duration: oldestOrderDate ? getTimeDuration(oldestOrderDate) : null
                };
            });

            // Assign orders to channels using the map
            const channelsWithOrders = orderChannels.map(channel => {
                const channelOrdersList = channelOrdersMap[channel.id] || []; // Use channel.id (variant title) for lookup
                let oldestOrderDate = null;
                if (channelOrdersList.length > 0) {
                    oldestOrderDate = channelOrdersList
                        .map(o => o.currentStatus?.date)
                        .filter(Boolean)
                        .reduce((oldest, current) => {
                            const oldestD = parseDate(oldest);
                            const currentD = parseDate(current);
                            if (!currentD) return oldest;
                            if (!oldestD) return current;
                            return oldestD < currentD ? oldest : current;
                        });
                }

                return {
                    ...channel,
                    orders: channelOrdersList,
                    duration: oldestOrderDate ? getTimeDuration(oldestOrderDate) : null
                };
            });

            // Update state
            setTables(tablesWithOrders);
            setChannels(channelsWithOrders);

            // Update dashboard metrics (use all fetched orders for metrics)
            // Ensure calculateDashboardMetrics can handle the 'orders' state format
            const metrics = calculateDashboardMetrics(orders);
            setDashboardMetrics(metrics);
        } catch (err) {
            console.error('Error processing orders:', err);
            setError('Failed to process orders data');
        }
        // Update dependencies: Now depends on 'seller' and the locally fetched 'kitchenOrders'
    }, [seller, kitchenOrders]);

    // Fetch orders based on current filter
    React.useEffect(() => {
        if (showCompletedOrders) {
            // Clean up any existing completed orders listener before creating a new one
            if (completedOrdersUnsubscribe) {
                completedOrdersUnsubscribe();
            }
            // Set up the listener for completed orders
            setupCompletedOrdersListener();
        }
    }, [dateFilter, customDateRange, showCompletedOrders]);

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
        console.log(`Opening OrderRoom for ${tableId ? `Table ${tableId}` : variant} showing KITCHEN status orders`);
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

    // Check SDK availability when component mounts
    React.useEffect(() => {
        if (!window.sdk || !window.sdk.collection) {
            console.error("SDK is not available or not properly initialized");
            setError("SDK is not available. Some features may not work properly.");
        }
    }, []);

    // Fetch QR orders and set up real-time listeners
    React.useEffect(() => {
        // Initial fetch for PLACED orders (QR tab)
        setupPlacedOrdersListener();

        // Set up real-time listener for KITCHEN orders
        setupKitchenOrdersListener();

        // Cleanup listeners on component unmount
        return () => {
            // Clean up Firestore listeners
            if (kitchenOrdersUnsubscribe) {
                kitchenOrdersUnsubscribe();
            }
            if (completedOrdersUnsubscribe) {
                completedOrdersUnsubscribe();
            }
            if (placedOrdersUnsubscribe) {
                placedOrdersUnsubscribe();
            }
        };
    }, []); // Empty dependency array means this runs once on mount

    // Set up real-time listener for KITCHEN orders
    const setupKitchenOrdersListener = () => {
        try {
            // Check if SDK is available
            if (!window.sdk || !window.sdk.collection) {
                console.error("SDK is not available or not properly initialized");
                setError("SDK is not available. Please try again later.");
                return;
            }

            console.log("[Kitchen Listener] Setting up real-time listener for KITCHEN orders");

            // Query for KITCHEN orders - mirrors the Flutter implementation
            const kitchenQuery = window.sdk.collection("Orders")
                .where("currentStatus.label", "==", "KITCHEN")
                .orderBy("date", "desc")
                .limit(100); // Increased limit for better pagination

            // Set up real-time listener
            const unsubscribe = kitchenQuery.onSnapshot(
                (snapshot) => {
                    // Process the snapshot data
                    const kitchenOrdersData = snapshot.docs
                        .map(doc => ({
                            id: doc.id,
                            ...doc.data(),
                            date: parseDate(doc.data().date)
                        }))
                        .filter(order => order.items && order.items.length > 0);

                    // Log for debugging: count orders with no tableId and no priceVariant (Default channel)
                    const defaultChannelOrders = kitchenOrdersData.filter(order =>
                        !order.tableId && (!order.priceVariant || order.priceVariant === '')
                    );

                    if (defaultChannelOrders.length > 0) {
                        console.log(`[Dashboard] Found ${defaultChannelOrders.length} orders for Default channel`);
                        // Log first 3 default channel orders for debugging
                        defaultChannelOrders.slice(0, 3).forEach(order => {
                            console.log(`  Default channel order: ${order.id}, TableID: ${order.tableId || 'null/undefined'}, PriceVariant: '${order.priceVariant || ''}' (${typeof order.priceVariant})`);
                        });
                    }

                    // Update state with the real-time KITCHEN orders data
                    setKitchenOrders(kitchenOrdersData);

                    // Also fetch recent COMPLETED orders for metrics
                    fetchRecentCompletedOrders(kitchenOrdersData);

                    console.log(`[Realtime update] ${kitchenOrdersData.length} KITCHEN orders (real-time listener active)`);
                },
                (error) => {
                    console.error('Error in KITCHEN orders listener:', error);
                    setError(`Failed to listen to kitchen orders updates: ${error.message}`);
                }
            );

            // Save the unsubscribe function
            setKitchenOrdersUnsubscribe(() => unsubscribe);
        } catch (err) {
            console.error('Error setting up kitchen orders listener:', err);
            setError('Failed to set up kitchen orders listener');
        }
    };

    // Fetch recent COMPLETED orders for metrics only
    const fetchRecentCompletedOrders = async (kitchenOrdersData) => {
        try {
            // Check if SDK is available
            if (!window.sdk || !window.sdk.collection) {
                console.error("SDK is not available or not properly initialized");
                return;
            }

            // Fetch recent COMPLETED orders for metrics only
            const recentCompletedQuery = window.sdk.collection("Orders")
                .where("currentStatus.label", "==", "COMPLETED")
                .orderBy("date", "desc")
                .limit(100);

            const completedSnapshot = await recentCompletedQuery.get();

            const completedOrdersData = completedSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                date: parseDate(doc.data().date)
            }));

            // Combine KITCHEN and recent COMPLETED for the metrics state
            setOrders([...kitchenOrdersData, ...completedOrdersData]);

            console.log(`Fetched ${completedOrdersData.length} COMPLETED orders for metrics`);
        } catch (err) {
            console.error('Error fetching completed orders for metrics:', err);
        }
    };

    // Set up real-time listener for PLACED orders
    const setupPlacedOrdersListener = () => {
        try {
            setLoadingQrOrders(true);
            setErrorQrOrders(null);

            // Check if SDK is available
            if (!window.sdk || !window.sdk.collection) {
                console.error("SDK is not available or not properly initialized");
                setErrorQrOrders("SDK is not available. Please try again later.");
                setLoadingQrOrders(false);
                return;
            }

            console.log("[PLACED Listener] Setting up real-time listener for PLACED orders");

            // Query for PLACED orders - similar to the KITCHEN orders listener
            const placedQuery = window.sdk.collection("Orders")
                .where("currentStatus.label", "==", "PLACED")
                .orderBy("date", "desc")
                .limit(100); // Increased limit for better pagination

            // Set up real-time listener
            const unsubscribe = placedQuery.onSnapshot(
                (snapshot) => {
                    // Process the snapshot data
                    const placedOrdersData = snapshot.docs
                        .map(doc => ({
                            id: doc.id,
                            ...doc.data(),
                            date: parseDate(doc.data().date)
                        }));

                    // Update state with the real-time PLACED orders data
                    setQrOrders(placedOrdersData);
                    setLoadingQrOrders(false);

                    console.log(`[Realtime update] ${placedOrdersData.length} PLACED orders (real-time listener active)`);
                },
                (error) => {
                    console.error('Error in PLACED orders listener:', error);
                    setErrorQrOrders(`Failed to listen to QR orders updates: ${error.message}`);
                    setLoadingQrOrders(false);
                }
            );

            // Save the unsubscribe function
            setPlacedOrdersUnsubscribe(() => unsubscribe);
        } catch (err) {
            console.error('Error setting up PLACED orders listener:', err);
            setErrorQrOrders(`Failed to set up PLACED orders listener: ${err.message}`);
            setLoadingQrOrders(false);
        }
    };

    // Keep the handleAcceptOrder function for accepting orders
    const handleAcceptOrder = async (orderId) => {
        try {
            setLoadingQrOrders(true);

            // Check if SDK is available
            if (!window.sdk || !window.sdk.collection) {
                throw new Error('SDK is not available or not properly initialized');
            }

            const orderRef = window.sdk.collection("Orders").doc(orderId);
            const orderDoc = await orderRef.get();

            if (!orderDoc.exists) {
                throw new Error('Order not found');
            }

            const order = orderDoc.data();

            // Log order details BEFORE update
            console.log(`[Accept Order] BEFORE - OrderID: ${orderId}, TableID: ${order.tableId || 'null/undefined'}, PriceVariant: '${order.priceVariant || ''}' (${typeof order.priceVariant})`);

            // Create status entry for kitchen processing - use KITCHEN status to be consistent with OrderRoom
            const statusEntry = {
                label: 'KITCHEN',
                date: new Date()
            };

            // Prepare the update object - don't modify priceVariant, let the grouping logic handle default channel assignment
            const updateObj = {
                currentStatus: statusEntry,
                status: [...(order.status || []), statusEntry]
            };

            // Update the order status
            await orderRef.update(updateObj);

            // Fetch the updated order to verify changes
            const updatedOrderDoc = await orderRef.get();
            const updatedOrder = updatedOrderDoc.data();

            // Log order details AFTER update
            console.log(`[Accept Order] AFTER - OrderID: ${orderId}, TableID: ${updatedOrder.tableId || 'null/undefined'}, PriceVariant: '${updatedOrder.priceVariant || ''}' (${typeof updatedOrder.priceVariant})`);
            console.log(`[Accept Order] Current status is now: ${updatedOrder.currentStatus?.label}`);

            // Show success message
            showToast("Order accepted successfully");
            console.log("Order moved to KITCHEN status and will appear in tables/channels");

            // No need to manually refresh as the real-time listeners will catch this update

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

            // Check if SDK is available
            if (!window.sdk || !window.sdk.collection) {
                throw new Error('SDK is not available or not properly initialized');
            }

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

            // No need to manually refresh as the real-time listeners will catch this update

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

            // Check if SDK is available
            if (!window.sdk || !window.sdk.collection) {
                throw new Error('SDK is not available or not properly initialized');
            }

            // Delete the order from Firestore
            await window.sdk.collection("Orders").doc(orderId).delete();

            // Show success message
            showToast("Order deleted successfully");

            // No need to manually refresh as the real-time listeners will catch this update

        } catch (err) {
            console.error('Error deleting order:', err);
            showToast(`Failed to delete order: ${err.message}`, "error");
        } finally {
            setLoadingQrOrders(false);
        }
    };

    const handlePrintBill = async (orderId) => {
        try {
            // Check if SDK is available
            if (!window.sdk || !window.sdk.collection) {
                throw new Error('SDK is not available or not properly initialized');
            }

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

    // Set up real-time listener for COMPLETED orders with date filtering
    const setupCompletedOrdersListener = () => {
        try {
            setLoadingCompletedOrders(true);
            setErrorCompletedOrders(null);

            // Check if SDK is available
            if (!window.sdk || !window.sdk.collection) {
                console.error("SDK is not available or not properly initialized");
                setErrorCompletedOrders("SDK is not available. Please try again later.");
                setLoadingCompletedOrders(false);
                return;
            }

            console.log("[COMPLETED Listener] Setting up real-time listener for COMPLETED orders");

            // Calculate date range based on selected filter
            const startDate = calculateStartDate(dateFilter, customDateRange.startDate);
            const endDate = calculateEndDate(dateFilter, customDateRange.endDate);

            // Query specifically for COMPLETED orders only
            let ordersQuery = window.sdk.collection("Orders")
                .where("currentStatus.label", "==", "COMPLETED")
                .orderBy("date", "desc")
                .limit(100);

            // Set up real-time listener
            const unsubscribe = ordersQuery.onSnapshot(
                (snapshot) => {
                    if (!snapshot || !snapshot.docs) {
                        setErrorCompletedOrders("Failed to fetch completed orders data");
                        setLoadingCompletedOrders(false);
                        return;
                    }

                    const fetchedOrders = snapshot.docs.map(doc => {
                        const data = doc.data();
                        return {
                            id: doc.id,
                            ...data,
                            // Ensure date is properly handled
                            date: parseDate(data.date)
                        };
                    });

                    // Client-side filtering for date range
                    const filteredOrders = fetchedOrders.filter(order => {
                        // Get order date
                        const orderDate = order.date;
                        if (!orderDate) return false;

                        // Check if within date range
                        return orderDate >= startDate && orderDate <= endDate;
                    });

                    // Store filtered completed orders
                    setOrders(filteredOrders);
                    setLoadingCompletedOrders(false);

                    console.log(`[Realtime update] Fetched ${fetchedOrders.length} COMPLETED orders, ${filteredOrders.length} matched the selected date range (real-time listener active)`);
                },
                (error) => {
                    console.error('Error in COMPLETED orders listener:', error);
                    setErrorCompletedOrders(`Failed to listen to completed orders updates: ${error.message}`);
                    setLoadingCompletedOrders(false);
                }
            );

            // Save the unsubscribe function
            setCompletedOrdersUnsubscribe(() => unsubscribe);
        } catch (err) {
            console.error('Error setting up completed orders listener:', err);
            setErrorCompletedOrders(`Failed to set up completed orders listener: ${err.message}`);
            setLoadingCompletedOrders(false);
        }
    };

    // Handle date range selection for custom filter
    const handleDateRangeSelect = (startDate, endDate) => {
        setCustomDateRange({ startDate, endDate });
        setDateFilter('custom');
    };

    // Handle scroll to load more items (restore this function)
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

    // Render the dashboard
    return (
        <div className="pb-24 md:pb-4 px-4 mt-4">
            {/* Orders Dashboard */}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center">
                        <i className="ph ph-storefront text-red-500 mr-2"></i>
                        Orders Dashboard
                    </h2>
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
                    <h2 className="text-lg font-semibold text-gray-800">Kitchen Orders by Channel</h2>
                </div>
                <div className="p-3">
                    {isLoading ? (
                        <div className="text-center py-10">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-500 mx-auto"></div>
                            <p className="mt-3 text-gray-600">Loading online orders...</p>
                        </div>
                    ) : error ? (
                        <div className="text-center py-10">
                            <div className="rounded-full h-10 w-10 bg-red-100 flex items-center justify-center mx-auto">
                                <i className="ph ph-x text-red-500 text-xl"></i>
                            </div>
                            <p className="mt-3 text-gray-600">{error}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                            {channels
                                .filter(channel => channel.isChannel)
                                .map(channel => (
                                    <div
                                        key={channel.id}
                                        className="mb-2"
                                        onClick={() => handleRoomClick(null, channel.id)}
                                        onContextMenu={(e) => {
                                            e.preventDefault();
                                            showRenameRoomModal(null, channel.id);
                                        }}
                                    >
                                        <TableCard
                                            title={channel.title}
                                            orders={channel.orders || []}
                                            duration={channel.duration}
                                            onTap={() => handleRoomClick(null, channel.id)}
                                            onLongPress={() => showRenameRoomModal(null, channel.id)}
                                            compact={true}
                                        />
                                    </div>
                                ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Tables Section */}
            <div className="mb-6 bg-section-bg rounded-xl shadow-section overflow-hidden border border-gray-200">
                <div className="px-3 py-3 border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center">
                        <i className="ph ph-table text-red-500 text-xl mr-2"></i>
                        <h2 className="text-lg font-semibold text-gray-800">Kitchen Orders by Table</h2>
                    </div>
                    <button
                        onClick={showAddTableModal}
                        className="px-2 py-1 bg-gradient-to-r from-white to-gray-50 border border-gray-200 text-red-500 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-1.5 text-sm shadow-sm"
                    >
                        <i className="ph ph-plus"></i>
                        <span>Add Table</span>
                    </button>
                </div>
                <div className="p-3">
                    {isLoading ? (
                        <div className="text-center py-10">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-500 mx-auto"></div>
                            <p className="mt-3 text-gray-600">Loading tables...</p>
                        </div>
                    ) : error ? (
                        <div className="text-center py-10">
                            <div className="rounded-full h-10 w-10 bg-red-100 flex items-center justify-center mx-auto">
                                <i className="ph ph-x text-red-500 text-xl"></i>
                            </div>
                            <p className="mt-3 text-gray-600">{error}</p>
                        </div>
                    ) : tables.length === 0 ? (
                        <NoOrdersFound />
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                            {tables
                                .filter(table => table.isTable)
                                .map(table => (
                                    <div
                                        key={table.id}
                                        className="mb-2"
                                        onClick={() => handleRoomClick(table.id, null)}
                                        onContextMenu={(e) => {
                                            e.preventDefault();
                                            showRenameRoomModal(table.id, null);
                                        }}
                                    >
                                        <TableCard
                                            title={table.title}
                                            orders={table.orders || []}
                                            duration={table.duration}
                                            onTap={() => handleRoomClick(table.id, null)}
                                            onLongPress={() => showRenameRoomModal(table.id, null)}
                                            compact={true}
                                        />
                                    </div>
                                ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Orders Section */}
            <div className="mb-6 bg-section-bg rounded-xl shadow-section overflow-hidden border border-gray-200">
                <div className="px-3 py-3 border-b border-gray-200 flex items-center">
                    <i className="ph ph-qr-code text-red-500 text-xl mr-2"></i>
                    <h2 className="text-lg font-semibold text-gray-800">Orders</h2>
                </div>

                {/* Order Tabs */}
                <div className="flex border-b border-gray-200">
                    <button
                        className={`flex-1 py-2 px-4 text-sm font-medium ${!showCompletedOrders ? 'text-red-500 border-b-2 border-red-500' : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setShowCompletedOrders(false)}
                    >
                        <i className={`ph ph-timer ${!showCompletedOrders ? 'text-red-500' : 'text-gray-400'} mr-1.5`}></i>
                        QR Orders
                    </button>
                    <button
                        className={`flex-1 py-2 px-4 text-sm font-medium ${showCompletedOrders ? 'text-red-500 border-b-2 border-red-500' : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setShowCompletedOrders(true)}
                    >
                        <i className={`ph ph-check-circle ${showCompletedOrders ? 'text-red-500' : 'text-gray-400'} mr-1.5`}></i>
                        Completed Orders
                    </button>
                </div>

                {/* Desktop Summary Row - Only for Active Orders tab */}
                {!showCompletedOrders && (
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
                )}

                {/* Date Filter - Only for Completed Orders tab */}
                {showCompletedOrders && (
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-warm-bg to-white">
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
                    </div>
                )}

                <div className="p-4" ref={qrOrdersScrollRef} onScroll={handleScroll}>
                    {/* Active Orders Tab Content */}
                    {!showCompletedOrders && (
                        <>
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
                        </>
                    )}

                    {/* Completed Orders Tab Content */}
                    {showCompletedOrders && (
                        <>
                            {loadingCompletedOrders ? (
                                <div className="text-center py-10">
                                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-500 mx-auto"></div>
                                    <p className="mt-3 text-gray-600">Loading completed orders...</p>
                                </div>
                            ) : errorCompletedOrders ? (
                                <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-4">
                                    <p>{errorCompletedOrders}</p>
                                </div>
                            ) : orders.length === 0 ? (
                                <div className="text-center py-10">
                                    <div className="w-16 h-16 bg-gradient-to-br from-red-100 to-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <i className="ph ph-check-circle text-2xl text-red-500"></i>
                                    </div>
                                    <h3 className="text-lg font-medium text-gray-700 mb-1">No Completed Orders</h3>
                                    <p className="text-gray-500">Completed orders will appear here</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {orders
                                        .filter(order => order.currentStatus?.label === "COMPLETED" || order.paid === true)
                                        .map(order => (
                                            <OrderGroupTile
                                                key={order.id}
                                                order={order}
                                                onPrintBill={() => handlePrintBill(order.id)}
                                            />
                                        ))
                                    }
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

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
                orderStatus="KITCHEN"
                seller={seller}
            />
        </div>
    );
} 