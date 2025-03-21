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

    return (
        <div
            className={`bg-white rounded-xl p-4 aspect-square flex flex-col cursor-pointer hover:shadow-md transition-all border ${color}`}
            onClick={onTap}
            onContextMenu={(e) => {
                e.preventDefault();
                onLongPress && onLongPress();
            }}
            style={{ backgroundColor: "#fff8f8" }}
        >
            <div className="flex flex-col items-center justify-between h-full">
                <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mb-3">
                    <i className="ph ph-table text-red-500 text-2xl"></i>
                </div>

                <h3 className="text-lg font-bold text-center mb-2">{title}</h3>

                <div className="bg-white bg-opacity-80 px-4 py-2 rounded-full text-sm font-medium shadow-sm mb-2">
                    {orders && orders.length > 0 ? (
                        <span className="text-red-500">{orders.length} {orders.length === 1 ? 'order' : 'orders'}</span>
                    ) : (
                        <span className="text-gray-500">No orders</span>
                    )}
                </div>

                {duration && (
                    <div className="text-xs bg-white bg-opacity-60 px-3 py-1 rounded-full">
                        <i className="ph ph-clock text-red-500 mr-1"></i> {message}
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

    return (
        <div className="my-3">
            <div
                className="bg-white rounded-xl shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-all border border-pink-100"
                onClick={handleOrderClick}
                style={{ backgroundColor: "#fff8f8" }}
            >
                <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                                <span className="text-lg font-semibold text-red-600">{totalItems}</span>
                            </div>
                            <div>
                                <h3 className="font-medium text-gray-900">
                                    {order.customer?.name || "Your Customer"}
                                </h3>
                                <p className="text-sm text-gray-500">
                                    {timeAgo}
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-lg font-semibold text-red-600">₹{totalAmount}</div>
                            <div className="text-sm text-gray-500">Bill No: #{order.id?.slice(-6)}</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-orange-50 text-orange-600 text-xs font-medium rounded-full">
                            {order.orderSource || "Online"}
                        </span>
                        <span className="px-2 py-1 bg-pink-50 text-red-600 text-xs font-medium rounded-full">
                            {order.currentStatus?.label || "PLACED"}
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
                <div className="sticky top-0 bg-white border-b z-10">
                    <div className="p-4 flex items-center justify-between">
                        <h2 className="text-xl font-semibold">Order Details</h2>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-full"
                        >
                            <i className="ph ph-x text-xl"></i>
                        </button>
                    </div>
                </div>

                <div className="p-4">
                    {/* Customer Info */}
                    <div className="bg-gray-50 rounded-xl p-4 mb-6">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                                    <i className="ph ph-user text-2xl text-gray-500"></i>
                                </div>
                                <div>
                                    <h3 className="font-medium text-gray-900">
                                        {order.customer?.name || "Your Customer"}
                                    </h3>
                                    <p className="text-sm text-gray-500">
                                        {order.customer?.phone || "No phone"}
                                    </p>
                                </div>
                            </div>
                            <button
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-full"
                                onClick={() => setIsCustomerSearchOpen(true)}
                                title="Assign Customer"
                            >
                                <i className="ph ph-user-plus text-xl"></i>
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-gray-500">Order ID</p>
                                <p className="font-medium">#{order.id?.slice(-6)}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Date & Time</p>
                                <p className="font-medium">
                                    {formatDate(order.date, 'full')}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Items List */}
                    <div className="mb-6">
                        <h3 className="text-lg font-medium mb-4">Order Items</h3>
                        <div className="space-y-4">
                            {order.items?.map((item, index) => (
                                <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                    <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                                        {item.image ? (
                                            <img
                                                src={item.image}
                                                alt={item.title}
                                                className="w-full h-full object-cover rounded-lg"
                                            />
                                        ) : (
                                            <i className="ph ph-image text-2xl text-gray-400"></i>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-medium text-gray-900">{item.title}</h4>
                                        <div className="flex justify-between items-center mt-1">
                                            <p className="text-sm text-gray-500">
                                                {item.quantity || 1} x ₹{item.price || 0}
                                            </p>
                                            <p className="font-medium">
                                                ₹{(item.quantity || 1) * (item.price || 0)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Bill Details */}
                    <div className="bg-gray-50 rounded-xl p-4 mb-6">
                        <h3 className="text-lg font-medium mb-4">Bill Details</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Item Total</span>
                                <span className="font-medium">₹{totalAmount}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Tax (18%)</span>
                                <span className="font-medium">₹{taxAmount.toFixed(2)}</span>
                            </div>
                            <div className="border-t pt-3 flex justify-between">
                                <span className="font-medium">Grand Total</span>
                                <span className="font-semibold">₹{finalAmount.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    {isNewOrder ? (
                        <div className="space-y-3">
                            <div className="flex gap-4">
                                <button
                                    onClick={() => {
                                        onAccept && onAccept();
                                        onClose();
                                    }}
                                    className="flex-1 py-3 bg-green-600 text-white rounded-xl flex items-center justify-center gap-2 hover:bg-green-700 transition-colors"
                                >
                                    <i className="ph ph-check text-xl"></i>
                                    <span>Accept Order</span>
                                </button>
                                <button
                                    onClick={() => {
                                        onReject && onReject();
                                        onClose();
                                    }}
                                    className="flex-1 py-3 bg-red-600 text-white rounded-xl flex items-center justify-center gap-2 hover:bg-red-700 transition-colors"
                                >
                                    <i className="ph ph-x text-xl"></i>
                                    <span>Reject Order</span>
                                </button>
                            </div>
                            <button
                                onClick={() => {
                                    onDelete && onDelete();
                                    onClose();
                                }}
                                className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors"
                            >
                                <i className="ph ph-trash text-xl"></i>
                                <span>Delete Order</span>
                            </button>
                        </div>
                    ) : (
                        <div className="flex gap-4">
                            <button
                                onClick={() => {
                                    onPrintBill && onPrintBill();
                                    onClose();
                                }}
                                className="flex-1 py-3 bg-blue-600 text-white rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors"
                            >
                                <i className="ph ph-printer text-xl"></i>
                                <span>Print Bill</span>
                            </button>
                            <button
                                onClick={() => {
                                    onDelete && onDelete();
                                    onClose();
                                }}
                                className="py-3 px-4 bg-red-50 text-red-600 rounded-xl flex items-center justify-center hover:bg-red-100 transition-colors"
                            >
                                <i className="ph ph-trash text-xl"></i>
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