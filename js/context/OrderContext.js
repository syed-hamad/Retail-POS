// OrderContext.js - Centralized Order Management
const OrderContext = React.createContext();

function OrderProvider({ children }) {
    const [activeOrders, setActiveOrders] = React.useState([]);
    const [completedOrders, setCompletedOrders] = React.useState([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState(null);

    // Pagination and filtering state
    const [dateRange, setDateRange] = React.useState({
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        end: new Date()
    });
    const [lastVisibleDoc, setLastVisibleDoc] = React.useState(null);
    const [hasMoreOrders, setHasMoreOrders] = React.useState(true);

    // Initialize listeners for active orders
    React.useEffect(() => {
        console.log("[OrderContext] Setting up real-time listeners for active orders");

        // Set up listener for active orders (KITCHEN, PLACED)
        const unsubscribe = setupActiveOrdersListener();

        // Cleanup on unmount
        return () => {
            console.log("[OrderContext] Cleaning up order listeners");
            unsubscribe();
        };
    }, []);

    const setupActiveOrdersListener = () => {
        setIsLoading(true);

        try {
            // Create query for active orders (KITCHEN, PLACED)
            const query = window.sdk.collection("Orders")
                .where("currentStatus.label", "in", ["KITCHEN", "PLACED"])
                .orderBy("date", "desc")
                .limit(50);  // Reasonable limit

            return query.onSnapshot(
                snapshot => {
                    const orders = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                    console.log("[OrderContext] Active orders updated:", orders.length);
                    setActiveOrders(orders);
                    setIsLoading(false);
                },
                error => {
                    console.error("[OrderContext] Error fetching active orders:", error);
                    setError(error);
                    setIsLoading(false);
                }
            );
        } catch (err) {
            console.error("[OrderContext] Error setting up active orders listener:", err);
            setError(err);
            setIsLoading(false);
            // Return a no-op function as a fallback
            return () => { };
        }
    };

    // Function to load completed orders (on-demand)
    const loadCompletedOrders = async (forceRefresh = false) => {
        if (forceRefresh) {
            setCompletedOrders([]);
            setLastVisibleDoc(null);
            setHasMoreOrders(true);
        }

        if (!hasMoreOrders && !forceRefresh) return;

        setIsLoading(true);

        try {
            // Convert date objects to Firestore timestamps if needed
            const startTimestamp = dateRange.start instanceof Date ?
                window.firebase.firestore.Timestamp.fromDate(dateRange.start) : dateRange.start;
            const endTimestamp = dateRange.end instanceof Date ?
                window.firebase.firestore.Timestamp.fromDate(dateRange.end) : dateRange.end;

            let query = window.sdk.collection("Orders")
                .where("currentStatus.label", "==", "COMPLETED")
                .orderBy("date", "desc")
                .limit(20);

            // Add date filtering if supported
            try {
                // This may fail if the right indexes don't exist
                query = window.sdk.collection("Orders")
                    .where("currentStatus.label", "==", "COMPLETED")
                    .where("date", ">=", startTimestamp)
                    .where("date", "<=", endTimestamp)
                    .orderBy("date", "desc")
                    .limit(20);
            } catch (e) {
                console.warn("[OrderContext] Date filtering failed, falling back:", e);
            }

            if (lastVisibleDoc && !forceRefresh) {
                query = query.startAfter(lastVisibleDoc);
            }

            const snapshot = await query.get();

            if (snapshot.empty) {
                setHasMoreOrders(false);
                setIsLoading(false);
                return;
            }

            const newOrders = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            console.log("[OrderContext] Loaded completed orders:", newOrders.length);
            setLastVisibleDoc(snapshot.docs[snapshot.docs.length - 1]);
            setCompletedOrders(prev => forceRefresh ? newOrders : [...prev, ...newOrders]);
            setHasMoreOrders(snapshot.docs.length === 20);
        } catch (error) {
            console.error("[OrderContext] Error loading completed orders:", error);
            setError(error);
        } finally {
            setIsLoading(false);
        }
    };

    // Filter active orders by table and channel
    const getOrdersByTableAndChannel = React.useCallback(() => {
        const tableOrders = {};
        const channelOrders = {};

        // Process active orders into tables and channels
        activeOrders.forEach(order => {
            // Filter orders with items - only if items exists and has length > 0
            if (!order.items || order.items.length === 0) return;

            // 1. Handle table assignments
            if (order.tableId) {
                if (!tableOrders[order.tableId]) {
                    tableOrders[order.tableId] = [];
                }
                tableOrders[order.tableId].push(order);
            }

            // 2. Handle channel assignments with price variants
            if (order.priceVariant) {
                const variant = order.priceVariant;
                if (!channelOrders[variant]) {
                    channelOrders[variant] = [];
                }
                channelOrders[variant].push(order);
            }
            // 2b. Default channel (no priceVariant and no tableId)
            else if (!order.tableId) {
                if (!channelOrders['Default']) {
                    channelOrders['Default'] = [];
                }
                channelOrders['Default'].push(order);
            }
        });

        return { tableOrders, channelOrders };
    }, [activeOrders]);

    // Get an order by ID
    const getOrderById = React.useCallback((orderId) => {
        // First check active orders
        const activeOrder = activeOrders.find(order => order.id === orderId);
        if (activeOrder) return activeOrder;

        // Then check completed orders
        const completedOrder = completedOrders.find(order => order.id === orderId);
        if (completedOrder) return completedOrder;

        // If not found, return null
        return null;
    }, [activeOrders, completedOrders]);

    // Get orders for a specific table or channel
    const getOrdersForSource = React.useCallback((tableId, variant, orderStatus = "KITCHEN") => {
        // Filter active orders first by status
        const statusFilteredOrders = activeOrders.filter(order =>
            order.currentStatus?.label === orderStatus &&
            order.items && order.items.length > 0
        );

        // Group into tables and channels
        const tableOrders = {};
        const channelOrders = {};

        statusFilteredOrders.forEach(order => {
            // 1. Handle table assignments
            if (order.tableId) {
                if (!tableOrders[order.tableId]) {
                    tableOrders[order.tableId] = [];
                }
                tableOrders[order.tableId].push(order);
            }

            // 2. Handle channel assignments with price variants
            if (order.priceVariant) {
                const variant = order.priceVariant;
                if (!channelOrders[variant]) {
                    channelOrders[variant] = [];
                }
                channelOrders[variant].push(order);
            }
            // 2b. Default channel (no priceVariant and no tableId)
            else if (!order.tableId) {
                if (!channelOrders['Default']) {
                    channelOrders['Default'] = [];
                }
                channelOrders['Default'].push(order);
            }
        });

        if (tableId) {
            return tableOrders[tableId] || [];
        } else if (variant) {
            return channelOrders[variant] || [];
        }

        return [];
    }, [activeOrders]);

    // Value object with all context data and functions
    const value = {
        activeOrders,
        completedOrders,
        isLoading,
        error,
        dateRange,
        setDateRange,
        loadCompletedOrders,
        loadMoreCompletedOrders: () => loadCompletedOrders(false),
        refreshCompletedOrders: () => loadCompletedOrders(true),
        hasMoreOrders,
        getOrdersByTableAndChannel,
        getOrderById,
        getOrdersForSource
    };

    return (
        <OrderContext.Provider value={value}>
            {children}
        </OrderContext.Provider>
    );
}

// Custom hook for using the order context
function useOrders() {
    const context = React.useContext(OrderContext);
    if (context === undefined) {
        throw new Error("useOrders must be used within an OrderProvider");
    }
    return context;
}

// Make OrderProvider and useOrders available globally
window.OrderProvider = OrderProvider;
window.useOrders = useOrders; 