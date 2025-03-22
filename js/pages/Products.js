// Products Component
function Products() {
    const [products, setProducts] = React.useState([]);
    const [inventory, setInventory] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [activeTab, setActiveTab] = React.useState('products');
    const [selectedCategory, setSelectedCategory] = React.useState('Appetizers');
    const [categories, setCategories] = React.useState([]);
    const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
    const [editingItem, setEditingItem] = React.useState(null);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [productSearchQuery, setProductSearchQuery] = React.useState('');
    const [sortBy, setSortBy] = React.useState('recent');

    // Define a function to refresh products and make it available globally
    const refreshProducts = async () => {
        try {
            setLoading(true);
            setError(null);

            // Fetch products
            const productsSnapshot = await window.sdk.collection("Product")
                .orderBy("date", "desc")
                .limit(100)
                .get();

            // More robust handling of product creation
            const productsList = [];
            for (const doc of productsSnapshot.docs) {
                try {
                    const product = Product.fromDoc(doc);
                    if (product) {
                        productsList.push(product);
                    }
                } catch (productError) {
                    console.error(`Error creating product from doc ${doc.id}:`, productError);
                    // Continue with other products
                }
            }

            setProducts(productsList);
            console.log(`Successfully loaded ${productsList.length} products`);

            // Fetch inventory items
            const inventorySnapshot = await window.sdk.collection("Inventory")
                .orderBy("updatedAt", "desc")
                .limit(100)
                .get();

            // More robust handling of inventory item creation
            const inventoryList = [];
            for (const doc of inventorySnapshot.docs) {
                try {
                    const data = doc.data();
                    // Handle date conversions for Firestore Timestamps
                    const processedData = {
                        id: doc.id,
                        name: data.name || '',
                        quantity: Number(data.quantity || 0),
                        unit: data.unit || '',
                        minQuantity: Number(data.minQuantity || 0),
                        date: data.date?.toDate ? data.date.toDate() : new Date(),
                        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
                        lastUpdated: data.lastUpdated || (data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : new Date().toISOString())
                    };
                    
                    const item = new InventoryItem(processedData);
                    if (item) {
                        inventoryList.push(item);
                    }
                } catch (inventoryError) {
                    console.error(`Error creating inventory item from doc ${doc.id}:`, inventoryError);
                    // Continue with other inventory items
                }
            }

            setInventory(inventoryList);
            console.log(`Successfully loaded ${inventoryList.length} inventory items`);

            // Extract unique categories and count products in each
            const categoryCounts = productsList.reduce((acc, product) => {
                const cat = product.cat || 'Uncategorized';
                acc[cat] = (acc[cat] || 0) + 1;
                return acc;
            }, {});

            // Format categories with counts
            const formattedCategories = Object.entries(categoryCounts).map(([name, count]) => ({
                name,
                count,
                id: name.toLowerCase()
            }));

            setCategories(formattedCategories);
            if (formattedCategories.length > 0 && !formattedCategories.find(c => c.name === selectedCategory)) {
                setSelectedCategory(formattedCategories[0].name);
            }

            setLoading(false);
        } catch (err) {
            console.error('Error fetching product data:', err);
            setError(`Failed to load product data: ${err.message}`);
            setLoading(false);
        }
    };

    // Make the refreshProducts function available globally
    window.refreshProducts = refreshProducts;

    React.useEffect(() => {
        // Load product data on initial render
        refreshProducts();
    }, []);

    // Filter inventory items based on search query
    const filteredInventory = React.useMemo(() => {
        return inventory.filter(item => 
            item.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [inventory, searchQuery]);

    // Filter products based on search query and category
    const filteredProducts = React.useMemo(() => {
        let filtered = products;
        
        // Filter by search query
        if (productSearchQuery) {
            filtered = filtered.filter(product => 
                product.name.toLowerCase().includes(productSearchQuery.toLowerCase())
            );
        }
        
        // Filter by category
        if (selectedCategory) {
            filtered = filtered.filter(product => 
                product.cat === selectedCategory
            );
        }
        
        // Sort products
        switch (sortBy) {
            case 'name':
                filtered.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'price':
                filtered.sort((a, b) => a.price - b.price);
                break;
            case 'recent':
            default:
                // Sorting by date is the default from the query
                break;
        }
        
        return filtered;
    }, [products, productSearchQuery, selectedCategory, sortBy]);

    const handleSaveInventory = async (itemData) => {
        try {
            if (editingItem) {
                // Update existing item
                const updatedItem = new InventoryItem({
                    ...editingItem,
                    ...itemData,
                    quantity: Number(itemData.quantity),
                    minQuantity: Number(itemData.minQuantity),
                    updatedAt: new Date(),
                    lastUpdated: new Date().toISOString()
                });

                const updatedInventory = inventory.map(item =>
                    item.id === editingItem.id ? updatedItem : item
                );
                setInventory(updatedInventory);

                // Update in Firestore
                await sdk.collection("Inventory").doc(editingItem.id).update({
                    name: itemData.name,
                    quantity: Number(itemData.quantity),
                    unit: itemData.unit,
                    minQuantity: Number(itemData.minQuantity),
                    updatedAt: new Date(),
                    lastUpdated: new Date().toISOString()
                });
                showToast('Inventory item updated successfully', 'success');
            } else {
                // Add new item
                const newItemData = new InventoryItem({
                    name: itemData.name,
                    quantity: Number(itemData.quantity),
                    unit: itemData.unit,
                    minQuantity: Number(itemData.minQuantity),
                    date: new Date(),
                    updatedAt: new Date(),
                    lastUpdated: new Date().toISOString()
                });

                // Add to Firestore
                const newItemRef = sdk.collection("Inventory").doc();
                await newItemRef.set(newItemData.toJson());

                newItemData.id = newItemRef.id;
                setInventory([...inventory, newItemData]);
                showToast('Inventory item added successfully', 'success');
            }
            setIsAddModalOpen(false);
            setEditingItem(null);
        } catch (err) {
            console.error('Error saving inventory:', err);
            showToast('Failed to save inventory item', 'error');
        }
    };

    const handleDeleteInventory = async (itemId) => {
        if (!confirm('Are you sure you want to delete this item?')) return;

        try {
            const updatedInventory = inventory.filter(item => item.id !== itemId);
            setInventory(updatedInventory);

            // Delete from Firestore
            await sdk.collection("Inventory").doc(itemId).delete();
            showToast('Inventory item deleted successfully', 'success');
        } catch (err) {
            console.error('Error deleting inventory:', err);
            showToast('Failed to delete inventory item', 'error');
        }
    };

    // Tab Button Component
    const TabButton = ({ isActive, onClick, children }) => {
        return (
            <button
                className={`px-3 md:px-6 py-1.5 md:py-2 rounded-full transition-colors text-sm ${isActive
                    ? 'bg-red-100 text-red-700'
                    : 'text-gray-600 hover:bg-gray-100'
                    }`}
                onClick={onClick}
            >
                {children}
            </button>
        );
    };

    // Category Tab Component
    const CategoryTab = ({ category, isActive, onClick }) => {
        return (
            <button
                className={`flex-shrink-0 transition-colors relative py-1 md:py-2 text-xs md:text-sm ${isActive
                    ? 'text-red-600 font-medium'
                    : 'text-gray-600 hover:text-red-600'
                    }`}
                onClick={onClick}
            >
                <span className="whitespace-nowrap">
                    {`${category.name} ${category.count > 0 ? `(${category.count})` : ''}`}
                </span>
                {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600 rounded-full" />
                )}
            </button>
        );
    };

    // Search Bar Component
    const SearchBar = ({ value, onChange, placeholder, onAdd }) => {
        return (
            <div className="flex items-center gap-2 md:gap-4 mb-4 md:mb-6 bg-white p-2 md:p-4 rounded-lg shadow-sm">
                {/* Search Input */}
                <div className="flex-1 relative">
                    <i className="ph ph-magnifying-glass absolute left-2 md:left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={placeholder}
                        className="w-full text-sm pl-7 md:pl-10 pr-2 md:pr-4 py-2 md:py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    />
                </div>
                {/* Add Button */}
                <button
                    className="px-2 md:px-4 py-2 md:py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center gap-1 md:gap-2"
                    onClick={onAdd}
                >
                    <i className={`ph ph-${activeTab === 'products' ? 'package-plus' : 'plus'} text-base md:text-lg`} />
                    <span className="hidden md:inline">
                        {activeTab === 'products' ? 'Add Product' : 'Add Item'}
                    </span>
                    <span className="md:hidden">Add</span>
                </button>
            </div>
        );
    };

    // Function to open product form modal
    const openProductFormModal = () => {
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
                },
                editProduct: null // null for add new product
            }),
            modalContainer
        );
    };

    // Get the correct ProductCard component
    const ProductCardComponent = window.ProductCard || ProductCard;

    if (loading) {
        return (
            <div className="p-4 text-center">
                <div className="animate-spin inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 text-center text-red-600">{error}</div>
        );
    }

    return (
        <div className="p-2 md:p-4">
            {/* Top Tabs (Products/Inventory) */}
            <div className="flex items-center gap-1 md:gap-2 mb-3 md:mb-6">
                <TabButton
                    isActive={activeTab === 'products'}
                    onClick={() => setActiveTab('products')}
                >
                    <i className="ph ph-package text-base mr-1 md:mr-2"></i>
                    <span>Products</span>
                </TabButton>
                <TabButton
                    isActive={activeTab === 'inventory'}
                    onClick={() => setActiveTab('inventory')}
                >
                    <i className="ph ph-clipboard-text text-base mr-1 md:mr-2"></i>
                    <span>Inventory</span>
                </TabButton>
            </div>

            {/* Show different content based on active tab */}
            {activeTab === 'products' ? (
                <>
                    {/* Search Bar for Products */}
                    <SearchBar
                        value={productSearchQuery}
                        onChange={setProductSearchQuery}
                        placeholder="Search products by name or description..."
                        onAdd={openProductFormModal}
                    />

                    {/* Category Navigation for Products */}
                    <div className="relative border-b border-gray-200 mb-2 md:mb-3">
                        <div className="scroll-tabs flex items-center gap-3 md:gap-6 overflow-x-auto py-1 md:py-2 px-1 md:px-4">
                            {categories.map(category => (
                                <CategoryTab
                                    key={category.id}
                                    category={category}
                                    isActive={selectedCategory === category.name}
                                    onClick={() => setSelectedCategory(category.name)}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Products List - Changed to Grid Layout */}
                    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-3 lg:gap-4 mt-4">
                        {filteredProducts.map(product => (
                            <ProductCardComponent
                                key={product.id}
                                product={product}
                            />
                        ))}
                        {filteredProducts.length === 0 && (
                            <div className="col-span-full p-8 text-center bg-white rounded-lg shadow-sm">
                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-50 mb-4">
                                    <i className="ph ph-package text-red-500 text-3xl"></i>
                                </div>
                                <h3 className="text-lg font-medium text-gray-800">No products found</h3>
                                <p className="text-gray-500 mt-2">
                                    {productSearchQuery
                                        ? `No products matching "${productSearchQuery}" in the selected category.`
                                        : `No products in the "${selectedCategory}" category.`
                                    }
                                </p>
                                <button
                                    className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors inline-flex items-center gap-2"
                                    onClick={openProductFormModal}
                                >
                                    <i className="ph ph-plus"></i>
                                    Add Product
                                </button>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <>
                    {/* Search Bar for Inventory */}
                    <SearchBar
                        value={searchQuery}
                        onChange={setSearchQuery}
                        placeholder="Search inventory items..."
                        onAdd={() => {
                            setEditingItem(null);
                            setIsAddModalOpen(true);
                        }}
                    />

                    {/* Inventory List */}
                    <div className="space-y-4">
                        {filteredInventory.map(item => (
                            <InventoryCard
                                key={item.id}
                                item={item}
                                onEdit={() => {
                                    setEditingItem(item);
                                    setIsAddModalOpen(true);
                                }}
                                onDelete={() => handleDeleteInventory(item.id)}
                            />
                        ))}
                    </div>
                </>
            )}

            {/* Add/Edit Modal */}
            <AddInventoryModal
                isOpen={isAddModalOpen}
                onClose={() => {
                    setIsAddModalOpen(false);
                    setEditingItem(null);
                }}
                onSave={handleSaveInventory}
                editItem={editingItem}
            />
        </div>
    );
}
