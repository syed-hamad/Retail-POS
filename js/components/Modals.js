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
            await sdk.sellers.update(seller.id, {
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
                await sdk.sellers.update(seller.id, {
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
                await sdk.sellers.update(seller.id, {
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
    if (!isOpen) return null;

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
                                onClick={() => {
                                    window.open(`https://${seller?.username}.shopto.store/getQR`, '_blank');
                                }}
                            >
                                <i className="ph ph-qr-code text-lg" />
                                Get Store QR Code
                            </button>
                            <button className="w-full px-4 py-2.5 bg-gradient-to-r from-gray-100 to-gray-50 text-gray-700 rounded-xl hover:from-gray-200 hover:to-gray-100 transition-all flex items-center justify-center gap-2 font-medium">
                                <i className="ph ph-gear text-lg" />
                                Settings
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