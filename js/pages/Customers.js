// Customers Component
function Customers() {
    const [customers, setCustomers] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [filterType, setFilterType] = React.useState('all'); // 'all', 'creditors'
    const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = React.useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = React.useState(false);

    // Expose refreshCustomers function globally so it can be called from components
    window.refreshCustomers = fetchCustomers;

    React.useEffect(() => {
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

        return (
            <div className={`fixed inset-0 z-50 flex items-end justify-center ${isAddCustomerModalOpen ? 'visible' : 'invisible'}`}>
                <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setIsAddCustomerModalOpen(false)}></div>
                <div className="bg-white w-full max-w-md rounded-t-xl shadow-lg overflow-hidden relative z-10">
                    <div className="p-4">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-medium">Add New Customer</h3>
                            <button onClick={() => setIsAddCustomerModalOpen(false)} className="text-gray-500">
                                <i className="ph ph-x text-xl" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="mb-4">
                                <label className="block text-gray-700 mb-1">Name</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                                    placeholder="Customer name"
                                    required
                                />
                            </div>

                            <div className="mb-6">
                                <label className="block text-gray-700 mb-1">Phone</label>
                                <div className="flex">
                                    <div className="bg-gray-100 border border-gray-300 border-r-0 rounded-l-md px-3 flex items-center">
                                        <span className="text-gray-500">+</span>
                                    </div>
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        className="flex-1 p-2 border border-gray-300 rounded-r-md focus:outline-none focus:ring-2 focus:ring-red-500"
                                        placeholder="Phone number"
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full bg-red-500 hover:bg-red-600 text-white font-medium py-3 rounded-md transition-colors disabled:opacity-70"
                            >
                                {submitting ? (
                                    <div className="flex justify-center items-center">
                                        <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                                        Adding...
                                    </div>
                                ) : 'Add Customer'}
                            </button>
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

        return (
            <div className={`fixed inset-0 z-50 flex items-center justify-center ${isImportModalOpen ? 'visible' : 'invisible'}`}>
                <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setIsImportModalOpen(false)}></div>
                <div className="bg-white w-full max-w-md rounded-xl shadow-lg overflow-hidden relative z-10 p-6">
                    <div className="text-center">
                        <h3 className="text-xl font-medium mb-2">Import Customers</h3>
                        <div className="border-b mb-4"></div>

                        <div className="mb-4 flex justify-center">
                            <i className="ph ph-cloud-arrow-up text-6xl text-red-200" />
                        </div>

                        <div className="text-left text-gray-600 mb-6">
                            <p className="mb-2">1. Upload your customers pdf/image file here.</p>
                            <p className="mb-2">2. After all customers are added we will inform you in app notification.</p>
                            <p className="mb-2">3. Under 5 minutes your new customers will be added to your CRM.</p>
                        </div>

                        <label className={`block w-full py-4 px-6 bg-red-500 text-white rounded-lg cursor-pointer transition-colors ${uploading ? 'opacity-70' : 'hover:bg-red-600'}`}>
                            {uploading ? (
                                <div className="flex justify-center items-center">
                                    <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                                    Uploading...
                                </div>
                            ) : (
                                <>
                                    <i className="ph ph-upload-simple mr-2"></i>
                                    Choose Files
                                </>
                            )}
                            <input
                                type="file"
                                className="hidden"
                                accept=".jpg,.jpeg,.png,.pdf"
                                multiple
                                onChange={handleFileUpload}
                                disabled={uploading}
                            />
                        </label>
                    </div>
                </div>
            </div>
        );
    };

    // Show success dialog after import
    const showImportSuccessDialog = (fileCount) => {
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
                    <h3 class="text-xl font-medium mb-2">${fileCount} File(s) Uploaded</h3>
                    <p class="text-gray-600 mb-4">We will inform you in app notification after your customers are added.</p>
                    <button class="w-full py-3 bg-red-500 text-white rounded-lg" onclick="document.getElementById('import-success-modal').remove()">
                        OK
                    </button>
                </div>
            </div>
        `;
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
        toast.className = `p-3 rounded-lg shadow-lg mb-2 flex items-center ${type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`;
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

    return (
        <div className="bg-gray-50 min-h-screen">
            {/* Header */}
            <div className="flex justify-between items-center p-4 bg-white border-b">
                <button className="w-8 h-8 flex items-center justify-center" onClick={() => window.history.back()}>
                    <i className="ph ph-arrow-left text-xl" />
                </button>
                <h1 className="text-xl font-medium">Customers</h1>
                <ContextMenu />
            </div>

            {/* Content */}
            <div className="p-4">
                <SearchBar />

                {/* Customer List */}
                {customers.length === 0 ? (
                    <NoCustomers />
                ) : (
                    <div className="mt-2">
                        {filteredCustomers.map(customer => (
                            <CustomerCard key={customer.id} customer={customer} />
                        ))}
                    </div>
                )}
            </div>

            {/* Modals */}
            <AddCustomerModal />
            <ImportCustomersModal />
        </div>
    );
} 