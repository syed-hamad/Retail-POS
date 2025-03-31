// Customers Component
function Customers() {
    const [customers, setCustomers] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [filterType, setFilterType] = React.useState('all'); // 'all', 'regular', 'creditors'
    const [sortBy, setSortBy] = React.useState('recent'); // 'recent', 'spent'
    const [showAddCustomerForm, setShowAddCustomerForm] = React.useState(false);
    const [showDepositForm, setShowDepositForm] = React.useState(false);
    const [selectedCustomer, setSelectedCustomer] = React.useState(null);

    React.useEffect(() => {
        async function fetchCustomers() {
            try {
                // Fetch customers from SDK
                const customersSnapshot = await sdk.collection("Customers")
                    .orderBy("lastOrderDate", "desc")
                    .limit(100)
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
        }

        fetchCustomers();
    }, []);

    // Filter and sort customers
    const filteredCustomers = React.useMemo(() => {
        return customers
            .filter(customer => {
                // Search filter
                const matchesSearch = (customer?.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                    (customer?.phone || '').includes(searchQuery);

                // Type filter
                const matchesType = filterType === 'all' ||
                    (filterType === 'creditors' && (customer?.walletBalance || 0) < 0);

                return matchesSearch && matchesType;
            })
            .sort((a, b) => {
                switch (sortBy) {
                    case 'spent':
                        return (b?.totalSpent || 0) - (a?.totalSpent || 0);
                    default: // 'recent'
                        return new Date(b?.lastOrderDate || 0) - new Date(a?.lastOrderDate || 0);
                }
            });
    }, [customers, searchQuery, filterType, sortBy]);

    const handleAddCustomer = async (customerData) => {
        try {
            const customerId = `${customerData.phone.replaceAll(" ", "")}_${sdk.getCurrentUser().id}`;

            await sdk.collection("Customers").doc(customerId).set({
                name: customerData.name,
                phone: customerData.phone,
                date: new Date(),
                walletBalance: 0,
                totalSpent: 0
            });

            // Refresh customer list
            const updatedCustomers = [...customers, {
                id: customerId,
                name: customerData.name,
                phone: customerData.phone,
                date: new Date(),
                walletBalance: 0,
                totalSpent: 0
            }];

            setCustomers(updatedCustomers);
            setShowAddCustomerForm(false);
            showToast("Customer added successfully");
        } catch (error) {
            console.error("Error adding customer:", error);
            showToast("Failed to add customer", "error");
        }
    };

    // Header with back button and menu
    const Header = () => {
        return (
            <div className="flex items-center justify-between px-4 py-3 border-b">
                <div className="flex items-center gap-2">
                    <button
                        className="p-1 rounded-full hover:bg-gray-100"
                        onClick={() => window.history.back()}
                    >
                        <i className="ph ph-arrow-left text-lg"></i>
                    </button>
                    <h1 className="text-xl font-semibold">Customers</h1>
                </div>
                <div className="relative">
                    <button
                        className="p-1 rounded-full hover:bg-gray-100"
                        onClick={() => document.getElementById('customerMenu').classList.toggle('hidden')}
                    >
                        <i className="ph ph-dots-three-vertical text-lg"></i>
                    </button>
                    <div id="customerMenu" className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 hidden">
                        <ul className="py-1">
                            <li>
                                <button
                                    className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2"
                                    onClick={() => setShowAddCustomerForm(true)}
                                >
                                    <i className="ph ph-user-plus"></i>
                                    <span>New customer</span>
                                </button>
                            </li>
                            <li>
                                <button
                                    className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2"
                                    onClick={() => {/* Handle import */ }}
                                >
                                    <i className="ph ph-upload"></i>
                                    <span>Import customers</span>
                                </button>
                            </li>
                            <li>
                                <button
                                    className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2"
                                    onClick={() => {/* Handle export */ }}
                                >
                                    <i className="ph ph-file-csv"></i>
                                    <span>Export CSV</span>
                                </button>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        );
    };

    // Search Bar Component - updated to match the UI in the screenshot
    const SearchBar = () => {
        return (
            <div className="p-4 bg-gray-50">
                <div className="relative">
                    <i className="ph ph-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search customers"
                        className="w-full pl-10 pr-20 py-3 rounded-full border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="border-none bg-transparent focus:outline-none text-sm mr-1"
                        >
                            <option value="all">All</option>
                            <option value="creditors">Creditors</option>
                        </select>
                        {searchQuery && (
                            <button
                                className="p-1 text-gray-500"
                                onClick={() => setSearchQuery('')}
                            >
                                <i className="ph ph-x text-lg"></i>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // Customer List Item Component
    const CustomerListItem = ({ customer }) => {
        const customerName = customer?.name || 'Unknown';
        const customerPhone = customer?.phone || '';
        const lastOrderDate = customer?.lastOrderDate ?
            new Date(customer.lastOrderDate).toLocaleDateString() : 'N/A';
        const totalSpent = customer?.totalSpent || 0;
        const walletBalance = customer?.walletBalance || 0;

        // Format the "time ago" text
        const getTimeAgo = (date) => {
            if (!date) return 'N/A';

            const now = new Date();
            const orderDate = new Date(date);
            const diffInDays = Math.floor((now - orderDate) / (1000 * 60 * 60 * 24));

            if (diffInDays === 0) return 'Today';
            if (diffInDays === 1) return 'Yesterday';
            if (diffInDays < 30) return `${diffInDays} days ago`;
            if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`;
            return `${Math.floor(diffInDays / 365)} years ago`;
        };

        const handleCustomerSelect = () => {
            setSelectedCustomer(customer);
            // In the future, navigate to customer details page
        };

        return (
            <div className="bg-white p-4 border-b" onClick={handleCustomerSelect}>
                <div className="flex">
                    <div className="w-16 flex flex-col items-center mr-4">
                        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center mb-2">
                            <i className="ph ph-user text-gray-500 text-2xl"></i>
                        </div>
                        <div className="flex items-center text-sm">
                            <i className="ph ph-wallet text-xs mr-1"></i>
                            <span className={walletBalance < 0 ? 'text-red-500' : 'text-green-500'}>
                                ₹{walletBalance}
                            </span>
                        </div>
                    </div>

                    <div className="flex-1">
                        <div className="font-medium text-lg text-blue-900">{customerName}</div>
                        <div className="text-gray-500 text-sm">{customerPhone}</div>

                        <div className="mt-3 flex items-center">
                            <div className="flex items-center text-gray-500 text-xs mr-4">
                                <i className="ph ph-clock text-xs mr-1"></i>
                                <span>{getTimeAgo(customer?.lastOrderDate)}</span>
                            </div>

                            <div className="flex items-center justify-between flex-1">
                                <span className="text-xs text-gray-500">Spent:</span>
                                <span className="text-xs font-medium">₹{totalSpent}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // Add Customer Form
    const AddCustomerForm = () => {
        const [name, setName] = React.useState('');
        const [phone, setPhone] = React.useState('');
        const [isSubmitting, setIsSubmitting] = React.useState(false);

        const handleSubmit = async (e) => {
            e.preventDefault();

            if (!name.trim() || !phone.trim()) {
                showToast("Please fill all fields", "error");
                return;
            }

            setIsSubmitting(true);

            try {
                await handleAddCustomer({ name, phone });
            } finally {
                setIsSubmitting(false);
            }
        };

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50">
                <div className="bg-white rounded-t-xl w-full max-w-md p-4">
                    <h2 className="text-xl font-semibold mb-4">Add New Customer</h2>

                    <form onSubmit={handleSubmit}>
                        <div className="mb-4">
                            <label className="block text-gray-700 mb-2">Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full p-2 border rounded-lg"
                                placeholder="Customer name"
                            />
                        </div>

                        <div className="mb-6">
                            <label className="block text-gray-700 mb-2">Phone</label>
                            <div className="flex">
                                <span className="bg-gray-100 py-2 px-3 rounded-l-lg border-y border-l">+</span>
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="w-full p-2 border rounded-r-lg"
                                    placeholder="Phone number"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setShowAddCustomerForm(false)}
                                className="flex-1 p-3 border rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex-1 p-3 bg-blue-600 text-white rounded-lg"
                            >
                                {isSubmitting ? 'Adding...' : 'Add Customer'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    };

    // Deposit Balance Form
    const DepositBalanceForm = () => {
        const [amount, setAmount] = React.useState('');
        const [paymentMode, setPaymentMode] = React.useState('CASH'); // 'CASH' or 'DIGITAL'
        const [isSubmitting, setIsSubmitting] = React.useState(false);

        const handleSubmit = async (e) => {
            e.preventDefault();

            if (!amount || parseInt(amount) <= 0) {
                showToast("Please enter a valid amount", "error");
                return;
            }

            setIsSubmitting(true);

            try {
                // Add to wallet collection
                await sdk.collection("Wallet").add({
                    amount: parseInt(amount),
                    mode: paymentMode,
                    customerId: selectedCustomer.id,
                    sellerId: sdk.getCurrentUser().id,
                    date: new Date()
                });

                // Update the customer balance in the UI
                const updatedCustomers = customers.map(c => {
                    if (c.id === selectedCustomer.id) {
                        return {
                            ...c,
                            walletBalance: (c.walletBalance || 0) + parseInt(amount)
                        };
                    }
                    return c;
                });

                setCustomers(updatedCustomers);
                setShowDepositForm(false);
                setSelectedCustomer(null);
                showToast("Balance added successfully");
            } catch (error) {
                console.error("Error adding balance:", error);
                showToast("Failed to add balance", "error");
            } finally {
                setIsSubmitting(false);
            }
        };

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg w-full max-w-md p-4 m-4">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold">Add Balance</h2>
                        <button
                            onClick={() => setShowDepositForm(false)}
                            className="p-1 rounded-full hover:bg-gray-100"
                        >
                            <i className="ph ph-x text-lg"></i>
                        </button>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="mb-4">
                            <label className="block text-gray-700 mb-2">Amount</label>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="w-full p-3 border rounded-lg"
                                placeholder="Enter amount"
                                autoFocus
                            />
                        </div>

                        <div className="mb-6">
                            <label className="block text-gray-700 mb-2">Payment Mode</label>
                            <div className="flex border rounded-lg overflow-hidden">
                                <button
                                    type="button"
                                    className={`flex-1 py-3 ${paymentMode === 'CASH' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
                                    onClick={() => setPaymentMode('CASH')}
                                >
                                    Cash
                                </button>
                                <button
                                    type="button"
                                    className={`flex-1 py-3 ${paymentMode === 'DIGITAL' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
                                    onClick={() => setPaymentMode('DIGITAL')}
                                >
                                    UPI
                                </button>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setShowDepositForm(false)}
                                className="flex-1 p-3 border rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex-1 p-3 bg-blue-600 text-white rounded-lg"
                            >
                                {isSubmitting ? 'Processing...' : 'Confirm'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    };

    // No Customers Found
    const EmptyState = () => (
        <div className="flex flex-col items-center justify-center p-8">
            <i className="ph ph-users text-5xl text-gray-300 mb-4"></i>
            <p className="text-xl text-gray-500 text-center">No Customers yet.</p>
        </div>
    );

    if (loading) {
        return (
            <div className="p-4 h-screen flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 text-center text-red-600">{error}</div>
        );
    }

    return (
        <div className="h-screen flex flex-col bg-gray-50">
            <Header />
            <SearchBar />

            <div className="flex-1 overflow-auto">
                {filteredCustomers.length === 0 ? (
                    <EmptyState />
                ) : (
                    filteredCustomers.map(customer => (
                        <CustomerListItem
                            key={customer.id}
                            customer={customer}
                        />
                    ))
                )}
            </div>

            {showAddCustomerForm && <AddCustomerForm />}
            {showDepositForm && <DepositBalanceForm />}
        </div>
    );
} 