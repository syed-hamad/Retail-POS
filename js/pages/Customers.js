// Customers Component
function Customers() {
    const [customers, setCustomers] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [filterType, setFilterType] = React.useState('all'); // 'all', 'creditors'
    const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = React.useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = React.useState(false);
    const [customerCardLoaded, setCustomerCardLoaded] = React.useState(false);

    // Expose refreshCustomers function globally so it can be called from components
    window.refreshCustomers = fetchCustomers;

    React.useEffect(() => {
        // Check if CustomerCard component is loaded
        if (!window.CustomerCard) {
            // Load CustomerCard component dynamically
            // First ensure ModalManager is loaded
            const loadDependencies = async () => {
                try {
                    // Check and load ModalManager first if needed
                    if (!window.ModalManager) {
                        console.log("Loading ModalManager before CustomerCard...");
                        const modalManagerScript = document.createElement('script');
                        modalManagerScript.src = 'js/components/ModalManager.js';

                        await new Promise((resolve, reject) => {
                            modalManagerScript.onload = resolve;
                            modalManagerScript.onerror = reject;
                            document.head.appendChild(modalManagerScript);
                        });
                        console.log("ModalManager loaded successfully");
                    }

                    // Now load CustomerCard
                    const script = document.createElement('script');
                    script.src = 'js/components/CustomerCard.js';

                    script.onload = () => {
                        console.log("CustomerCard loaded successfully");
                        setCustomerCardLoaded(true);
                    };

                    document.head.appendChild(script);
                } catch (error) {
                    console.error("Error loading dependencies:", error);
                    setCustomerCardLoaded(true); // Set to true anyway to prevent infinite loading
                }
            };

            loadDependencies();
        } else {
            setCustomerCardLoaded(true);
        }

        fetchCustomers();
    }, []);

    // Fetch customers from SDK
    const fetchCustomers = async () => {
        try {
            setLoading(true);
            // Use the SDK to fetch customers as in the Flutter code
            const customersSnapshot = await sdk.collection("Customers")
                .get();

            const customersList = customersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            setCustomers(customersList);
            setLoading(false);
        } catch (err) {
            console.error('Error fetching customers:', err);
            setError('Failed to load customers');
            setLoading(false);
        }
    };

    // Filter customers based on search query and filter type
    const filteredCustomers = React.useMemo(() => {
        return customers
            .filter(customer => {
                // Search filter
                const matchesSearch = (customer?.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                    (customer?.phone || '').includes(searchQuery);

                // Type filter
                const matchesType = filterType === 'all' ||
                    (filterType === 'creditors' && (customer?.balance || 0) < 0);

                return matchesSearch && matchesType;
            });
    }, [customers, searchQuery, filterType]);

    // Function to show the "Add Customer" modal
    const addCustomer = () => {
        setIsAddCustomerModalOpen(true);
    };

    // Function to handle importing customers
    const importCustomers = () => {
        setIsImportModalOpen(true);
    };

    // Function to export customers to CSV
    const exportAll = async () => {
        try {
            // Prepare data for export - similar to Flutter code
            const data = customers.map(c => ({
                name: c.name || "",
                phone: c.phone || "",
                balance: c.balance || 0,
                date: c.date ? new Date(c.date).toISOString() : ""
            }));

            // Create CSV content
            const headers = Object.keys(data[0]).join(',');
            const rows = data.map(obj => Object.values(obj).map(val => typeof val === 'string' ? `"${val}"` : val).join(','));
            const csvContent = [headers, ...rows].join('\n');

            // Create download
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', `customers_${new Date().toISOString().slice(0, 10)}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            showToast("Customers exported to CSV");
        } catch (error) {
            console.error("Error exporting customers:", error);
            showToast("Failed to export customers", "error");
        }
    };

    // Search Bar Component
    const SearchBar = () => {
        return (
            <div className="flex items-center mb-4 bg-white rounded-full shadow-sm overflow-hidden">
                <div className="flex-1 relative">
                    <i className="ph ph-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search customers"
                        className="w-full pl-12 pr-4 py-3 border-none focus:outline-none"
                    />
                </div>
                <div className="px-4 flex items-center">
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="border-none bg-transparent outline-none text-gray-700 py-2 pr-8"
                    >
                        <option value="all">All</option>
                        <option value="creditors">Creditors</option>
                    </select>
                </div>
                {searchQuery && (
                    <button
                        className="pr-4"
                        onClick={() => setSearchQuery('')}
                    >
                        <i className="ph ph-x text-gray-500" />
                    </button>
                )}
            </div>
        );
    };

    // "No Customers" empty state component
    const NoCustomers = () => (
        <div className="text-center py-10">
            <div className="mb-4">
                <i className="ph ph-users text-5xl text-gray-300" />
            </div>
            <h3 className="text-xl font-medium text-gray-500">No Customers yet.</h3>
        </div>
    );

    // Context menu for customer actions
    const ContextMenu = () => (
        <div className="relative">
            <button
                className="p-2 rounded-full"
                onClick={() => document.getElementById('customer-actions-menu').classList.toggle('hidden')}
            >
                <i className="ph ph-dots-three-vertical text-gray-700" />
            </button>
            <div id="customer-actions-menu" className="absolute right-0 mt-2 z-10 hidden bg-white rounded-lg shadow-lg overflow-hidden w-40">
                <ul className="py-1">
                    <li>
                        <button
                            onClick={() => {
                                document.getElementById('customer-actions-menu').classList.add('hidden');
                                addCustomer();
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center"
                        >
                            <i className="ph ph-user-plus mr-2 text-gray-500" />
                            <span>New customer</span>
                        </button>
                    </li>
                    <li>
                        <button
                            onClick={() => {
                                document.getElementById('customer-actions-menu').classList.add('hidden');
                                importCustomers();
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center"
                        >
                            <i className="ph ph-upload-simple mr-2 text-gray-500" />
                            <span>Import customers</span>
                        </button>
                    </li>
                    <li>
                        <button
                            onClick={() => {
                                document.getElementById('customer-actions-menu').classList.add('hidden');
                                exportAll();
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center"
                        >
                            <i className="ph ph-download-simple mr-2 text-gray-500" />
                            <span>Export CSV</span>
                        </button>
                    </li>
                </ul>
            </div>
        </div>
    );

    // Show success dialog after import
    const showImportSuccessDialog = (fileCount) => {
        if (window.ModalManager) {
            const modal = window.ModalManager.createCenterModal({
                id: 'import-success-modal',
                title: `${fileCount} File(s) Uploaded`,
                content: `
                    <div class="text-center py-2">
                        <div class="flex justify-center mb-4">
                            <i class="ph ph-check-circle text-5xl text-green-500"></i>
                        </div>
                        <p class="text-gray-600 mb-4">We will inform you in app notification after your customers are added.</p>
                    </div>
                `,
                actions: `<button class="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium rounded-lg transition-colors" id="import-success-ok">Done</button>`,
                size: 'sm',
                onShown: (modalControl) => {
                    document.getElementById('import-success-ok').addEventListener('click', () => {
                        modalControl.close();
                    });
                }
            });
        } else {
            // Fallback to original implementation
            // Create the modal container if it doesn't exist
            let modalContainer = document.getElementById('import-success-modal');
            if (!modalContainer) {
                modalContainer = document.createElement('div');
                modalContainer.id = 'import-success-modal';
                document.body.appendChild(modalContainer);
            }

            // Create a simple modal using vanilla JS
            modalContainer.innerHTML = `
                <div class="fixed inset-0 z-50 flex items-center justify-center">
                    <div class="fixed inset-0 bg-black bg-opacity-50"></div>
                    <div class="bg-white w-full max-w-sm rounded-xl shadow-lg overflow-hidden relative z-10 p-6">
                        <div class="text-center">
                            <div class="flex justify-center mb-4">
                                <i class="ph ph-check-circle text-5xl text-green-500"></i>
                            </div>
                            <h3 class="text-xl font-medium mb-2">${fileCount} File(s) Uploaded</h3>
                            <p class="text-gray-600 mb-4">We will inform you in app notification after your customers are added.</p>
                            <button class="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium rounded-lg transition-colors" onclick="document.getElementById('import-success-modal').remove()">
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }
    };

    // Handle showing toast notifications
    const showToast = (message, type = "success") => {
        // Create toast container if it doesn't exist
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.className = 'fixed bottom-4 right-4 z-50';
            document.body.appendChild(toastContainer);
        }

        // Create toast element
        const toast = document.createElement('div');
        toast.className = `p-3 rounded-lg shadow-lg mb-2 flex items-center ${type === 'success' ? 'bg-green-50 text-green-800 border border-green-100' : 'bg-red-50 text-red-800 border border-red-100'}`;
        toast.innerHTML = `
            <i class="ph ${type === 'success' ? 'ph-check-circle' : 'ph-x-circle'} mr-2"></i>
            <span>${message}</span>
        `;

        // Add to container and set timeout to remove
        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.remove();
            if (toastContainer.children.length === 0) {
                toastContainer.remove();
            }
        }, 3000);
    };

    // Add Customer Modal component
    const AddCustomerModal = () => {
        const [formData, setFormData] = React.useState({ name: '', phone: '' });
        const [submitting, setSubmitting] = React.useState(false);

        const handleSubmit = async (e) => {
            e.preventDefault();
            if (!formData.name || !formData.phone) return;

            try {
                setSubmitting(true);

                // Generate an ID using phone and timestamp
                const id = `${formData.phone.replace(/\s/g, '')}_${Date.now()}`;

                await sdk.collection("Customers").doc(id).set({
                    name: formData.name,
                    phone: formData.phone,
                    date: new Date(),
                    balance: 0,
                    totalSpent: 0
                });

                setSubmitting(false);
                setIsAddCustomerModalOpen(false);
                showToast("Customer added successfully");
                fetchCustomers(); // Refresh the list
            } catch (error) {
                console.error("Error adding customer:", error);
                showToast("Failed to add customer", "error");
                setSubmitting(false);
            }
        };

        // Use ModalManager if available
        if (window.ModalManager && isAddCustomerModalOpen) {
            React.useEffect(() => {
                const modal = window.ModalManager.createCenterModal({
                    id: 'add-customer-modal',
                    title: 'Add New Customer',
                    content: `
                        <form id="add-customer-form" class="p-2">
                            <div class="mb-6">
                                <div class="flex justify-center mb-6">
                                    <div class="bg-gray-100 rounded-full p-4">
                                        <i class="ph ph-user-plus text-4xl text-gray-500"></i>
                                    </div>
                                </div>
                                
                                <div class="mb-4">
                                    <label class="block text-gray-700 mb-2 text-sm font-medium">Name</label>
                                    <div class="relative">
                                        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <i class="ph ph-user text-gray-400"></i>
                                        </div>
                                        <input
                                            type="text"
                                            id="customer-name-input"
                                            class="w-full py-2.5 pl-10 pr-3 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                                            placeholder="Customer name"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label class="block text-gray-700 mb-2 text-sm font-medium">Phone</label>
                                    <div class="relative">
                                        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <i class="ph ph-phone text-gray-400"></i>
                                        </div>
                                        <input
                                            type="tel"
                                            id="customer-phone-input"
                                            class="w-full py-2.5 pl-10 pr-3 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                                            placeholder="Phone number"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>
                        </form>
                    `,
                    actions: `
                        <div class="flex space-x-3">
                            <button 
                                type="button" 
                                id="cancel-customer-btn" 
                                class="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium rounded-md transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                id="submit-customer-btn"
                                class="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-md transition-colors"
                            >
                                Add Customer
                            </button>
                        </div>
                    `,
                    size: 'md',
                    onShown: (modalControl) => {
                        const nameInput = document.getElementById('customer-name-input');
                        const phoneInput = document.getElementById('customer-phone-input');
                        const submitBtn = document.getElementById('submit-customer-btn');
                        const cancelBtn = document.getElementById('cancel-customer-btn');

                        cancelBtn.addEventListener('click', () => {
                            modalControl.close();
                        });

                        submitBtn.addEventListener('click', async () => {
                            if (!nameInput.value || !phoneInput.value) return;

                            try {
                                submitBtn.disabled = true;
                                submitBtn.innerHTML = `<div class="flex justify-center items-center">
                                    <div class="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                                    Adding...
                                </div>`;

                                // Generate an ID using phone and timestamp
                                const id = `${phoneInput.value.replace(/\s/g, '')}_${Date.now()}`;

                                await sdk.collection("Customers").doc(id).set({
                                    name: nameInput.value,
                                    phone: phoneInput.value,
                                    date: new Date(),
                                    balance: 0,
                                    totalSpent: 0
                                });

                                modalControl.close();
                                window.ModalManager.showToast("Customer added successfully");
                                fetchCustomers(); // Refresh the list
                            } catch (error) {
                                console.error("Error adding customer:", error);
                                window.ModalManager.showToast("Failed to add customer", { type: "error" });
                                submitBtn.disabled = false;
                                submitBtn.textContent = "Add Customer";
                            }
                        });

                        // Focus the name input
                        nameInput.focus();
                    },
                    onClose: () => {
                        setIsAddCustomerModalOpen(false);
                    }
                });

                return () => {
                    // Clean up
                    if (modal && modal.close) {
                        modal.close();
                    }
                };
            }, [isAddCustomerModalOpen]);

            // The modal is created via useEffect, so return null here
            return null;
        }

        // Fallback to original implementation if ModalManager is not available
        return (
            <div className={`fixed inset-0 z-50 flex items-center justify-center ${isAddCustomerModalOpen ? 'visible' : 'invisible'}`}>
                <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setIsAddCustomerModalOpen(false)}></div>
                <div className="bg-white w-full max-w-md rounded-xl shadow-lg overflow-hidden relative z-10">
                    <div className="p-5">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-medium text-gray-800">Add New Customer</h3>
                            <button onClick={() => setIsAddCustomerModalOpen(false)} className="text-gray-500 hover:text-gray-700">
                                <i className="ph ph-x text-xl" />
                            </button>
                        </div>

                        <div className="flex justify-center mb-6">
                            <div className="bg-gray-100 rounded-full p-4">
                                <i className="ph ph-user-plus text-4xl text-gray-500"></i>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="mb-4">
                                <label className="block text-gray-700 mb-2 text-sm font-medium">Name</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <i className="ph ph-user text-gray-400"></i>
                                    </div>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full py-2.5 pl-10 pr-3 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                                        placeholder="Customer name"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="mb-6">
                                <label className="block text-gray-700 mb-2 text-sm font-medium">Phone</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <i className="ph ph-phone text-gray-400"></i>
                                    </div>
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        className="w-full py-2.5 pl-10 pr-3 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                                        placeholder="Phone number"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="flex space-x-3">
                                <button
                                    type="button"
                                    onClick={() => setIsAddCustomerModalOpen(false)}
                                    className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium rounded-md transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-md transition-colors disabled:opacity-70"
                                >
                                    {submitting ? (
                                        <div className="flex justify-center items-center">
                                            <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                                            Adding...
                                        </div>
                                    ) : 'Add Customer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        );
    };

    // Import Customers Modal component
    const ImportCustomersModal = () => {
        const [uploading, setUploading] = React.useState(false);

        const handleFileUpload = async (e) => {
            const files = e.target.files;
            if (!files || files.length === 0) {
                showToast("No files selected", "error");
                return;
            }

            try {
                setUploading(true);

                // In real implementation, you would upload these files to your server
                // for processing. For now, we'll simulate a successful upload.

                setTimeout(() => {
                    setUploading(false);
                    setIsImportModalOpen(false);

                    // Show success dialog
                    showImportSuccessDialog(files.length);
                }, 2000);
            } catch (error) {
                console.error("Error uploading files:", error);
                showToast("Failed to upload files", "error");
                setUploading(false);
            }
        };

        // Use ModalManager if available
        if (window.ModalManager && isImportModalOpen) {
            React.useEffect(() => {
                const modal = window.ModalManager.createCenterModal({
                    id: 'import-customers-modal',
                    title: 'Import Customers',
                    content: `
                        <div class="text-center p-2">
                            <div class="mb-6 flex justify-center">
                                <div class="bg-blue-50 rounded-full p-5">
                                    <i class="ph ph-users-three text-5xl text-blue-500"></i>
                                </div>
                            </div>
                            <div class="text-left mb-6">
                                <div class="flex items-start mb-3">
                                    <div class="bg-gray-100 rounded-full p-1 mr-3 mt-0.5">
                                        <span class="flex items-center justify-center w-5 h-5 text-xs text-gray-700 font-medium">1</span>
                                    </div>
                                    <p class="text-gray-600">Upload your customers pdf/image file here.</p>
                                </div>
                                <div class="flex items-start mb-3">
                                    <div class="bg-gray-100 rounded-full p-1 mr-3 mt-0.5">
                                        <span class="flex items-center justify-center w-5 h-5 text-xs text-gray-700 font-medium">2</span>
                                    </div>
                                    <p class="text-gray-600">After all customers are added we will inform you in app notification.</p>
                                </div>
                                <div class="flex items-start">
                                    <div class="bg-gray-100 rounded-full p-1 mr-3 mt-0.5">
                                        <span class="flex items-center justify-center w-5 h-5 text-xs text-gray-700 font-medium">3</span>
                                    </div>
                                    <p class="text-gray-600">Under 5 minutes your new customers will be added to your CRM.</p>
                                </div>
                            </div>
                            <div class="border border-dashed border-gray-300 rounded-lg p-4 bg-gray-50 mb-4">
                                <label id="upload-files-btn" class="block w-full py-3 px-6 bg-gray-800 text-white rounded-md cursor-pointer hover:bg-gray-700 transition-colors">
                                    <i class="ph ph-file-arrow-up mr-2"></i>
                                    Choose Files
                                    <input type="file" class="hidden" id="customer-files-input" accept=".jpg,.jpeg,.png,.pdf,.csv,.xlsx,.xls" multiple>
                                </label>
                                <p class="text-xs text-gray-500 mt-2">Supported formats: PDF, CSV, Excel, Images</p>
                            </div>
                        </div>
                    `,
                    actions: `
                        <button 
                            type="button" 
                            id="cancel-import-btn" 
                            class="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium rounded-md transition-colors"
                        >
                            Cancel
                        </button>
                    `,
                    size: 'md',
                    onShown: (modalControl) => {
                        const fileInput = document.getElementById('customer-files-input');
                        const uploadBtn = document.getElementById('upload-files-btn');
                        const cancelBtn = document.getElementById('cancel-import-btn');

                        cancelBtn.addEventListener('click', () => {
                            modalControl.close();
                        });

                        fileInput.addEventListener('change', async (e) => {
                            const files = e.target.files;
                            if (!files || files.length === 0) {
                                window.ModalManager.showToast("No files selected", { type: "error" });
                                return;
                            }

                            try {
                                // Show uploading state
                                uploadBtn.classList.add('opacity-70');
                                uploadBtn.classList.remove('hover:bg-gray-700');
                                uploadBtn.innerHTML = `
                                    <div class="flex justify-center items-center">
                                        <div class="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                                        Uploading...
                                    </div>
                                `;
                                uploadBtn.style.pointerEvents = 'none';

                                // Simulate upload
                                setTimeout(() => {
                                    modalControl.close();
                                    showImportSuccessDialog(files.length);
                                }, 2000);
                            } catch (error) {
                                console.error("Error uploading files:", error);
                                window.ModalManager.showToast("Failed to upload files", { type: "error" });
                                uploadBtn.classList.remove('opacity-70');
                                uploadBtn.classList.add('hover:bg-gray-700');
                                uploadBtn.innerHTML = `<i class="ph ph-file-arrow-up mr-2"></i> Choose Files`;
                                uploadBtn.style.pointerEvents = 'auto';
                            }
                        });
                    },
                    onClose: () => {
                        setIsImportModalOpen(false);
                    }
                });

                return () => {
                    // Clean up
                    if (modal && modal.close) {
                        modal.close();
                    }
                };
            }, [isImportModalOpen]);

            // The modal is created via useEffect, so return null here
            return null;
        }

        // Fallback to original implementation if ModalManager is not available
        return (
            <div className={`fixed inset-0 z-50 flex items-center justify-center ${isImportModalOpen ? 'visible' : 'invisible'}`}>
                <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setIsImportModalOpen(false)}></div>
                <div className="bg-white w-full max-w-md rounded-xl shadow-lg overflow-hidden relative z-10 p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-medium text-gray-800">Import Customers</h3>
                        <button onClick={() => setIsImportModalOpen(false)} className="text-gray-500 hover:text-gray-700">
                            <i className="ph ph-x text-xl" />
                        </button>
                    </div>

                    <div className="mb-6 flex justify-center">
                        <div className="bg-blue-50 rounded-full p-5">
                            <i className="ph ph-users-three text-5xl text-blue-500"></i>
                        </div>
                    </div>

                    <div className="text-left mb-6">
                        <div className="flex items-start mb-3">
                            <div className="bg-gray-100 rounded-full p-1 mr-3 mt-0.5">
                                <span className="flex items-center justify-center w-5 h-5 text-xs text-gray-700 font-medium">1</span>
                            </div>
                            <p className="text-gray-600">Upload your customers pdf/image file here.</p>
                        </div>
                        <div className="flex items-start mb-3">
                            <div className="bg-gray-100 rounded-full p-1 mr-3 mt-0.5">
                                <span className="flex items-center justify-center w-5 h-5 text-xs text-gray-700 font-medium">2</span>
                            </div>
                            <p className="text-gray-600">After all customers are added we will inform you in app notification.</p>
                        </div>
                        <div className="flex items-start">
                            <div className="bg-gray-100 rounded-full p-1 mr-3 mt-0.5">
                                <span className="flex items-center justify-center w-5 h-5 text-xs text-gray-700 font-medium">3</span>
                            </div>
                            <p className="text-gray-600">Under 5 minutes your new customers will be added to your CRM.</p>
                        </div>
                    </div>

                    <div className="border border-dashed border-gray-300 rounded-lg p-4 bg-gray-50 mb-4">
                        <label className={`block w-full py-3 px-6 bg-gray-800 text-white rounded-md cursor-pointer transition-colors ${uploading ? 'opacity-70' : 'hover:bg-gray-700'}`}>
                            {uploading ? (
                                <div className="flex justify-center items-center">
                                    <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                                    Uploading...
                                </div>
                            ) : (
                                <>
                                    <i className="ph ph-file-arrow-up mr-2"></i>
                                    Choose Files
                                </>
                            )}
                            <input
                                type="file"
                                className="hidden"
                                accept=".jpg,.jpeg,.png,.pdf,.csv,.xlsx,.xls"
                                multiple
                                onChange={handleFileUpload}
                                disabled={uploading}
                            />
                        </label>
                        <p className="text-xs text-gray-500 mt-2 text-center">Supported formats: PDF, CSV, Excel, Images</p>
                    </div>

                    <button
                        type="button"
                        onClick={() => setIsImportModalOpen(false)}
                        className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium rounded-md transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        );
    };

    // Main render
    if (loading) {
        return (
            <div className="p-4 text-center">
                <div className="animate-spin inline-block w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 text-center text-red-600">{error}</div>
        );
    }

    if (!customerCardLoaded) {
        return (
            <div className="p-4 text-center">
                <div>Loading customer components...</div>
                <div className="animate-spin inline-block w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full mt-2" />
            </div>
        );
    }

    // Render the CustomerCard component for each filtered customer
    const renderCustomerCard = (customer) => {
        return window.CustomerCard ? (
            <window.CustomerCard key={customer.id} customer={customer} />
        ) : (
            <div key={customer.id} className="p-3 border border-gray-200 rounded-lg mb-2">
                Loading customer component...
            </div>
        );
    };

    return (
        <div className="bg-gray-50 min-h-screen">
            {/* Content */}
            <div className="p-4">
                <SearchBar />

                {/* Customer List */}
                {customers.length === 0 ? (
                    <NoCustomers />
                ) : (
                    <div className="mt-2">
                        {filteredCustomers.map(customer => renderCustomerCard(customer))}
                    </div>
                )}
            </div>

            {/* Modals */}
            <AddCustomerModal />
            <ImportCustomersModal />
        </div>
    );
}
