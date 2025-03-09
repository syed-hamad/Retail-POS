// Dashboard Card Component
function DashboardCard({ icon, title, value, trend }) {
    return (
        <div className="card p-4 mb-4">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-light text-sm">{title}</p>
                    <h3 className="text-dark text-xl font-semibold mt-1">{value}</h3>
                </div>
                <i className={`ph ph-${icon} text-2xl text-primary`} />
            </div>
            {trend && (
                <p className={`text-sm mt-2 ${trend > 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}% vs last month
                </p>
            )}
        </div>
    );
}

// Dashboard Tile Component
function DashboardTile({ tableId, variant, orders, onTap, onLongPress }) {
    // Find the oldest order for this table/variant
    const lastPlacedDate = orders.length > 0
        ? orders.map(o => o.currentStatus?.date).reduce((a, b) =>
            new Date(a) < new Date(b) ? a : b, orders[0].currentStatus?.date)
        : null;

    // Get duration object from the getTimeDuration function
    const duration = lastPlacedDate ? getTimeDuration(lastPlacedDate) : null;

    // Get color based on time elapsed
    const getColor = (duration) => {
        if (!duration) return 'bg-blue-100 text-blue-800';

        const minutes = duration.minutes;

        if (minutes > 30) return 'bg-red-100 text-red-800';
        if (minutes > 15) return 'bg-orange-100 text-orange-800';
        return 'bg-green-100 text-green-800';
    };

    // Special colors for aggregator tables
    const getAggregatorColor = (id) => {
        if (id === 'zomato') return 'bg-red-100 text-red-800';
        if (id === 'swiggy') return 'bg-orange-100 text-orange-800';
        if (id === 'default') return 'bg-blue-100 text-blue-800';
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

    // Handle remove button click
    const handleRemove = (e) => {
        e.stopPropagation(); // Prevent triggering the tile's onClick
        if (tableId && !isAggregator) {
            removeTable(tableId);
        }
    };

    return (
        <div
            className={`relative rounded-lg shadow-sm ${color} cursor-pointer transition-all duration-300 transform hover:scale-105 hover:shadow-md`}
            onClick={() => onTap && onTap()}
            onContextMenu={(e) => {
                e.preventDefault();
                onLongPress && onLongPress();
            }}
        >
            {/* Remove button - only show for tables, not variants or aggregators */}
            {tableId && !variant && !isAggregator && (
                <button
                    className="absolute top-1 right-1 text-gray-500 hover:text-red-500 p-1 rounded-full hover:bg-white hover:bg-opacity-30 z-10"
                    onClick={handleRemove}
                    title="Remove table"
                >
                    <i className="ph ph-trash text-sm"></i>
                </button>
            )}
            <div className="flex flex-col items-center justify-between h-full py-2">
                <h3 className="text-lg font-bold text-center mb-2">
                    {isAggregator ? (
                        <div className="flex items-center justify-center">
                            {tableId === 'zomato' && <i className="ph ph-pizza text-red-600 mr-1"></i>}
                            {tableId === 'swiggy' && <i className="ph ph-bicycle text-orange-600 mr-1"></i>}
                            {tableId === 'default' && <i className="ph ph-globe text-blue-600 mr-1"></i>}
                            {tableId.charAt(0).toUpperCase() + tableId.slice(1)}
                        </div>
                    ) : (
                        tableId || variant || "Default"
                    )}
                </h3>
                <div className="bg-white bg-opacity-60 px-3 py-1 rounded-md text-xs mb-2">
                    {message}
                </div>
                {duration && orders.length > 0 && (
                    <div className="text-xs">
                        {durationDisplay}
                    </div>
                )}
            </div>
        </div>
    );
} 