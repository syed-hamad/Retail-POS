// Analytics Component
function Analytics() {
    const [metrics, setMetrics] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [dateFilter, setDateFilter] = React.useState('last30');
    const [customDateRange, setCustomDateRange] = React.useState({ start: null, end: null });

    // Date filter options
    const dateFilters = [
        { id: 'yesterday', label: 'Yesterday' },
        { id: 'last7', label: 'Last 7 Days' },
        { id: 'last30', label: 'Last 30 Days' },
        { id: 'custom', label: 'Custom' }
    ];

    // Get date range based on filter
    const getDateRange = (filter) => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        switch (filter) {
            case 'yesterday':
                return {
                    start: new Date(today.getTime() - 24 * 60 * 60 * 1000),
                    end: today
                };
            case 'last7':
                return {
                    start: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
                    end: now
                };
            case 'last30':
                return {
                    start: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
                    end: now
                };
            case 'custom':
                return {
                    start: customDateRange.start,
                    end: customDateRange.end
                };
            default:
                return { start: null, end: null };
        }
    };

    // Check if a date is within the selected range
    const isDateInRange = (date, range) => {
        if (!range.start || !range.end) return true;

        // Handle Firebase Timestamp or regular date
        const orderDate = date?.toDate ? date.toDate() : new Date(date);
        return orderDate >= range.start && orderDate <= range.end;
    };

    // Calculate trends by comparing with previous period
    const calculateTrends = (currentOrders, previousOrders) => {
        // If no previous data, return 0 (no change)
        if (!previousOrders || previousOrders.length === 0) {
            return {
                sales: 0,
                orders: 0,
                turnAround: 0,
                orderValue: 0
            };
        }

        // Calculate current metrics
        const currentSales = currentOrders.reduce((sum, order) =>
            sum + (order.items || []).reduce((itemSum, item) =>
                itemSum + ((Number(item.price) || 0) * (Number(item.quantity || item.qnt || 0))), 0), 0);

        const currentOrderCount = currentOrders.length;

        const currentTurnAround = currentOrders.reduce((sum, order) => {
            if (!order.date || !order.completedAt) return sum;
            const start = order.date?.toDate ? order.date.toDate() : new Date(order.date);
            const end = order.completedAt?.toDate ? order.completedAt.toDate() : new Date(order.completedAt);
            return sum + (end - start) / (1000 * 60); // in minutes
        }, 0) / (currentOrders.filter(o => o.date && o.completedAt).length || 1);

        const currentOrderValue = currentSales / (currentOrderCount || 1);

        // Calculate previous metrics
        const previousSales = previousOrders.reduce((sum, order) =>
            sum + (order.items || []).reduce((itemSum, item) =>
                itemSum + ((Number(item.price) || 0) * (Number(item.quantity || item.qnt || 0))), 0), 0);

        const previousOrderCount = previousOrders.length;

        const previousTurnAround = previousOrders.reduce((sum, order) => {
            if (!order.date || !order.completedAt) return sum;
            const start = order.date?.toDate ? order.date.toDate() : new Date(order.date);
            const end = order.completedAt?.toDate ? order.completedAt.toDate() : new Date(order.completedAt);
            return sum + (end - start) / (1000 * 60); // in minutes
        }, 0) / (previousOrders.filter(o => o.date && o.completedAt).length || 1);

        const previousOrderValue = previousSales / (previousOrderCount || 1);

        // Calculate percentage changes
        const calculatePercentChange = (current, previous) => {
            if (previous === 0) return current > 0 ? 100 : 0;
            return ((current - previous) / previous) * 100;
        };

        return {
            sales: calculatePercentChange(currentSales, previousSales),
            orders: calculatePercentChange(currentOrderCount, previousOrderCount),
            turnAround: calculatePercentChange(currentTurnAround, previousTurnAround),
            orderValue: calculatePercentChange(currentOrderValue, previousOrderValue)
        };
    };

    React.useEffect(() => {
        async function fetchAnalytics() {
            try {
                setLoading(true);
                setError(null);

                // Get current date range
                const currentRange = getDateRange(dateFilter);

                // Fetch all orders for analysis
                const ordersSnapshot = await sdk.db.collection("Orders")
                    .orderBy("date", "desc")
                    .limit(200) // Increased limit to get more historical data for trends
                    .get();

                const allOrders = ordersSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                // Filter orders for current period
                const currentPeriodOrders = allOrders.filter(order =>
                    isDateInRange(order.date, currentRange));

                // Calculate previous period range (same duration, earlier dates)
                const previousRange = {
                    start: currentRange.start ? new Date(currentRange.start.getTime() - (currentRange.end - currentRange.start)) : null,
                    end: currentRange.start ? new Date(currentRange.start) : null
                };

                // Filter orders for previous period
                const previousPeriodOrders = allOrders.filter(order =>
                    isDateInRange(order.date, previousRange));

                // Calculate trends
                const trends = calculateTrends(currentPeriodOrders, previousPeriodOrders);

                // Calculate metrics for current period
                const totalRevenue = currentPeriodOrders.reduce((sum, order) =>
                    sum + (order.items || []).reduce((itemSum, item) =>
                        itemSum + ((Number(item.price) || 0) * (Number(item.quantity || item.qnt || 0))), 0), 0);

                const totalOrders = currentPeriodOrders.length;

                // Calculate average turn around time
                const completedOrders = currentPeriodOrders.filter(order => order.date && order.completedAt);
                const avgTurnAroundTime = completedOrders.reduce((sum, order) => {
                    const start = order.date?.toDate ? order.date.toDate() : new Date(order.date);
                    const end = order.completedAt?.toDate ? order.completedAt.toDate() : new Date(order.completedAt);
                    return sum + (end - start) / (1000 * 60); // in minutes
                }, 0) / (completedOrders.length || 1);

                // Split orders by type
                const offlineOrders = currentPeriodOrders.filter(order => !order.isOnline);
                const onlineOrders = currentPeriodOrders.filter(order => order.isOnline);
                const zomatoOrders = currentPeriodOrders.filter(order => order.source === 'zomato');
                const dineInOrders = offlineOrders.filter(order => order.orderType === 'dine-in');

                // Calculate revenues by type
                const offlineSales = offlineOrders.reduce((sum, order) =>
                    sum + (order.items || []).reduce((itemSum, item) =>
                        itemSum + ((Number(item.price) || 0) * (Number(item.quantity || item.qnt || 0))), 0), 0);

                const onlineSales = onlineOrders.reduce((sum, order) =>
                    sum + (order.items || []).reduce((itemSum, item) =>
                        itemSum + ((Number(item.price) || 0) * (Number(item.quantity || item.qnt || 0))), 0), 0);

                const zomatoSales = zomatoOrders.reduce((sum, order) =>
                    sum + (order.items || []).reduce((itemSum, item) =>
                        itemSum + ((Number(item.price) || 0) * (Number(item.quantity || item.qnt || 0))), 0), 0);

                const dineInSales = dineInOrders.reduce((sum, order) =>
                    sum + (order.items || []).reduce((itemSum, item) =>
                        itemSum + ((Number(item.price) || 0) * (Number(item.quantity || item.qnt || 0))), 0), 0);

                setMetrics({
                    totalSales: totalRevenue,
                    totalOrders,
                    avgTurnAroundTime,
                    avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
                    offlineSales,
                    onlineSales,
                    zomatoSales,
                    dineInSales,
                    trends
                });

                setLoading(false);
            } catch (err) {
                console.error('Error fetching analytics:', err);
                setError('Failed to load analytics data');
                setLoading(false);
            }
        }

        fetchAnalytics();
    }, [dateFilter, customDateRange]);

    const MetricCard = ({ title, value, trend, type = 'currency', className = '' }) => {
        const chartRef = React.useRef(null);
        const canvasRef = React.useRef(null);

        // Color schemes for different metric types
        const colorSchemes = {
            totalSales: {
                background: 'bg-gradient-to-br from-emerald-50 to-teal-50',
                border: 'border-emerald-100',
                chart: {
                    line: '#059669',
                    fill: 'rgba(5, 150, 105, 0.1)'
                }
            },
            totalOrders: {
                background: 'bg-gradient-to-br from-blue-50 to-indigo-50',
                border: 'border-blue-100',
                chart: {
                    line: '#4F46E5',
                    fill: 'rgba(79, 70, 229, 0.1)'
                }
            },
            turnAround: {
                background: 'bg-gradient-to-br from-amber-50 to-orange-50',
                border: 'border-amber-100',
                chart: {
                    line: '#D97706',
                    fill: 'rgba(217, 119, 6, 0.1)'
                }
            },
            orderValue: {
                background: 'bg-gradient-to-br from-purple-50 to-fuchsia-50',
                border: 'border-purple-100',
                chart: {
                    line: '#7C3AED',
                    fill: 'rgba(124, 58, 237, 0.1)'
                }
            },
            offlineSales: {
                background: 'bg-gradient-to-br from-rose-50 to-pink-50',
                border: 'border-rose-100',
                chart: {
                    line: '#E11D48',
                    fill: 'rgba(225, 29, 72, 0.1)'
                }
            },
            onlineSales: {
                background: 'bg-gradient-to-br from-cyan-50 to-sky-50',
                border: 'border-cyan-100',
                chart: {
                    line: '#0891B2',
                    fill: 'rgba(8, 145, 178, 0.1)'
                }
            },
            dineIn: {
                background: 'bg-gradient-to-br from-lime-50 to-green-50',
                border: 'border-lime-100',
                chart: {
                    line: '#65A30D',
                    fill: 'rgba(101, 163, 13, 0.1)'
                }
            },
            zomato: {
                background: 'bg-gradient-to-br from-red-50 to-rose-50',
                border: 'border-red-100',
                chart: {
                    line: '#DC2626',
                    fill: 'rgba(220, 38, 38, 0.1)'
                }
            }
        };

        // Get color scheme based on title
        const getColorScheme = () => {
            switch (title.toLowerCase()) {
                case 'total sales': return colorSchemes.totalSales;
                case 'total orders': return colorSchemes.totalOrders;
                case 'turn around time (avg)': return colorSchemes.turnAround;
                case 'order value (avg)': return colorSchemes.orderValue;
                case 'offline sales': return colorSchemes.offlineSales;
                case 'online sales': return colorSchemes.onlineSales;
                case 'dine-in sales': return colorSchemes.dineIn;
                case 'zomato': return colorSchemes.zomato;
                default: return colorSchemes.totalSales;
            }
        };

        const scheme = getColorScheme();

        React.useEffect(() => {
            if (canvasRef.current) {
                if (chartRef.current) {
                    chartRef.current.destroy();
                }

                const data = Array.from({ length: 12 }, () => Math.random() * 100);
                const ctx = canvasRef.current.getContext('2d');
                chartRef.current = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: Array.from({ length: 12 }, (_, i) => i + 1),
                        datasets: [{
                            data: data,
                            borderColor: scheme.chart.line,
                            borderWidth: 1.5,
                            fill: true,
                            backgroundColor: scheme.chart.fill,
                            tension: 0.4,
                            pointRadius: 0
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            tooltip: { enabled: false }
                        },
                        scales: {
                            x: { display: false },
                            y: { display: false }
                        }
                    }
                });
            }

            return () => {
                if (chartRef.current) {
                    chartRef.current.destroy();
                }
            };
        }, [trend, scheme]);

        const formattedValue = type === 'currency'
            ? `₹${Math.round(value).toLocaleString()}`
            : type === 'time'
                ? `${Math.round(value)} min`
                : value.toString();

        const trendColor = trend >= 0 ? 'text-green-600' : 'text-red-600';
        const trendIcon = trend >= 0 ? '↑' : '↓';

        return (
            <div className={`relative overflow-hidden rounded-xl ${scheme.background} border ${scheme.border} shadow-sm hover:shadow-md transition-shadow`}>
                <div className="p-4">
                    <h3 className="text-sm font-medium text-gray-600">{title}</h3>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-gray-900">{formattedValue}</span>
                        <span className={`text-sm font-medium ${trendColor}`}>
                            {trendIcon} {Math.abs(trend).toFixed(1)}%
                        </span>
                    </div>
                </div>
                <div className="h-16 px-1">
                    <canvas ref={canvasRef} className="w-full h-full" />
                </div>
            </div>
        );
    };

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
                <button
                    className="block mx-auto mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    onClick={() => window.location.reload()}
                >
                    Try Again
                </button>
            </div>
        );
    }

    return (
        <div className="p-4 space-y-6">
            {/* Date filter tabs */}
            <div className="flex items-center gap-4 overflow-x-auto pb-2 mb-6">
                {dateFilters.map(filter => (
                    <button
                        key={filter.id}
                        className={`px-4 py-2 whitespace-nowrap ${dateFilter === filter.id
                            ? 'text-blue-600 border-b-2 border-blue-600 font-medium'
                            : 'text-gray-600 hover:text-blue-600'
                            }`}
                        onClick={() => setDateFilter(filter.id)}
                    >
                        {filter.label}
                    </button>
                ))}
            </div>

            {/* Custom date range picker */}
            {dateFilter === 'custom' && (
                <div className="flex items-center gap-4 mb-6">
                    <input
                        type="date"
                        value={customDateRange.start?.toISOString().split('T')[0] || ''}
                        onChange={(e) => setCustomDateRange(prev => ({
                            ...prev,
                            start: e.target.value ? new Date(e.target.value) : null
                        }))}
                        className="px-3 py-2 border border-gray-200 rounded-lg"
                    />
                    <span>to</span>
                    <input
                        type="date"
                        value={customDateRange.end?.toISOString().split('T')[0] || ''}
                        onChange={(e) => setCustomDateRange(prev => ({
                            ...prev,
                            end: e.target.value ? new Date(e.target.value) : null
                        }))}
                        className="px-3 py-2 border border-gray-200 rounded-lg"
                    />
                </div>
            )}

            {/* Main metrics grid */}
            <div className="grid grid-cols-2 gap-4">
                <MetricCard
                    title="Total Sales"
                    value={metrics.totalSales}
                    trend={metrics.trends.sales}
                    className="bg-green-50"
                />
                <MetricCard
                    title="Total Orders"
                    value={metrics.totalOrders}
                    trend={metrics.trends.orders}
                    type="number"
                    className="bg-blue-50"
                />
                <MetricCard
                    title="Turn Around Time (Avg)"
                    value={metrics.avgTurnAroundTime}
                    trend={metrics.trends.turnAround}
                    type="time"
                    className="bg-orange-50"
                />
                <MetricCard
                    title="Order Value (Avg)"
                    value={metrics.avgOrderValue}
                    trend={metrics.trends.orderValue}
                    className="bg-purple-50"
                />
            </div>

            {/* Sales breakdown */}
            <div className="grid grid-cols-2 gap-4 mt-6">
                <MetricCard
                    title="Offline Sales"
                    value={metrics.offlineSales}
                    trend={metrics.trends.sales}
                    className="bg-gray-50"
                />
                <MetricCard
                    title="Online Sales"
                    value={metrics.onlineSales}
                    trend={metrics.trends.sales}
                    className="bg-gray-50"
                />
                <MetricCard
                    title="Dine-in Sales"
                    value={metrics.dineInSales}
                    trend={metrics.trends.sales}
                    className="bg-gray-50"
                />
                <MetricCard
                    title="Zomato"
                    value={metrics.zomatoSales}
                    trend={metrics.trends.sales}
                    className="bg-gray-50"
                />
            </div>
        </div>
    );
} 