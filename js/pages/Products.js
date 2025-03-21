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

    React.useEffect(() => {
        async function fetchData() {
            try {
                // Fetch products
                const productsSnapshot = await sdk.collection("Product")
                    .orderBy("date", "desc")
                    .limit(100)
                    .get();

                const productsList = productsSnapshot.docs.map(doc =>
                    Product.fromDoc(doc)
                ).filter(Boolean);

                setProducts(productsList);

                // Fetch inventory items
                const inventorySnapshot = await sdk.collection("Inventory")
                    .orderBy("updatedAt", "desc")
                    .limit(100)
                    .get();

                const inventoryList = inventorySnapshot.docs.map(doc =>
                    InventoryItem.fromJson({
                        id: doc.id,
                        ...doc.data()
                    })
                );

                setInventory(inventoryList);

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
                if (formattedCategories.length > 0) {
                    setSelectedCategory(formattedCategories[0].name);
                }

                setLoading(false);
            } catch (err) {
                console.error('Error fetching data:', err);
                setError('Failed to load data');
                setLoading(false);
            }
        }

        fetchData();
    }, []);

    // Filter products based on search and category
    const filteredProducts = React.useMemo(() => {
        return products
            .filter(product => product.cat === selectedCategory)
            .filter(product =>
                product.title.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
                product.desc?.toLowerCase().includes(productSearchQuery.toLowerCase())
            );
    }, [products, selectedCategory, productSearchQuery]);

    // Filter inventory items based on search
    const filteredInventory = React.useMemo(() => {
        return inventory.filter(item =>
            item.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [inventory, searchQuery]);

    const handleSaveInventory = async (itemData) => {
        try {
            if (editingItem) {
                // Update existing item
                const updatedItem = new InventoryItem({
                    ...editingItem,
                    ...itemData,
                    updatedAt: new Date()
                });

                const updatedInventory = inventory.map(item =>
                    item.id === editingItem.id ? updatedItem : item
                );
                setInventory(updatedInventory);

                // Update in Firestore
                await sdk.collection("Inventory").doc(editingItem.id).update({
                    ...itemData,
                    updatedAt: new Date()
                });
            } else {
                // Add new item
                const newItemData = new InventoryItem({
                    ...itemData,
                    date: new Date(),
                    updatedAt: new Date()
                });

                // Add to Firestore
                const newItemRef = sdk.collection("Inventory").doc();
                await newItemRef.set(newItemData.toJson());

                newItemData.id = newItemRef.id;
                setInventory([...inventory, newItemData]);
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
                className={`px-6 py-2 rounded-full transition-colors ${isActive
                    ? 'bg-blue-100 text-blue-700'
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
                className={`flex-shrink-0 transition-colors relative py-2 ${isActive
                    ? 'text-blue-600 font-medium'
                    : 'text-gray-600 hover:text-blue-600'
                    }`}
                onClick={onClick}
            >
                <span className="whitespace-nowrap">
                    {`${category.name} (${category.count})`}
                </span>
                {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
                )}
            </button>
        );
    };

    // Search Bar Component
    const SearchBar = ({ value, onChange, placeholder, onAdd }) => {
        return (
            <div className="flex items-center gap-4 mb-6 bg-white p-4 rounded-lg shadow-sm">
                {/* Search Input */}
                <div className="flex-1 relative">
                    <i className="ph ph-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={placeholder}
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>
                {/* Add Button */}
                <button
                    className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                    onClick={onAdd}
                >
                    <i className={`ph ph-${activeTab === 'products' ? 'package-plus' : 'plus'} text-lg`} />
                    <span>
                        {activeTab === 'products' ? 'Add Product' : 'Add Item'}
                    </span>
                </button>
            </div>
        );
    };

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
        <div className="p-4">
            {/* Top Tabs (Products/Inventory) */}
            <div className="flex items-center gap-2 mb-6">
                <TabButton
                    isActive={activeTab === 'products'}
                    onClick={() => setActiveTab('products')}
                >
                    📦 Products
                </TabButton>
                <TabButton
                    isActive={activeTab === 'inventory'}
                    onClick={() => setActiveTab('inventory')}
                >
                    🗒️ Inventory
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
                        onAdd={() => setIsAddModalOpen(true)}
                    />

                    {/* Category Navigation for Products */}
                    <div className="relative border-b border-gray-200">
                        <div className="scroll-tabs flex items-center gap-6 overflow-x-auto py-2 px-4 md:px-0">
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

                    {/* Products List */}
                    <div className="space-y-4 mt-4">
                        {filteredProducts.map(product => (
                            <ProductCard
                                key={product.id}
                                product={product}
                            />
                        ))}
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
