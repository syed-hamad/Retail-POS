// Table Card Component
function TableCard({ title, orders, duration, status, onTap, onLongPress, compact = false }) {
    // Calculate color based on last placed date (similar to getColor in Flutter)
    const getColor = (duration) => {
        if (!duration) return {
            border: 'border-gray-200',
            gradient: 'bg-gradient-to-br from-card-bg to-white'
        };

        const minutes = duration.minutes || 0;

        if (minutes < 15) return {
            border: 'border-gray-200',
            gradient: 'bg-gradient-to-br from-green-50 to-white'
        };
        if (minutes < 30) return {
            border: 'border-gray-200',
            gradient: 'bg-gradient-to-br from-orange-50 to-white'
        };
        return {
            border: 'border-gray-200',
            gradient: 'bg-gradient-to-br from-red-50 to-white'
        };
    };

    // Get message based on last placed date (similar to getMsg in Flutter)
    const getMessage = (duration) => {
        if (!duration) return 'No orders';

        const minutes = duration.minutes || 0;

        if (minutes < 3) return 'New order';
        return `${duration.display}`;
    };

    const colorStyle = getColor(duration);
    const message = getMessage(duration);
    const hasOrders = orders && orders.length > 0;

    // Calculate order status text
    const orderText = hasOrders
        ? `${orders.length} ${orders.length === 1 ? 'order' : 'orders'}`
        : 'No orders';

    // Render compact version for mobile
    if (compact) {
        return (
            <div
                className={`${colorStyle.gradient} rounded-xl p-2 md:p-3 h-full flex flex-col cursor-pointer hover:shadow-md transition-all border ${colorStyle.border} shadow-section`}
                onClick={onTap}
                onContextMenu={(e) => {
                    e.preventDefault();
                    onLongPress && onLongPress();
                }}
            >
                <div className="flex items-center justify-between mb-1.5 md:mb-2">
                    <h3 className="text-xs md:text-sm font-bold line-clamp-1 leading-tight max-w-[70%]">{title}</h3>
                    <div className="w-6 h-6 md:w-7 md:h-7 rounded-lg bg-gradient-to-br from-white to-white/80 flex items-center justify-center shadow-sm flex-shrink-0">
                        <i className="ph ph-table text-red-500 text-xs md:text-sm"></i>
                    </div>
                </div>

                <div className="mt-auto">
                    <div className={`text-2xs md:text-xs font-medium px-1.5 py-0.5 md:px-2 md:py-1 rounded-full mb-0.5 md:mb-1 inline-flex items-center ${hasOrders ? 'bg-gradient-to-r from-red-100 to-red-50 text-red-600' : 'bg-gradient-to-r from-gray-100 to-gray-50 text-gray-500'}`}>
                        {hasOrders ? (
                            <i className="ph ph-shopping-bag text-2xs md:text-xs mr-0.5 md:mr-1"></i>
                        ) : (
                            <i className="ph ph-tray-empty text-2xs md:text-xs mr-0.5 md:mr-1"></i>
                        )}
                        {orderText}
                    </div>

                    {duration && hasOrders && (
                        <div className="text-2xs md:text-xs bg-gradient-to-r from-gray-100 to-gray-50 px-1.5 md:px-2 py-0.5 md:py-1 rounded-full inline-flex items-center">
                            <i className="ph ph-clock text-red-500 text-2xs md:text-xs mr-0.5 md:mr-1"></i>
                            {message}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Render standard version
    return (
        <div
            className={`${colorStyle.gradient} rounded-xl p-4 h-full flex flex-col cursor-pointer hover:shadow-md transition-all border ${colorStyle.border} shadow-section`}
            onClick={onTap}
            onContextMenu={(e) => {
                e.preventDefault();
                onLongPress && onLongPress();
            }}
        >
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold truncate max-w-[70%]">{title}</h3>
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-white to-white/80 flex items-center justify-center shadow-sm">
                    <i className="ph ph-table text-red-500 text-lg"></i>
                </div>
            </div>

            <div className="mt-auto">
                <div className={`text-sm font-medium px-3 py-1.5 rounded-full mb-2 inline-flex items-center ${hasOrders ? 'bg-gradient-to-r from-red-100 to-red-50 text-red-600' : 'bg-gradient-to-r from-gray-100 to-gray-50 text-gray-500'}`}>
                    {hasOrders ? (
                        <i className="ph ph-shopping-bag text-xs mr-1.5"></i>
                    ) : (
                        <i className="ph ph-tray-empty text-xs mr-1.5"></i>
                    )}
                    {orderText}
                </div>

                {duration && hasOrders && (
                    <div className="text-xs bg-gradient-to-r from-gray-100 to-gray-50 px-2 py-1 rounded-full inline-flex items-center">
                        <i className="ph ph-clock text-red-500 text-xs mr-1"></i>
                        {message}
                    </div>
                )}
            </div>
        </div>
    );
}

// Order Thumb Component
function OrderThumb({ order }) {
    return (
        <div className="p-2 pl-4 pr-4">
            <div className="bg-gradient-to-br from-warm-bg to-white h-[150px] w-[150px] relative rounded-xl shadow-sm overflow-hidden border border-gray-100">
                <div className="absolute inset-0 overflow-hidden">
                    {order.items && order.items.length > 0 && (
                        <img
                            src={order.items[0].thumb || 'https://via.placeholder.com/150'}
                            alt={order.items[0].title || 'Order item'}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="%23ccc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
                            }}
                        />
                    )}
                    <div className="absolute inset-2 bg-gradient-to-br from-white to-white/80 rounded-full flex items-center justify-center shadow-sm">
                        <div className="text-center">
                            <div className="text-3xl font-bold leading-none text-red-500">
                                {order.items ? order.items.length : 0}
                            </div>
                            <div className="text-sm leading-none text-gray-600">items</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Order Group Tile Component
function OrderGroupTile({ order, onAccept, onReject, onDelete, onPrintBill }) {
    const [isExpanded, setIsExpanded] = React.useState(false);

    const handleOrderClick = () => {
        setIsExpanded(true);
    };

    // Calculate total items and amount
    const totalItems = order.items?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 0;
    const totalAmount = order.items?.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 1)), 0) || 0;

    // Get time ago duration
    const duration = getTimeDuration(order.date);
    const timeAgo = duration ? duration.display + ' ago' : 'Just now';

    // Get status color
    const getStatusColor = (status) => {
        if (!status) return 'bg-gradient-to-r from-gray-100 to-gray-50 text-gray-600';

        const label = status.label?.toUpperCase();

        if (label === 'PLACED') return 'bg-gradient-to-r from-blue-100 to-blue-50 text-blue-600';
        if (label === 'PROCESSING' || label === 'KITCHEN') return 'bg-gradient-to-r from-orange-100 to-orange-50 text-orange-600';
        if (label === 'COMPLETED') return 'bg-gradient-to-r from-green-100 to-green-50 text-green-600';
        if (label === 'CANCELLED') return 'bg-gradient-to-r from-red-100 to-red-50 text-red-600';

        return 'bg-gradient-to-r from-gray-100 to-gray-50 text-gray-600';
    };

    // Get status badge color
    const statusColor = getStatusColor(order.currentStatus);

    return (
        <div className="my-1.5">
            <div
                className="bg-gradient-to-br from-warm-bg to-white rounded-xl shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-all border border-gray-200"
                onClick={handleOrderClick}
            >
                <div className="p-2.5 md:p-3">
                    <div className="flex items-center justify-between mb-1.5 md:mb-2">
                        <div className="flex items-center gap-1.5 md:gap-3">
                            <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-red-50 to-white rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
                                <i className="ph ph-shopping-bag text-red-500 text-base md:text-lg"></i>
                            </div>
                            <div>
                                <h3 className="font-medium text-gray-900 line-clamp-1 max-w-[120px] md:max-w-[200px] text-sm md:text-base">
                                    {order.customer?.name || "Guest Customer"}
                                </h3>
                                <p className="text-xs md:text-sm text-gray-500">
                                    {timeAgo}
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-sm md:text-base font-semibold text-red-600">₹{totalAmount}</div>
                            <div className="text-xs text-gray-500">#{order.id?.slice(-6)}</div>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-1 mt-1.5 md:mt-2">
                        <div className="flex items-center gap-1 md:gap-2 flex-wrap">
                            <span className={`px-1.5 py-0.5 md:px-2 md:py-1 rounded-full text-xs md:text-sm font-medium ${statusColor}`}>
                                {order.currentStatus?.label?.toUpperCase() || "PLACED"}
                            </span>
                            <span className="px-1.5 py-0.5 md:px-2 md:py-1 bg-gradient-to-r from-red-100 to-red-50 text-red-600 text-xs md:text-sm font-medium rounded-full inline-flex items-center">
                                <i className="ph ph-shopping-cart-simple text-xs mr-0.5 md:mr-1"></i>
                                {totalItems} {totalItems === 1 ? 'item' : 'items'}
                            </span>
                            <span className="hidden md:inline-flex px-2 py-1 bg-gradient-to-r from-gray-100 to-gray-50 text-gray-600 text-sm font-medium rounded-full items-center">
                                <i className="ph ph-map-pin text-gray-500 mr-1"></i>
                                {order.address?.area || "In-store"}
                            </span>
                        </div>
                        <span className="text-2xs md:text-xs text-gray-500">
                            {order.orderSource || "In-store"}
                        </span>
                    </div>

                    {/* Desktop Quick Actions - Only visible on md screens and up */}
                    <div className="hidden md:flex justify-end mt-2 gap-2">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onAccept && onAccept();
                            }}
                            className="px-2 py-1 bg-gradient-to-r from-green-600 to-green-500 text-white rounded-lg text-xs font-medium"
                        >
                            <i className="ph ph-check mr-1"></i>
                            Accept
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onReject && onReject();
                            }}
                            className="px-2 py-1 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-lg text-xs font-medium"
                        >
                            <i className="ph ph-x mr-1"></i>
                            Reject
                        </button>
                    </div>
                </div>
            </div>

            {/* Order Details Modal */}
            {isExpanded && (
                <OrderDetailsModal
                    order={order}
                    onClose={() => setIsExpanded(false)}
                    onAccept={onAccept}
                    onReject={onReject}
                    onDelete={onDelete}
                    onPrintBill={onPrintBill}
                />
            )}
        </div>
    );
}

