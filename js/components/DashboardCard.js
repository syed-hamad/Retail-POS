// Dashboard Card Component
function DashboardCard({ icon, title, value, trend }) {
    return (
        <div className="bg-white rounded-xl p-4 mb-4 shadow-sm hover:shadow transition-all duration-300" style={{ backgroundColor: "#fff8f8" }}>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-gray-600 text-sm">{title}</p>
                    <h3 className="text-gray-800 text-xl font-semibold mt-1">{value}</h3>
                </div>
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                    <i className={`ph ph-${icon} text-2xl text-red-500`} />
                </div>
            </div>
            {trend && (
                <p className={`text-sm mt-2 flex items-center ${trend > 0 ? 'text-green-600' : 'text-red-500'}`}>
                    <i className={`ph ph-${trend > 0 ? 'trend-up' : 'trend-down'} mr-1`}></i>
                    {Math.abs(trend)}% vs last month
                </p>
            )}
        </div>
    );
}

// Dashboard Tile Component
function DashboardTile({ tableId, variant, orders, onTap, onLongPress }) {
    // Find the oldest order for this table/variant
    const lastPlacedDate = orders.length > 0
        ? orders.map(o => o.currentStatus?.date).reduce((a, b) => {
            const dateA = parseDate(a);
            const dateB = parseDate(b);
            return dateA && dateB && dateA < dateB ? a : b;
        }, orders[0].currentStatus?.date)
        : null;

    // Get duration object from the getTimeDuration function
    const duration = lastPlacedDate ? getTimeDuration(lastPlacedDate) : null;

    // Get color based on time elapsed
    const getColor = (duration) => {
        if (!duration) return 'bg-pink-50 text-gray-800 border-pink-100';

        const minutes = duration.minutes;

        if (minutes > 30) return 'bg-red-50 text-gray-800 border-red-200';
        if (minutes > 15) return 'bg-orange-50 text-gray-800 border-orange-200';
        return 'bg-green-50 text-gray-800 border-green-200';
    };

    // Special colors for aggregator tables
    const getAggregatorColor = (id) => {
        if (id === 'zomato') return 'bg-red-50 text-gray-800 border-red-200';
        if (id === 'swiggy') return 'bg-orange-50 text-gray-800 border-orange-200';
        if (id === 'default') return 'bg-blue-50 text-gray-800 border-blue-200';
        return null;
    };

    // Determine if this is an aggregator table
    const isAggregator = ['zomato', 'swiggy', 'default'].includes(tableId);

    // Get the appropriate color
    const aggregatorColor = isAggregator ? getAggregatorColor(tableId) : null;
    const color = aggregatorColor || getColor(duration);

    const message = orders.length > 0
        ? `${orders.length} order${orders.length > 1 ? 's' : ''}`
        : 'No orders';

    // Display duration if available
    const durationDisplay = duration ? duration.display : '';

    return (
        <div
            className={`relative rounded-xl shadow-sm border ${color} cursor-pointer transition-all duration-300 transform hover:shadow-md overflow-hidden`}
            onClick={() => onTap && onTap()}
            onContextMenu={(e) => {
                e.preventDefault();
                onLongPress && onLongPress();
            }}
            style={{ backgroundColor: isAggregator && tableId === 'zomato' ? '#fff0f0' : '' }}
        >
            <div className="flex flex-col items-center justify-between h-full p-4">
                <h3 className="text-lg font-bold text-center mb-2">
                    {isAggregator ? (
                        <div className="flex items-center justify-center">
                            {tableId === 'zomato' && <i className="ph ph-pizza text-red-600 mr-1"></i>}
                            {tableId === 'swiggy' && <i className="ph ph-bicycle text-orange-600 mr-1"></i>}
                            {tableId === 'default' && <i className="ph ph-globe text-blue-600 mr-1"></i>}
                            {tableId.charAt(0).toUpperCase() + tableId.slice(1)}
                        </div>
                    ) : (
                        <div className="flex items-center">
                            <i className="ph ph-table text-red-500 mr-1"></i>
                            {tableId || variant || "Default"}
                        </div>
                    )}
                </h3>
                <div className="bg-white bg-opacity-80 px-4 py-2 rounded-full text-sm font-medium shadow-sm mb-2">
                    {message}
                </div>
                {duration && orders.length > 0 && (
                    <div className="text-xs bg-white bg-opacity-60 px-3 py-1 rounded-full">
                        <i className="ph ph-clock text-red-500 mr-1"></i> {durationDisplay}
                    </div>
                )}
            </div>
        </div>
    );
} 