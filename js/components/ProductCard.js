// Product Card Component
function ProductCard({ product }) {
    // Function to handle product deletion
    const handleDelete = (e) => {
        e.stopPropagation();
        if (!confirm(`Are you sure you want to delete "${product.title}"?`)) return;

        try {
            window.sdk.collection("Product").doc(product.id).delete()
                .then(() => {
                    showToast("Product deleted successfully");
                    // Trigger a re-fetch instead of reloading the page
                    if (window.refreshProducts && typeof window.refreshProducts === 'function') {
                        window.refreshProducts();
                    }
                })
                .catch(error => {
                    console.error("Error deleting product:", error);
                    showToast("Failed to delete product", "error");
                });
        } catch (error) {
            console.error("Error deleting product:", error);
            showToast("Failed to delete product", "error");
        }
    };

    // Function to toggle product active status
    const toggleActive = (e) => {
        e.stopPropagation();
        const newActiveState = !product.active;

        try {
            window.sdk.collection("Product").doc(product.id).update({
                active: newActiveState
            })
                .then(() => {
                    showToast(`Product ${newActiveState ? 'activated' : 'deactivated'} successfully`);
                    // Trigger a re-fetch instead of reloading the page
                    if (window.refreshProducts && typeof window.refreshProducts === 'function') {
                        window.refreshProducts();
                    }
                })
                .catch(error => {
                    console.error("Error updating product status:", error);
                    showToast("Failed to update product status", "error");
                });
        } catch (error) {
            console.error("Error updating product status:", error);
            showToast("Failed to update product status", "error");
        }
    };

    // Function to open product edit form
    const handleEdit = () => {
        // Create a modal container if it doesn't exist
        let modalContainer = document.getElementById('product-form-modal-container');
        if (!modalContainer) {
            modalContainer = document.createElement('div');
            modalContainer.id = 'product-form-modal-container';
            document.body.appendChild(modalContainer);
        }

        // Render the ProductFormModal inside the container
        ReactDOM.render(
            React.createElement(window.ProductFormModal, {
                isOpen: true,
                onClose: () => {
                    ReactDOM.unmountComponentAtNode(modalContainer);
                    // Refresh products data after modal is closed
                    if (window.refreshProducts && typeof window.refreshProducts === 'function') {
                        window.refreshProducts();
                    }
                },
                editProduct: product
            }),
            modalContainer
        );
    };

    // Determine the stock status display
    const getStockDisplay = () => {
        if (product.stock === undefined || product.stock === null) return null;

        const available = product.stock;

        if (available <= 0) {
            return (
                <div className="flex justify-between items-center w-full mt-1">
                    <span className="text-2xs font-bold text-red-600">Out of stock</span>
                </div>
            );
        } else {
            return (
                <div className="w-full mt-1">
                    <span className="text-2xs font-bold text-green-600">({available} left)</span>
                </div>
            );
        }
    };

    return (
        <div 
            className={`bg-gradient-to-br from-warm-bg to-white rounded-lg overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-all flex flex-col h-full ${!product.active ? 'opacity-60' : ''} cursor-pointer`}
            onClick={handleEdit}
        >
            {/* Product Image with Badges */}
            <div className="relative w-full aspect-square bg-gradient-to-br from-card-bg to-white overflow-hidden">
                {product.imgs && product.imgs.length > 0 ? (
                    <img src={product.imgs[0]} className="w-full h-full object-cover" alt={product.title} />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <i className="ph ph-image text-2xl md:text-4xl" />
                    </div>
                )}

                {/* Discount Badge */}
                {product.hasDiscount && (
                    <div className="absolute top-1 right-1 text-xs px-1.5 py-0.5 bg-red-500 text-white rounded-full font-medium">
                        {product.discountPercent}% OFF
                    </div>
                )}

                {/* Veg/Non-veg indicator - moved to top left */}
                <div className="absolute top-1 left-1">
                    <div className={`h-4 w-4 border p-0.5 bg-white shadow-sm ${product.veg ? 'border-green-500' : 'border-red-500'}`}>
                        <div className={`h-full w-full rounded-full ${product.veg ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    </div>
                </div>

                {/* Status Badge */}
                {!product.active && (
                    <div className="absolute bottom-1 right-1 px-1.5 py-0.5 text-2xs bg-gray-100 text-gray-600 rounded-full">
                        Inactive
                    </div>
                )}
            </div>

            {/* Product Details */}
            <div className="p-2 flex-1 flex flex-col">
                <h3 className="font-medium text-sm md:text-base line-clamp-1">{product.title}</h3>
                <p className="text-gray-500 text-2xs md:text-xs mt-0.5 line-clamp-1 flex-grow" style={{ lineHeight: '1.2' }}>
                    {product.desc || 'No description'}
                </p>

                {/* Price Information */}
                <div className="flex items-center mt-1 md:mt-2">
                    <div className="flex items-center gap-1">
                        <div className="font-medium text-gray-800 text-sm md:text-base">₹{product.price}</div>
                        {product.hasDiscount && (
                            <div className="text-2xs md:text-xs line-through text-gray-400">₹{product.mrp}</div>
                        )}
                    </div>
                </div>

                {/* Stock Information */}
                {getStockDisplay()}
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
        <div className="bg-gradient-to-br from-warm-bg to-white rounded-xl p-4 border border-gray-200 shadow-section hover:shadow-md transition-all">
            <div className="flex items-start gap-4">
                {/* Customer Avatar/Initial */}
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-100 to-red-50 flex-shrink-0 flex items-center justify-center text-red-600 font-semibold text-lg">
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
                                ? 'bg-gradient-to-r from-green-100 to-green-50 text-green-800'
                                : 'bg-gradient-to-r from-red-100 to-red-50 text-red-800'
                                }`}>
                                ₹{walletBalance.toLocaleString()}
                            </span>
                            {/* Customer Type Badge */}
                            <span className={`px-2 py-1 rounded-full text-xs ${walletBalance < 0
                                ? 'bg-gradient-to-r from-purple-100 to-purple-50 text-purple-800'
                                : 'bg-gradient-to-r from-red-100 to-red-50 text-red-600'
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
                        className="p-2 hover:bg-gradient-to-br from-red-50 to-white rounded-full transition-colors"
                        onClick={() => { }} // View details handler
                    >
                        <i className="ph ph-eye text-red-500" />
                    </button>
                    <button
                        className="p-2 hover:bg-gradient-to-br from-red-50 to-white rounded-full transition-colors"
                        onClick={() => { }} // Edit handler
                    >
                        <i className="ph ph-pencil text-red-500" />
                    </button>
                </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-3">
                <button className="px-2 py-1.5 text-sm bg-gradient-to-r hover:from-red-50 hover:to-white text-red-500 border border-gray-200 rounded-lg flex items-center gap-1.5">
                    <i className="ph ph-pencil-simple-line"></i>
                    <span>Edit</span>
                </button>
                <button className="px-2 py-1.5 text-sm bg-gradient-to-r hover:from-red-50 hover:to-white text-red-500 border border-gray-200 rounded-lg flex items-center gap-1.5">
                    <i className="ph ph-shopping-bag"></i>
                    <span>Orders</span>
                </button>
            </div>
        </div>
    );
}

// Make components available globally
window.ProductCard = ProductCard;
window.CustomerCard = CustomerCard; 