// Order Details Modal Component
function OrderDetailsModal({ order, onClose, onAccept, onReject, onDelete, onPrintBill }) {
    const [isCustomerSearchOpen, setIsCustomerSearchOpen] = React.useState(false);
    const totalAmount = order.items?.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || item.qnt || 1)), 0) || 0;
    const taxAmount = totalAmount * 0.18; // Assuming 18% tax
    const finalAmount = totalAmount + taxAmount;

    // Determine if this is a new order that can be accepted/rejected
    const isNewOrder = order.currentStatus?.label === "PLACED";

    // Handle selecting a customer
    const handleSelectCustomer = async (customer) => {
        try {
            // Update the order with the selected customer
            await sdk.orders.setCustomer(order.id, customer);

            // Show success message
            showToast(`Customer ${customer.name} assigned to order`);

            // Refresh the order data
            // In a real implementation, you would update the order state
            // For now, we'll just close and reopen the modal
            onClose();
        } catch (err) {
            console.error('Error assigning customer:', err);
            showToast('Failed to assign customer', 'error');
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end"
            onClick={onClose}
        >
            <div
                className="bg-gradient-to-br from-warm-bg to-white w-full max-w-md h-full overflow-y-auto animate-slide-in-right shadow-section"
                onClick={e => e.stopPropagation()}
            >
                <div className="sticky top-0 bg-white border-b border-gray-200 z-10 px-4 py-3 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-800">Order Details</h2>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center hover:bg-red-50 text-gray-600 rounded-full transition-colors"
                    >
                        <i className="ph ph-x"></i>
                    </button>
                </div>

                <div className="p-4 space-y-4">
                    {/* Customer Info */}
                    <div className="bg-gradient-to-br from-warm-bg to-white rounded-xl p-4 border border-gray-200 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-red-50 to-white rounded-lg flex items-center justify-center shadow-sm">
                                    <i className="ph ph-user text-red-500 text-lg"></i>
                                </div>
                                <div>
                                    <h3 className="font-medium text-gray-900 truncate max-w-[160px]">
                                        {order.customer?.name || "Guest Customer"}
                                    </h3>
                                    <p className="text-xs text-gray-500 truncate max-w-[160px]">
                                        {order.customer?.phone || "No phone"}
                                    </p>
                                </div>
                            </div>
                            <button
                                className="w-8 h-8 flex items-center justify-center text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsCustomerSearchOpen(true);
                                }}
                                title="Assign Customer"
                            >
                                <i className="ph ph-user-plus"></i>
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-3">
                            <div className="bg-gradient-to-br from-gray-100 to-gray-50 p-2 rounded-lg">
                                <p className="text-xs text-gray-500">Order ID</p>
                                <p className="font-medium text-sm">#{order.id?.slice(-6)}</p>
                            </div>
                            <div className="bg-gradient-to-br from-gray-100 to-gray-50 p-2 rounded-lg">
                                <p className="text-xs text-gray-500">Date & Time</p>
                                <p className="font-medium text-sm truncate">
                                    {formatDate(order.date, 'full')}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Items List */}
                    <div>
                        <h3 className="text-sm font-semibold mb-2 text-gray-700 flex items-center">
                            <i className="ph ph-shopping-cart text-red-500 mr-1.5"></i>
                            Order Items
                        </h3>
                        <div className="space-y-2">
                            {order.items?.map((item, index) => (
                                <div key={index} className="flex items-center gap-2 p-3 bg-gradient-to-br from-warm-bg to-white rounded-lg border border-gray-200 shadow-sm">
                                    <div className="w-12 h-12 bg-gradient-to-br from-gray-100 to-white rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
                                        {item.image ? (
                                            <img
                                                src={item.image}
                                                alt={item.title}
                                                className="w-full h-full object-cover rounded-lg"
                                                onError={(e) => {
                                                    e.target.onerror = null;
                                                    e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="%23ccc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
                                                }}
                                            />
                                        ) : (
                                            <i className="ph ph-hamburger text-gray-400 text-lg"></i>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-medium text-gray-900 truncate">{item.title}</h4>
                                        <div className="flex justify-between items-center mt-1">
                                            <p className="text-xs text-gray-500">
                                                {item.quantity || 1} x ₹{item.price || 0}
                                            </p>
                                            <p className="font-medium text-sm">
                                                ₹{(item.quantity || 1) * (item.price || 0)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Bill Details */}
                    <div className="bg-gradient-to-br from-warm-bg to-white rounded-xl p-4 border border-gray-200 shadow-sm">
                        <h3 className="text-sm font-semibold mb-3 text-gray-700 flex items-center">
                            <i className="ph ph-receipt text-red-500 mr-1.5"></i>
                            Bill Details
                        </h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Item Total</span>
                                <span className="font-medium">₹{totalAmount}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Tax (18%)</span>
                                <span className="font-medium">₹{taxAmount.toFixed(2)}</span>
                            </div>
                            <div className="border-t border-gray-200 pt-2 flex justify-between mt-2">
                                <span className="font-medium">Grand Total</span>
                                <span className="font-semibold text-red-600">₹{finalAmount.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    {isNewOrder ? (
                        <div className="space-y-2 pt-2">
                            <div className="flex gap-2">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onAccept && onAccept();
                                        onClose();
                                    }}
                                    className="flex-1 py-2.5 bg-gradient-to-r from-green-600 to-green-500 text-white rounded-lg flex items-center justify-center gap-1.5 hover:from-green-700 hover:to-green-600 transition-colors text-sm font-medium shadow-sm"
                                >
                                    <i className="ph ph-check"></i>
                                    <span>Accept Order</span>
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onReject && onReject();
                                        onClose();
                                    }}
                                    className="flex-1 py-2.5 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-lg flex items-center justify-center gap-1.5 hover:from-red-700 hover:to-red-600 transition-colors text-sm font-medium shadow-sm"
                                >
                                    <i className="ph ph-x"></i>
                                    <span>Reject Order</span>
                                </button>
                            </div>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete && onDelete();
                                    onClose();
                                }}
                                className="w-full py-2.5 bg-gradient-to-r from-gray-100 to-gray-50 text-gray-700 rounded-lg flex items-center justify-center gap-1.5 hover:from-gray-200 hover:to-gray-100 transition-colors text-sm font-medium shadow-sm border border-gray-200"
                            >
                                <i className="ph ph-trash"></i>
                                <span>Delete Order</span>
                            </button>
                        </div>
                    ) : (
                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onPrintBill && onPrintBill();
                                    onClose();
                                }}
                                className="flex-1 py-2.5 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-lg flex items-center justify-center gap-1.5 hover:from-red-700 hover:to-red-600 transition-colors text-sm font-medium shadow-sm"
                            >
                                <i className="ph ph-printer"></i>
                                <span>Print Bill</span>
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete && onDelete();
                                    onClose();
                                }}
                                className="w-10 h-10 bg-gradient-to-r from-gray-100 to-gray-50 text-red-600 rounded-lg flex items-center justify-center hover:from-gray-200 hover:to-gray-100 transition-colors shadow-sm border border-gray-200"
                            >
                                <i className="ph ph-trash"></i>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Customer Search Modal */}
            {isCustomerSearchOpen && (
                <CustomerSearch
                    isOpen={isCustomerSearchOpen}
                    onClose={() => setIsCustomerSearchOpen(false)}
                    onSelectCustomer={handleSelectCustomer}
                />
            )}
        </div>
    );
}

// No Orders Found Component
function NoOrdersFound() {
    return (
        <div className="flex flex-col items-center justify-center py-20 opacity-30">
            <i className="ph ph-table text-5xl text-blue-800 mb-4"></i>
            <p className="text-xl font-bold text-blue-800 text-center">
                No tables added yet
            </p>
        </div>
    );
} 