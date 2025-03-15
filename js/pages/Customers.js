// Customers Component
function Customers() {
    const [customers, setCustomers] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [filterType, setFilterType] = React.useState('all'); // 'all', 'regular', 'new'
    const [sortBy, setSortBy] = React.useState('recent'); // 'recent', 'orders', 'spent'

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
                    (filterType === 'regular' && customer?.totalSpent > 0) ||
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

    // Stats Cards
    const StatsSection = () => {
        const stats = React.useMemo(() => ({
            total: customers.length,
            regular: customers.filter(c => c.totalSpent > 0).length,
            creditors: customers.filter(c => (c?.walletBalance || 0) < 0).length
        }), [customers]);

        return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <div className="card p-3">
                    <p className="text-gray-500 text-xs">Total Customers</p>
                    <h3 className="text-lg font-semibold mt-1">{stats.total}</h3>
                </div>
                <div className="card p-3">
                    <p className="text-gray-500 text-xs">Regular</p>
                    <h3 className="text-lg font-semibold mt-1">{stats.regular}</h3>
                </div>
                <div className="card p-3">
                    <p className="text-gray-500 text-xs">Creditors</p>
                    <h3 className="text-lg font-semibold mt-1">{stats.creditors}</h3>
                </div>
            </div>
        );
    };

    // Creditors Section Component
    const CreditorsSection = () => {
        const creditors = React.useMemo(() =>
            customers.filter(c => (c?.walletBalance || 0) < 0)
            , [customers]);

        const totalCredit = creditors.reduce((sum, c) => sum + (c?.walletBalance || 0), 0);

        // Only render if there are creditors
        if (creditors.length === 0 || totalCredit >= 0) return null;

        return (
            <div className="mb-6">
                {/* Credit Overview */}
                <div className="bg-red-50 border border-red-100 rounded-lg p-4 mb-4">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="text-red-800 font-medium text-lg">Total Outstanding</h3>
                            <p className="text-red-600 text-sm mt-1">
                                {creditors.length} customers with pending credit
                            </p>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-semibold text-red-800">
                                ₹{Math.abs(totalCredit).toLocaleString()}
                            </div>
                            <button
                                className="text-sm font-medium text-red-800 hover:text-red-900 transition-colors flex items-center gap-1 mt-2"
                                onClick={() => {
                                    setFilterType('creditors');
                                    document.getElementById('customerList')?.scrollIntoView({ behavior: 'smooth' });
                                }}
                            >
                                View All
                                <i className="ph ph-arrow-right" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Creditors List */}
                {creditors.length > 0 && (
                    <div className="space-y-3">
                        {creditors.map(customer => (
                            <div key={customer.id} className="card p-3 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-red-100 flex-shrink-0 flex items-center justify-center text-red-600 font-medium">
                                        {(customer?.name || 'Unknown').charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h4 className="font-medium">{customer?.name || 'Unknown'}</h4>
                                        <p className="text-gray-500 text-sm">{customer?.phone || 'No phone'}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-red-600 font-medium">
                                        ₹{Math.abs(customer?.walletBalance || 0).toLocaleString()}
                                    </p>
                                    <button
                                        className="text-sm text-blue-600 hover:text-blue-700 mt-1"
                                        onClick={() => { }} // Handle credit settlement
                                    >
                                        Settle
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    // Search Bar Component
    const SearchBar = () => {
        return (
            <div className="flex items-center gap-4 mb-6 bg-white p-4 rounded-lg shadow-sm">
                {/* Search Input */}
                <div className="flex-1 relative">
                    <i className="ph ph-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search customers by name or phone..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>
                {/* Filter Dropdown */}
                <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                    <option value="all">All Customers</option>
                    <option value="regular">Regular</option>
                    <option value="creditors">⚠️ Creditors</option>
                </select>
                {/* Sort Dropdown */}
                <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                    <option value="recent">Most Recent</option>
                    <option value="spent">Highest Spent</option>
                </select>
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
            <StatsSection />
            <CreditorsSection />
            <SearchBar />
            <div id="customerList" className="space-y-4">
                {filteredCustomers.map(customer => (
                    <CustomerCard
                        key={customer.id}
                        customer={customer}
                    />
                ))}
            </div>
        </div>
    );
} 