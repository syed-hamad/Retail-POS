// POS (Point of Sale) component for product selection and cart management
const React = window.React;
const ReactDOM = window.ReactDOM;

function POS({ title, tableId, order, variant, checkout = false, onClose }) {
    const [cart, setCart] = React.useState({});
    const [products, setProducts] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [selectedCategory, setSelectedCategory] = React.useState('all');
    const [searchQuery, setSearchQuery] = React.useState('');
    const [showSearchPanel, setShowSearchPanel] = React.useState(false);
    const [showRawItemPanel, setShowRawItemPanel] = React.useState(false);
    const [isClosing, setIsClosing] = React.useState(false);
    const dialogRef = React.useRef(null);
    const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);

    // Check for mobile/desktop on resize
    React.useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };

        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    // Load products
    React.useEffect(() => {
        loadProducts();
    }, []);

    // Load products from Firestore
    const loadProducts = async () => {
        try {
            const snapshot = await window.sdk.collection("Product").get();
            let allProducts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Remove products that are already in order
            if (order && order.items && Array.isArray(order.items)) {
                const existingProductIds = order.items.map(item => item.pid);
                allProducts = allProducts.filter(product =>
                    !existingProductIds.includes(product.id)
                );
            }

            // Remove inactive products
            allProducts = allProducts.filter(p => p.active !== false);

            setProducts(allProducts);
        } catch (error) {
            console.error("Error loading products:", error);
            showToast("Failed to load products", "error");
        } finally {
            setLoading(false);
        }
    };

    // Filter products based on category and search
    const filteredProducts = React.useMemo(() => {
        return products.filter(product => {
            const matchesCategory = selectedCategory === 'all' || product.cat === selectedCategory;
            const matchesSearch = product.title.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesCategory && matchesSearch;
        });
    }, [products, selectedCategory, searchQuery]);

    // Get unique categories
    const categories = React.useMemo(() => {
        const uniqueCategories = new Set(products.map(p => p.cat));
        return ['all', ...Array.from(uniqueCategories)];
    }, [products]);

    // Handle adding item to cart
    const handleAddToCart = (product) => {
        setCart(prevCart => {
            const existingItem = prevCart[product.id];
            if (existingItem) {
                return {
                    ...prevCart,
                    [product.id]: {
                        ...existingItem,
                        quantity: existingItem.quantity + 1
                    }
                };
            }
            return {
                ...prevCart,
                [product.id]: {
                    product,
                    quantity: 1
                }
            };
        });
    };

    // Handle removing item from cart
    const handleRemoveFromCart = (productId) => {
        setCart(prevCart => {
            const existingItem = prevCart[productId];
            if (!existingItem) return prevCart;

            // If quantity is 1, remove the item completely
            if (existingItem.quantity === 1) {
                const newCart = { ...prevCart };
                delete newCart[productId];
                return newCart;
            }

            // Otherwise, decrease the quantity by 1
            return {
                ...prevCart,
                [productId]: {
                    ...existingItem,
                    quantity: existingItem.quantity - 1
                }
            };
        });
    };

    // Handle updating item quantity
    const handleUpdateQuantity = (productId, quantity) => {
        if (quantity < 1) {
            handleRemoveFromCart(productId);
        } else {
            setCart(prevCart => ({
                ...prevCart,
                [productId]: {
                    ...prevCart[productId],
                    quantity
                }
            }));
        }
    };

    // Handle clearing cart
    const handleClearCart = () => {
        setCart({});
    };

    // Handle barcode scanning
    const handleScanBarcode = async () => {
        try {
            // TODO: Implement barcode scanning
            showToast("Barcode scanning not implemented yet");
        } catch (error) {
            console.error("Error scanning barcode:", error);
            showToast("Failed to scan barcode", "error");
        }
    };

    // Handle adding raw item
    const handleAddRawItem = () => {
        setShowRawItemPanel(true);
    };

    // Handle smooth closing animation
    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            setIsClosing(false);
            onClose && onClose();
        }, 300);
    };

    // Create a new order
    const createOrder = async () => {
        if (Object.values(cart).length === 0) {
            showToast("Cart is empty", "error");
            return;
        }

        try {
            const now = new Date();
            const orderId = order?.id || window.sdk.collection("Orders").doc().id;

            // Convert cart to order items
            const items = Object.values(cart).map(cartItem => {
                const product = cartItem.product;
                return {
                    pid: product.id,
                    title: product.title,
                    thumb: product.imgs && product.imgs.length > 0 ? product.imgs[0] : null,
                    cat: product.cat,
                    mrp: product.mrp,
                    price: product.price,
                    veg: product.veg,
                    served: false,
                    qnt: cartItem.quantity
                };
            });

            // If we already have an order, merge the new items with existing ones
            let finalItems = items;
            if (order) {
                if (order.ref) {
                    // If we have a Firestore reference, use it
                    const orderDoc = await order.ref.get();
                    if (orderDoc.exists) {
                        const existingItems = orderDoc.data().items || [];

                        // Create a map of existing items by product ID
                        const existingItemsMap = {};
                        existingItems.forEach(item => {
                            existingItemsMap[item.pid] = item;
                        });

                        // Merge items with the same product ID by adding quantities
                        const mergedItems = [...existingItems];

                        items.forEach(newItem => {
                            const existingItem = existingItemsMap[newItem.pid];

                            if (existingItem) {
                                // Find the existing item in the array and update its quantity
                                const index = mergedItems.findIndex(item => item.pid === newItem.pid);
                                if (index !== -1) {
                                    mergedItems[index] = {
                                        ...mergedItems[index],
                                        qnt: (parseInt(mergedItems[index].qnt) || 0) + (parseInt(newItem.qnt) || 0)
                                    };
                                }
                            } else {
                                // Add as a new item
                                mergedItems.push(newItem);
                            }
                        });

                        finalItems = mergedItems;

                        // Update only the items field in the existing order
                        await order.ref.update({ items: finalItems });
                        showToast("Items added to order successfully");
                        handleClearCart();
                        handleClose();
                        return;
                    }
                } else {
                    // Fallback if no ref is provided
                    const existingItems = await window.sdk.collection("Orders").doc(orderId).get()
                        .then(doc => doc.exists ? doc.data().items : []);

                    // Create a map of existing items by product ID
                    const existingItemsMap = {};
                    existingItems.forEach(item => {
                        existingItemsMap[item.pid] = item;
                    });

                    // Merge items with the same product ID by adding quantities
                    const mergedItems = [...existingItems];

                    items.forEach(newItem => {
                        const existingItem = existingItemsMap[newItem.pid];

                        if (existingItem) {
                            // Find the existing item in the array and update its quantity
                            const index = mergedItems.findIndex(item => item.pid === newItem.pid);
                            if (index !== -1) {
                                mergedItems[index] = {
                                    ...mergedItems[index],
                                    qnt: (parseInt(mergedItems[index].qnt) || 0) + (parseInt(newItem.qnt) || 0)
                                };
                            }
                        } else {
                            // Add as a new item
                            mergedItems.push(newItem);
                        }
                    });

                    finalItems = mergedItems;
                }
            }

            // Create or update order in Firestore
            const orderData = {
                id: orderId,
                billNo: window.UserSession?.seller?.getBillNo ?
                    window.UserSession.seller.getBillNo() :
                    Math.floor(Math.random() * 1000000),
                items: finalItems,
                sellerId: window.UserSession?.seller?.id,
                priceVariant: variant,
                tableId: tableId,
                discount: order?.discount || 0,
                paid: false,
                status: [
                    {
                        label: OrderStatus.PLACED,
                        date: now
                    },
                    {
                        label: OrderStatus.KITCHEN,
                        date: now
                    }
                ],
                currentStatus: {
                    label: OrderStatus.KITCHEN,
                    date: now
                },
                charges: [],
                payMode: PaymentMode.CASH,
                date: now
            };

            // Save to Firestore
            await window.sdk.collection("Orders").doc(orderId).set(
                order ? { items: finalItems } : orderData,
                { merge: true }
            );

            showToast("Order saved successfully");
            handleClearCart();
            handleClose();
        } catch (error) {
            console.error("Error creating order:", error);
            showToast("Failed to create order", "error");
        }
    };

    if (loading) {
        return (
            <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
                <div className="bg-white p-8 rounded-lg shadow-section" onClick={e => e.stopPropagation()}>
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
                </div>
            </div>
        );
    }

    // Determine the appropriate classes based on device width and animation state
    const getDialogClasses = () => {
        const baseClasses = "overflow-y-auto shadow-xl custom-scrollbar";

        if (isMobile) {
            // Mobile classes
            const mobileClasses = "fixed inset-x-0 bottom-0 rounded-t-2xl max-h-[90vh] mobile-bottom-sheet";
            const animationClass = isClosing ? "translate-y-full" : "translate-y-0";
            return `${baseClasses} ${mobileClasses} transition-transform ${animationClass}`;
        } else {
            // Desktop classes
            const desktopClasses = "fixed top-0 right-0 h-full w-full md:w-2/3 lg:w-1/2 xl:w-2/5";
            const animationClass = isClosing ? "translate-x-full" : "translate-x-0";
            return `${baseClasses} ${desktopClasses} transition-transform ${animationClass} desktop-slide-in`;
        }
    };

    // Overlay classes
    const overlayClasses = `fixed inset-0 bg-black transition-opacity duration-300 z-50 ${isClosing ? 'bg-opacity-0' : 'bg-opacity-50'}`;

    return (
        <div className={overlayClasses} onClick={handleClose}>
            <div
                ref={dialogRef}
                className={getDialogClasses()}
                style={{ backgroundColor: "#fff8f8" }}
                onClick={e => e.stopPropagation()}
            >
                {/* Handle/Drag indicator for mobile */}
                {isMobile && (
                    <div className="w-full flex justify-center pt-2 pb-1">
                        <div className="mobile-drag-handle"></div>
                    </div>
                )}

                {/* Header */}
                <div className="sticky top-0 bg-white border-b z-10" style={{ backgroundColor: "#fff8f8" }}>
                    <div className="p-4 flex items-center justify-between">
                        <h2 className="text-xl font-semibold text-gray-800">
                            {title || "New Order"}
                        </h2>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowSearchPanel(true)}
                                className="p-2.5 bg-white hover:bg-red-50 rounded-full shadow-sm transition-colors flex items-center justify-center w-10 h-10"
                                aria-label="Search"
                            >
                                <i className="ph ph-magnifying-glass text-red-500 text-xl"></i>
                            </button>
                            <button
                                onClick={handleScanBarcode}
                                className="p-2.5 bg-white hover:bg-red-50 rounded-full shadow-sm transition-colors flex items-center justify-center w-10 h-10"
                                aria-label="Scan barcode"
                            >
                                <i className="ph ph-qr-code text-red-500 text-xl"></i>
                            </button>
                            <button
                                onClick={() => setShowRawItemPanel(true)}
                                className="p-2.5 bg-white hover:bg-red-50 rounded-full shadow-sm transition-colors flex items-center justify-center w-10 h-10"
                                aria-label="Add raw item"
                            >
                                <i className="ph ph-plus text-red-500 text-xl"></i>
                            </button>
                            <button
                                onClick={handleClose}
                                className="p-2.5 bg-white hover:bg-red-50 rounded-full shadow-sm transition-colors flex items-center justify-center w-10 h-10"
                                aria-label="Close"
                            >
                                <i className="ph ph-x text-red-500 text-xl"></i>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex flex-col h-[calc(100%-200px)]">
                    {showSearchPanel ? (
                        <div className="space-y-4 p-4" style={{ backgroundColor: "#fffcfc" }}>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search products..."
                                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400 shadow-sm"
                                />
                                <i className="ph ph-magnifying-glass absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                                <button
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    onClick={() => setShowSearchPanel(false)}
                                >
                                    <i className="ph ph-x"></i>
                                </button>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {filteredProducts.map(product => (
                                    <ProductCard
                                        key={product.id}
                                        product={product}
                                        inCart={cart[product.id]?.quantity || 0}
                                        onAdd={() => handleAddToCart(product)}
                                        onRemove={() => handleRemoveFromCart(product.id)}
                                    />
                                ))}
                            </div>
                            {filteredProducts.length === 0 && (
                                <div className="text-center py-8 text-gray-500">
                                    No products found matching "{searchQuery}"
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Category tabs */}
                            <div className="px-4 py-3 border-b" style={{ backgroundColor: "#ffefef" }}>
                                <div className="flex items-center overflow-x-auto py-1 scroll-tabs gap-2">
                                    {categories.map(category => (
                                        <button
                                            key={category}
                                            className={`px-4 py-2.5 whitespace-nowrap rounded-full transition-colors ${selectedCategory === category
                                                ? 'bg-red-500 text-white font-medium shadow-sm'
                                                : 'bg-white text-gray-700 hover:bg-pink-50 shadow-sm'
                                                }`}
                                            onClick={() => setSelectedCategory(category)}
                                        >
                                            {category === 'all' ? 'All Items' : category}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Products grid */}
                            <div className="flex-1 overflow-y-auto p-4" style={{ backgroundColor: "#fffcfc" }}>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {filteredProducts.map(product => (
                                        <ProductCard
                                            key={product.id}
                                            product={product}
                                            inCart={cart[product.id]?.quantity || 0}
                                            onAdd={() => handleAddToCart(product)}
                                            onRemove={() => handleRemoveFromCart(product.id)}
                                        />
                                    ))}
                                    <button
                                        className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-pink-200 rounded-lg hover:border-red-400 hover:bg-pink-50 transition-colors"
                                        onClick={() => setShowRawItemPanel(true)}
                                    >
                                        <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mb-2">
                                            <i className="ph ph-plus-circle text-3xl text-red-500"></i>
                                        </div>
                                        <span className="text-sm text-gray-600 font-medium">Add Quick Item</span>
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Checkout Section */}
                <div className="sticky bottom-0 bg-white border-t p-4" style={{ backgroundColor: "#fff8f8" }}>
                    <div className="mb-4">
                        <div className="flex justify-between items-center">
                            <h3 className="font-medium text-gray-700">Subtotal</h3>
                            <span className="font-medium text-red-600 text-lg">₹{Object.values(cart).reduce((sum, item) => sum + (item.product.price * item.quantity), 0)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm text-gray-500 mt-1">
                            <span>Items in cart</span>
                            <span>{Object.values(cart).reduce((sum, item) => sum + item.quantity, 0)} items</span>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button
                            className="px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 font-medium"
                            onClick={handleClearCart}
                        >
                            <i className="ph ph-trash text-red-500"></i>
                            Clear
                        </button>
                        <button
                            className="flex-1 px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 font-medium"
                            onClick={createOrder}
                            disabled={Object.values(cart).length === 0}
                        >
                            <i className="ph ph-check-circle"></i>
                            {checkout ? "Checkout" : "Save Order"}
                        </button>
                    </div>
                </div>

                {/* Raw Product Panel */}
                {showRawItemPanel && (
                    <RawProductPanel
                        onClose={() => setShowRawItemPanel(false)}
                        onAdd={(product) => {
                            handleAddToCart(product);
                            setShowRawItemPanel(false);
                        }}
                    />
                )}
            </div>
        </div>
    );
}

// Product Card Component
function ProductCard({ product, inCart = 0, onAdd, onRemove }) {
    const [addAnimation, setAddAnimation] = React.useState(false);

    // Animation effect when adding to cart
    const handleAddWithAnimation = () => {
        onAdd();
        setAddAnimation(true);
        setTimeout(() => setAddAnimation(false), 300);
    };

    return (
        <div className={`bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow transition-shadow group ${addAnimation ? 'ring-2 ring-red-400 scale-[1.02]' : ''}`}
            style={{ transition: 'all 0.2s ease' }}>
            {/* Make the main product area clickable for adding items */}
            <div
                className="cursor-pointer relative"
                onClick={handleAddWithAnimation}
            >
                <div className="aspect-square bg-gray-100 relative overflow-hidden">
                    {product.imgs && product.imgs.length > 0 ? (
                        <img
                            src={product.imgs[0]}
                            alt={product.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = 'https://via.placeholder.com/150';
                            }}
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <i className="ph ph-image text-gray-400 text-3xl"></i>
                        </div>
                    )}
                    {product.hasDiscount && (
                        <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                            {product.discount}% OFF
                        </div>
                    )}
                    {product.veg !== undefined && (
                        <div className="absolute top-2 left-2 h-6 w-6 flex items-center justify-center">
                            <div className={`h-5 w-5 border p-0.5 ${product.veg ? 'border-green-500' : 'border-red-500'}`}>
                                <div className={`h-full w-full rounded-full ${product.veg ? 'bg-green-500' : 'bg-red-500'}`}></div>
                            </div>
                        </div>
                    )}

                    {/* Add overlay on hover */}
                    {inCart === 0 && (
                        <div className="absolute inset-0 bg-red-500 bg-opacity-0 flex items-center justify-center group-hover:bg-opacity-20 transition-all duration-300">
                            <div className="bg-red-500 text-white px-3 py-1 rounded-full transform translate-y-4 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 shadow-md">
                                <i className="ph ph-plus mr-1"></i>
                                Add
                            </div>
                        </div>
                    )}

                    {/* Badge for items in cart */}
                    {inCart > 0 && (
                        <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full font-medium animate-fadeIn">
                            {inCart} in cart
                        </div>
                    )}
                </div>
                <div className="p-3">
                    <h3 className="font-medium text-gray-900 line-clamp-1">{product.title}</h3>
                    <div className="flex items-center justify-between mt-1">
                        <div>
                            <span className="font-medium text-red-600">₹{product.price}</span>
                            {product.hasDiscount && (
                                <span className="text-xs text-gray-500 line-through ml-1">₹{product.mrp}</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Quantity controls in a separate div to prevent click event bubbling */}
            <div className="px-3 pb-3 flex justify-end items-center" onClick={(e) => e.stopPropagation()}>
                {inCart > 0 ? (
                    <div className="flex items-center bg-gray-100 rounded-full px-1">
                        <button
                            className="w-7 h-7 flex items-center justify-center text-red-500 hover:bg-red-50 rounded-full"
                            onClick={(e) => {
                                e.stopPropagation();
                                onRemove();
                            }}
                        >
                            <i className="ph ph-minus"></i>
                        </button>
                        <span className="w-8 text-center font-medium">{inCart}</span>
                        <button
                            className="w-7 h-7 flex items-center justify-center text-red-500 hover:bg-red-50 rounded-full"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleAddWithAnimation();
                            }}
                        >
                            <i className="ph ph-plus"></i>
                        </button>
                    </div>
                ) : (
                    <div className="inline-flex items-center justify-center px-3 py-1 rounded-full text-sm opacity-0">
                        <i className="ph ph-check mr-1"></i> Add
                    </div>
                )}
            </div>
        </div>
    );
}

// Raw Product Panel Component
function RawProductPanel({ onClose, onAdd }) {
    const [title, setTitle] = React.useState('');
    const [price, setPrice] = React.useState('');
    const [isValid, setIsValid] = React.useState(false);

    // Validate form
    React.useEffect(() => {
        setIsValid(title.trim().length > 0 && !isNaN(price) && parseInt(price) > 0);
    }, [title, price]);

    // Create a quick product
    const createQuickProduct = () => {
        const id = "quick_" + Math.random().toString(36).substring(2, 15);

        const product = {
            id,
            title,
            price: parseInt(price),
            mrp: parseInt(price),
            cat: "Quick Items",
            active: true,
            date: new Date(),
            sellerId: window.UserSession?.seller?.id || '',
            sellerBusinessName: window.UserSession?.seller?.businessName || '',
            sellerAvatar: window.UserSession?.seller?.avatar || '',
            veg: true
        };

        onAdd(product);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
            <div
                className="bg-white rounded-xl p-6 w-full max-w-md mx-4 shadow-xl"
                onClick={e => e.stopPropagation()}
                style={{ backgroundColor: "#fff8f8" }}
            >
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Quick Item</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Title
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400"
                            placeholder="Enter item name"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Price
                        </label>
                        <input
                            type="number"
                            value={price}
                            onChange={e => setPrice(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400"
                            placeholder="Enter price"
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                    <button
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                        onClick={onClose}
                    >
                        Cancel
                    </button>
                    <button
                        className={`px-4 py-2 bg-red-500 text-white rounded-lg transition-colors ${isValid
                            ? 'hover:bg-red-600'
                            : 'opacity-50 cursor-not-allowed'
                            }`}
                        onClick={createQuickProduct}
                        disabled={!isValid}
                    >
                        Add to Cart
                    </button>
                </div>
            </div>
        </div>
    );
}

// Make component available globally
window.POS = POS; 