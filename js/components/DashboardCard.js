// Dashboard Card Component
function DashboardCard({ icon, title, value, trend, color }) {
    let colorClass = 'text-gray-600';
    let bgClass = 'bg-gray-50';
    let trendColorClass = 'text-gray-400';
    let iconColorClass = 'text-red-600';
    
    if (color === 'primary' || color === 'red') {
        bgClass = 'bg-red-50';
        iconColorClass = 'text-red-600';
    } else if (color === 'success' || color === 'green') {
        bgClass = 'bg-green-50';
        iconColorClass = 'text-green-600';
    } else if (color === 'info' || color === 'blue') {
        bgClass = 'bg-blue-50';
        iconColorClass = 'text-blue-600';
    } else if (color === 'warning' || color === 'orange') {
        bgClass = 'bg-orange-50';
        iconColorClass = 'text-orange-600';
    }
    
    if (trend) {
        if (trend.startsWith('+')) {
            trendColorClass = 'text-green-600';
        } else if (trend.startsWith('-')) {
            trendColorClass = 'text-red-600';
        }
    }
    
    return (
        <div className={`rounded-xl border p-3 ${bgClass} bg-white shadow-sm`}>
            <div className="flex items-center justify-between mb-2">
                <div className="font-medium text-sm truncate">{title}</div>
                <div className={`w-8 h-8 flex items-center justify-center rounded-lg ${bgClass}`}>
                    <i className={`ph ${icon} ${iconColorClass}`}></i>
                </div>
            </div>
            
            <div className="flex items-end justify-between">
                <div className="text-xl font-bold truncate" title={value}>{value}</div>
                {trend && (
                    <div className={`text-xs ${trendColorClass} flex items-center`}>
                        {trend.startsWith('+') ? (
                            <i className="ph ph-trend-up mr-1"></i>
                        ) : trend.startsWith('-') ? (
                            <i className="ph ph-trend-down mr-1"></i>
                        ) : (
                            <i className="ph ph-minus mr-1"></i>
                        )}
                        {trend}
                    </div>
                )}
            </div>
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
        if (!duration) return 'bg-pink-50 border-pink-100';

        const minutes = duration.minutes;

        if (minutes > 30) return 'bg-red-50 border-red-200';
        if (minutes > 15) return 'bg-orange-50 border-orange-200';
        return 'bg-green-50 border-green-100';
    };

    // Special colors for aggregator tables
    const getAggregatorColor = (id) => {
        if (id === 'zomato') return 'bg-red-50 border-red-200';
        if (id === 'swiggy') return 'bg-orange-50 border-orange-200';
        if (id === 'default') return 'bg-blue-50 border-blue-200';
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
    
    // Get appropriate icon for aggregator
    const getAggregatorIcon = (id) => {
        if (id === 'zomato') return 'ph-pizza';
        if (id === 'swiggy') return 'ph-bicycle';
        return 'ph-globe';
    };
    
    // Get appropriate color for icon
    const getIconColor = (id) => {
        if (id === 'zomato') return 'text-red-600';
        if (id === 'swiggy') return 'text-orange-600';
        return 'text-blue-600';
    };

    return (
        <div
            className={`bg-white rounded-xl p-3 h-full flex flex-col cursor-pointer hover:shadow-md transition-all border ${color}`}
            onClick={() => onTap && onTap()}
            onContextMenu={(e) => {
                e.preventDefault();
                onLongPress && onLongPress();
            }}
            style={{ backgroundColor: isAggregator && tableId === 'zomato' ? '#fff0f0' : '' }}
        >
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold truncate">
                    {isAggregator ? tableId.charAt(0).toUpperCase() + tableId.slice(1) : (tableId || variant || "Default")}
                </h3>
                <div className="w-6 h-6 flex items-center justify-center">
                    {isAggregator ? (
                        <i className={`ph ${getAggregatorIcon(tableId)} ${getIconColor(tableId)} text-sm`}></i>
                    ) : (
                        <i className="ph ph-layout text-red-500 text-sm"></i>
                    )}
                </div>
            </div>
            
            <div className="mt-auto">
                <div className={`text-sm font-medium px-3 py-1.5 rounded-full mb-2 inline-flex items-center ${orders.length > 0 ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-500'}`}>
                    {orders.length > 0 ? (
                        <i className="ph ph-shopping-bag text-xs mr-1.5"></i>
                    ) : (
                        <i className="ph ph-tray-empty text-xs mr-1.5"></i>
                    )}
                    {message}
                </div>
                
                {duration && orders.length > 0 && (
                    <div className="text-xs bg-white bg-opacity-60 px-2 py-1 rounded-full inline-flex items-center">
                        <i className="ph ph-clock text-red-500 text-xs mr-1"></i>
                        {durationDisplay}
                    </div>
                )}
            </div>
        </div>
    );
} 