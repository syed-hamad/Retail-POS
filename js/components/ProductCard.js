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
                product: product
            }),
            modalContainer
        );
    };

    return (
        <div
            className={`bg-gradient-to-br from-warm-bg to-white rounded-lg overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-all flex flex-col h-full ${!product.active ? 'opacity-70' : ''} cursor-pointer`}
            onClick={handleEdit}
        >
            {/* Product Image with Badges */}
            <div className="relative w-full pb-[75%] bg-gradient-to-br from-gray-50 to-white overflow-hidden">
                {product.imgs && product.imgs.length > 0 ? (
                    <img
                        src={product.imgs[0]}
                        className="absolute top-0 left-0 w-full h-full object-cover"
                        alt={product.title}
                        onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%23d1d5db" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>';
                        }}
                    />
                ) : (
                    <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center text-gray-400">
                        <i className="ph ph-image text-3xl" />
                    </div>
                )}

                {/* Overlapping badges container */}
                <div className="absolute inset-x-0 top-0 flex items-start justify-between p-1.5">
                    {/* Left badges */}
                    <div className="flex flex-col items-start gap-1">
                        {/* Veg/Non-veg indicator */}
                        <div className={`h-4 w-4 border p-0.5 bg-white shadow-sm ${product.veg ? 'border-green-500' : 'border-red-500'}`}>
                            <div className={`h-full w-full rounded-full ${product.veg ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        </div>
                    </div>

                    {/* Right badges */}
                    <div className="flex flex-col items-end gap-1">
                        {/* Discount Badge */}
                        {product.hasDiscount && (
                            <div className="text-xs px-1.5 py-0.5 bg-red-500 text-white rounded-full font-medium shadow-sm">
                                {product.discountPercent}% OFF
                            </div>
                        )}

                        {/* Stock Badge - moved from bottom */}
                        {product.stock !== undefined && product.stock <= 10 && (
                            <div className={`text-2xs px-1.5 py-0.5 rounded-full font-medium shadow-sm ${product.stock <= 0
                                ? 'bg-red-100 text-red-600'
                                : product.stock <= 5
                                    ? 'bg-orange-100 text-orange-600'
                                    : 'bg-green-100 text-green-600'
                                }`}>
                                {product.stock <= 0
                                    ? 'Out of stock'
                                    : `${product.stock} left`}
                            </div>
                        )}

                        {/* Status Badge */}
                        {!product.active && (
                            <div className="text-2xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-full shadow-sm">
                                Inactive
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Product Details - Compact */}
            <div className="p-2 flex-1 flex flex-col justify-between">
                <div>
                    <h3 className="font-medium text-sm line-clamp-1">{product.title}</h3>
                    <p className="text-gray-500 text-2xs line-clamp-1" style={{ lineHeight: '1.2' }}>
                        {product.desc || 'No description'}
                    </p>
                </div>

                {/* Price Row */}
                <div className="flex items-center justify-between mt-1.5">
                    <div className="flex items-baseline gap-1">
                        <div className="font-semibold text-gray-800">₹{product.price}</div>
                        {product.hasDiscount && (
                            <div className="text-2xs line-through text-gray-400">₹{product.mrp}</div>
                        )}
                    </div>

                    {/* Stock number - compact format for high stock */}
                    {product.stock !== undefined && product.stock > 10 && (
                        <div className="text-2xs font-medium text-green-600">
                            ({product.stock})
                        </div>
                    )}
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
    const balance = customer?.balance || 0;

    // Format last order date
    const formatLastOrderDate = (date) => {
        if (!date) return "N/A";

        const orderDate = new Date(date);
        const now = new Date();
        const diffTime = Math.abs(now - orderDate);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return "Today";
        } else if (diffDays === 1) {
            return "Yesterday";
        } else if (diffDays < 30) {
            return `${diffDays} days ago`;
        } else if (diffDays < 365) {
            const months = Math.floor(diffDays / 30);
            return `${months} month${months > 1 ? 's' : ''} ago`;
        } else {
            const years = Math.floor(diffDays / 365);
            return `${years} year${years > 1 ? 's' : ''} ago`;
        }
    };

    const lastOrderDate = formatLastOrderDate(customer?.lastOrderDate);

    // Handle calling the customer
    const handleCall = (e) => {
        e.stopPropagation();
        window.location.href = `tel:${phone}`;
    };

    // Handle WhatsApp message
    const handleWhatsApp = (e) => {
        e.stopPropagation();
        const whatsappPhone = phone.replace(/\+/g, '');
        const message = balance > 0
            ? `Hi ${name}, you have a pending credit of ₹${balance}. Please pay it at your earliest convenience. Thank you.`
            : `Hi ${name}, thank you for your recent order. We hope you enjoyed our service. Please let us know if you have any feedback or suggestions. Thank you.`;

        window.open(`https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`, '_blank');
    };

    // Handle deposit balance
    const handleDeposit = (e) => {
        e.stopPropagation();

        // Create modal container if it doesn't exist
        let modalContainer = document.getElementById('deposit-modal-container');
        if (!modalContainer) {
            modalContainer = document.createElement('div');
            modalContainer.id = 'deposit-modal-container';
            document.body.appendChild(modalContainer);
        }

        // Create a simple modal using vanilla JS
        modalContainer.innerHTML = `
            <div class="fixed inset-0 z-50 flex items-center justify-center">
                <div class="fixed inset-0 bg-black bg-opacity-50" onclick="document.getElementById('deposit-modal-container').remove()"></div>
                <div class="bg-white w-full max-w-sm rounded-xl shadow-lg overflow-hidden relative z-10 p-6">
                    <h3 class="text-xl font-medium mb-4">Add Balance</h3>
                    
                    <div class="mb-4">
                        <input 
                            type="number" 
                            id="deposit-amount" 
                            placeholder="Enter amount" 
                            class="w-full p-2 border border-gray-300 rounded-md"
                            autofocus
                        />
                    </div>
                    
                    <div class="flex justify-center gap-2 mb-6">
                        <button 
                            id="cash-mode"
                            class="px-4 py-2 bg-red-500 text-white rounded-full"
                            onclick="document.getElementById('cash-mode').classList.add('bg-red-500', 'text-white');
                                    document.getElementById('cash-mode').classList.remove('bg-gray-200', 'text-gray-800');
                                    document.getElementById('upi-mode').classList.add('bg-gray-200', 'text-gray-800');
                                    document.getElementById('upi-mode').classList.remove('bg-red-500', 'text-white');
                                    document.getElementById('payment-mode').value = 'cash';"
                        >Cash</button>
                        <button 
                            id="upi-mode"
                            class="px-4 py-2 bg-gray-200 text-gray-800 rounded-full"
                            onclick="document.getElementById('upi-mode').classList.add('bg-red-500', 'text-white');
                                    document.getElementById('upi-mode').classList.remove('bg-gray-200', 'text-gray-800');
                                    document.getElementById('cash-mode').classList.add('bg-gray-200', 'text-gray-800');
                                    document.getElementById('cash-mode').classList.remove('bg-red-500', 'text-white');
                                    document.getElementById('payment-mode').value = 'digital';"
                        >UPI</button>
                        <input type="hidden" id="payment-mode" value="cash" />
                    </div>
                    
                    <div class="flex gap-3">
                        <button 
                            class="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg"
                            onclick="document.getElementById('deposit-modal-container').remove()"
                        >
                            Cancel
                        </button>
                        <button 
                            class="flex-1 py-2 bg-red-500 text-white rounded-lg"
                            onclick="handleAddBalance()"
                        >
                            Confirm
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Add the handler function for adding balance
        window.handleAddBalance = async () => {
            const amount = parseInt(document.getElementById('deposit-amount').value);
            const mode = document.getElementById('payment-mode').value;

            if (!amount || isNaN(amount) || amount <= 0) {
                alert('Please enter a valid amount');
                return;
            }

            try {
                // Add to wallet collection
                await window.sdk.collection("Wallet").add({
                    amount: amount,
                    mode: mode,
                    customerId: customer.id,
                    date: new Date()
                });

                document.getElementById('deposit-modal-container').remove();

                // Show success message
                const toastContainer = document.createElement('div');
                toastContainer.className = 'fixed bottom-4 right-4 z-50 bg-green-100 text-green-800 p-3 rounded-lg shadow-lg';
                toastContainer.innerHTML = `
                    <div class="flex items-center">
                        <i class="ph ph-check-circle mr-2"></i>
                        <span>Balance added successfully</span>
                    </div>
                `;
                document.body.appendChild(toastContainer);

                // Remove toast after 3 seconds
                setTimeout(() => {
                    toastContainer.remove();
                }, 3000);

                // Refresh customers data
                if (window.refreshCustomers && typeof window.refreshCustomers === 'function') {
                    window.refreshCustomers();
                }
            } catch (error) {
                console.error('Error adding balance:', error);
                alert('Failed to add balance. Please try again.');
            }
        };
    };

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-3 mb-2 shadow-sm">
            <div className="flex items-center">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-gray-100 flex-shrink-0 flex items-center justify-center mr-3">
                    <i className="ph ph-user text-gray-500" />
                </div>

                {/* Customer Info */}
                <div className="flex-1">
                    <h4 className="text-blue-900 font-medium">{name}</h4>
                    <p className="text-gray-500 text-sm">{phone}</p>
                </div>

                {/* Right Section */}
                <div className="flex items-center">
                    <div className="mr-4">
                        <div className="flex items-center text-xs text-gray-500 mb-1">
                            <i className="ph ph-clock text-gray-400 mr-1" />
                            {lastOrderDate}
                        </div>
                        <div className="flex justify-end">
                            <div className="flex items-center">
                                <i className="ph ph-currency-circle-dollar text-gray-400 mr-1" />
                                <span className={balance < 0 ? 'text-red-500' : 'text-green-500'}>₹{balance}</span>
                            </div>
                        </div>
                    </div>

                    <div className="text-right">
                        <div className="text-xs text-gray-500">Spent:</div>
                        <div className="font-medium">₹{totalSpent}</div>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
                <div className="flex">
                    <button
                        onClick={handleCall}
                        className="mr-2 w-8 h-8 flex items-center justify-center rounded-full bg-red-50 text-red-500"
                    >
                        <i className="ph ph-phone" />
                    </button>
                    <button
                        onClick={handleWhatsApp}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-green-50 text-green-500"
                    >
                        <i className="ph ph-whatsapp-logo" />
                    </button>
                </div>

                <button
                    onClick={handleDeposit}
                    className="px-3 py-1 bg-red-500 text-white text-sm rounded-lg flex items-center"
                >
                    <i className="ph ph-plus-circle mr-1" />
                    Deposit Balance
                </button>
            </div>
        </div>
    );
}

// Make components available globally
window.ProductCard = ProductCard;
window.CustomerCard = CustomerCard; 