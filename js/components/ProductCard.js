// Product Card Component
function ProductCard({ product }) {
    return (
        <div className="card p-4">
            <div className="flex items-start gap-4">
                {/* Product Image */}
                <div className="w-24 h-24 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden">
                    {product.imgs && product.imgs.length > 0 ? (
                        <img src={product.imgs[0]} className="w-full h-full object-cover" alt={product.title} />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <i className="ph ph-image text-2xl" />
                        </div>
                    )}
                </div>
                {/* Product Details */}
                <div className="flex-1">
                    <div className="flex items-center justify-between">
                        <h3 className="font-medium text-lg">{product.title}</h3>
                        <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded-full text-xs ${product.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                                {product.active ? 'Active' : 'Inactive'}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs ${product.veg ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                {product.veg ? 'Veg' : 'Non-veg'}
                            </span>
                        </div>
                    </div>
                    <p className="text-gray-400 text-xs mt-1 line-clamp-2" style={{ lineHeight: '1.3' }}>
                        {product.desc || 'No description'}
                    </p>
                    <div className="flex items-center gap-4 mt-2">
                        <div className="text-sm">
                            <span className="text-gray-500">Price: </span>
                            <span className="font-medium">₹{product.price}</span>
                        </div>
                        <div className="text-sm">
                            <span className="text-gray-500">MRP: </span>
                            <span className="line-through text-gray-400">₹{product.mrp}</span>
                        </div>
                        {product.conv > 0 && (
                            <div className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                                {product.conv}% conversion
                            </div>
                        )}
                    </div>
                </div>
                {/* Action Buttons */}
                <div className="flex flex-col gap-2">
                    <button className="p-2 hover:bg-gray-100 rounded-full" onClick={() => { }}>
                        <i className="ph ph-pencil text-gray-600" />
                    </button>
                    <button className="p-2 hover:bg-gray-100 rounded-full" onClick={() => { }}>
                        <i className="ph ph-trash text-gray-600" />
                    </button>
                </div>
            </div>
        </div>
    );
}

// Customer Card Component
function CustomerCard({ customer }) {
    // Add null checks and default values
    const name = customer?.name || 'Unknown';
    const phone = customer?.phone || 'No phone';
    const totalSpent = customer?.totalSpent || 0;
    const lastOrderDate = customer?.lastOrderDate ? new Date(customer.lastOrderDate).toLocaleDateString() : 'Never';
    const walletBalance = customer?.walletBalance || 0;

    return (
        <div className="card p-4">
            <div className="flex items-start gap-4">
                {/* Customer Avatar/Initial */}
                <div className="w-12 h-12 rounded-full bg-blue-100 flex-shrink-0 flex items-center justify-center text-blue-600 font-semibold text-lg">
                    {name.charAt(0).toUpperCase()}
                </div>

                {/* Customer Details */}
                <div className="flex-1">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-medium text-lg">{name}</h3>
                            <p className="text-gray-500 text-sm">{phone}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Wallet Balance Badge */}
                            <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${walletBalance >= 0
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                                }`}>
                                ₹{walletBalance.toLocaleString()}
                            </span>
                            {/* Customer Type Badge */}
                            <span className={`px-2 py-1 rounded-full text-xs ${walletBalance < 0
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-blue-100 text-blue-800'
                                }`}>
                                {walletBalance < 0 ? 'Creditor' : 'Regular'}
                            </span>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-3">
                        <div className="text-sm">
                            <span className="text-gray-500 block">Total Spent</span>
                            <span className="font-medium">₹{totalSpent.toLocaleString()}</span>
                        </div>
                        <div className="text-sm">
                            <span className="text-gray-500 block">Last Order</span>
                            <span className="font-medium">{lastOrderDate}</span>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-2">
                    <button
                        className="p-2 hover:bg-gray-100 rounded-full"
                        onClick={() => { }} // View details handler
                    >
                        <i className="ph ph-eye text-gray-600" />
                    </button>
                    <button
                        className="p-2 hover:bg-gray-100 rounded-full"
                        onClick={() => { }} // Edit handler
                    >
                        <i className="ph ph-pencil text-gray-600" />
                    </button>
                </div>
            </div>
        </div>
    );
} 