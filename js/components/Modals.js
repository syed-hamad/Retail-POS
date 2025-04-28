const React = window.React;
const ReactDOM = window.ReactDOM;

// Modal components for the application

// Add Table Modal Component
function AddTableModal({ isOpen, onClose, seller }) {
    const [title, setTitle] = React.useState('');
    const [desc, setDesc] = React.useState('');
    const [error, setError] = React.useState(null);
    const [usingModalManager, setUsingModalManager] = React.useState(false);

    // Reset form when modal opens
    React.useEffect(() => {
        if (isOpen) {
            setTitle('');
            setDesc('');
            setError(null);

            // Use ModalManager if available
            if (window.ModalManager && typeof window.ModalManager.createCenterModal === 'function') {
                setUsingModalManager(true);
                showAddTableModal();
            } else {
                setUsingModalManager(false);
            }
        }
    }, [isOpen]);

    const handleAddTable = async (newTitle, newDesc) => {
        try {
            // Get current tables
            const currentTables = seller?.tables || [];

            // Check if table already exists
            if (currentTables.some(t => t.title === newTitle)) {
                throw new Error('Table already exists');
            }

            // Add new table
            await window.sdk.profile.update({
                tables: [...currentTables, { title: newTitle, desc: newDesc }]
            });

            // Track analytics if available
            if (window.sdk.analytics) {
                window.sdk.analytics.logEvent('add_table', {
                    table_id: newTitle,
                    seller_id: seller?.id
                });
            }

            window.ModalManager?.showToast('Table added successfully');

            // Trigger UI refresh
            if (window.refreshTables && typeof window.refreshTables === 'function') {
                window.refreshTables();
            }

            return true;
        } catch (err) {
            console.error('Error adding table:', err);
            throw err;
        }
    };

    const showAddTableModal = () => {
        if (!window.ModalManager || typeof window.ModalManager.createCenterModal !== 'function') {
            return;
        }

        const content = `
            <div id="add-table-form">
                <div id="error-container" class="mb-4 hidden p-3 bg-red-50 text-red-700 rounded-md"></div>
                <div class="mb-4">
                    <label class="block text-gray-700 mb-2" for="table-title">
                        Title
                    </label>
                    <input
                        type="text"
                        id="table-title"
                        maxlength="4"
                        class="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="eg. T1"
                    />
                    <p class="text-xs text-gray-500 mt-1">Max 4 characters</p>
                </div>

                <div class="mb-6">
                    <label class="block text-gray-700 mb-2" for="table-desc">
                        Description
                    </label>
                    <input
                        type="text"
                        id="table-desc"
                        class="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="eg. Table in the corner"
                    />
                </div>
            </div>
        `;

        const actions = `
            <div class="flex justify-end gap-3">
                <button
                    id="cancel-add-table"
                    type="button"
                    class="px-4 py-2 border rounded-md hover:bg-gray-50"
                >
                    Cancel
                </button>
                <button
                    id="save-add-table"
                    type="button"
                    class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                    Save Table
                </button>
            </div>
        `;

        const modal = window.ModalManager.createCenterModal({
            id: 'add-table-modal',
            title: 'Add New Table',
            content: content,
            actions: actions,
            onShown: (modalControl) => {
                const titleInput = document.getElementById('table-title');
                const descInput = document.getElementById('table-desc');
                const errorContainer = document.getElementById('error-container');
                const cancelButton = document.getElementById('cancel-add-table');
                const saveButton = document.getElementById('save-add-table');

                if (titleInput && descInput && cancelButton && saveButton) {
                    titleInput.focus();

                    cancelButton.addEventListener('click', () => {
                        modalControl.close();
                        onClose();
                    });

                    saveButton.addEventListener('click', async () => {
                        const newTitle = titleInput.value.trim();
                        const newDesc = descInput.value.trim();

                        // Validate form
                        if (!newTitle) {
                            errorContainer.textContent = 'Please enter a title';
                            errorContainer.classList.remove('hidden');
                            return;
                        }

                        if (!newDesc) {
                            errorContainer.textContent = 'Please enter a description';
                            errorContainer.classList.remove('hidden');
                            return;
                        }

                        try {
                            await handleAddTable(newTitle, newDesc);
                            modalControl.close();
                            onClose();
                        } catch (err) {
                            errorContainer.textContent = err.message || 'Failed to add table. Please try again.';
                            errorContainer.classList.remove('hidden');
                        }
                    });
                }
            }
        });
    };

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

        try {
            await handleAddTable(title, desc);
            onClose();
        } catch (err) {
            setError(err.message || 'Failed to add table. Please try again.');
        }
    };

    // If using ModalManager, don't render the default modal
    if (usingModalManager || !isOpen) return null;

    // Fallback to original implementation
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
    const [usingModalManager, setUsingModalManager] = React.useState(false);

    // Set initial title when modal opens
    React.useEffect(() => {
        if (isOpen) {
            setTitle(tableId || variant || '');
            setError(null);

            // Use ModalManager if available
            if (window.ModalManager && typeof window.ModalManager.createCenterModal === 'function') {
                setUsingModalManager(true);
                showRenameRoomModal();
            } else {
                setUsingModalManager(false);
            }
        }
    }, [isOpen, tableId, variant]);

    // Function to show modal using ModalManager
    const showRenameRoomModal = () => {
        if (!window.ModalManager || typeof window.ModalManager.createCenterModal !== 'function') {
            return;
        }

        const initialTitle = tableId || variant || '';
        const modalTitle = tableId ? "Rename Table" : "Rename Channel";

        const content = `
            <div id="rename-room-form">
                <div id="rename-error-container" class="mb-4 hidden p-3 bg-red-50 text-red-700 rounded-md"></div>
                <div class="mb-6">
                    <label class="block text-gray-700 mb-2" for="room-title">
                        Title
                    </label>
                    <input
                        type="text"
                        id="room-title"
                        value="${initialTitle}"
                        class="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="eg. T1"
                    />
                </div>
            </div>
        `;

        const actions = `
            <div class="flex justify-end gap-3">
                <button
                    id="cancel-rename"
                    type="button"
                    class="px-4 py-2 border rounded-md hover:bg-gray-50"
                >
                    Cancel
                </button>
                <button
                    id="save-rename"
                    type="button"
                    class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                    Save
                </button>
            </div>
        `;

        const modal = window.ModalManager.createCenterModal({
            id: 'rename-room-modal',
            title: modalTitle,
            content: content,
            actions: actions,
            onShown: (modalControl) => {
                const titleInput = document.getElementById('room-title');
                const errorContainer = document.getElementById('rename-error-container');
                const cancelButton = document.getElementById('cancel-rename');
                const saveButton = document.getElementById('save-rename');

                if (titleInput && cancelButton && saveButton) {
                    titleInput.focus();
                    titleInput.select();

                    cancelButton.addEventListener('click', () => {
                        modalControl.close();
                        onClose();
                    });

                    saveButton.addEventListener('click', async () => {
                        const newTitle = titleInput.value.trim();

                        // Validate form
                        if (!newTitle) {
                            errorContainer.textContent = 'Please enter a title';
                            errorContainer.classList.remove('hidden');
                            return;
                        }

                        try {
                            if (variant) {
                                // Rename price variant
                                const vars = seller?.priceVariants || [];
                                const index = vars.findIndex(v => v.title === variant);

                                if (index === -1) {
                                    errorContainer.textContent = "Can't rename this default room";
                                    errorContainer.classList.remove('hidden');
                                    return;
                                }

                                const updatedVars = [...vars];
                                updatedVars[index] = { title: newTitle };

                                await window.sdk.profile.update({ priceVariants: updatedVars });
                            } else if (tableId) {
                                // Rename table
                                const tables = seller?.tables || [];
                                const index = tables.findIndex(t => t.title === tableId);

                                if (index === -1) {
                                    errorContainer.textContent = "Can't rename this table";
                                    errorContainer.classList.remove('hidden');
                                    return;
                                }

                                const updatedTables = [...tables];
                                updatedTables[index] = { ...updatedTables[index], title: newTitle };

                                await window.sdk.profile.update({ tables: updatedTables });
                            } else {
                                errorContainer.textContent = "Can't rename room";
                                errorContainer.classList.remove('hidden');
                                return;
                            }

                            // Trigger UI refresh
                            if (window.refreshTables && typeof window.refreshTables === 'function') {
                                window.refreshTables();
                            }

                            window.ModalManager.showToast('Renamed successfully');
                            modalControl.close();
                            onClose();
                        } catch (err) {
                            console.error('Error renaming:', err);
                            errorContainer.textContent = 'Failed to rename. Please try again.';
                            errorContainer.classList.remove('hidden');
                        }
                    });
                }
            }
        });
    };

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
                updatedTables[index] = { ...updatedTables[index], title: newTitle };

                await window.sdk.profile.update({ tables: updatedTables });
            } else {
                setError("Can't rename room");
                return;
            }

            // Trigger UI refresh
            if (window.refreshTables && typeof window.refreshTables === 'function') {
                window.refreshTables();
            }

            showToast('Renamed successfully');
            onClose();
        } catch (err) {
            console.error('Error renaming:', err);
            setError('Failed to rename. Please try again.');
        }
    };

    // If using ModalManager, don't render the default modal
    if (usingModalManager || !isOpen) return null;

    // Fallback to original implementation
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
        name: '',
        quantity: '',
        unit: 'kg',
        minQuantity: ''
    });

    // Initialize form data when editItem changes
    React.useEffect(() => {
        if (editItem) {
            setFormData({
                name: editItem.name || '',
                quantity: editItem.quantity || '',
                unit: editItem.unit || 'kg',
                minQuantity: editItem.minQuantity || ''
            });
        } else {
            setFormData({
                name: '',
                quantity: '',
                unit: 'kg',
                minQuantity: ''
            });
        }
    }, [editItem]);

    const units = ['kg', 'gm', 'ltr', 'ml', 'pc'];

    if (!isOpen) return null;

    return (
        <div
            className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${isOpen ? 'visible' : 'invisible'}`}
            onClick={onClose}
        >
            <div className="fixed inset-0 bg-black bg-opacity-50"></div>
            <div className="bg-section-bg w-full max-w-md rounded-lg shadow-section overflow-hidden relative z-10 p-6" onClick={e => e.stopPropagation()}>
                {/* Modal Header */}
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-semibold text-gray-800">
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
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
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
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                placeholder="Enter quantity"
                                min="0"
                            />
                        </div>
                        <div className="w-32">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Unit
                            </label>
                            <select
                                value={formData.unit}
                                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
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
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                            placeholder="Enter minimum quantity"
                            min="0"
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
                        className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                        onClick={() => {
                            if (!formData.name || formData.quantity === '' || formData.minQuantity === '') {
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
function OrderRoom({ isOpen, onClose, tableId, variant, orderStatus = "KITCHEN", seller }) {
    // Get order data and methods directly from OrderContext
    const {
        getOrdersForSource,
        isLoading: ordersLoading,
        refreshCompletedOrders
    } = window.useOrders ? window.useOrders() : {
        getOrdersForSource: () => [],
        isLoading: true,
        refreshCompletedOrders: () => { }
    };

    // Get orders directly from context without maintaining separate state
    const orders = getOrdersForSource(tableId, variant, orderStatus);

    // State to track printer connection status
    const [printerConnected, setPrinterConnected] = React.useState(
        window.BluetoothPrinting ? window.BluetoothPrinting.connected : false
    );
    const [connectingPrinter, setConnectingPrinter] = React.useState(false);

    // Debug logging
    React.useEffect(() => {
        console.log(`[OrderRoom] Component mounted/updated for ${tableId ? `Table ${tableId}` : variant || 'Default'}`);
        console.log(`[OrderRoom] Received ${orders.length} orders with status "${orderStatus}"`);

        if (orders.length > 0) {
            console.log(`[OrderRoom] First few orders:`, orders.slice(0, 3).map(o => ({
                id: o.id,
                tableId: o.tableId || null,
                priceVariant: o.priceVariant || null,
                status: o.currentStatus?.label
            })));
        } else {
            console.log(`[OrderRoom] No orders found. This might indicate a problem with filtering or data.`);
        }
    }, [orders, tableId, variant, orderStatus]);

    // Update printer connection status when BluetoothPrinting state changes
    React.useEffect(() => {
        if (window.BluetoothPrinting) {
            const checkConnectionStatus = () => {
                setPrinterConnected(window.BluetoothPrinting.connected);
            };

            // Initial check
            checkConnectionStatus();

            // Set up an interval to periodically check printer connection status
            const interval = setInterval(checkConnectionStatus, 2000);

            return () => clearInterval(interval);
        }
    }, [isOpen]);

    // No longer attempt to automatically connect to printer on modal open
    // This was causing repeated prompts. Users can connect manually from the menu.

    // Keep the disconnect function when closing the room
    React.useEffect(() => {
        if (!isOpen && printerConnected && window.BluetoothPrinting) {
            // We don't need to actually disconnect the printer, as we want to maintain
            // the connection for future use. Just update the UI state.
            setPrinterConnected(window.BluetoothPrinting.connected);
        }
    }, [isOpen, printerConnected]);

    // Calculate totals for progress bar
    const totalItems = React.useMemo(() => {
        return orders.reduce((sum, order) => {
            const itemCount = order.items?.reduce((itemSum, item) => itemSum + (item.quantity || item.qnt || 1), 0) || 0;
            return sum + itemCount;
        }, 0);
    }, [orders]);

    const servedItems = React.useMemo(() => {
        return orders.reduce((sum, order) => {
            const servedCount = order.items?.filter(item => item.served)
                .reduce((itemSum, item) => itemSum + (item.quantity || item.qnt || 1), 0) || 0;
            return sum + servedCount;
        }, 0);
    }, [orders]);

    const progressPercent = React.useMemo(() => {
        const progress = totalItems > 0 ? servedItems / totalItems : 0;
        return Math.round(progress * 100);
    }, [totalItems, servedItems]);

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

    // We've removed the loadOrders function since we're now directly using data from context
    // The context will automatically update when orders change

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
                        // No need to explicitly refresh orders, context will update automatically
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
        console.log(`[OrderRoom] No orders for ${tableId ? `Table ${tableId}` : variant || 'Default'}`);
        console.log(`[OrderRoom] Current orderStatus filter: "${orderStatus}"`);

        return (
            <div className="flex flex-col items-center justify-center h-full py-10 text-center">
                <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mb-5">
                    <i className="ph ph-shopping-bag text-4xl text-red-400"></i>
                </div>
                <h3 className="text-2xl font-medium text-gray-700 mb-2">No Orders Yet</h3>
                <p className="text-gray-500 max-w-sm mb-8">Add new orders using the button below</p>
            </div>
        );
    };

    // Render the context menu (equivalent to contextMenu in Flutter)
    const renderContextMenu = () => {
        if (!isMenuOpen) return null;

        return (
            <div
                ref={menuRef}
                className="absolute right-0 top-12 w-52 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-50"
            >
                <div className="py-1">
                    {window.BluetoothPrinting && window.BluetoothPrinting.isSupported() && (
                        <button
                            className="w-full text-left px-4 py-3 text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                            onClick={() => {
                                setIsMenuOpen(false);
                                if (printerConnected) {
                                    // Disconnect printer
                                    window.BluetoothPrinting.disconnect()
                                        .then(() => {
                                            setPrinterConnected(false);
                                            if (window.ModalManager && typeof window.ModalManager.showToast === 'function') {
                                                window.ModalManager.showToast("Printer disconnected", { type: "info" });
                                            } else {
                                                showToast("Printer disconnected", "info");
                                            }
                                        })
                                        .catch(err => {
                                            console.error("Error disconnecting printer:", err);
                                        });
                                } else {
                                    // Connect to printer
                                    setConnectingPrinter(true);
                                    window.BluetoothPrinting.connect()
                                        .then(() => {
                                            setPrinterConnected(true);
                                            if (window.ModalManager && typeof window.ModalManager.showToast === 'function') {
                                                window.ModalManager.showToast("Printer connected successfully", { type: "success" });
                                            } else {
                                                showToast("Printer connected successfully", "success");
                                            }
                                        })
                                        .catch(error => {
                                            console.error("Error connecting to printer:", error);
                                            // Only show error messages for non-cancellation errors
                                            if (error.name !== "NotFoundError" &&
                                                !error.message.includes("Device selection cancelled") &&
                                                !error.message.includes("cancelled by user") &&
                                                !error.message.includes("No printer selected")) {
                                                if (window.ModalManager && typeof window.ModalManager.showToast === 'function') {
                                                    window.ModalManager.showToast("Error connecting to printer", { type: "error" });
                                                } else {
                                                    showToast("Error connecting to printer", "error");
                                                }
                                            }
                                        })
                                        .finally(() => {
                                            setConnectingPrinter(false);
                                        });
                                }
                            }}
                        >
                            <i className={`ph ph-printer ${printerConnected ? 'text-green-500' : 'text-red-500'}`}></i>
                            <span>{printerConnected ? 'Disconnect Printer' : 'Connect Printer'}</span>
                        </button>
                    )}

                    <button
                        className="w-full text-left px-4 py-3 text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                        onClick={() => {
                            setIsMenuOpen(false);
                            handleShowQR();
                        }}
                    >
                        <i className="ph ph-qr-code text-red-500"></i>
                        <span>Show QR Code</span>
                    </button>

                    <button
                        className="w-full text-left px-4 py-3 text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                        onClick={() => {
                            if (confirm(`Are you sure you want to delete all orders for ${tableId || variant}?`)) {
                                confirmDelete();
                            }
                            setIsMenuOpen(false);
                        }}
                    >
                        <i className="ph ph-trash text-red-500"></i>
                        <span>Clear All Orders</span>
                    </button>

                    <button
                        className="w-full text-left px-4 py-3 text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                        onClick={() => {
                            setIsMenuOpen(false);
                            showRenameRoomModal(tableId, variant);
                        }}
                    >
                        <i className="ph ph-pencil-simple text-red-500"></i>
                        <span>Rename {tableId ? 'Table' : 'Channel'}</span>
                    </button>

                    {tableId && (
                        <button
                            className="w-full text-left px-4 py-3 text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                            onClick={() => {
                                if (confirm(`Are you sure you want to delete table ${tableId}?`)) {
                                    deleteTable(tableId);
                                    handleClose();
                                }
                                setIsMenuOpen(false);
                            }}
                        >
                            <i className="ph ph-trash text-red-500"></i>
                            <span>Delete Table</span>
                        </button>
                    )}
                </div>
            </div>
        );
    };

    const deleteTable = async (tableId) => {
        try {
            // Get current tables from seller
            const currentTables = seller?.tables || [];

            // Remove the table
            const updatedTables = currentTables.filter(table => table.title !== tableId);

            // Update seller document in Firestore
            await window.sdk.profile.update({
                tables: updatedTables
            });

            showToast('Table removed successfully');
            handleClose();
        } catch (err) {
            console.error('Error removing table:', err);
            showToast('Failed to remove table. Please try again.');
        }
    };

    const showRenameRoomModal = (tableId, variant) => {
        if (window.ModalManager && typeof window.ModalManager.createCenterModal === 'function') {
            const modalId = 'rename-room-modal-' + Date.now();
            const initialTitle = tableId || variant || '';
            const modalTitle = tableId ? "Rename Table" : "Rename Channel";

            const content = `
                <div id="rename-room-form">
                    <div id="rename-error-container" class="mb-4 hidden p-3 bg-red-50 text-red-700 rounded-md"></div>
                    <div class="mb-6">
                        <label class="block text-gray-700 mb-2" for="room-title">
                            Title
                        </label>
                        <input
                            type="text"
                            id="room-title"
                            value="${initialTitle}"
                            class="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="eg. T1"
                        />
                    </div>
                </div>
            `;

            const actions = `
                <div class="flex justify-end gap-3">
                    <button
                        id="cancel-rename"
                        type="button"
                        class="px-4 py-2 border rounded-md hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        id="save-rename"
                        type="button"
                        class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                        Save
                    </button>
                </div>
            `;

            const modal = window.ModalManager.createCenterModal({
                id: modalId,
                title: modalTitle,
                content: content,
                actions: actions,
                onShown: (modalControl) => {
                    const titleInput = document.getElementById('room-title');
                    const errorContainer = document.getElementById('rename-error-container');
                    const cancelButton = document.getElementById('cancel-rename');
                    const saveButton = document.getElementById('save-rename');

                    if (titleInput && cancelButton && saveButton) {
                        titleInput.focus();
                        titleInput.select();

                        cancelButton.addEventListener('click', () => {
                            modalControl.close();
                        });

                        saveButton.addEventListener('click', async () => {
                            const newTitle = titleInput.value.trim();

                            if (!newTitle) {
                                errorContainer.textContent = 'Please enter a title';
                                errorContainer.classList.remove('hidden');
                                return;
                            }

                            try {
                                if (variant) {
                                    const vars = seller?.priceVariants || [];
                                    const index = vars.findIndex(v => v.title === variant);

                                    if (index === -1) {
                                        errorContainer.textContent = "Can't rename this default room";
                                        errorContainer.classList.remove('hidden');
                                        return;
                                    }

                                    const updatedVars = [...vars];
                                    updatedVars[index] = { title: newTitle };

                                    await window.sdk.profile.update({ priceVariants: updatedVars });
                                } else if (tableId) {
                                    const tables = seller?.tables || [];
                                    const index = tables.findIndex(t => t.title === tableId);

                                    if (index === -1) {
                                        errorContainer.textContent = "Can't rename this table";
                                        errorContainer.classList.remove('hidden');
                                        return;
                                    }

                                    const updatedTables = [...tables];
                                    updatedTables[index] = { ...updatedTables[index], title: newTitle };

                                    await window.sdk.profile.update({ tables: updatedTables });
                                }

                                // Trigger UI refresh
                                if (window.refreshTables && typeof window.refreshTables === 'function') {
                                    window.refreshTables();
                                }

                                window.ModalManager.showToast('Renamed successfully');
                                modalControl.close();
                            } catch (err) {
                                console.error('Error renaming:', err);
                                errorContainer.textContent = 'Failed to rename. Please try again.';
                                errorContainer.classList.remove('hidden');
                            }
                        });
                    }
                }
            });
        } else {
            // Fallback to original React component modal
            setSelectedTableId(tableId);
            setSelectedVariant(variant);
            setIsRenameRoomModalOpen(true);
        }
    };

    if (!isOpen) return null;

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
                        <h2 className="text-xl font-semibold">{variant || `Table ${tableId}`}</h2>
                        <div className="flex items-center gap-3">
                            {window.BluetoothPrinting && window.BluetoothPrinting.isSupported() && (
                                <div
                                    className={`flex items-center ${printerConnected ? 'text-green-600' : 'text-gray-400'}`}
                                    title={printerConnected ? 'Printer connected' : 'Printer not connected'}
                                >
                                    <i className="ph ph-printer text-xl"></i>
                                    {connectingPrinter && (
                                        <div className="ml-1 w-3 h-3 border-2 border-t-transparent border-gray-400 rounded-full animate-spin"></div>
                                    )}
                                </div>
                            )}
                            <button
                                className="p-2 hover:bg-gray-100 rounded-full"
                                onClick={() => refreshCompletedOrders(true)}
                                title="Refresh Orders"
                            >
                                <i className="ph ph-arrows-clockwise text-xl text-gray-600"></i>
                            </button>
                            <div className="relative" ref={menuRef}>
                                <button
                                    className="p-2 hover:bg-gray-100 rounded-full"
                                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                                    title="Menu"
                                >
                                    <i className="ph ph-dots-three-vertical text-xl text-gray-600"></i>
                                </button>
                                {renderContextMenu()}
                            </div>
                            <button
                                onClick={handleClose}
                                className="p-2 hover:bg-gray-100 rounded-full"
                                title="Close"
                            >
                                <i className="ph ph-x text-xl text-gray-600"></i>
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
                    {ordersLoading ? (
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
                                    className="w-full py-3 px-4 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
                                    onClick={handleAddNewOrder}
                                >
                                    <i className="ph ph-plus-circle text-xl"></i>
                                    <span>Add New Order</span>
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
                                        subTotal: order.items?.reduce((sum, item) => sum + ((item.price || 0) * (item.qnt || 1)), 0) || 0,
                                        // Add methods that OrderView component expects
                                        serveItem: async (item, served) => {
                                            try {
                                                const orderRef = window.sdk.db.collection("Orders").doc(order.id);
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
                                                const orderRef = window.sdk.db.collection("Orders").doc(order.id);
                                                const orderDoc = await orderRef.get();
                                                if (!orderDoc.exists) throw new Error('Order not found');

                                                const orderData = orderDoc.data();
                                                const updatedItems = orderData.items.map(i => {
                                                    if (i.pid === item.pid) {
                                                        const newQnt = (i.qnt || 1) + 1;
                                                        return { ...i, qnt: newQnt };
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
                                                const orderRef = window.sdk.db.collection("Orders").doc(order.id);
                                                const orderDoc = await orderRef.get();
                                                if (!orderDoc.exists) throw new Error('Order not found');

                                                const orderData = orderDoc.data();

                                                // Find the item in the current items array
                                                const itemIndex = orderData.items.findIndex(i => i.pid === item.pid);
                                                if (itemIndex === -1) {
                                                    throw new Error('Item not found in order');
                                                }

                                                // Get current quantity - standardize on qnt property
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
                                    className="w-full py-3 px-4 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
                                    onClick={handleAddNewOrder}
                                >
                                    <i className="ph ph-plus-circle text-xl"></i>
                                    <span>Add New Order</span>
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
            // Try Bluetooth printing first if available
            if (window.BluetoothPrinting && window.BluetoothPrinting.isSupported()) {
                try {
                    // Check if we already have a printer connected
                    const printerAlreadyConnected = window.BluetoothPrinting.connected && window.BluetoothPrinting.characteristic;

                    if (printerAlreadyConnected) {
                        showToast("Printing KOT using connected printer...", "info");
                    } else if (window.BluetoothPrinting.lastConnectedDevice) {
                        showToast(`Connecting to printer...`, "info");
                    } else {
                        showToast("Select a printer to print KOT", "info");
                    }

                    await window.BluetoothPrinting.printKOT(order.id);
                    showToast("KOT printed successfully", "success");
                    return; // Exit if Bluetooth printing succeeds
                } catch (btError) {
                    console.error("Bluetooth printing failed:", btError);

                    // Handle user cancellation errors
                    if (btError.message.includes("Device selection cancelled") ||
                        btError.message.includes("No printer selected") ||
                        btError.message.includes("cancelled by user") ||
                        btError.name === "NotFoundError") {
                        showToast("Printing cancelled", "info");
                        return;
                    }

                    // If it's a connection error or unsupported device, show helpful message
                    if (btError.message.includes("No suitable service") ||
                        btError.message.includes("No services found") ||
                        btError.message.includes("not supported as a printer") ||
                        btError.message.includes("cannot be used for printing") ||
                        (btError.name === 'NetworkError' && btError.message.includes("Unsupported device"))) {
                        showToast("Could not connect to printer. Please select a compatible thermal printer.", "error");
                        return;
                    }

                    // Generic error case
                    showToast(`Printing error: ${btError.message}`, "error");

                    // Fall through to traditional printing for other errors
                    showToast("Bluetooth printing failed, falling back to standard printing", "warning");
                }
            }

            // Traditional KOT printing (fallback)
            if (window.UserSession?.seller?.kotEnabled) {
                window.sdk.kot.print(order.id);
                showToast('KOT Printed successfully', 'success');
            } else {
                console.log('Print KOT for order:', order.id);
                showToast('KOT Printed successfully (simulation)', 'success');
            }
        } catch (err) {
            console.error('Error printing KOT:', err);
            showToast(`Failed to print KOT: ${err.message}`, 'error');
        }
    };

    const handlePrintBill = async () => {
        try {
            // Try Bluetooth printing first if available
            if (window.BluetoothPrinting && window.BluetoothPrinting.isSupported()) {
                try {
                    // Check if we already have a printer connected
                    const printerAlreadyConnected = window.BluetoothPrinting.connected && window.BluetoothPrinting.characteristic;

                    if (printerAlreadyConnected) {
                        showToast("Printing bill using connected printer...", "info");
                    } else if (window.BluetoothPrinting.lastConnectedDevice) {
                        showToast(`Connecting to printer...`, "info");
                    } else {
                        showToast("Select a printer to print bill", "info");
                    }

                    await window.BluetoothPrinting.printBill(order.id);
                    showToast("Bill printed successfully", "success");

                    // Refresh the page after successful printing
                    if (window.refreshOrders && typeof window.refreshOrders === 'function') {
                        window.refreshOrders();
                    } else if (window.refreshData && typeof window.refreshData === 'function') {
                        window.refreshData();
                    }

                    return true; // Exit if Bluetooth printing succeeds
                } catch (btError) {
                    console.error("Bluetooth printing failed:", btError);

                    // Handle user cancellation errors
                    if (btError.message.includes("Device selection cancelled") ||
                        btError.message.includes("No printer selected") ||
                        btError.message.includes("cancelled by user") ||
                        btError.name === "NotFoundError") {
                        showToast("Printing cancelled", "info");
                        return false;
                    }

                    // If it's a connection error or unsupported device, show helpful message
                    if (btError.message.includes("No suitable service") ||
                        btError.message.includes("No services found") ||
                        btError.message.includes("not supported as a printer") ||
                        btError.message.includes("cannot be used for printing") ||
                        (btError.name === 'NetworkError' && btError.message.includes("Unsupported device"))) {
                        showToast("Could not connect to printer. Please select a compatible thermal printer.", "error");
                        return false;
                    }

                    // Generic error case
                    showToast(`Printing error: ${btError.message}`, "error");

                    // Fall through to update order status for other errors
                    showToast("Bluetooth printing failed, marking order as completed", "warning");
                }
            }

            // Update order status to COMPLETED
            const orderRef = window.sdk.db.collection("Orders").doc(order.id);
            await orderRef.update({
                status: window.sdk.FieldValue.arrayUnion({
                    label: "COMPLETED",
                    date: new Date()
                }),
                currentStatus: {
                    label: "COMPLETED",
                    date: new Date()
                }
            });

            showToast("Order completed 👍", "success");

            // Refresh the page after updating the order
            if (window.refreshOrders && typeof window.refreshOrders === 'function') {
                window.refreshOrders();
            } else if (window.refreshData && typeof window.refreshData === 'function') {
                window.refreshData();
            }

            return true;
        } catch (err) {
            console.error('Error printing bill or completing order:', err);
            showToast(`Failed: ${err.message}`, 'error');
            return false;
        }
    };

    const handleBluetoothPrint = async () => {
        try {
            // This function is no longer needed as we've integrated Bluetooth printing into handlePrintKOT
            // Keeping it for backward compatibility, but just forwarding to handlePrintKOT
            await handlePrintKOT();
        } catch (error) {
            console.error("Error printing:", error);
        }
    };

    const handleCheckout = async () => {
        try {
            // Create a container for the CheckoutSheet
            const checkoutContainer = document.createElement('div');
            checkoutContainer.id = 'checkout-container';
            checkoutContainer.className = 'fixed inset-0 z-50';
            document.body.appendChild(checkoutContainer);

            try {
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
                        clearCallback: async () => {
                            // Cleanup and close
                            root.unmount();
                            if (document.body.contains(checkoutContainer)) {
                                document.body.removeChild(checkoutContainer);
                            }
                            // Refresh orders list or page
                            if (window.refreshOrders && typeof window.refreshOrders === 'function') {
                                window.refreshOrders();
                            } else if (window.refreshData && typeof window.refreshData === 'function') {
                                window.refreshData();
                            }
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
                console.error("Error rendering CheckoutSheet:", error);
                if (document.body.contains(checkoutContainer)) {
                    document.body.removeChild(checkoutContainer);
                }
                throw error;
            }
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
                ref: window.sdk.db.collection("Orders").doc(order.id)
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
            const orderRef = window.sdk.db.collection("Orders").doc(order.id);

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
            const orderRef = window.sdk.db.collection("Orders").doc(order.id);

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

            // Get current quantity - standardize on qnt property
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
            const orderRef = window.sdk.db.collection("Orders").doc(order.id);

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

            // Get current quantity and increase by 1
            const currentQty = parseInt(orderData.items[itemIndex].qnt || 1);
            const updatedItems = [...orderData.items];
            updatedItems[itemIndex] = {
                ...updatedItems[itemIndex],
                qnt: currentQty + 1
            };

            // Update the order with the modified items array
            await orderRef.update({ items: updatedItems });
            showToast(`Added ${item.title} quantity by 1`);
        } catch (err) {
            console.error('Error updating item quantity:', err);
            showToast('Failed to update item quantity', 'error');
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
    const subtotal = order.items?.reduce((sum, item) => sum + ((item.price || 0) * (item.qnt || 1)), 0) || 0;

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
                                        {item.qnt || 1}
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
                const results = await window.sdk.db.collection("Customers")
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
            const newCustomerRef = window.sdk.db.collection("Customers").doc();
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

// ProductFormModal updated with consistent layout and slide-in behavior
function ProductFormModal({ isOpen, onClose, product = null }) {
    // State definitions remain the same...
    const [formData, setFormData] = React.useState({
        id: '',
        title: '',
        desc: '',
        cat: 'Food',
        imgs: [],
        price: '',
        mrp: '',
        active: true,
        veg: true,
        stock: 0,
        barcode: '',
        priceVariants: [],
    });

    const [recipeItems, setRecipeItems] = React.useState([]);
    const [uploading, setUploading] = React.useState(false);
    const [error, setError] = React.useState('');
    const [charges, setCharges] = React.useState([
        { name: 'CGST', value: '0%', inclusive: false },
        { name: 'SGST', value: '0%', inclusive: false }
    ]);
    const [categories, setCategories] = React.useState([
        'Food', 'Beverages', 'Appetizers', 'Main Course', 'Desserts', 'Snacks'
    ]);
    const [previewImage, setPreviewImage] = React.useState('');
    const [showStockManagement, setShowStockManagement] = React.useState(false);
    const [deleteConfirmed, setDeleteConfirmed] = React.useState(false);
    const modalRef = React.useRef(null);

    // Detect if mobile
    const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);

    React.useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Handle outside click to dismiss
    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (modalRef.current && !modalRef.current.contains(event.target)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    // Reset form when modal opens
    React.useEffect(() => {
        if (isOpen) {
            setFormData({
                id: product?.id || '',
                title: product?.title || '',
                desc: product?.desc || '',
                cat: product?.cat || 'Food',
                imgs: product?.imgs || [],
                price: product?.price || '',
                mrp: product?.mrp || '',
                active: product?.active !== undefined ? product?.active : true,
                veg: product?.veg !== undefined ? product?.veg : true,
                stock: product?.stock || 0,
                barcode: product?.barcode || '',
                priceVariants: product?.priceVariants || [],
            });

            setRecipeItems(product?.recipeItems || []);
            setCharges(product?.charges?.map(c => ({
                name: c.name,
                value: c.type === 'percentage' ? `${c.value}%` : String(c.value),
                inclusive: c.inclusive
            })) || [
                    { name: 'CGST', value: '0%', inclusive: false },
                    { name: 'SGST', value: '0%', inclusive: false }
                ]);

            setShowStockManagement(product?.stock !== undefined);
            setUploading(false);
            setError('');
            setDeleteConfirmed(false);

            if (product?.imgs && product?.imgs.length > 0) {
                setPreviewImage(product.imgs[0]);
            } else {
                setPreviewImage('');
            }
        }
    }, [isOpen, product]);

    // Fetch categories from existing products
    React.useEffect(() => {
        async function fetchCategories() {
            try {
                const snapshot = await window.sdk.db.collection("Product").get();
                // Start with default categories plus popular food categories
                const cats = new Set([
                    'Appetizers', 'Main Course', 'Breakfast', 'Desserts', 'Beverages',
                    'Soups', 'Salads', 'Rice', 'Noodles', 'Pizza', 'Burgers', 'Sandwiches',
                    'Wraps', 'Pasta', 'Biryani', 'Snacks', 'Combos', 'Thalis'
                ]);

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

    const handleFormChange = (field, value) => {
        setFormData(prevData => ({
            ...prevData,
            [field]: value
        }));
    };

    // Handle input change for text fields
    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;

        // Handle different input types
        if (type === 'checkbox') {
            handleFormChange(name, checked);
        } else {
            handleFormChange(name, value);
        }
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            setUploading(true);
            setError(null);

            // Preview image immediately for better UX
            const reader = new FileReader();
            reader.onload = async (e) => {
                const result = e.target.result;
                setPreviewImage(result);

                try {
                    // Generate a temporary ID if this is a new product
                    const productId = formData.id || `temp_${Date.now()}`;

                    // Create a unique filename with timestamp to avoid conflicts
                    const timestamp = Date.now();
                    const fileName = `main_${timestamp}.jpg`;
                    const filePath = `products/${productId}/${fileName}`;

                    // Upload the file to Firebase Storage
                    await window.sdk.storage.uploadFile(filePath, file);

                    // Get the download URL
                    const imageUrl = await window.sdk.storage.getDownloadURL(filePath);

                    // Update form data with the new image URL
                    setFormData(prev => ({
                        ...prev,
                        imgs: [...prev.imgs, imageUrl]
                    }));

                    setUploading(false);
                    showToast('Image uploaded successfully', 'success');
                } catch (error) {
                    console.error('Error uploading image:', error);
                    setError('Failed to upload image to storage');
                    setUploading(false);
                }
            };

            reader.readAsDataURL(file);
        } catch (error) {
            console.error('Error uploading image:', error);
            setError('Failed to upload image');
            setUploading(false);
        }
    };

    const handleBarcodeScanner = async () => {
        // In a real implementation, you would integrate with a barcode scanner library
        // For this example, we'll simulate a scanned barcode
        try {
            // Simulate a barcode scanning delay
            const simulatedBarcode = "PROD" + Math.floor(1000000 + Math.random() * 9000000);

            setFormData(prev => ({
                ...prev,
                barcode: simulatedBarcode
            }));

            showToast("Barcode scanned successfully");
        } catch (error) {
            setError('Failed to scan barcode');
        }
    };

    const updateCharge = (index, updatedCharge) => {
        console.log("Updating charge at index", index, "with", updatedCharge);
        const updatedCharges = [...charges];

        if (index < updatedCharges.length) {
            updatedCharges[index] = updatedCharge;
        } else {
            updatedCharges.push(updatedCharge);
        }

        // Only filter charges when actually saving the form, not during editing
        // This allows users to work with empty or zero-value charges during editing
        setCharges(updatedCharges);

        console.log("Updated charges:", updatedCharges);
    };

    const removeImage = async (index) => {
        try {
            // Get the image URL that's being removed
            const imageToRemove = formData.imgs[index];

            // If it's a Firebase Storage URL, try to delete the file
            if (imageToRemove && imageToRemove.includes('firebasestorage.googleapis.com')) {
                // Extract the path from the URL
                const urlParts = imageToRemove.split('/o/')[1];
                if (urlParts) {
                    const path = decodeURIComponent(urlParts.split('?')[0]);
                    try {
                        await window.sdk.storage.deleteFile(path);
                        showToast('Image deleted from storage', 'success');
                    } catch (deleteError) {
                        console.warn('Could not delete image from storage:', deleteError);
                        // Continue with UI update even if delete fails
                    }
                }
            }

            // Update the form data
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
        } catch (error) {
            console.error('Error removing image:', error);
            showToast('Failed to remove image', 'error');
        }
    };

    // Handle form submission
    const handleSubmit = async () => {
        if (!formData.title || !formData.price || !formData.mrp || !formData.cat) {
            setError('All fields marked with * are required.');
            return;
        }

        setUploading(true);
        setError('');

        try {
            // Create product data with combined fields
            const productData = {
                title: formData.title,
                desc: formData.desc,
                cat: formData.cat,
                price: Number(formData.price),
                mrp: Number(formData.mrp),
                active: formData.active,
                veg: formData.veg,
                imgs: formData.imgs,
                barcode: formData.barcode,
                stock: formData.stock,
                priceVariants: formData.priceVariants,
                charges: charges.filter(charge => {
                    // Filter out charges with empty name or zero value
                    const numValue = parseFloat(String(charge.value).replace('%', ''));
                    return charge.name.trim() !== '' && !isNaN(numValue) && numValue > 0;
                }).map(charge => {
                    // Process charges for storage
                    const isPercentage = String(charge.value).includes('%');
                    const numValue = parseFloat(String(charge.value).replace('%', ''));
                    return {
                        name: charge.name,
                        value: numValue,
                        type: isPercentage ? 'percentage' : 'fixed',
                        inclusive: charge.inclusive
                    };
                }),
                recipe: recipeItems, // Save recipe items
                updatedAt: new Date()
            };

            // Get current user profile
            try {
                const profileDoc = await window.sdk.profile.get();
                const userProfile = profileDoc.data();

                if (userProfile) {
                    productData.sellerId = userProfile.uid || '';
                    productData.sellerBusinessName = userProfile.businessName || '';
                    productData.sellerAvatar = userProfile.photoURL || '';
                }
            } catch (profileError) {
                console.warn('Could not get profile data:', profileError);
                // Continue without profile data
            }

            let productId;

            // Save to Firestore
            if (product) {
                // Update existing product
                productId = product.id;
                await window.sdk.db.collection("Product").doc(productId).update(productData);

                // Track product update with analytics
                if (window.sdk.analytics) {
                    window.sdk.analytics.logEvent('product_updated', {
                        product_id: productId,
                        product_name: productData.title,
                        category: productData.category || 'uncategorized'
                    });
                }

                showToast('Product updated successfully');
            } else {
                // Add new product
                const docRef = await window.sdk.db.collection("Product").add({
                    ...productData,
                    date: new Date()
                });
                productId = docRef.id;

                // Track product creation with analytics
                if (window.sdk.analytics) {
                    window.sdk.analytics.logEvent('product_created', {
                        product_id: productId,
                        product_name: productData.title,
                        category: productData.category || 'uncategorized'
                    });
                }

                // If we had temporary IDs in the image paths, we need to update them
                if (formData.imgs.length > 0) {
                    const hasTemps = formData.imgs.some(img => img.includes('temp_'));

                    if (hasTemps) {
                        // Get all images for this product
                        try {
                            const files = await window.sdk.storage.listFiles(`products/temp_`);

                            // Move each temp file to the correct product folder
                            for (const item of files.items) {
                                const fullPath = item.fullPath;
                                if (fullPath.includes('temp_')) {
                                    // Get file content
                                    const fileBlob = await fetch(await window.sdk.storage.getDownloadURL(fullPath)).then(r => r.blob());

                                    // Upload to new location
                                    const newPath = fullPath.replace(/products\/temp_[^\/]+\//, `products/${productId}/`);
                                    await window.sdk.storage.uploadFile(newPath, fileBlob);

                                    // Get new URL
                                    const newUrl = await window.sdk.storage.getDownloadURL(newPath);

                                    // Find old URL in product images and replace it
                                    const oldUrl = await window.sdk.storage.getDownloadURL(fullPath);
                                    if (productData.imgs.includes(oldUrl)) {
                                        productData.imgs = productData.imgs.map(url =>
                                            url === oldUrl ? newUrl : url
                                        );
                                    }

                                    // Delete old file
                                    await window.sdk.storage.deleteFile(fullPath);
                                }
                            }

                            // Update product with fixed image URLs
                            await window.sdk.db.collection("Product").doc(productId).update({
                                imgs: productData.imgs
                            });
                        } catch (moveError) {
                            console.error('Error moving temporary images:', moveError);
                            // Continue anyway, as the product is created and images will still work
                        }
                    }
                }

                showToast('Product added successfully');
            }

            setUploading(false);
            onClose();
        } catch (error) {
            console.error('Error saving product:', error);
            setError('Failed to save product. Please try again.');
            setUploading(false);
        }
    };

    // Handle product deletion
    const handleDelete = async () => {
        // Only allow deletion of existing products
        if (!product || !product.id) {
            setError('Cannot delete a product that has not been saved yet.');
            return;
        }

        // If not confirmed via checkbox, remind user
        if (!deleteConfirmed) {
            setError('Please check the confirmation box before deleting.');
            return;
        }

        // Final confirmation
        if (!window.confirm(`Are you absolutely sure you want to delete "${product.title}"? This action cannot be undone and the product will be permanently removed from your inventory.`)) {
            return;
        }

        // Proceed with deletion
        try {
            setUploading(true);
            setError('');

            // First delete all product images from storage if they exist
            if (formData.imgs && formData.imgs.length > 0) {
                try {
                    const files = await window.sdk.storage.listFiles(`products/${product.id}`);

                    // Delete each file
                    for (const item of files.items) {
                        try {
                            await window.sdk.storage.deleteFile(item.fullPath);
                            console.log(`Deleted image: ${item.fullPath}`);
                        } catch (deleteError) {
                            console.warn(`Could not delete image: ${item.fullPath}`, deleteError);
                            // Continue with deletion of other files
                        }
                    }
                } catch (listError) {
                    console.warn('Could not list images for deletion:', listError);
                    // Continue with document deletion regardless
                }
            }

            // Then delete the product document
            await window.sdk.db.collection("Product").doc(product.id).delete();

            // Track product deletion with analytics
            if (window.sdk.analytics) {
                window.sdk.analytics.logEvent('product_deleted', {
                    product_id: product.id,
                    product_name: product.title,
                    category: product.category || 'uncategorized'
                });
            }

            window.showToast('Product deleted successfully');
            setUploading(false);
            onClose();

            // Refresh products list if the function exists
            if (window.refreshProducts && typeof window.refreshProducts === 'function') {
                window.refreshProducts();
            }
        } catch (error) {
            console.error('Error deleting product:', error);
            setError('Failed to delete product. Please try again.');
            setUploading(false);
        }
    };

    if (!isOpen) return null;

    // Get modal classes based on device type
    const modalClasses = isMobile
        ? "fixed inset-x-0 bottom-0 z-50 rounded-t-xl bg-white shadow-xl animate-slideUp max-h-[90vh] overflow-auto"
        : "fixed top-0 right-0 bottom-0 z-50 bg-white shadow-xl animate-slideInRight w-full max-w-2xl overflow-auto";

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-end md:items-center justify-end transition-opacity">
            <div ref={modalRef} className={modalClasses}>
                {/* Mobile drag handle - only show on mobile */}
                {isMobile && (
                    <div className="flex justify-center pt-2 pb-1">
                        <div className="w-10 h-1 bg-gray-300 rounded-full"></div>
                    </div>
                )}

                {/* Header */}
                <div className="sticky top-0 z-10 px-4 py-3 bg-red-50 border-b border-gray-200 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-800">
                        {product ? 'Edit Product' : 'Add New Product'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-red-100 transition-colors"
                    >
                        <i className="ph ph-x text-gray-600 text-lg"></i>
                    </button>
                </div>

                {/* Form Content - Scrollable */}
                <div className="p-4 overflow-y-auto">
                    {error && (
                        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
                            {error}
                        </div>
                    )}

                    <form className="space-y-5">
                        {/* Product Image Upload */}
                        <div>
                            <div className="mb-1 flex justify-between items-center">
                                <label className="block text-sm font-medium text-gray-700">
                                    Product Images
                                </label>
                                <label className="cursor-pointer inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors">
                                    <i className="ph ph-plus mr-1"></i>
                                    <span>{uploading ? 'Uploading...' : 'Add Image'}</span>
                                    <input
                                        type="file"
                                        className="hidden"
                                        onChange={handleImageUpload}
                                        accept="image/*"
                                        disabled={uploading}
                                    />
                                </label>
                            </div>

                            {formData.imgs.length > 0 ? (
                                <div className="grid grid-cols-3 gap-2 mt-2 mb-2">
                                    {formData.imgs.map((img, index) => (
                                        <div key={index} className="relative rounded-lg border border-gray-200 overflow-hidden aspect-square">
                                            <img
                                                src={img}
                                                alt={`Product ${index + 1}`}
                                                className="w-full h-full object-cover"
                                                onClick={() => setPreviewImage(img)}
                                            />
                                            {img === previewImage && (
                                                <div className="absolute inset-0 bg-red-500 bg-opacity-20 flex items-center justify-center">
                                                    <span className="px-2 py-1 bg-red-500 text-white text-xs rounded">Main</span>
                                                </div>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => removeImage(index)}
                                                className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full"
                                            >
                                                <i className="ph ph-x text-sm"></i>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                                    <div className="flex flex-col items-center justify-center py-6">
                                        <i className="ph ph-image text-4xl text-gray-400 mb-2"></i>
                                        <p className="text-gray-500">No product images</p>
                                        <p className="text-xs text-gray-400 mt-1">Click "Add Image" to upload</p>
                                    </div>
                                </div>
                            )}

                            {previewImage && (
                                <div className="mt-3 bg-gray-50 p-3 rounded-lg">
                                    <div className="text-sm font-medium text-gray-700 mb-2">Preview Image</div>
                                    <img
                                        src={previewImage}
                                        alt="Product preview"
                                        className="mx-auto max-h-48 object-contain"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Category Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Category <span className="text-red-500">*</span>
                            </label>
                            <select
                                name="cat"
                                value={formData.cat}
                                onChange={handleChange}
                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                            >
                                {categories.map((category, index) => (
                                    <option key={index} value={category}>
                                        {category}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Product Title */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Product Title <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="title"
                                value={formData.title}
                                onChange={handleChange}
                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                                placeholder="Enter product name"
                            />
                        </div>

                        {/* Barcode */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Barcode ID
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    name="barcode"
                                    value={formData.barcode}
                                    onChange={handleChange}
                                    className="w-full p-2.5 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                                    placeholder="Enter barcode"
                                />
                                <button
                                    type="button"
                                    onClick={handleBarcodeScanner}
                                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-red-500"
                                >
                                    <i className="ph ph-barcode text-xl"></i>
                                </button>
                            </div>
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Description
                            </label>
                            <textarea
                                name="desc"
                                value={formData.desc}
                                onChange={handleChange}
                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                                placeholder="Enter product description"
                                rows="3"
                            ></textarea>
                        </div>

                        {/* Pricing Section */}
                        <div>
                            <h3 className="text-md font-medium text-gray-700 mb-3">Pricing</h3>
                            <div className="grid grid-cols-2 gap-4">
                                {/* MRP */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        MRP (₹) <span className="text-red-500">*</span>
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
                                            className="w-full pl-8 p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                                            placeholder="0"
                                        />
                                    </div>
                                </div>

                                {/* Selling Price */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Selling Price (₹) <span className="text-red-500">*</span>
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
                                            className="w-full pl-8 p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Price Calculation Display */}
                            {formData.mrp && formData.price && (
                                <div className="flex items-center mt-2 text-sm">
                                    <span className="mr-2">Price:</span>
                                    {Number(formData.mrp) > Number(formData.price) && (
                                        <span className="line-through text-gray-500 mr-2">₹{formData.mrp}</span>
                                    )}
                                    <span className="font-medium">₹{formData.price}</span>
                                    {Number(formData.mrp) > Number(formData.price) && (
                                        <span className="ml-2 text-green-600">
                                            ({Math.round(((Number(formData.mrp) - Number(formData.price)) / Number(formData.mrp)) * 100)}% OFF)
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Price Variants */}
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <h3 className="text-sm font-medium text-gray-700">Additional Price Variants</h3>
                            </div>
                            <PriceVariants
                                variants={formData.priceVariants || []}
                                setVariants={(variants) => handleFormChange('priceVariants', variants)}
                            />
                        </div>

                        {/* Veg/Non-veg Toggle */}
                        <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                            <div className="flex items-center space-x-2">
                                <div className={`h-6 w-6 border-2 p-0.5 ${formData.veg ? 'border-green-500' : 'border-red-500'}`}>
                                    <div className={`h-full w-full rounded-sm ${formData.veg ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                </div>
                                <span className="text-sm font-medium text-gray-800">
                                    {formData.veg ? 'Vegetarian' : 'Non-vegetarian'}
                                </span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="veg"
                                    checked={formData.veg}
                                    onChange={handleChange}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                            </label>
                        </div>

                        {/* Stock Management Toggle */}
                        <div className="bg-gray-50 p-3 rounded-lg">
                            <div className="flex items-center mb-2">
                                <input
                                    type="checkbox"
                                    id="enableStock"
                                    className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                                    checked={showStockManagement}
                                    onChange={(e) => {
                                        setShowStockManagement(e.target.checked);
                                        handleFormChange('stock', e.target.checked ? 0 : undefined);
                                    }}
                                />
                                <label htmlFor="enableStock" className="ml-2 text-sm font-medium text-gray-700">
                                    Enable Stock Management
                                </label>
                            </div>

                            {showStockManagement && (
                                <div className="mt-2 space-y-4">
                                    <div className="flex items-center space-x-2">
                                        <div className="w-1/2">
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                                Current Stock
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.stock}
                                                min="0"
                                                onChange={(e) => handleFormChange('stock', Math.max(0, Number(e.target.value)))}
                                                className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                                            />
                                        </div>
                                    </div>

                                    {/* Recipe Items Component */}
                                    <RecipeItems
                                        items={recipeItems}
                                        setItems={setRecipeItems}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Tax & Charges */}
                        <div className="p-3 bg-gray-50 rounded-lg">
                            <h4 className="text-sm font-medium text-gray-700 mb-3">Tax & Charges</h4>

                            {charges.map((charge, index) => (
                                <div key={index} className="mb-3 last:mb-0">
                                    <div className="flex gap-2 mb-2">
                                        <input
                                            type="text"
                                            value={charge.name}
                                            onChange={(e) => {
                                                const updatedCharge = { ...charge, name: e.target.value };
                                                updateCharge(index, updatedCharge);
                                            }}
                                            placeholder="Charge name"
                                            className="flex-1 p-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                                        />
                                        <div className="relative flex-1">
                                            <input
                                                type="text"
                                                value={String(charge.value).replace('%', '')}
                                                onChange={(e) => {
                                                    const value = e.target.value.replace(/[^0-9.]/g, '');
                                                    const updatedCharge = {
                                                        ...charge,
                                                        value: String(charge.value).includes('%') ? `${value}%` : value
                                                    };
                                                    updateCharge(index, updatedCharge);
                                                }}
                                                placeholder="Value"
                                                className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const isPercentage = String(charge.value).includes('%');
                                                    const value = String(charge.value).replace('%', '');
                                                    const updatedCharge = {
                                                        ...charge,
                                                        value: isPercentage ? value : `${value}%`
                                                    };
                                                    updateCharge(index, updatedCharge);
                                                }}
                                                className={`absolute right-0 top-0 bottom-0 px-3 rounded-r-lg flex items-center justify-center ${String(charge.value).includes('%')
                                                    ? 'bg-red-100 text-red-600'
                                                    : 'bg-green-100 text-green-600'
                                                    }`}
                                            >
                                                {String(charge.value).includes('%') ? '%' : '₹'}
                                            </button>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const updatedCharges = charges.filter((_, i) => i !== index);
                                                setCharges(updatedCharges);
                                            }}
                                            className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                            title="Delete charge"
                                        >
                                            <i className="ph ph-trash"></i>
                                        </button>
                                    </div>
                                    <div className="flex items-center">
                                        <label className="flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={charge.inclusive}
                                                onChange={(e) => {
                                                    const updatedCharge = { ...charge, inclusive: e.target.checked };
                                                    updateCharge(index, updatedCharge);
                                                }}
                                                className="w-4 h-4 text-red-600 bg-gray-100 border-gray-300 rounded focus:ring-red-500"
                                            />
                                            <span className="ml-2 text-xs font-medium text-gray-700">Inclusive</span>
                                        </label>
                                    </div>
                                </div>
                            ))}

                            {/* Add new charge */}
                            <button
                                type="button"
                                onClick={() => {
                                    updateCharge(charges.length, {
                                        name: '',
                                        value: '0%', // Initialize as string with % for consistency
                                        inclusive: false
                                    });
                                }}
                                className="mt-2 text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 py-1 px-2 rounded flex items-center w-full justify-center"
                            >
                                <i className="ph ph-plus mr-1"></i> Add Charge
                            </button>
                        </div>

                        {/* Active Status */}
                        <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                            <span className="text-sm font-medium text-gray-700">Product Status</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="active"
                                    checked={formData.active}
                                    onChange={handleChange}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
                                <span className="ml-2 text-sm font-medium text-gray-700">
                                    {formData.active ? 'Active' : 'Inactive'}
                                </span>
                            </label>
                        </div>
                    </form>
                </div>

                {/* Danger Zone - Only show when editing an existing product */}
                {product && product.id && (
                    <div className="px-4 py-3 bg-red-50 border-t border-b border-red-100">
                        <div className="mb-2">
                            <h3 className="text-sm font-bold text-red-700 flex items-center">
                                <i className="ph ph-warning-circle mr-1.5"></i>
                                Danger Zone
                            </h3>
                            <p className="text-xs text-red-600 mt-1">
                                Deleting this product will permanently remove it. This action cannot be undone.
                            </p>
                        </div>

                        <div className="flex items-center mt-3">
                            <input
                                type="checkbox"
                                id="confirm-delete"
                                className="h-4 w-4 text-red-600 border-red-300 rounded mr-2"
                                checked={deleteConfirmed}
                                onChange={(e) => setDeleteConfirmed(e.target.checked)}
                            />
                            <label htmlFor="confirm-delete" className="text-xs text-red-700">
                                I understand that this action is permanent
                            </label>
                        </div>

                        <button
                            id="delete-product-btn"
                            type="button"
                            onClick={handleDelete}
                            disabled={!deleteConfirmed || uploading}
                            className="mt-3 px-3 py-1.5 text-xs text-red-700 border border-red-300 bg-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-100 flex items-center"
                        >
                            {uploading ? (
                                <span className="mr-2 h-3 w-3 rounded-full border-2 border-red-700 border-t-transparent animate-spin"></span>
                            ) : (
                                <i className="ph ph-trash mr-1.5"></i>
                            )}
                            Delete This Product
                        </button>
                    </div>
                )}

                {/* Form Actions - Sticky Footer */}
                <div className="sticky bottom-0 px-4 py-3 bg-white border-t flex justify-between gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>

                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={uploading}
                        className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors flex items-center"
                    >
                        {uploading ? (
                            <>
                                <span className="mr-2 h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
                                {product ? 'Updating...' : 'Saving...'}
                            </>
                        ) : (
                            <>
                                <i className="ph ph-floppy-disk mr-1"></i>
                                {product ? 'Update Product' : 'Save Product'}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

// Recipe Items Component for the Product Form
function RecipeItems({ items, setItems }) {
    const [inventoryItems, setInventoryItems] = React.useState([]);
    const [loading, setLoading] = React.useState(true);

    // Fetch available inventory items when component mounts
    React.useEffect(() => {
        async function fetchInventoryItems() {
            try {
                setLoading(true);
                const inventorySnapshot = await window.sdk.db.collection("Inventory")
                    .orderBy("updatedAt", "desc")
                    .limit(100)
                    .get();

                // Process inventory items the same way as in Products.js
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
                    } catch (error) {
                        console.error(`Error creating inventory item from doc ${doc.id}:`, error);
                        // Continue with other inventory items
                    }
                }

                // Filter out duplicates based on name (just to be extra safe)
                const uniqueItems = [];
                const nameSet = new Set();

                // Log the total number of inventory items before deduplication
                console.log(`Total inventory items before deduplication: ${inventoryList.length}`);

                // Log each inventory item for debugging
                inventoryList.forEach((item, index) => {
                    console.log(`Inventory item ${index}:`, item.name, item.id);
                });

                // For now, use all items without deduplication
                setInventoryItems(inventoryList);

                // Log the final result
                console.log(`Set ${inventoryList.length} inventory items for the recipe dropdown`);

                setLoading(false);
            } catch (error) {
                console.error("Error fetching inventory items:", error);
                setLoading(false);
            }
        }

        fetchInventoryItems();
    }, []);

    const handleAddItem = () => {
        if (inventoryItems.length === 0) {
            showToast('No inventory items available. Please add items to inventory first.', 'error');
            return;
        }

        // Access properties correctly from InventoryItem object
        const firstItem = inventoryItems[0];
        const newItem = {
            id: Date.now().toString(), // Temporary ID for UI purposes
            name: firstItem.name,
            quantity: 1,
            unit: firstItem.unit
        };

        setItems([...items, newItem]);
    };

    const handleUpdateItem = (index, field, value) => {
        const updatedItems = [...items];

        if (field === 'name') {
            // When name changes, update the unit as well
            const selectedItem = inventoryItems.find(item => item.name === value);
            if (selectedItem) {
                updatedItems[index] = {
                    ...updatedItems[index],
                    name: value,
                    unit: selectedItem.unit
                };
            } else {
                updatedItems[index] = {
                    ...updatedItems[index],
                    name: value
                };
            }
        } else if (field === 'quantity') {
            // Ensure quantity is a positive number
            const quantity = Math.max(0, Number(value) || 0);
            updatedItems[index] = {
                ...updatedItems[index],
                quantity
            };
        }

        setItems(updatedItems);
    };

    const handleRemoveItem = (index) => {
        const updatedItems = [...items];
        updatedItems.splice(index, 1);
        setItems(updatedItems);
    };

    if (loading) {
        return (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-500"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-700">Recipe Items</h4>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            // Function to reload inventory items for debugging
                            async function reloadInventory() {
                                try {
                                    setLoading(true);
                                    const snapshot = await window.sdk.db.collection("Inventory")
                                        .orderBy("updatedAt", "desc")
                                        .limit(100)
                                        .get();

                                    console.log("RELOAD: Total docs from Firestore:", snapshot.docs.length);

                                    const items = snapshot.docs.map(doc => {
                                        const data = doc.data();
                                        console.log("RELOAD: Item data:", data.name, doc.id);
                                        return new InventoryItem({
                                            id: doc.id,
                                            name: data.name || '',
                                            quantity: Number(data.quantity || 0),
                                            unit: data.unit || '',
                                            minQuantity: Number(data.minQuantity || 0),
                                            date: data.date?.toDate ? data.date.toDate() : new Date(),
                                            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
                                            lastUpdated: data.lastUpdated || (data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : new Date().toISOString())
                                        });
                                    });

                                    setInventoryItems(items);
                                    setLoading(false);
                                    showToast("Inventory items reloaded for debugging", "success");
                                } catch (error) {
                                    console.error("Error reloading inventory items:", error);
                                    setLoading(false);
                                    showToast("Failed to reload inventory", "error");
                                }
                            }

                            reloadInventory();
                        }}
                        className="text-xs bg-blue-100 text-blue-600 py-1 px-2 rounded flex items-center"
                    >
                        <i className="ph ph-arrows-clockwise mr-1"></i> Reload
                    </button>
                    <button
                        type="button"
                        onClick={handleAddItem}
                        className="text-xs bg-red-100 text-red-600 py-1 px-2 rounded flex items-center"
                    >
                        <i className="ph ph-plus mr-1"></i> Add Item
                    </button>
                </div>
            </div>

            {items.length === 0 ? (
                <p className="text-sm text-gray-500">No recipe items added yet</p>
            ) : (
                <div className="space-y-3">
                    {items.map((item, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <div className="flex-grow">
                                <select
                                    value={item.name}
                                    onChange={(e) => handleUpdateItem(index, 'name', e.target.value)}
                                    className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                                >
                                    {inventoryItems.map((invItem) => (
                                        <option key={invItem.id} value={invItem.name}>
                                            {invItem.name} ({invItem.quantity} {invItem.unit})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="w-28">
                                <div className="flex items-center">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const currentValue = Number(item.quantity) || 0;
                                            if (currentValue > 0) {
                                                handleUpdateItem(index, 'quantity', currentValue - 1);
                                            }
                                        }}
                                        className="p-2 bg-red-500 text-white rounded-l-lg"
                                    >
                                        <i className="ph ph-minus"></i>
                                    </button>
                                    <input
                                        type="text"
                                        value={item.quantity}
                                        onChange={(e) => handleUpdateItem(index, 'quantity', e.target.value)}
                                        className="w-10 p-2 text-center border-y border-gray-300 focus:outline-none focus:ring-2 focus:ring-red-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const currentValue = Number(item.quantity) || 0;
                                            handleUpdateItem(index, 'quantity', currentValue + 1);
                                        }}
                                        className="p-2 bg-red-500 text-white rounded-r-lg"
                                    >
                                        <i className="ph ph-plus"></i>
                                    </button>
                                </div>
                            </div>
                            <div className="w-16 text-sm text-gray-600 text-center">
                                {item.unit}
                            </div>
                            <button
                                type="button"
                                onClick={() => handleRemoveItem(index)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                            >
                                <i className="ph ph-trash"></i>
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// Price Variants Component for the Product Form
function PriceVariants({ variants, setVariants }) {
    const handleAddVariant = () => {
        setVariants([
            ...variants,
            { id: Date.now().toString(), name: '', price: '' }
        ]);
    };

    const handleUpdateVariant = (index, field, value) => {
        const updatedVariants = [...variants];

        if (field === 'price') {
            // Ensure price is a number
            value = value.replace(/[^0-9]/g, '');
        }

        updatedVariants[index] = {
            ...updatedVariants[index],
            [field]: value
        };

        setVariants(updatedVariants);
    };

    const handleRemoveVariant = (index) => {
        const updatedVariants = [...variants];
        updatedVariants.splice(index, 1);
        setVariants(updatedVariants);
    };

    return (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-700">Price Variants</h4>
                <button
                    type="button"
                    onClick={handleAddVariant}
                    className="text-xs bg-red-100 text-red-600 py-1 px-2 rounded flex items-center"
                >
                    <i className="ph ph-plus mr-1"></i> Add Variant
                </button>
            </div>

            {variants.length === 0 ? (
                <p className="text-sm text-gray-500">No price variants added yet</p>
            ) : (
                <div className="space-y-3">
                    {variants.map((variant, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <div className="flex-grow">
                                <input
                                    type="text"
                                    placeholder="Variant Name (e.g. Half, Full)"
                                    value={variant.name}
                                    onChange={(e) => handleUpdateVariant(index, 'name', e.target.value)}
                                    className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                                />
                            </div>
                            <div className="w-28">
                                <div className="flex items-center">
                                    <span className="p-2 bg-gray-100 border border-gray-300 rounded-l-lg">₹</span>
                                    <input
                                        type="text"
                                        placeholder="Price"
                                        value={variant.price}
                                        onChange={(e) => handleUpdateVariant(index, 'price', e.target.value)}
                                        className="w-full p-2 text-center border-y border-r border-gray-300 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                                    />
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleRemoveVariant(index)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                            >
                                <i className="ph ph-trash"></i>
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// Make component available globally
window.ProductFormModal = ProductFormModal;
window.RecipeItems = RecipeItems;
window.PriceVariants = PriceVariants;

// Export components
window.ProfileMenu = ProfileMenu;
window.AddTableModal = AddTableModal;
window.RenameRoomModal = RenameRoomModal;
window.OrderRoom = OrderRoom;
window.OrderView = OrderView;
window.CustomerSearch = CustomerSearch;

// Context Menu Component
function ContextMenu() {
    return (
        <div className="relative" ref={menuRef}>
            <button
                className="p-2 hover:bg-gray-100 rounded-full"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
                <i className="ph ph-dots-three-vertical text-xl"></i>
            </button>
            {isMenuOpen && renderContextMenu()}
        </div>
    );
}

const renderContextMenu = () => {
    return (
        <div
            ref={menuRef}
            className="absolute right-0 top-12 w-52 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-50"
        >
            <div className="py-1">
                {window.BluetoothPrinting && window.BluetoothPrinting.isSupported() && (
                    <button
                        className="w-full text-left px-4 py-3 text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                        onClick={() => {
                            setIsMenuOpen(false);
                            if (printerConnected) {
                                // Disconnect printer
                                window.BluetoothPrinting.disconnect()
                                    .then(() => {
                                        setPrinterConnected(false);
                                        if (window.ModalManager && typeof window.ModalManager.showToast === 'function') {
                                            window.ModalManager.showToast("Printer disconnected", { type: "info" });
                                        } else {
                                            showToast("Printer disconnected", "info");
                                        }
                                    })
                                    .catch(err => {
                                        console.error("Error disconnecting printer:", err);
                                    });
                            } else {
                                // Connect to printer
                                setConnectingPrinter(true);
                                window.BluetoothPrinting.connect()
                                    .then(() => {
                                        setPrinterConnected(true);
                                        if (window.ModalManager && typeof window.ModalManager.showToast === 'function') {
                                            window.ModalManager.showToast("Printer connected successfully", { type: "success" });
                                        } else {
                                            showToast("Printer connected successfully", "success");
                                        }
                                    })
                                    .catch(error => {
                                        console.error("Error connecting to printer:", error);
                                        // Only show error messages for non-cancellation errors
                                        if (error.name !== "NotFoundError" &&
                                            !error.message.includes("Device selection cancelled") &&
                                            !error.message.includes("cancelled by user") &&
                                            !error.message.includes("No printer selected")) {
                                            if (window.ModalManager && typeof window.ModalManager.showToast === 'function') {
                                                window.ModalManager.showToast("Error connecting to printer", { type: "error" });
                                            } else {
                                                showToast("Error connecting to printer", "error");
                                            }
                                        }
                                    })
                                    .finally(() => {
                                        setConnectingPrinter(false);
                                    });
                            }
                        }}
                    >
                        <i className={`ph ph-printer ${printerConnected ? 'text-green-500' : 'text-red-500'}`}></i>
                        <span>{printerConnected ? 'Disconnect Printer' : 'Connect Printer'}</span>
                    </button>
                )}

                <button
                    className="w-full text-left px-4 py-3 text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                    onClick={() => {
                        setIsMenuOpen(false);
                        handleShowQR();
                    }}
                >
                    <i className="ph ph-qr-code text-red-500"></i>
                    <span>Show QR Code</span>
                </button>

                <button
                    className="w-full text-left px-4 py-3 text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                    onClick={() => {
                        if (confirm(`Are you sure you want to delete all orders for ${tableId || variant}?`)) {
                            confirmDelete();
                        }
                        setIsMenuOpen(false);
                    }}
                >
                    <i className="ph ph-trash text-red-500"></i>
                    <span>Clear All Orders</span>
                </button>

                <button
                    className="w-full text-left px-4 py-3 text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                    onClick={() => {
                        setIsMenuOpen(false);
                        showRenameRoomModal(tableId, variant);
                    }}
                >
                    <i className="ph ph-pencil-simple text-red-500"></i>
                    <span>Rename {tableId ? 'Table' : 'Channel'}</span>
                </button>

                {tableId && (
                    <button
                        className="w-full text-left px-4 py-3 text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                        onClick={() => {
                            if (confirm(`Are you sure you want to delete table ${tableId}?`)) {
                                deleteTable(tableId);
                                handleClose();
                            }
                            setIsMenuOpen(false);
                        }}
                    >
                        <i className="ph ph-trash text-red-500"></i>
                        <span>Delete Table</span>
                    </button>
                )}
            </div>
        </div>
    );
};

// ... existing code ...
// ... existing code ...