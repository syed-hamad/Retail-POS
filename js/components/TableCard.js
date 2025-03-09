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
function OrderGroupTile({ order }) {
    const [isSlideOpen, setIsSlideOpen] = React.useState(false);

    const handleOrderClick = () => {
        // Handle order click - show order details in a side sheet
        pp('Order clicked:', order);

        // In a real implementation, this would open a side sheet with order details
        // Similar to the Flutter implementation using showModalSideSheet
        showOrderDetails(order);
    };

    // Function to show order details in a side sheet
    const showOrderDetails = (order) => {
        // Create a modal element
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end';
        modal.onclick = (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        };

        // Create the side sheet content
        const sideSheet = document.createElement('div');
        sideSheet.className = 'bg-white w-full max-w-md h-full overflow-y-auto shadow-xl';
        sideSheet.onclick = (e) => e.stopPropagation();

        // Render the order details
        ReactDOM.render(
            <div className="p-4">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold">Order Details</h2>
                    <button
                        className="p-2 rounded-full hover:bg-gray-100"
                        onClick={() => document.body.removeChild(modal)}
                    >
                        <i className="ph ph-x text-xl"></i>
                    </button>
                </div>

                {/* Order Info */}
                <div className="bg-gray-50 p-4 rounded-lg mb-6">
                    <div className="flex justify-between mb-2">
                        <span className="text-gray-600">Order ID:</span>
                        <span className="font-medium">#{order.id || '000'}</span>
                    </div>
                    <div className="flex justify-between mb-2">
                        <span className="text-gray-600">Customer:</span>
                        <span className="font-medium">{order.custName || 'Your Customer'}</span>
                    </div>
                    <div className="flex justify-between mb-2">
                        <span className="text-gray-600">Date:</span>
                        <span className="font-medium">
                            {order.date ? new Date(order.date).toLocaleString() : ''}
                        </span>
                    </div>
                    <div className="flex justify-between mb-2">
                        <span className="text-gray-600">Status:</span>
                        <span className="font-medium">{order.currentStatus?.label || 'PLACED'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-600">Total:</span>
                        <span className="font-medium">₹{order.total || 0}</span>
                    </div>
                </div>

                {/* Order Items */}
                <h3 className="text-lg font-medium mb-4">Items</h3>
                <div className="space-y-4">
                    {order.items && order.items.map((item, index) => (
                        <div key={index} className="flex items-start border-b pb-4">
                            <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden mr-4">
                                {item.thumb ? (
                                    <img src={item.thumb} alt={item.title} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                        <i className="ph ph-image text-2xl" />
                                    </div>
                                )}
                            </div>
                            <div className="flex-1">
                                <h4 className="font-medium">{item.title}</h4>
                                <div className="flex justify-between mt-1">
                                    <span className="text-sm text-gray-600">
                                        {item.qnt} x ₹{item.price}
                                    </span>
                                    <span className="font-medium">
                                        ₹{(item.qnt * item.price) || 0}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Action Buttons */}
                <div className="mt-8 flex gap-4">
                    {order.currentStatus?.label === "PLACED" && (
                        <button
                            className="flex-1 py-3 bg-green-500 text-white rounded-lg flex items-center justify-center gap-2"
                            onClick={() => {
                                pp('Print KOT for order:', order.id);
                                document.body.removeChild(modal);
                            }}
                        >
                            <i className="ph ph-printer"></i>
                            <span>Print KOT</span>
                        </button>
                    )}
                    {order.currentStatus?.label === "KITCHEN" && (
                        <button
                            className="flex-1 py-3 bg-gray-800 text-white rounded-lg flex items-center justify-center gap-2"
                            onClick={() => {
                                pp('Print Bill for order:', order.id);
                                document.body.removeChild(modal);
                            }}
                        >
                            <i className="ph ph-printer"></i>
                            <span>Print Bill</span>
                        </button>
                    )}
                </div>
            </div>,
            sideSheet
        );

        // Add the side sheet to the modal
        modal.appendChild(sideSheet);

        // Add the modal to the body
        document.body.appendChild(modal);
    };

    const handlePrintKOT = (e) => {
        e.stopPropagation();
        pp('Print KOT for order:', order.id);
        // In a real implementation, this would call the printKoT function
    };

    const handlePrintBill = (e) => {
        e.stopPropagation();
        pp('Print Bill for order:', order.id);
        // In a real implementation, this would call the printBill function
    };

    return (
        <div className="my-3">
            <div className="relative">
                {/* Slidable Actions - shown when isSlideOpen is true */}
                <div
                    className={`absolute right-0 top-0 bottom-0 flex items-center transition-transform duration-300 ${isSlideOpen ? 'translate-x-0' : 'translate-x-full'}`}
                    style={{ zIndex: 1 }}
                >
                    {order.currentStatus?.label === "PLACED" && (
                        <button
                            className="h-full px-6 bg-green-500 text-white flex flex-col items-center justify-center"
                            onClick={handlePrintKOT}
                        >
                            <i className="ph ph-printer text-xl"></i>
                            <span className="text-xs mt-1">Print KOT</span>
                        </button>
                    )}
                    {order.currentStatus?.label === "KITCHEN" && (
                        <button
                            className="h-full px-6 bg-gray-700 text-white flex flex-col items-center justify-center"
                            onClick={handlePrintBill}
                        >
                            <i className="ph ph-printer text-xl"></i>
                            <span className="text-xs mt-1">Print Bill</span>
                        </button>
                    )}
                </div>

                {/* Main Card - can be swiped to reveal actions */}
                <div
                    className={`bg-white rounded-lg shadow-md overflow-hidden transition-transform duration-300 ${isSlideOpen ? 'transform -translate-x-24' : ''}`}
                    onClick={handleOrderClick}
                    onTouchStart={() => {
                        // In a real implementation, this would handle touch gestures for sliding
                        // For now, we'll just toggle the slide state on click for demonstration
                    }}
                >
                    <div className="cursor-pointer">
                        <div className="flex pt-2">
                            <OrderThumb order={order} />
                            <div className="flex-1 flex flex-col justify-between">
                                <div className="w-1/2 mb-1 mt-1">
                                    <h3 className="font-medium text-lg">{order.custName || "Your Customer"}</h3>
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="pt-2 pr-3">
                                        <span className="text-lg font-semibold">₹{order.total || 0}</span>
                                    </div>
                                    <div className="py-2">
                                        <div className={`rounded-l-full py-1 px-3 pl-5 ${order.orderSource === 'Zomato' ? 'bg-red-500' :
                                            order.orderSource === 'Swiggy' ? 'bg-orange-500' :
                                                'bg-blue-500'
                                            } text-white`}>
                                            <span className="text-xs">{order.orderSource || "Online"}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-between pb-2 pr-2">
                                    <span className="text-xs text-gray-500">
                                        {order.date ? new Date(order.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                    </span>
                                    <span className="text-xs text-gray-500">Bill No: #{order.billNo || '000'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex border-t">
                        <button
                            className="flex-1 py-2 text-blue-600 font-medium hover:bg-gray-50 flex items-center justify-center gap-2"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsSlideOpen(!isSlideOpen);
                            }}
                        >
                            <i className="ph ph-dots-three-outline text-lg"></i>
                            <span>Actions</span>
                        </button>
                    </div>
                </div>
            </div>
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