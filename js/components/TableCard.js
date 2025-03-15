// Table Card Component
function TableCard({ title, orders, duration, status }) {
    const statusColors = {
        active: 'bg-green-100 text-green-800',
        inactive: 'bg-gray-100 text-gray-600'
    };

    return (
        <div className="card p-4 aspect-square flex flex-col cursor-pointer hover:border-2 hover:border-primary transition-all">
            <h3 className="text-lg font-medium mb-2">{title}</h3>
            <div className="flex items-center gap-2 text-gray-600 text-sm">
                <i className="ph ph-hourglass text-lg" />
                {duration ? <span>{duration}</span> : <span>No orders</span>}
            </div>
            {orders && (
                <div className="mt-2">
                    <span className={`text-sm px-2 py-1 rounded-full ${orders.length > 0 ? statusColors.active : statusColors.inactive}`}>
                        {orders.length} {orders.length === 1 ? 'order' : 'orders'}
                    </span>
                </div>
            )}
        </div>
    );
}

// Order Thumb Component
function OrderThumb({ order }) {
    return (
        <div className="p-2 pl-4 pr-4">
            <div className="bg-white h-[150px] w-[150px] relative">
                <div className="absolute inset-0 overflow-hidden rounded-lg">
                    {order.items && order.items.length > 0 && (
                        <img
                            src={order.items[0].thumb || 'https://via.placeholder.com/150'}
                            alt={order.items[0].title || 'Order item'}
                            className="w-full h-full object-cover"
                        />
                    )}
                    <div className="absolute inset-2 bg-white bg-opacity-80 rounded-full flex items-center justify-center">
                        <div className="text-center">
                            <div className="text-3xl font-bold leading-none">
                                {order.items ? order.items.length : 0}
                            </div>
                            <div className="text-sm leading-none">items</div>
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
                className="bg-white rounded-lg shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-all"
                onClick={handleOrderClick}
            >
                <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                                <span className="text-lg font-semibold text-blue-600">{totalItems}</span>
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
                            <div className="text-lg font-semibold text-gray-900">₹{totalAmount}</div>
                            <div className="text-sm text-gray-500">Bill No: #{order.id?.slice(-6)}</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-orange-50 text-orange-600 text-xs font-medium rounded-full">
                            {order.orderSource || "Online"}
                        </span>
                        <span className="px-2 py-1 bg-blue-50 text-blue-600 text-xs font-medium rounded-full">
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
        <div className="flex flex-col items-center justify-center py-20">
            <i className="ph ph-inbox text-5xl text-gray-300 mb-5"></i>
            <p className="text-xl text-gray-500 text-center">
                No Orders yet, Don't worry!<br />Soon it will appear here.
            </p>
        </div>
    );
} 