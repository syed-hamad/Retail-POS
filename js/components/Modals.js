// Add Table Modal Component
function AddTableModal({ isOpen, onClose, seller }) {
    const [title, setTitle] = React.useState('');
    const [desc, setDesc] = React.useState('');
    const [error, setError] = React.useState('');
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            if (!title) {
                setError('Please enter a title');
                setIsSubmitting(false);
                return;
            }

            if (!desc) {
                setError('Please enter a description');
                setIsSubmitting(false);
                return;
            }

            // Check if table already exists
            if (seller?.tables?.some(t => t.title === title)) {
                setError('Table already exists');
                setIsSubmitting(false);
                return;
            }

            // Create new table object
            const newTable = {
                id: `T${Date.now().toString(36)}`, // Generate unique ID
                title,
                desc,
                type: 'dine_in',
                section: 'ac'
            };

            // Update Firestore
            // Get current tables from seller
            const currentTables = seller?.tables || [];

            // Add new table to the list
            const updatedTables = [...currentTables, newTable];

            // Update seller document in Firestore
            await sdk.profile.update({
                tables: updatedTables
            });

            // Show success message
            showToast('Table added successfully');

            // Close modal
            onClose();
        } catch (err) {
            console.error('Error adding table:', err);
            setError('Failed to add table. Please try again.');
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center" onClick={onClose}>
            <div className="bg-white rounded-lg w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold mb-4">Add Table</h2>

                <form onSubmit={handleSubmit}>
                    {error && (
                        <div className="mb-4 p-2 bg-red-50 text-red-600 rounded">
                            {error}
                        </div>
                    )}

                    <div className="mb-4">
                        <label className="block text-gray-700 mb-2">Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            maxLength={4}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="eg. T1"
                        />
                    </div>

                    <div className="mb-6">
                        <label className="block text-gray-700 mb-2">Description</label>
                        <input
                            type="text"
                            value={desc}
                            onChange={e => setDesc(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="eg. Table in the corner"
                        />
                    </div>

                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                        >
                            Save Table
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// Rename Room Modal Component
function RenameRoomModal({ isOpen, onClose, tableId, variant, seller }) {
    const [title, setTitle] = React.useState(tableId || variant || '');
    const [error, setError] = React.useState('');
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            if (!title) {
                setError('Please enter a title');
                setIsSubmitting(false);
                return;
            }

            if (tableId) {
                // Rename table
                // Get current tables from seller
                const currentTables = seller?.tables || [];

                // Find the table to rename
                const updatedTables = currentTables.map(table =>
                    table.title === tableId ? { ...table, title } : table
                );

                // Update seller document in Firestore
                await sdk.profile.update({
                    tables: updatedTables
                });

                showToast('Table renamed successfully');
            } else if (variant) {
                // Rename variant
                // Get current price variants from seller
                const currentVariants = seller?.priceVariants || [];

                // Find the variant to rename
                const updatedVariants = currentVariants.map(v =>
                    v === variant ? title : v
                );

                // Update seller document in Firestore
                await sdk.profile.update({
                    priceVariants: updatedVariants
                });

                showToast('Price variant renamed successfully');
            }

            onClose();
        } catch (err) {
            console.error('Error renaming:', err);
            setError('Failed to rename. Please try again.');
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center" onClick={onClose}>
            <div className="bg-white rounded-lg w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold mb-4">Rename Room</h2>

                <form onSubmit={handleSubmit}>
                    {error && (
                        <div className="mb-4 p-2 bg-red-50 text-red-600 rounded">
                            {error}
                        </div>
                    )}

                    <div className="mb-6">
                        <label className="block text-gray-700 mb-2">Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="eg. T1"
                        />
                    </div>

                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                        >
                            Save
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// Profile Menu Component
function ProfileMenu({ isOpen, onClose, seller }) {
    const { downloadQr } = window.useProfile ? window.useProfile() : { downloadQr: () => { } };
    const [showProfileEditor, setShowProfileEditor] = React.useState(false);

    if (!isOpen) return null;

    // If profile editor is shown, render the ProfilePage component
    if (showProfileEditor) {
        return (
            <div className="fixed inset-0 z-50 bg-black bg-opacity-50" onClick={() => setShowProfileEditor(false)}>
                <div className="absolute right-0 top-0 h-full w-full md:w-2/3 lg:w-1/2 bg-white shadow-lg overflow-y-auto" onClick={e => e.stopPropagation()}>
                    <div className="p-4">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold">Edit Profile</h2>
                            <button
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-50 hover:bg-gray-100 transition-colors"
                                onClick={() => setShowProfileEditor(false)}
                            >
                                <i className="ph ph-x text-lg text-gray-600" />
                            </button>
                        </div>
                        <ProfilePage inModal={true} onClose={() => setShowProfileEditor(false)} />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50" onClick={onClose}>
            <div className="absolute right-0 top-0 h-full w-96 bg-white shadow-lg overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="p-6">
                    {/* Modern Header with just close button */}
                    <div className="flex justify-end mb-6">
                        <button className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-50 hover:bg-gray-100 transition-colors" onClick={onClose}>
                            <i className="ph ph-x text-lg text-gray-600" />
                        </button>
                    </div>

                    {/* Content Container with gradient background */}
                    <div className="space-y-8">
                        {/* Avatar and Basic Info with gradient background */}
                        <div className="relative text-center px-4 py-6 rounded-2xl bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
                            <div className="inline-block relative mb-4">
                                <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center overflow-hidden border-2 border-white ring-4 ring-white/50 shadow-lg">
                                    {seller?.avatar ? (
                                        <img src={seller.avatar} alt={seller?.businessName} className="w-full h-full object-cover" />
                                    ) : (
                                        <i className="ph ph-storefront text-3xl text-gray-400" />
                                    )}
                                </div>
                            </div>
                            <h4 className="text-lg font-semibold text-gray-900">
                                {seller?.businessName || 'Loading...'}
                            </h4>
                            {seller?.phone && (
                                <p className="text-sm text-gray-500 mt-1 flex items-center justify-center gap-1">
                                    <i className="ph ph-phone text-base" />
                                    {seller.phone}
                                </p>
                            )}
                        </div>

                        {/* Info Cards */}
                        <div className="space-y-4">
                            {seller?.address && (
                                <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 p-4 rounded-xl border border-emerald-100/20">
                                    <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-full bg-white/80 flex items-center justify-center flex-shrink-0 shadow-sm">
                                            <i className="ph ph-map-pin text-emerald-600" />
                                        </div>
                                        <div>
                                            <h5 className="text-sm font-medium text-gray-900 mb-1">Store Address</h5>
                                            <p className="text-sm text-gray-600 leading-relaxed">{seller.address}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-violet-50 p-4 rounded-xl border border-blue-100/20">
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-white/80 flex items-center justify-center flex-shrink-0 shadow-sm">
                                        <i className="ph ph-globe text-blue-600" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <h5 className="text-sm font-medium text-gray-900">Store URL</h5>
                                            <button
                                                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                                                onClick={() => {
                                                    const url = `https://${seller?.username}.shopto.store`;
                                                    navigator.clipboard.writeText(url);
                                                    showToast('URL copied to clipboard', 'success');
                                                }}
                                            >
                                                Copy
                                            </button>
                                        </div>
                                        <p className="text-sm text-gray-600 font-mono break-all">
                                            {`https://${seller?.username}.shopto.store`}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="space-y-3 pt-2">
                            <button
                                className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all flex items-center justify-center gap-2 font-medium shadow-sm"
                                onClick={() => downloadQr()}
                            >
                                <i className="ph ph-qr-code text-lg" />
                                Get Store QR Code
                            </button>
                            <button
                                className="w-full px-4 py-2.5 bg-gradient-to-r from-gray-100 to-gray-50 text-gray-700 rounded-xl hover:from-gray-200 hover:to-gray-100 transition-all flex items-center justify-center gap-2 font-medium"
                                onClick={() => setShowProfileEditor(true)}
                            >
                                <i className="ph ph-user-circle text-lg" />
                                Edit Profile
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Add Inventory Modal Component
function AddInventoryModal({ isOpen, onClose, onSave, editItem = null }) {
    const [formData, setFormData] = React.useState({
        name: editItem?.name || '',
        quantity: editItem?.quantity || '',
        unit: editItem?.unit || 'kg',
        minQuantity: editItem?.minQuantity || ''
    });

    const units = ['kg', 'gm', 'ltr', 'ml', 'pc'];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg w-full max-w-md p-6">
                {/* Modal Header */}
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold">
                        {editItem ? 'Edit Inventory Item' : 'Add New Item'}
                    </h3>
                    <button className="p-2 hover:bg-gray-100 rounded-full" onClick={onClose}>
                        <i className="ph ph-x text-gray-600" />
                    </button>
                </div>
                {/* Form */}
                <div className="space-y-4">
                    {/* Name Input */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Item Name
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Enter item name"
                        />
                    </div>
                    {/* Quantity and Unit */}
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Quantity
                            </label>
                            <input
                                type="number"
                                value={formData.quantity}
                                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Enter quantity"
                            />
                        </div>
                        <div className="w-32">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Unit
                            </label>
                            <select
                                value={formData.unit}
                                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                {units.map(unit => (
                                    <option key={unit} value={unit}>{unit}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    {/* Min Quantity */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Minimum Quantity
                        </label>
                        <input
                            type="number"
                            value={formData.minQuantity}
                            onChange={(e) => setFormData({ ...formData, minQuantity: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Enter minimum quantity"
                        />
                    </div>
                </div>
                {/* Action Buttons */}
                <div className="flex justify-end gap-3 mt-6">
                    <button
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        onClick={onClose}
                    >
                        Cancel
                    </button>
                    <button
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        onClick={() => {
                            if (!formData.name || !formData.quantity || !formData.minQuantity) {
                                alert('Please fill all required fields');
                                return;
                            }
                            onSave({
                                ...formData,
                                quantity: Number(formData.quantity),
                                minQuantity: Number(formData.minQuantity),
                                lastUpdated: new Date().toISOString()
                            });
                        }}
                    >
                        {editItem ? 'Update' : 'Add'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// OrderRoom Modal Component
function OrderRoom({ isOpen, onClose, tableId, variant, seller }) {
    const [orders, setOrders] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    const menuRef = React.useRef(null);

    React.useEffect(() => {
        if (!isOpen) return;

        async function fetchOrders() {
            try {
                setLoading(true);
                const ordersSnapshot = await sdk.collection("Orders")
                    .orderBy("date", "desc")
                    .limit(100)
                    .get();

                const allOrders = ordersSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                // Filter orders by KITCHEN status and tableId or variant
                // This matches the Flutter implementation where we filter by currentStatus.label
                const filteredOrders = allOrders.filter(order => {
                    if (order.currentStatus?.label !== 'KITCHEN') return false;

                    if (tableId) {
                        return order.tableId === tableId;
                    } else if (variant) {
                        return order.priceVariant === variant;
                    }

                    return false;
                });

                setOrders(filteredOrders);
                setLoading(false);
            } catch (err) {
                console.error('Error fetching orders:', err);
                setError('Failed to load orders');
                setLoading(false);
            }
        }

        fetchOrders();

        // Set up interval to refresh orders every 30 seconds
        const interval = setInterval(fetchOrders, 30000);

        // Add click event listener to close menu when clicking outside
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);

        // Cleanup interval and event listener on component unmount or when modal closes
        return () => {
            clearInterval(interval);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, tableId, variant]);

    const handleAddNewOrder = () => {
        // In a real implementation, this would open the POS screen
        console.log('Add new order for', tableId || variant);
        // For now, just show a toast
        showToast('Add new order functionality coming soon');
    };

    const handleShowQR = () => {
        // In a real implementation, this would show the QR code
        console.log('Show QR for', tableId || variant);
        // For now, just show a toast
        showToast('QR code functionality coming soon');
        setIsMenuOpen(false);
    };

    const handleDeleteTable = () => {
        if (confirm(`Are you sure you want to delete ${tableId ? `table ${tableId}` : variant}?`)) {
            // In a real implementation, this would delete the table
            console.log('Delete', tableId || variant);
            // For now, just show a toast and close the modal
            showToast('Delete functionality coming soon');
            onClose();
        }
        setIsMenuOpen(false);
    };

    // Calculate total items and served items across all orders
    const totalItems = orders.reduce((sum, order) => sum + (order.totalItems || order.items?.reduce((s, item) => s + (item.qnt || item.quantity || 1), 0) || 0), 0);
    const servedItems = orders.reduce((sum, order) => sum + (order.servedItems || order.items?.filter(item => item.served).reduce((s, item) => s + (item.qnt || item.quantity || 1), 0) || 0), 0);
    const progress = totalItems > 0 ? (servedItems / totalItems) * 100 : 0;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
            <div className="bg-white w-full max-w-4xl h-full md:h-auto md:max-h-[90vh] overflow-y-auto rounded-lg shadow-xl">
                <div className="sticky top-0 bg-white border-b z-10">
                    <div className="p-4 flex items-center justify-between">
                        <h2 className="text-xl font-semibold">
                            {variant || `Table ${tableId}`}
                        </h2>
                        <div className="flex items-center">
                            <div className="relative" ref={menuRef}>
                                <button
                                    className="p-2 hover:bg-gray-100 rounded-full"
                                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                                >
                                    <i className="ph ph-dots-three-vertical text-xl"></i>
                                </button>
                                {isMenuOpen && (
                                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-20">
                                        <div className="py-1">
                                            <button
                                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                                                onClick={handleShowQR}
                                            >
                                                <i className="ph ph-qr-code mr-2"></i>
                                                Show QR
                                            </button>
                                            <button
                                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                                                onClick={handleDeleteTable}
                                            >
                                                <i className="ph ph-trash mr-2"></i>
                                                Delete table
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-gray-100 rounded-full"
                            >
                                <i className="ph ph-x text-xl"></i>
                            </button>
                        </div>
                    </div>

                    {orders.length > 0 && (
                        <div className="px-4 pb-2">
                            <div className="flex justify-between text-sm text-gray-600 mb-1">
                                <span>Progress</span>
                                <span>{servedItems}/{totalItems} items served</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                    className="bg-blue-600 h-2 rounded-full"
                                    style={{ width: `${progress}%` }}
                                ></div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4">
                    {loading ? (
                        <div className="p-4 text-center">
                            <div className="animate-spin inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
                        </div>
                    ) : error ? (
                        <div className="p-4 text-center text-red-600">{error}</div>
                    ) : orders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10">
                            <div className="opacity-50 mb-8">
                                <i className="ph ph-shopping-bag text-5xl text-blue-800 mb-4"></i>
                                <p className="text-xl font-bold text-blue-800 text-center">No orders yet here</p>
                            </div>
                            <button
                                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                onClick={handleAddNewOrder}
                            >
                                Add New Order
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {orders.map(order => (
                                <OrderView
                                    key={order.id}
                                    order={order}
                                    tableId={tableId}
                                    variant={variant}
                                />
                            ))}
                            <div className="py-4">
                                <button
                                    className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                    onClick={handleAddNewOrder}
                                >
                                    Add New Order
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// OrderView Component
function OrderView({ order, tableId, variant }) {
    // Calculate served items
    const totalItems = order.items?.reduce((sum, item) => sum + (item.quantity || item.qnt || 1), 0) || 0;
    const servedItems = order.items?.filter(item => item.served).reduce((sum, item) => sum + (item.quantity || item.qnt || 1), 0) || 0;
    const progress = totalItems > 0 ? servedItems / totalItems : 0;

    // Format date using the patterns from DateModifiers extension
    const formatTinyDateTime = (date) => {
        if (!date) return '';

        const orderDate = new Date(date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const orderDay = new Date(orderDate);
        orderDay.setHours(0, 0, 0, 0);

        const timeStr = orderDate.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });

        if (orderDay.getTime() === today.getTime()) {
            return `Today, ${timeStr}`;
        } else if (orderDay.getTime() === yesterday.getTime()) {
            return `Yesterday, ${timeStr}`;
        } else if (orderDay.getTime() === tomorrow.getTime()) {
            return `Tomorrow, ${timeStr}`;
        } else if (orderDay.getFullYear() === today.getFullYear()) {
            return orderDate.toLocaleDateString('en-US', {
                weekday: 'long',
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        } else {
            return orderDate.toLocaleDateString('en-US', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        }
    };

    const handlePrintKOT = async () => {
        try {
            // In a real implementation, this would print the KOT
            console.log('Print KOT for order:', order.id);
            showToast('KOT Printed');
        } catch (err) {
            console.error('Error printing KOT:', err);
            showToast('Failed to print KOT', 'error');
        }
    };

    const handleCheckout = async () => {
        try {
            // In a real implementation, this would open the checkout sheet
            console.log('Checkout order:', order.id);
            showToast('Checkout functionality coming soon');
        } catch (err) {
            console.error('Error checking out:', err);
            showToast('Failed to checkout', 'error');
        }
    };

    const handleAddNewItem = () => {
        // In a real implementation, this would open the POS screen with the current order
        console.log('Add new item to order:', order.id);
        showToast('Add new item functionality coming soon');
    };

    const toggleItemServed = async (item, served) => {
        try {
            // Update the item's served status in the database
            await sdk.orders.updateItemServed(order.id, item.pid, served);
            showToast(`Item ${served ? 'served' : 'unserved'}`);
        } catch (err) {
            console.error('Error updating item served status:', err);
            showToast('Failed to update item status', 'error');
        }
    };

    const handleRemoveItem = async (item) => {
        try {
            // Remove the item from the order
            await sdk.orders.removeItem(order.id, item.pid);
            showToast(`${item.title} removed from order`);
        } catch (err) {
            console.error('Error removing item:', err);
            showToast('Failed to remove item', 'error');
        }
    };

    const handleAddItem = async (item) => {
        try {
            // Add one more of the item to the order
            await sdk.orders.addItem(order.id, item.pid);
            showToast(`${item.title} added to order`);
        } catch (err) {
            console.error('Error adding item:', err);
            showToast('Failed to add item', 'error');
        }
    };

    // Helper function to get the item image URL
    const getItemImage = (item) => {
        // Check for thumb first (as in the Flutter model)
        return item.thumb || item.image || item.thumbnail || item.imageUrl || item.img || null;
    };

    // Helper function to get a category-appropriate icon
    const getCategoryIcon = (item) => {
        const category = (item.cat || item.category || '').toLowerCase();

        if (category.includes('drink') || category.includes('beverage')) {
            return 'ph-coffee';
        } else if (category.includes('dessert') || category.includes('sweet')) {
            return 'ph-cake';
        } else if (item.veg) {
            return 'ph-leaf';
        } else {
            return 'ph-hamburger';
        }
    };

    // Calculate subtotal
    const subtotal = order.items?.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || item.qnt || 1)), 0) || 0;

    // Check if customer information is available
    const hasCustomerInfo = order.custName || order.custPhone || order.custId;

    return (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-4 border-b">
                <div className="flex items-center justify-between">
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <h3 className="font-medium">Bill No: #{order.billNo || order.id?.slice(-6)}</h3>
                            <div className="flex-1"></div>
                            <span className="text-sm text-gray-600">Served</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            <p className="text-sm text-gray-500">{formatTinyDateTime(order.date)}</p>
                            <div className="flex-1"></div>
                            <span className="text-sm text-gray-600">{servedItems}/{totalItems} items</span>
                        </div>
                    </div>
                    <button
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-full"
                        onClick={handleAddNewItem}
                    >
                        <i className="ph ph-plus-circle text-2xl"></i>
                    </button>
                </div>

                <div className="mt-2 bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                        className="bg-blue-600 h-full rounded-full"
                        style={{ width: `${progress * 100}%` }}
                    ></div>
                </div>
            </div>

            {/* Customer Information (if available) */}
            {hasCustomerInfo && (
                <div className="px-4 py-3 bg-blue-50 border-b">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <i className="ph ph-user text-blue-600"></i>
                        </div>
                        <div>
                            <h4 className="font-medium">{order.custName || "Customer"}</h4>
                            {order.custPhone && (
                                <p className="text-sm text-gray-600">{order.custPhone}</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="p-4 space-y-4">
                {order.items?.map((item, index) => (
                    <div key={index} className="flex items-center border-b pb-3">
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={item.served || false}
                                onChange={(e) => toggleItemServed(item, e.target.checked)}
                                className="w-5 h-5 rounded text-blue-600"
                            />
                            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                                {getItemImage(item) ? (
                                    <img
                                        src={getItemImage(item)}
                                        alt={item.title}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            e.target.onerror = null;
                                            e.target.style.display = 'none';
                                            e.target.parentNode.innerHTML = `<i class="ph ${getCategoryIcon(item)} text-2xl text-gray-500"></i>`;
                                        }}
                                    />
                                ) : (
                                    <i className={`ph ${getCategoryIcon(item)} text-2xl text-gray-500`}></i>
                                )}
                            </div>
                        </div>
                        <div className="ml-3 flex-1">
                            <h4 className="font-medium">{item.title}</h4>
                            <p className="text-sm text-gray-600">
                                Qnt: {item.qnt || item.quantity || 1}
                                Price: ₹{item.price || 0}
                                {item.veg !== undefined && (
                                    <span className={`ml-2 ${item.veg ? 'text-green-600' : 'text-red-600'}`}>
                                        <i className={`ph ${item.veg ? 'ph-leaf' : 'ph-circle-wavy'} text-sm`}></i>
                                    </span>
                                )}
                            </p>
                        </div>
                        <div className="flex items-center">
                            <button
                                className="p-2 text-gray-600 hover:bg-gray-100 rounded-full"
                                onClick={() => handleRemoveItem(item)}
                            >
                                <i className="ph ph-minus"></i>
                            </button>
                            <button
                                className="p-2 text-gray-600 hover:bg-gray-100 rounded-full"
                                onClick={() => handleAddItem(item)}
                            >
                                <i className="ph ph-plus"></i>
                            </button>
                        </div>
                    </div>
                ))}

                <div className="pt-2">
                    <div className="flex justify-between items-center">
                        <h3 className="font-medium">Sub Total:</h3>
                        <p className="font-semibold">₹{subtotal}</p>
                    </div>

                    {order.discount > 0 && (
                        <div className="flex justify-between items-center text-green-600">
                            <h3 className="font-medium">Discount:</h3>
                            <p className="font-semibold">-₹{order.discount}</p>
                        </div>
                    )}

                    {order.charges?.length > 0 && order.charges.map((charge, index) => (
                        <div key={index} className="flex justify-between items-center">
                            <h3 className="font-medium">{charge.title}:</h3>
                            <p className="font-semibold">₹{charge.value}</p>
                        </div>
                    ))}

                    <div className="flex justify-between items-center mt-2 pt-2 border-t">
                        <h3 className="font-medium text-lg">Total:</h3>
                        <p className="font-semibold text-lg">
                            ₹{order.total || (subtotal - (order.discount || 0))}
                        </p>
                    </div>
                </div>

                {order.instructions && (
                    <div className="bg-yellow-50 p-3 rounded-lg">
                        <h4 className="text-sm font-medium text-yellow-800 mb-1">Instructions:</h4>
                        <p className="text-sm text-yellow-700">{order.instructions}</p>
                    </div>
                )}

                <div className="flex gap-4 pt-4">
                    <button
                        className="px-4 py-2 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50 transition-colors"
                        onClick={handlePrintKOT}
                    >
                        Print KOT
                    </button>
                    <button
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                        onClick={handleCheckout}
                    >
                        Checkout
                    </button>
                </div>
            </div>
        </div>
    );
}

// CustomerSearch Component
function CustomerSearch({ isOpen, onClose, onSelectCustomer }) {
    const [searchTerm, setSearchTerm] = React.useState('');
    const [customers, setCustomers] = React.useState([]);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState(null);
    const [showAddForm, setShowAddForm] = React.useState(false);
    const [newCustomer, setNewCustomer] = React.useState({
        name: '',
        phone: ''
    });

    // Search for customers when the search term changes
    React.useEffect(() => {
        if (!searchTerm || searchTerm.length < 2) {
            setCustomers([]);
            return;
        }

        const delayDebounceFn = setTimeout(async () => {
            try {
                setLoading(true);
                setError(null);

                // Search for customers
                const results = await sdk.collection("Customers")
                    .where("phone", "==", searchTerm)
                    .limit(10)
                    .get()
                    .then(snapshot => snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    })));

                setCustomers(results);
            } catch (err) {
                console.error('Error searching customers:', err);
                setError('Failed to search customers');
            } finally {
                setLoading(false);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm]);

    // Handle selecting a customer
    const handleSelectCustomer = (customer) => {
        onSelectCustomer(customer);
        onClose();
    };

    // Handle creating a new customer
    const handleCreateCustomer = async () => {
        try {
            if (!newCustomer.name || !newCustomer.phone) {
                setError('Please enter both name and phone number');
                return;
            }

            setLoading(true);
            setError(null);

            // Create the customer
            const customerData = {
                ...newCustomer,
                date: new Date(),
                orderCount: 0,
                totalSpent: 0,
                balance: 0
            };

            // Add to Firestore
            const newCustomerRef = sdk.collection("Customers").doc();
            await newCustomerRef.set(customerData);

            const customer = {
                id: newCustomerRef.id,
                ...customerData
            };

            // Select the new customer
            handleSelectCustomer(customer);
        } catch (err) {
            console.error('Error creating customer:', err);
            setError('Failed to create customer');
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center" onClick={onClose}>
            <div className="bg-white rounded-lg w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Select Customer</h2>
                    <button
                        className="p-2 hover:bg-gray-100 rounded-full"
                        onClick={onClose}
                    >
                        <i className="ph ph-x text-gray-600"></i>
                    </button>
                </div>

                {error && (
                    <div className="mb-4 p-2 bg-red-50 text-red-600 rounded">
                        {error}
                    </div>
                )}

                {!showAddForm ? (
                    <>
                        <div className="mb-4">
                            <div className="relative">
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    placeholder="Search by name or phone"
                                    className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <i className="ph ph-magnifying-glass absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                            </div>
                        </div>

                        <div className="max-h-60 overflow-y-auto mb-4">
                            {loading ? (
                                <div className="p-4 text-center">
                                    <div className="animate-spin inline-block w-6 h-6 border-3 border-primary border-t-transparent rounded-full"></div>
                                </div>
                            ) : customers.length > 0 ? (
                                <div className="space-y-2">
                                    {customers.map(customer => (
                                        <div
                                            key={customer.id}
                                            className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                                            onClick={() => handleSelectCustomer(customer)}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                                    <i className="ph ph-user text-blue-600"></i>
                                                </div>
                                                <div>
                                                    <h4 className="font-medium">{customer.name}</h4>
                                                    <p className="text-sm text-gray-600">{customer.phone}</p>
                                                </div>
                                                {customer.orderCount > 0 && (
                                                    <div className="ml-auto text-right">
                                                        <span className="text-sm text-gray-600">{customer.orderCount} orders</span>
                                                        <p className="text-sm font-medium">₹{customer.totalSpent}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : searchTerm.length >= 2 ? (
                                <div className="p-4 text-center text-gray-500">
                                    No customers found
                                </div>
                            ) : (
                                <div className="p-4 text-center text-gray-500">
                                    Type at least 2 characters to search
                                </div>
                            )}
                        </div>

                        <button
                            className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            onClick={() => setShowAddForm(true)}
                        >
                            Add New Customer
                        </button>
                    </>
                ) : (
                    <>
                        <div className="space-y-4 mb-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Name
                                </label>
                                <input
                                    type="text"
                                    value={newCustomer.name}
                                    onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Enter customer name"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Phone
                                </label>
                                <input
                                    type="tel"
                                    value={newCustomer.phone}
                                    onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Enter phone number"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                                onClick={() => setShowAddForm(false)}
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <button
                                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                onClick={handleCreateCustomer}
                                disabled={loading}
                            >
                                {loading ? (
                                    <div className="animate-spin inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                                ) : (
                                    'Create Customer'
                                )}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

// Export components
window.ProfileMenu = ProfileMenu;
window.AddTableModal = AddTableModal;
window.RenameRoomModal = RenameRoomModal;
window.OrderRoom = OrderRoom;
window.OrderView = OrderView;
window.CustomerSearch = CustomerSearch; 