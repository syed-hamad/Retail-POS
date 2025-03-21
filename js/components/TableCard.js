// Table Card Component
function TableCard({ title, orders, duration, status, onTap, onLongPress }) {
    // Calculate color based on last placed date (similar to getColor in Flutter)
    const getColor = (duration) => {
        if (!duration) return 'bg-pink-50 border-pink-100';

        const minutes = duration.minutes || 0;

        if (minutes < 15) return 'bg-green-50 border-green-100';
        if (minutes < 30) return 'bg-orange-50 border-orange-100';
        return 'bg-red-50 border-red-100';
    };

    // Get message based on last placed date (similar to getMsg in Flutter)
    const getMessage = (duration) => {
        if (!duration) return 'No orders';

        const minutes = duration.minutes || 0;

        if (minutes < 3) return 'New order';
        return `${duration.display}`;
    };

    const color = getColor(duration);
    const message = getMessage(duration);
    const hasOrders = orders && orders.length > 0;

    // Calculate order status text
    const orderText = hasOrders
        ? `${orders.length} ${orders.length === 1 ? 'order' : 'orders'}`
        : 'No orders';

    return (
        <div
            className={`bg-white rounded-xl p-3 h-full flex flex-col cursor-pointer hover:shadow-md transition-all border ${color}`}
            onClick={onTap}
            onContextMenu={(e) => {
                e.preventDefault();
                onLongPress && onLongPress();
            }}
            style={{ backgroundColor: "#fff8f8" }}
        >
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold truncate">{title}</h3>
                <div className="w-6 h-6 flex items-center justify-center">
                    <i className="ph ph-table text-red-500 text-sm"></i>
                </div>
            </div>

            <div className="mt-auto">
                <div className={`text-sm font-medium px-3 py-1.5 rounded-full mb-2 inline-flex items-center ${hasOrders ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-500'}`}>
                    {hasOrders ? (
                        <i className="ph ph-shopping-bag text-xs mr-1.5"></i>
                    ) : (
                        <i className="ph ph-tray-empty text-xs mr-1.5"></i>
                    )}
                    {orderText}
                </div>

                {duration && hasOrders && (
                    <div className="text-xs bg-white bg-opacity-60 px-2 py-1 rounded-full inline-flex items-center">
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
            <div className="bg-white h-[150px] w-[150px] relative rounded-xl shadow-sm overflow-hidden" style={{ backgroundColor: "#fff8f8" }}>
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
                    <div className="absolute inset-2 bg-white bg-opacity-80 rounded-full flex items-center justify-center shadow-sm">
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
        if (!status) return 'bg-gray-50 text-gray-600';

        const label = status.label?.toUpperCase();

        if (label === 'PLACED') return 'bg-blue-50 text-blue-600';
        if (label === 'PROCESSING' || label === 'KITCHEN') return 'bg-orange-50 text-orange-600';
        if (label === 'COMPLETED') return 'bg-green-50 text-green-600';
        if (label === 'CANCELLED') return 'bg-red-50 text-red-600';

        return 'bg-gray-50 text-gray-600';
    };

    // Get status badge color
    const statusColor = getStatusColor(order.currentStatus);

    return (
        <div className="my-3">
            <div
                className="bg-white rounded-xl shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-all border border-red-100"
                onClick={handleOrderClick}
                style={{ backgroundColor: "#fff8f8" }}
            >
                <div className="p-3">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
                                <i className="ph ph-shopping-bag text-red-500"></i>
                            </div>
                            <div>
                                <h3 className="font-medium text-gray-900 truncate max-w-[150px]">
                                    {order.customer?.name || "Guest Customer"}
                                </h3>
                                <p className="text-xs text-gray-500">
                                    {timeAgo}
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-base font-semibold text-red-600">₹{totalAmount}</div>
                            <div className="text-xs text-gray-500">#{order.id?.slice(-6)}</div>
                        </div>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-1.5">
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColor}`}>
                                {order.currentStatus?.label?.toUpperCase() || "PLACED"}
                            </span>
                            <span className="px-2 py-0.5 bg-red-50 text-red-600 text-xs font-medium rounded-full inline-flex items-center">
                                <i className="ph ph-shopping-cart-simple text-xs mr-1"></i>
                                {totalItems} {totalItems === 1 ? 'item' : 'items'}
                            </span>
                        </div>
                        <span className="text-xs text-gray-500">
                            {order.orderSource || "In-store"}
                        </span>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end">
            <div className="bg-white w-full max-w-md h-full overflow-y-auto animate-slide-in-right">
                <div className="sticky top-0 bg-white border-b border-red-50 z-10 px-4 py-3 flex items-center justify-between">
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
                    <div className="bg-white rounded-xl p-3 border border-red-100 shadow-sm" style={{ backgroundColor: "#fff8f8" }}>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
                                    <i className="ph ph-user text-red-500"></i>
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
                                onClick={() => setIsCustomerSearchOpen(true)}
                                title="Assign Customer"
                            >
                                <i className="ph ph-user-plus"></i>
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
                            <div className="bg-white bg-opacity-60 p-2 rounded-lg">
                                <p className="text-xs text-gray-500">Order ID</p>
                                <p className="font-medium">#{order.id?.slice(-6)}</p>
                            </div>
                            <div className="bg-white bg-opacity-60 p-2 rounded-lg">
                                <p className="text-xs text-gray-500">Date & Time</p>
                                <p className="font-medium truncate">
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
                                <div key={index} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-red-100">
                                    <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
                                        {item.image ? (
                                            <img
                                                src={item.image}
                                                alt={item.title}
                                                className="w-full h-full object-cover rounded-lg"
                                            />
                                        ) : (
                                            <i className="ph ph-hamburger text-red-300"></i>
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
                    <div className="bg-white rounded-xl p-3 border border-red-100 shadow-sm" style={{ backgroundColor: "#fff8f8" }}>
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
                            <div className="border-t border-red-50 pt-2 flex justify-between mt-2">
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
                                    onClick={() => {
                                        onAccept && onAccept();
                                        onClose();
                                    }}
                                    className="flex-1 py-2.5 bg-green-600 text-white rounded-lg flex items-center justify-center gap-1.5 hover:bg-green-700 transition-colors text-sm font-medium"
                                >
                                    <i className="ph ph-check"></i>
                                    <span>Accept Order</span>
                                </button>
                                <button
                                    onClick={() => {
                                        onReject && onReject();
                                        onClose();
                                    }}
                                    className="flex-1 py-2.5 bg-red-600 text-white rounded-lg flex items-center justify-center gap-1.5 hover:bg-red-700 transition-colors text-sm font-medium"
                                >
                                    <i className="ph ph-x"></i>
                                    <span>Reject Order</span>
                                </button>
                            </div>
                            <button
                                onClick={() => {
                                    onDelete && onDelete();
                                    onClose();
                                }}
                                className="w-full py-2.5 bg-gray-100 text-gray-700 rounded-lg flex items-center justify-center gap-1.5 hover:bg-gray-200 transition-colors text-sm font-medium"
                            >
                                <i className="ph ph-trash"></i>
                                <span>Delete Order</span>
                            </button>
                        </div>
                    ) : (
                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={() => {
                                    onPrintBill && onPrintBill();
                                    onClose();
                                }}
                                className="flex-1 py-2.5 bg-red-600 text-white rounded-lg flex items-center justify-center gap-1.5 hover:bg-red-700 transition-colors text-sm font-medium"
                            >
                                <i className="ph ph-printer"></i>
                                <span>Print Bill</span>
                            </button>
                            <button
                                onClick={() => {
                                    onDelete && onDelete();
                                    onClose();
                                }}
                                className="w-10 h-10 bg-red-50 text-red-600 rounded-lg flex items-center justify-center hover:bg-red-100 transition-colors"
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