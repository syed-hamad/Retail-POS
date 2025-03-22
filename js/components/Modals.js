const React = window.React;
const ReactDOM = window.ReactDOM;

// Modal components for the application

// Add Table Modal Component
function AddTableModal({ isOpen, onClose, seller }) {
    const [title, setTitle] = React.useState('');
    const [desc, setDesc] = React.useState('');
    const [error, setError] = React.useState(null);

    // Reset form when modal opens
    React.useEffect(() => {
        if (isOpen) {
            setTitle('');
            setDesc('');
            setError(null);
        }
    }, [isOpen]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validate form
        if (!title) {
            setError('Please enter a title');
            return;
        }

        if (!desc) {
            setError('Please enter a description');
            return;
        }

        // Check if table already exists
        const existingTables = seller?.tables || [];
        if (existingTables.some(t => t.title === title)) {
            setError('Table already exists');
            return;
        }

        try {
            // Get current tables
            const currentTables = existingTables || [];

            // Add new table
            await window.sdk.profile.update({
                tables: [...currentTables, { title, desc }]
            });

            showToast('Table added successfully');
            onClose();
        } catch (err) {
            console.error('Error adding table:', err);
            setError('Failed to add table. Please try again.');
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${isOpen ? 'visible' : 'invisible'}`}
            onClick={onClose}
        >
            <div className="fixed inset-0 bg-black bg-opacity-50"></div>
            <div className="bg-section-bg w-full max-w-md rounded-lg shadow-section overflow-hidden relative z-10" onClick={e => e.stopPropagation()}>
                <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-xl font-semibold text-gray-800">Add New Table</h3>
                </div>

                <form onSubmit={handleSubmit} className="p-6">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md">
                            {error}
                        </div>
                    )}

                    <div className="mb-4">
                        <label className="block text-gray-700 mb-2" htmlFor="title">
                            Title
                        </label>
                        <input
                            type="text"
                            id="title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            maxLength={4}
                            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="eg. T1"
                        />
                        <p className="text-xs text-gray-500 mt-1">Max 4 characters</p>
                    </div>

                    <div className="mb-6">
                        <label className="block text-gray-700 mb-2" htmlFor="desc">
                            Description
                        </label>
                        <input
                            type="text"
                            id="desc"
                            value={desc}
                            onChange={(e) => setDesc(e.target.value)}
                            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="eg. Table in the corner"
                        />
                    </div>

                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border rounded-md hover:bg-gray-50"
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
    const [title, setTitle] = React.useState('');
    const [error, setError] = React.useState(null);

    // Set initial title when modal opens
    React.useEffect(() => {
        if (isOpen) {
            setTitle(tableId || variant || '');
            setError(null);
        }
    }, [isOpen, tableId, variant]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validate form
        if (!title) {
            setError('Please enter a title');
            return;
        }

        try {
            if (variant) {
                // Rename price variant
                const vars = seller?.priceVariants || [];
                const index = vars.findIndex(v => v.title === variant);

                if (index === -1) {
                    setError("Can't rename this default room");
                    return;
                }

                const updatedVars = [...vars];
                updatedVars[index] = { title };

                await window.sdk.profile.update({ priceVariants: updatedVars });
            } else if (tableId) {
                // Rename table
                const tables = seller?.tables || [];
                const index = tables.findIndex(t => t.title === tableId);

                if (index === -1) {
                    setError("Can't rename this table");
                    return;
                }

                const updatedTables = [...tables];
                updatedTables[index] = { ...updatedTables[index], title };

                await window.sdk.profile.update({ tables: updatedTables });
            } else {
                setError("Can't rename room");
                return;
            }

            showToast('Renamed successfully');
            onClose();
        } catch (err) {
            console.error('Error renaming:', err);
            setError('Failed to rename. Please try again.');
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${isOpen ? 'visible' : 'invisible'}`}
            onClick={onClose}
        >
            <div className="fixed inset-0 bg-black bg-opacity-50"></div>
            <div className="bg-section-bg w-full max-w-md rounded-lg shadow-section overflow-hidden relative z-10" onClick={e => e.stopPropagation()}>
                <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-xl font-semibold text-gray-800">Rename Table</h3>
                </div>

                <form onSubmit={handleSubmit} className="p-6">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md">
                            {error}
                        </div>
                    )}

                    <div className="mb-6">
                        <label className="block text-gray-700 mb-2" htmlFor="title">
                            Title
                        </label>
                        <input
                            type="text"
                            id="title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="eg. T1"
                        />
                    </div>

                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border rounded-md hover:bg-gray-50"
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
        <div className="fixed inset-0 z-50" onClick={onClose}>
            <div className="fixed inset-0 bg-black bg-opacity-50"></div>
            <div className="absolute top-16 right-4 mt-2 w-64 bg-section-bg rounded-lg shadow-section overflow-hidden" onClick={e => e.stopPropagation()}>
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
        <div
            className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${isOpen ? 'visible' : 'invisible'}`}
            onClick={onClose}
        >
            <div className="fixed inset-0 bg-black bg-opacity-50"></div>
            <div className="bg-section-bg w-full max-w-md rounded-lg shadow-section overflow-hidden relative z-10" onClick={e => e.stopPropagation()}>
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
    const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);
    const menuRef = React.useRef(null);
    const dialogRef = React.useRef(null);
    const [isClosing, setIsClosing] = React.useState(false);

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

    // Set up real-time listener for orders (equivalent to StreamBuilder in Flutter)
    React.useEffect(() => {
        if (!isOpen) return;

        let unsubscribe = () => { };

        try {
            // Create query similar to the Flutter implementation
            let query = window.sdk.collection("Orders")
                .where("currentStatus.label", "==", "KITCHEN");

            if (tableId) {
                query = query.where("tableId", "==", tableId);
            } else if (variant) {
                query = query.where("priceVariant", "==", variant);
            }

            // Set up real-time listener
            unsubscribe = query.onSnapshot(
                (snapshot) => {
                    const ordersList = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    })).filter(order => order.items && order.items.length > 0);

                    setOrders(ordersList);
                    setLoading(false);
                },
                (err) => {
                    console.error('Error listening to orders:', err);
                    setError('Failed to load orders');
                    setLoading(false);
                }
            );
        } catch (err) {
            console.error('Error setting up orders listener:', err);
            setError('Failed to set up orders listener');
            setLoading(false);
        }

        // Clean up listener when component unmounts or modal closes
        return () => {
            unsubscribe();
        };
    }, [isOpen, tableId, variant]);

    // Set up refresh interval (every 30 seconds)
    React.useEffect(() => {
        if (!isOpen) return;

        const intervalId = setInterval(() => {
            console.log('Refreshing orders data...');
            // The real-time listener will handle the refresh
        }, 30000);

        return () => clearInterval(intervalId);
    }, [isOpen]);

    // Add click event listener to close menu when clicking outside
    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Add swipe gesture for mobile
    React.useEffect(() => {
        if (!isOpen || !dialogRef.current) return;

        let startX, startY;
        const handleTouchStart = (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        };

        const handleTouchMove = (e) => {
            if (!startX || !startY) return;

            const currentX = e.touches[0].clientX;
            const currentY = e.touches[0].clientY;
            const diffX = startX - currentX;
            const diffY = startY - currentY;

            // Detect horizontal swipe (for desktop)
            if (Math.abs(diffX) > Math.abs(diffY) && diffX < -50 && !isMobile) {
                handleClose();
            }

            // Detect vertical swipe down (for mobile)
            if (Math.abs(diffY) > Math.abs(diffX) && diffY < -50 && isMobile) {
                handleClose();
            }
        };

        const element = dialogRef.current;
        element.addEventListener('touchstart', handleTouchStart);
        element.addEventListener('touchmove', handleTouchMove);

        return () => {
            element.removeEventListener('touchstart', handleTouchStart);
            element.removeEventListener('touchmove', handleTouchMove);
        };
    }, [isOpen, isMobile]);

    // Handle smooth closing animation
    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            setIsClosing(false);
            onClose();
        }, 300); // Match this with the CSS transition duration
    };

    // Function to reload orders
    const loadOrders = async () => {
        setLoading(true);
        try {
            // Create query similar to the Flutter implementation
            let query = window.sdk.collection("Orders")
                .where("currentStatus.label", "==", "KITCHEN");

            if (tableId) {
                query = query.where("tableId", "==", tableId);
            } else if (variant) {
                query = query.where("priceVariant", "==", variant);
            }

            const snapshot = await query.get();
            const ordersList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })).filter(order => order.items && order.items.length > 0);

            setOrders(ordersList);
            setLoading(false);
        } catch (err) {
            console.error('Error loading orders:', err);
            setError('Failed to load orders');
            setLoading(false);
        }
    };

    const handleAddNewOrder = () => {
        // Check if POS component is available
        if (!window.POS) {
            console.error("POS component is not defined");
            showToast("Cannot open POS: component not available", "error");
            return;
        }

        // Create a container for the POS component
        const posContainer = document.createElement('div');
        posContainer.id = 'pos-container';
        posContainer.className = 'fixed inset-0 z-50';
        document.body.appendChild(posContainer);

        try {
            // Create a root element for React 18
            const root = ReactDOM.createRoot(posContainer);

            // Render the POS component
            root.render(
                React.createElement(window.POS, {
                    title: "New Order",
                    tableId: tableId,
                    variant: variant,
                    onClose: () => {
                        // Unmount and clean up
                        root.unmount();
                        if (document.body.contains(posContainer)) {
                            document.body.removeChild(posContainer);
                        }
                        // Refresh orders list
                        loadOrders();
                    }
                })
            );
        } catch (error) {
            console.error("Error rendering POS:", error);
            if (document.body.contains(posContainer)) {
                document.body.removeChild(posContainer);
            }
            showToast("Failed to open POS", "error");
        }
    };

    const handleShowQR = () => {
        // Download QR code for the table (equivalent to Usr.seller!.downloadQr(tableId: widget.tableId))
        if (seller && typeof seller.downloadQr === 'function') {
            seller.downloadQr(tableId);
        } else {
            // Fallback if seller.downloadQr is not available
            const storeLink = seller?.getStoreLink ? seller.getStoreLink() : `https://${seller?.username || 'store'}.shopto.store`;
            const url = tableId ? `${storeLink}/getQR?id=${tableId}` : `${storeLink}/getQR`;
            window.open(url, '_blank');
        }
        setIsMenuOpen(false);
    };

    const confirmDelete = () => {
        // Confirm before deleting (equivalent to confirmDialog in Flutter)
        confirmDialog({
            title: "Confirm Delete",
            content: `Are you sure you want to delete ${tableId ? `table ${tableId}` : variant}?`,
            confirmText: "DELETE",
            onConfirm: async () => {
                try {
                    if (tableId && seller && typeof seller.removeTable === 'function') {
                        await seller.removeTable(tableId);
                        showToast('Table deleted successfully');
                        handleClose(); // Use handleClose instead of onClose directly
                    } else {
                        showToast('Delete functionality not available');
                    }
                } catch (err) {
                    console.error('Error deleting table:', err);
                    showToast('Failed to delete table');
                }
            }
        });
        setIsMenuOpen(false);
    };

    // Render the no orders widget (equivalent to noOrderWidget in Flutter)
    const renderNoOrdersWidget = () => {
        return (
            <div className="flex flex-col items-center justify-center py-10">
                <div className="opacity-50 mb-8">
                    <i className="ph ph-shopping-bag text-5xl text-blue-800 mb-4"></i>
                    <p className="text-xl font-bold text-blue-800 text-center">No orders yet here</p>
                </div>
            </div>
        );
    };

    // Render the context menu (equivalent to contextMenu in Flutter)
    const renderContextMenu = () => {
        return (
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
                                onClick={confirmDelete}
                            >
                                <i className="ph ph-trash mr-2"></i>
                                Delete table
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    if (!isOpen) return null;

    // Calculate total and served items across all orders
    const totalItems = orders.reduce((sum, order) => {
        return sum + (order.items?.reduce((itemSum, item) => itemSum + (item.quantity || item.qnt || 1), 0) || 0);
    }, 0);

    const servedItems = orders.reduce((sum, order) => {
        return sum + (order.items?.filter(item => item.served).reduce((itemSum, item) => itemSum + (item.quantity || item.qnt || 1), 0) || 0);
    }, 0);

    const progress = totalItems > 0 ? servedItems / totalItems : 0;
    const progressPercent = Math.round(progress * 100);

    // Use the utility function for modal classes
    const dialogClasses = getModalClasses({
        isMobile,
        isClosing
    });

    // Use utility function for overlay classes
    const overlayClasses = getModalOverlayClasses(isClosing);

    return (
        <div
            className={`fixed inset-0 z-50 ${isOpen ? 'visible' : 'invisible'}`}
            onClick={onClose}
        >
            <div className="fixed inset-0 bg-black bg-opacity-50"></div>
            <div className="absolute right-0 top-0 h-full w-full md:w-2/3 lg:w-1/2 bg-section-bg shadow-section overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="sticky top-0 bg-white border-b z-10">
                    <div className="p-4 flex items-center justify-between">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            {variant ? (
                                <><i className="ph ph-storefront text-blue-600"></i> {variant}</>
                            ) : (
                                <><i className="ph ph-table text-blue-600"></i> Table {tableId}</>
                            )}
                        </h2>
                        <div className="flex items-center">
                            {renderContextMenu()}
                            <button
                                onClick={handleClose}
                                className="p-2 hover:bg-gray-100 rounded-full"
                                aria-label="Close"
                            >
                                <i className="ph ph-x text-xl"></i>
                            </button>
                        </div>
                    </div>

                    {/* Progress bar for all orders */}
                    {orders.length > 0 && (
                        <div className="px-4 pb-3 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                <span>{servedItems}/{totalItems} items served</span>
                            </div>
                            <div className="text-sm font-medium text-gray-700">
                                {progressPercent}% complete
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex flex-col h-[calc(100%-70px)]">
                    {loading ? (
                        <div className="p-4 text-center flex-1 flex flex-col items-center justify-center">
                            <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
                            <p className="mt-2 text-gray-600">Loading orders...</p>
                        </div>
                    ) : error ? (
                        <div className="p-4 text-center flex-1 flex flex-col items-center justify-center">
                            <div className="bg-red-50 text-red-600 p-4 rounded-lg max-w-md">
                                <i className="ph ph-warning-circle text-2xl mb-2"></i>
                                <p>{error}</p>
                            </div>
                        </div>
                    ) : orders.length === 0 ? (
                        <div className="flex-1 flex flex-col">
                            <div className="flex-1 flex items-center justify-center">
                                {renderNoOrdersWidget()}
                            </div>
                            <div className="p-4 mt-auto">
                                <button
                                    className="w-full py-3.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-medium"
                                    onClick={handleAddNewOrder}
                                >
                                    <i className="ph ph-plus-circle text-xl"></i>
                                    Add New Order
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            <div className="space-y-6 flex-1 overflow-y-auto p-4">
                                {orders.map(order => {
                                    // Create an MOrder-like object with the necessary methods
                                    const mOrder = {
                                        ...order,
                                        id: order.id,
                                        billNo: order.billNo,
                                        items: order.items || [],
                                        date: order.date,
                                        servedItems: order.items?.filter(item => item.served).length || 0,
                                        totalItems: order.items?.length || 0,
                                        subTotal: order.items?.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || item.qnt || 1)), 0) || 0,
                                        // Add methods that OrderView component expects
                                        serveItem: async (item, served) => {
                                            try {
                                                const orderRef = window.sdk.collection("Orders").doc(order.id);
                                                const orderDoc = await orderRef.get();
                                                if (!orderDoc.exists) throw new Error('Order not found');

                                                const orderData = orderDoc.data();
                                                const updatedItems = orderData.items.map(i => {
                                                    if (i.pid === item.pid) {
                                                        return { ...i, served: served };
                                                    }
                                                    return i;
                                                });

                                                await orderRef.update({ items: updatedItems });
                                                return true;
                                            } catch (error) {
                                                console.error("Error updating serve status:", error);
                                                throw error;
                                            }
                                        },
                                        addItem: async (item) => {
                                            try {
                                                const orderRef = window.sdk.collection("Orders").doc(order.id);
                                                const orderDoc = await orderRef.get();
                                                if (!orderDoc.exists) throw new Error('Order not found');

                                                const orderData = orderDoc.data();
                                                const updatedItems = orderData.items.map(i => {
                                                    if (i.pid === item.pid) {
                                                        const newQnt = (i.quantity || i.qnt || 1) + 1;
                                                        return { ...i, quantity: newQnt, qnt: newQnt };
                                                    }
                                                    return i;
                                                });

                                                await orderRef.update({ items: updatedItems });
                                                return true;
                                            } catch (error) {
                                                console.error("Error adding item:", error);
                                                throw error;
                                            }
                                        },
                                        removeItem: async (item) => {
                                            try {
                                                const orderRef = window.sdk.collection("Orders").doc(order.id);
                                                const orderDoc = await orderRef.get();
                                                if (!orderDoc.exists) throw new Error('Order not found');

                                                const orderData = orderDoc.data();

                                                // Find the item in the current items array
                                                const itemIndex = orderData.items.findIndex(i => i.pid === item.pid);
                                                if (itemIndex === -1) {
                                                    throw new Error('Item not found in order');
                                                }

                                                // Get current quantity
                                                const currentQty = parseInt(orderData.items[itemIndex].qnt || 1);

                                                // If quantity is 1, remove the item completely
                                                if (currentQty <= 1) {
                                                    // Remove the item from the items array
                                                    const updatedItems = orderData.items.filter(i => i.pid !== item.pid);
                                                    // Update the order with the modified items array
                                                    await orderRef.update({ items: updatedItems });
                                                    showToast(`${item.title} removed from order`);
                                                } else {
                                                    // Decrease quantity by 1
                                                    const updatedItems = [...orderData.items];
                                                    updatedItems[itemIndex] = {
                                                        ...updatedItems[itemIndex],
                                                        qnt: currentQty - 1
                                                    };
                                                    // Update the order with the modified items array
                                                    await orderRef.update({ items: updatedItems });
                                                    showToast(`Decreased ${item.title} quantity by 1`);
                                                }
                                            } catch (err) {
                                                console.error('Error updating item quantity:', err);
                                                showToast('Failed to update item quantity', 'error');
                                            }
                                        }
                                    };

                                    return (
                                        <OrderView
                                            key={order.id}
                                            order={mOrder}
                                            tableId={tableId}
                                            variant={variant}
                                        />
                                    );
                                })}
                            </div>
                            <div className="p-4 mt-auto border-t sticky bottom-0 bg-white">
                                <button
                                    className="w-full py-3.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-medium"
                                    onClick={handleAddNewOrder}
                                >
                                    <i className="ph ph-plus-circle text-xl"></i>
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
    const progressPercent = Math.round(progress * 100);

    // Format date using the patterns from DateModifiers extension
    const formatTinyDateTime = (date) => {
        if (!date) return 'Just now';

        try {
            const orderDate = new Date(date);

            // Check if date is valid
            if (isNaN(orderDate.getTime())) {
                return 'Just now';
            }

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
            } else {
                return orderDate.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                });
            }
        } catch (error) {
            console.error("Date formatting error:", error);
            return 'Just now';
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
            // Create a container for the CheckoutSheet
            const checkoutContainer = document.createElement('div');
            checkoutContainer.id = 'checkout-container';
            checkoutContainer.className = 'fixed inset-0 z-50';
            document.body.appendChild(checkoutContainer);

            // Convert order items to cart format expected by CheckoutSheet
            const cart = {};

            // Make sure order and order.items exist before trying to loop
            if (order && Array.isArray(order.items)) {
                order.items.forEach(item => {
                    // Make sure item has required properties
                    if (item && item.pid) {
                        cart[item.pid] = {
                            product: {
                                id: item.pid,
                                title: item.title || 'Unknown Item',
                                price: item.price || 0,
                                mrp: item.mrp || item.price || 0,
                                imgs: item.thumb ? [item.thumb] : [],
                                charges: [], // Initialize with empty array to prevent undefined errors
                                cat: item.cat || 'Other',
                                veg: item.veg || false
                            },
                            quantity: item.quantity || item.qnt || 1
                        };
                    }
                });
            }

            // Create a root element for React 18
            const root = ReactDOM.createRoot(checkoutContainer);

            // Render the CheckoutSheet component
            root.render(
                React.createElement(window.CheckoutSheet, {
                    cart: cart,
                    clearCallback: () => {
                        // Cleanup and close
                        root.unmount();
                        if (document.body.contains(checkoutContainer)) {
                            document.body.removeChild(checkoutContainer);
                        }
                        // Refresh orders list or page
                        window.location.reload();
                    },
                    tableId: tableId,
                    checkout: true,
                    orderId: order ? order.id : null,
                    priceVariant: variant,
                    onClose: () => {
                        // Cleanup
                        root.unmount();
                        if (document.body.contains(checkoutContainer)) {
                            document.body.removeChild(checkoutContainer);
                        }
                    }
                })
            );
        } catch (error) {
            console.error("Error opening checkout:", error);
            showToast("Failed to open checkout", "error");
        }
    };

    const handleAddNewItem = () => {
        // Check if POS component is available
        if (!window.POS) {
            console.error("POS component is not defined");
            showToast("Cannot open POS: component not available", "error");
            return;
        }

        // Create a container for the POS component
        const posContainer = document.createElement('div');
        posContainer.id = 'pos-items-container';
        posContainer.className = 'fixed inset-0 z-50';
        document.body.appendChild(posContainer);

        try {
            // Create a root element for React 18
            const root = ReactDOM.createRoot(posContainer);

            // Convert order to the format expected by POS component
            const orderForPOS = {
                ...order,
                ref: window.sdk.collection("Orders").doc(order.id)
            };

            // Render the POS component
            root.render(
                React.createElement(window.POS, {
                    title: `Add to Order #${order.billNo || order.id?.slice(-6)}`,
                    tableId: tableId,
                    variant: variant,
                    order: orderForPOS,
                    onClose: () => {
                        // Unmount and clean up
                        root.unmount();
                        if (document.body.contains(posContainer)) {
                            document.body.removeChild(posContainer);
                        }
                    }
                })
            );
        } catch (error) {
            console.error("Error rendering POS:", error);
            if (document.body.contains(posContainer)) {
                document.body.removeChild(posContainer);
            }
            showToast("Failed to open POS", "error");
        }
    };

    const toggleItemServed = async (item, served) => {
        try {
            // Get a reference to the order document
            const orderRef = window.sdk.collection("Orders").doc(order.id);

            // Get the current order data
            const orderDoc = await orderRef.get();
            if (!orderDoc.exists) {
                throw new Error('Order not found');
            }

            const orderData = orderDoc.data();

            // Update the served status of the specific item
            const updatedItems = orderData.items.map(i => {
                if (i.pid === item.pid) {
                    return { ...i, served: served };
                }
                return i;
            });

            // Update the order with the modified items array
            await orderRef.update({ items: updatedItems });

            showToast(`Item ${served ? 'served' : 'unserved'}`);
        } catch (err) {
            console.error('Error updating item served status:', err);
            showToast('Failed to update item status', 'error');
        }
    };

    const handleRemoveItem = async (item) => {
        try {
            // Get a reference to the order document
            const orderRef = window.sdk.collection("Orders").doc(order.id);

            // Get the current order data
            const orderDoc = await orderRef.get();
            if (!orderDoc.exists) {
                throw new Error('Order not found');
            }

            const orderData = orderDoc.data();

            // Find the item in the current items array
            const itemIndex = orderData.items.findIndex(i => i.pid === item.pid);
            if (itemIndex === -1) {
                throw new Error('Item not found in order');
            }

            // Get current quantity
            const currentQty = parseInt(orderData.items[itemIndex].qnt || 1);

            // If quantity is 1, remove the item completely
            if (currentQty <= 1) {
                // Remove the item from the items array
                const updatedItems = orderData.items.filter(i => i.pid !== item.pid);
                // Update the order with the modified items array
                await orderRef.update({ items: updatedItems });
                showToast(`${item.title} removed from order`);
            } else {
                // Decrease quantity by 1
                const updatedItems = [...orderData.items];
                updatedItems[itemIndex] = {
                    ...updatedItems[itemIndex],
                    qnt: currentQty - 1
                };
                // Update the order with the modified items array
                await orderRef.update({ items: updatedItems });
                showToast(`Decreased ${item.title} quantity by 1`);
            }
        } catch (err) {
            console.error('Error updating item quantity:', err);
            showToast('Failed to update item quantity', 'error');
        }
    };

    const handleAddItem = async (item) => {
        try {
            // Get a reference to the order document
            const orderRef = window.sdk.collection("Orders").doc(order.id);

            // Get the current order data
            const orderDoc = await orderRef.get();
            if (!orderDoc.exists) {
                throw new Error('Order not found');
            }

            const orderData = orderDoc.data();

            // Find the item in the items array
            const existingItemIndex = orderData.items.findIndex(i => i.pid === item.pid);

            if (existingItemIndex >= 0) {
                // If the item exists, increase its quantity
                const updatedItems = [...orderData.items];
                const existingItem = updatedItems[existingItemIndex];
                const currentQuantity = existingItem.quantity || existingItem.qnt || 1;
                updatedItems[existingItemIndex] = {
                    ...existingItem,
                    quantity: currentQuantity + 1
                };

                // Update the order with the modified items array
                await orderRef.update({ items: updatedItems });
            } else {
                // If the item doesn't exist, add it to the items array
                const newItem = { ...item, quantity: 1 };
                const updatedItems = [...orderData.items, newItem];

                // Update the order with the modified items array
                await orderRef.update({ items: updatedItems });
            }

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

    return (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-6" style={{ backgroundColor: "#fff8f8", borderRadius: "16px" }}>
            {/* Order Header */}
            <div className="p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-medium text-gray-800 text-lg">
                            Bill No: <span className="text-red-500">#{order.billNo || order.id?.slice(-6)}</span>
                        </h3>
                        <div className="flex items-center mt-1">
                            <p className="text-sm text-gray-600">
                                {formatTinyDateTime(order.date || order.placeDate)}
                            </p>
                            <span className="mx-2 text-gray-300">•</span>
                            <p className="text-sm text-gray-600 flex items-center">
                                <span className={`inline-block w-2 h-2 rounded-full mr-1 ${progressPercent === 100 ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                {servedItems}/{totalItems} items
                            </p>
                        </div>
                    </div>
                    <button
                        className="p-2.5 text-red-500 hover:bg-red-50 rounded-full transition-colors flex items-center justify-center w-10 h-10"
                        onClick={handleAddNewItem}
                        aria-label="Add new item"
                    >
                        <i className="ph ph-plus-circle text-2xl"></i>
                    </button>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="h-2 bg-gray-100">
                <div
                    className="h-full bg-red-500 transition-all duration-300 ease-out rounded-r-full"
                    style={{ width: `${progressPercent}%` }}
                ></div>
            </div>

            {/* Order Items */}
            <div className="divide-y divide-pink-50">
                {order.items?.map((item, index) => (
                    <div key={index} className="p-4 hover:bg-pink-50 transition-colors">
                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                checked={item.served || false}
                                onChange={(e) => toggleItemServed(item, e.target.checked)}
                                className="w-5 h-5 rounded border-gray-300 text-red-500 focus:ring-red-500 focus:ring-offset-0"
                                id={`item-${order.id}-${index}`}
                            />
                            <div className="w-14 h-14 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                                {getItemImage(item) ? (
                                    <img
                                        src={getItemImage(item)}
                                        alt={item.title}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            e.target.onerror = null;
                                            e.target.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="%23ccc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
                                        }}
                                    />
                                ) : (
                                    <i className={`ph ${getCategoryIcon(item)} text-gray-400 text-xl`}></i>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-gray-800 truncate">{item.title}</h4>
                                <div className="flex items-center mt-1">
                                    <span className="text-sm font-medium text-red-500">₹{item.price || 0}</span>
                                    {item.cat && (
                                        <>
                                            <span className="mx-1 text-gray-300">•</span>
                                            <span className="text-sm text-gray-600">{item.cat}</span>
                                        </>
                                    )}
                                </div>
                                {item.veg !== undefined && (
                                    <div className="mt-1">
                                        <span className={`inline-block w-4 h-4 border ${item.veg ? 'border-green-500' : 'border-red-500'} p-0.5 rounded-sm`}>
                                            <span className={`block w-full h-full rounded-sm ${item.veg ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                        </span>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center">
                                <div className="bg-gray-100 rounded-full px-1 py-0.5 flex items-center gap-1">
                                    <button
                                        className="w-7 h-7 flex items-center justify-center text-red-500 hover:bg-red-50 rounded-full"
                                        onClick={() => handleRemoveItem(item)}
                                        aria-label="Remove item"
                                    >
                                        <i className="ph ph-minus"></i>
                                    </button>
                                    <span className="w-8 text-center font-medium">
                                        {item.quantity || item.qnt || 1}
                                    </span>
                                    <button
                                        className="w-7 h-7 flex items-center justify-center text-red-500 hover:bg-red-50 rounded-full"
                                        onClick={() => handleAddItem(item)}
                                        aria-label="Add item"
                                    >
                                        <i className="ph ph-plus"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Subtotal */}
            <div className="p-4 border-t border-pink-100">
                <div className="flex justify-between items-center">
                    <h3 className="font-medium text-gray-700">Sub Total:</h3>
                    <span className="font-medium text-red-500 text-lg">₹{subtotal}</span>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="p-4 pt-0">
                <div className="flex gap-3">
                    <button
                        className="flex-1 py-2.5 border border-red-500 text-red-500 rounded-lg hover:bg-red-50 transition-colors flex items-center justify-center"
                        onClick={handlePrintKOT}
                    >
                        <i className="ph ph-printer mr-2"></i>
                        Print KOT
                    </button>
                    <button
                        className="flex-1 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center"
                        onClick={handleCheckout}
                    >
                        <i className="ph ph-credit-card mr-2"></i>
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
                const results = await window.sdk.collection("Customers")
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
            const newCustomerRef = window.sdk.collection("Customers").doc();
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
        <div
            className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${isOpen ? 'visible' : 'invisible'}`}
            onClick={onClose}
        >
            <div className="fixed inset-0 bg-black bg-opacity-50"></div>
            <div className="bg-section-bg w-full max-w-md rounded-lg shadow-section overflow-hidden relative z-10" onClick={e => e.stopPropagation()}>
                <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold">Select Customer</h2>
                        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                            <i className="ph ph-x text-xl"></i>
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
        </div>
    );
}

// Product Form Modal Component
function ProductFormModal({ isOpen, onClose, editProduct = null }) {
    const [formData, setFormData] = React.useState({
        title: '',
        desc: '',
        price: '',
        mrp: '',
        cat: 'Appetizers',
        veg: true,
        active: true,
        stock: '',
        imgs: []
    });
    const [uploading, setUploading] = React.useState(false);
    const [error, setError] = React.useState(null);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [categories, setCategories] = React.useState([
        'Appetizers', 'Main Course', 'NORTH INDIAN', 'MILKSHAKES', 'Breakfast', 'Juices', 'WRAPS'
    ]);
    const [previewImage, setPreviewImage] = React.useState('');

    // Reset form when modal opens and populate with edit data if available
    React.useEffect(() => {
        if (isOpen) {
            setError(null);

            // If editing, populate form with product data
            if (editProduct) {
                setFormData({
                    title: editProduct.title || '',
                    desc: editProduct.desc || '',
                    price: editProduct.price || '',
                    mrp: editProduct.mrp || editProduct.price || '',
                    cat: editProduct.cat || 'Appetizers',
                    veg: editProduct.veg !== undefined ? editProduct.veg : true,
                    active: editProduct.active !== undefined ? editProduct.active : true,
                    stock: editProduct.stock !== undefined ? editProduct.stock : '',
                    imgs: editProduct.imgs || []
                });

                // Set preview image if available
                if (editProduct.imgs && editProduct.imgs.length > 0) {
                    setPreviewImage(editProduct.imgs[0]);
                } else {
                    setPreviewImage('');
                }
            } else {
                // Reset form for new product
                setFormData({
                    title: '',
                    desc: '',
                    price: '',
                    mrp: '',
                    cat: 'Appetizers',
                    veg: true,
                    active: true,
                    stock: '',
                    imgs: []
                });
                setPreviewImage('');
            }
        }
    }, [isOpen, editProduct]);

    // Fetch categories from existing products
    React.useEffect(() => {
        async function fetchCategories() {
            try {
                const snapshot = await window.sdk.collection("Product").get();
                const cats = new Set(['Appetizers', 'Main Course', 'NORTH INDIAN', 'MILKSHAKES', 'Breakfast', 'Juices', 'WRAPS']);

                snapshot.docs.forEach(doc => {
                    const data = doc.data();
                    if (data.cat) {
                        cats.add(data.cat);
                    }
                });

                setCategories(Array.from(cats).sort());
            } catch (error) {
                console.error("Error fetching categories:", error);
            }
        }

        if (isOpen) {
            fetchCategories();
        }
    }, [isOpen]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;

        if (type === 'checkbox') {
            setFormData(prev => ({ ...prev, [name]: checked }));
        } else if (name === 'price' || name === 'mrp' || name === 'stock') {
            // Only allow numbers for price, mrp and stock fields
            const numValue = value.replace(/[^0-9]/g, '');
            setFormData(prev => ({ ...prev, [name]: numValue }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Check file type
        if (!file.type.match('image.*')) {
            setError('Please select an image file');
            return;
        }

        // Check file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            setError('Image size should be less than 5MB');
            return;
        }

        try {
            setUploading(true);
            setError(null);

            // Preview image
            const reader = new FileReader();
            reader.onload = (e) => {
                setPreviewImage(e.target.result);
            };
            reader.readAsDataURL(file);

            // Upload image to storage
            const storageRef = window.sdk.storage.ref();
            const fileRef = storageRef.child(`products/${Date.now()}_${file.name}`);

            await fileRef.put(file);
            const downloadURL = await fileRef.getDownloadURL();

            // Update form data with image URL
            setFormData(prev => ({
                ...prev,
                imgs: [downloadURL, ...(prev.imgs || []).slice(0, 4)] // Keep max 5 images
            }));

            setUploading(false);
        } catch (error) {
            setError('Failed to upload image: ' + error.message);
            setUploading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validate form
        if (!formData.title) {
            setError('Please enter a product title');
            return;
        }

        if (!formData.price) {
            setError('Please enter a price');
            return;
        }

        // If mrp is not provided, set it equal to price
        if (!formData.mrp) {
            setFormData(prev => ({ ...prev, mrp: prev.price }));
        }

        // Ensure price is not greater than MRP
        if (Number(formData.price) > Number(formData.mrp)) {
            setError('Price cannot be greater than MRP');
            return;
        }

        try {
            setIsSubmitting(true);

            // Prepare product data
            const productData = {
                title: formData.title,
                desc: formData.desc,
                price: Number(formData.price),
                mrp: Number(formData.mrp),
                cat: formData.cat,
                veg: formData.veg,
                active: formData.active,
                date: new Date()
            };

            // Add stock if provided
            if (formData.stock !== '') {
                productData.stock = Number(formData.stock);
            }

            // Add images if available
            if (formData.imgs && formData.imgs.length > 0) {
                productData.imgs = formData.imgs;
            }

            // Save to Firestore
            if (editProduct) {
                // Update existing product
                await window.sdk.collection("Product").doc(editProduct.id).update(productData);
                showToast('Product updated successfully');
            } else {
                // Add new product
                await window.sdk.collection("Product").doc().set(productData);
                showToast('Product added successfully');
            }

            setIsSubmitting(false);
            onClose();

            // Refresh the page to show updated product list
            window.location.reload();
        } catch (error) {
            setError('Failed to save product: ' + error.message);
            setIsSubmitting(false);
        }
    };

    const removeImage = (index) => {
        setFormData(prev => {
            const updatedImgs = [...prev.imgs];
            updatedImgs.splice(index, 1);
            return { ...prev, imgs: updatedImgs };
        });

        // Update preview image
        if (index === 0 && formData.imgs.length > 1) {
            setPreviewImage(formData.imgs[1]);
        } else if (formData.imgs.length <= 1) {
            setPreviewImage('');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-red-50">
                    <h2 className="text-xl font-semibold text-gray-800">
                        {editProduct ? 'Edit Product' : 'Add New Product'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-red-100 rounded-full"
                    >
                        <i className="ph ph-x text-gray-600"></i>
                    </button>
                </div>

                {/* Form Content - Scrollable */}
                <div className="overflow-y-auto p-4 max-h-[calc(90vh-60px)]">
                    {error && (
                        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Left Column - Image and Basic Info */}
                            <div>
                                {/* Image Upload */}
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Product Image
                                    </label>
                                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                                        {previewImage ? (
                                            <div className="relative">
                                                <img
                                                    src={previewImage}
                                                    alt="Product preview"
                                                    className="mx-auto max-h-48 object-contain mb-2"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => removeImage(0)}
                                                    className="absolute top-0 right-0 bg-red-500 text-white p-1 rounded-full"
                                                >
                                                    <i className="ph ph-x text-sm"></i>
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-6">
                                                <i className="ph ph-image text-4xl text-gray-400 mb-2"></i>
                                                <p className="text-sm text-gray-500">Upload product image</p>
                                            </div>
                                        )}

                                        <div className="mt-2">
                                            <label className="cursor-pointer bg-red-500 hover:bg-red-600 text-white text-sm py-2 px-4 rounded-lg inline-flex items-center">
                                                <i className="ph ph-upload-simple mr-2"></i>
                                                <span>{uploading ? 'Uploading...' : 'Choose File'}</span>
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    onChange={handleImageUpload}
                                                    accept="image/*"
                                                    disabled={uploading}
                                                />
                                            </label>
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">Maximum file size: 5MB</p>
                                </div>

                                {/* Title */}
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Product Title <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="title"
                                        value={formData.title}
                                        onChange={handleChange}
                                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                                        placeholder="Enter product name"
                                        required
                                    />
                                </div>

                                {/* Description */}
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Description
                                    </label>
                                    <textarea
                                        name="desc"
                                        value={formData.desc}
                                        onChange={handleChange}
                                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                                        placeholder="Enter product description"
                                        rows="3"
                                    ></textarea>
                                </div>
                            </div>

                            {/* Right Column - Pricing and Category */}
                            <div>
                                <div className="flex gap-4 mb-4">
                                    {/* Price */}
                                    <div className="flex-1">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Price (₹) <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <span className="text-gray-500 sm:text-sm">₹</span>
                                            </div>
                                            <input
                                                type="text"
                                                name="price"
                                                value={formData.price}
                                                onChange={handleChange}
                                                className="w-full pl-8 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                                                placeholder="0"
                                                required
                                            />
                                        </div>
                                    </div>

                                    {/* MRP */}
                                    <div className="flex-1">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            MRP (₹)
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <span className="text-gray-500 sm:text-sm">₹</span>
                                            </div>
                                            <input
                                                type="text"
                                                name="mrp"
                                                value={formData.mrp}
                                                onChange={handleChange}
                                                className="w-full pl-8 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                                                placeholder="Same as price"
                                            />
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">Leave empty to set same as price</p>
                                    </div>
                                </div>

                                {/* Category */}
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Category
                                    </label>
                                    <select
                                        name="cat"
                                        value={formData.cat}
                                        onChange={handleChange}
                                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                                    >
                                        {categories.map((category, index) => (
                                            <option key={index} value={category}>
                                                {category}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Stock */}
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Stock (Quantity)
                                    </label>
                                    <input
                                        type="text"
                                        name="stock"
                                        value={formData.stock}
                                        onChange={handleChange}
                                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                                        placeholder="Leave empty for unlimited"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Leave empty if stock tracking is not needed</p>
                                </div>

                                {/* Toggles - Veg/Non-veg and Active Status */}
                                <div className="space-y-4 mt-6">
                                    {/* Veg/Non-veg Toggle */}
                                    <div className="flex items-center">
                                        <div className="mr-3">
                                            <div className={`h-6 w-6 border-2 p-0.5 ${formData.veg ? 'border-green-500' : 'border-red-500'}`}>
                                                <div className={`h-full w-full rounded-sm ${formData.veg ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                            </div>
                                        </div>
                                        <label className="flex items-center cursor-pointer">
                                            <div className="relative">
                                                <input
                                                    type="checkbox"
                                                    name="veg"
                                                    checked={formData.veg}
                                                    onChange={handleChange}
                                                    className="sr-only"
                                                />
                                                <div className="block bg-gray-300 w-14 h-8 rounded-full"></div>
                                                <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${formData.veg ? 'transform translate-x-6' : ''}`}></div>
                                            </div>
                                            <div className="ml-3 text-gray-700">
                                                {formData.veg ? 'Vegetarian' : 'Non-vegetarian'}
                                            </div>
                                        </label>
                                    </div>

                                    {/* Active Status Toggle */}
                                    <div className="flex items-center">
                                        <label className="flex items-center cursor-pointer">
                                            <div className="relative">
                                                <input
                                                    type="checkbox"
                                                    name="active"
                                                    checked={formData.active}
                                                    onChange={handleChange}
                                                    className="sr-only"
                                                />
                                                <div className="block bg-gray-300 w-14 h-8 rounded-full"></div>
                                                <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${formData.active ? 'transform translate-x-6' : ''}`}></div>
                                            </div>
                                            <div className="ml-3 text-gray-700">
                                                Product {formData.active ? 'Active' : 'Inactive'}
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Form Actions */}
                        <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-gray-200">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting || uploading}
                                className={`px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center ${(isSubmitting || uploading) ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                {isSubmitting ? (
                                    <>
                                        <span className="animate-spin inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <i className="ph ph-floppy-disk mr-2"></i>
                                        {editProduct ? 'Update Product' : 'Save Product'}
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

// Make component available globally
window.ProductFormModal = ProductFormModal;

// Export components
window.ProfileMenu = ProfileMenu;
window.AddTableModal = AddTableModal;
window.RenameRoomModal = RenameRoomModal;
window.OrderRoom = OrderRoom;
window.OrderView = OrderView;
window.CustomerSearch = CustomerSearch; 