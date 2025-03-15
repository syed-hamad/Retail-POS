// Passbook Component
function Passbook() {
    const [transactions, setTransactions] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [filterType, setFilterType] = React.useState('all');
    const [selectedCustomer, setSelectedCustomer] = React.useState(null);
    const [customers, setCustomers] = React.useState([]);
    const [dateFilter, setDateFilter] = React.useState('last30');
    const [customDateRange, setCustomDateRange] = React.useState({ start: null, end: null });

    const getDateRange = (filter) => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        switch (filter) {
            case 'today':
                return {
                    start: today,
                    end: new Date(today.getTime() + 24 * 60 * 60 * 1000)
                };
            case 'yesterday':
                return {
                    start: new Date(today.getTime() - 24 * 60 * 60 * 1000),
                    end: today
                };
            case 'last7':
                return {
                    start: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
                    end: now
                };
            case 'last30':
                return {
                    start: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
                    end: now
                };
            case 'thisMonth':
                return {
                    start: new Date(now.getFullYear(), now.getMonth(), 1),
                    end: new Date(now.getFullYear(), now.getMonth() + 1, 0)
                };
            case 'thisYear':
                return {
                    start: new Date(now.getFullYear(), 0, 1),
                    end: new Date(now.getFullYear() + 1, 0, 0)
                };
            case 'custom':
                return {
                    start: customDateRange.start,
                    end: customDateRange.end
                };
            default:
                return { start: null, end: null };
        }
    };

    const isDateInRange = (date, range) => {
        if (!range.start || !range.end) return true;
        const txDate = new Date(date);
        return txDate >= range.start && txDate <= range.end;
    };

    React.useEffect(() => {
        async function fetchData() {
            try {
                const ordersSnapshot = await sdk.collection("Orders")
                    .orderBy("date", "desc")
                    .limit(100)
                    .get();

                const orders = ordersSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                const customersSnapshot = await sdk.collection("Customers")
                    .orderBy("lastOrderDate", "desc")
                    .limit(100)
                    .get();

                const customersList = customersSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                pp('Fetched orders:', orders); // Debug log

                const transactionsList = orders.flatMap(order => {
                    if (!order || !order.items) return [];

                    // Convert Firebase timestamp to Date if needed
                    const orderDate = order.date?.toDate ? order.date.toDate() : new Date(order.date || Date.now());

                    const total = order.items.reduce((sum, item) => {
                        if (!item) return sum;
                        const price = Number(item.price) || 0;
                        const quantity = Number(item.qnt) || 0;
                        return sum + (price * quantity);
                    }, 0);

                    const transactions = [];

                    // Add credit transaction for the order payment
                    if (total > 0) {
                        transactions.push({
                            id: `${order.id}-payment`,
                            customerId: order.custId || 'unknown',
                            type: 'credit',
                            amount: total,
                            date: orderDate,
                            description: `Payment for order #${order.id}`,
                            orderId: order.id,
                            paymentMethod: order.paymentMethod || 'cash',
                            items: order.items
                        });
                    }

                    // Add debit transaction for wallet payment if used
                    if (order.walletAmount && Number(order.walletAmount) > 0) {
                        transactions.push({
                            id: `${order.id}-wallet`,
                            customerId: order.custId || 'unknown',
                            type: 'debit',
                            amount: -Number(order.walletAmount),
                            date: orderDate,
                            description: `Wallet payment for order #${order.id}`,
                            orderId: order.id,
                            paymentMethod: 'wallet'
                        });
                    }

                    return transactions;
                });

                pp('Processed transactions:', transactionsList); // Debug log

                setTransactions(transactionsList);
                setCustomers(customersList);
                setLoading(false);
            } catch (err) {
                console.error('Error fetching transactions:', err);
                setError('Failed to load transactions');
                setLoading(false);
            }
        }

        fetchData();
    }, []);

    const filteredTransactions = React.useMemo(() => {
        const dateRange = getDateRange(dateFilter);

        return transactions
            .filter(transaction => {
                if (selectedCustomer && transaction.customerId !== selectedCustomer) {
                    return false;
                }

                if (filterType !== 'all' && transaction.type !== filterType) {
                    return false;
                }

                if (!isDateInRange(transaction.date, dateRange)) {
                    return false;
                }

                if (searchQuery) {
                    const customer = customers.find(c => c.id === transaction.customerId);
                    return (transaction.description?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                        (customer?.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                        (customer?.phone || '').includes(searchQuery);
                }

                return true;
            })
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [transactions, selectedCustomer, filterType, dateFilter, customDateRange, searchQuery, customers]);

    const summary = React.useMemo(() => {
        const total = filteredTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
        const credit = filteredTransactions.reduce((sum, t) => t.type === 'credit' ? sum + (t.amount || 0) : sum, 0);
        const debit = filteredTransactions.reduce((sum, t) => t.type === 'debit' ? sum + Math.abs(t.amount || 0) : sum, 0);
        const cash = filteredTransactions.reduce((sum, t) => t.paymentMethod === 'cash' ? sum + (t.amount || 0) : sum, 0);
        const upi = filteredTransactions.reduce((sum, t) => t.paymentMethod === 'upi' ? sum + (t.amount || 0) : sum, 0);
        const wallet = filteredTransactions.reduce((sum, t) => t.paymentMethod === 'wallet' ? sum + Math.abs(t.amount || 0) : sum, 0);

        return { total, credit, debit, cash, upi, wallet };
    }, [filteredTransactions]);

    const SummaryCards = () => {
        return (
            <div>
                {/* Reports Header with Date Filter */}
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium">Reports</h3>
                    <select
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="today">Today</option>
                        <option value="yesterday">Yesterday</option>
                        <option value="last7">Last 7 Days</option>
                        <option value="last30">Last 30 Days</option>
                        <option value="thisMonth">This Month</option>
                        <option value="thisYear">This Year</option>
                        <option value="custom">Custom Range</option>
                    </select>
                </div>

                {/* Custom Date Range Picker */}
                {dateFilter === 'custom' && (
                    <div className="flex items-center gap-4 mb-4">
                        <input
                            type="date"
                            value={customDateRange.start?.toISOString().split('T')[0] || ''}
                            onChange={(e) => setCustomDateRange(prev => ({
                                ...prev,
                                start: e.target.value ? new Date(e.target.value) : null
                            }))}
                            className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm"
                        />
                        <span>to</span>
                        <input
                            type="date"
                            value={customDateRange.end?.toISOString().split('T')[0] || ''}
                            onChange={(e) => setCustomDateRange(prev => ({
                                ...prev,
                                end: e.target.value ? new Date(e.target.value) : null
                            }))}
                            className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm"
                        />
                    </div>
                )}

                {/* First Row - Main Stats (2 columns) */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                    {/* Sales Card */}
                    <div className="card p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                                <i className="ph ph-trending-up text-xl text-green-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Sales</p>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-lg font-semibold">
                                        ₹{summary.credit.toLocaleString()}
                                    </h3>
                                    <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded-full">
                                        +12.5%
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Wallet Balance Card */}
                    <div className="card p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                <i className="ph ph-wallet text-xl text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Wallet Balance</p>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-lg font-semibold mt-0.5">
                                        ₹{summary.total.toLocaleString()}
                                    </h3>
                                    <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded-full">
                                        +5.2%
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Second Row - Payment Methods (3 columns) */}
                <div className="grid grid-cols-3 gap-3">
                    {/* Cash Card */}
                    <div className="card p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                                <i className="ph ph-money text-xl text-green-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Cash</p>
                                <h3 className="text-lg font-semibold mt-0.5">
                                    ₹{summary.cash.toLocaleString()}
                                </h3>
                            </div>
                        </div>
                    </div>

                    {/* UPI/Card Card */}
                    <div className="card p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                <i className="ph ph-credit-card text-xl text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">UPI/Card</p>
                                <h3 className="text-lg font-semibold mt-0.5">
                                    ₹{summary.upi.toLocaleString()}
                                </h3>
                            </div>
                        </div>
                    </div>

                    {/* Credit Card */}
                    <div className="card p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                                <i className="ph ph-credit-card text-xl text-red-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Credit</p>
                                <h3 className="text-lg font-semibold mt-0.5 text-red-600">
                                    ₹{Math.abs(summary.debit).toLocaleString()}
                                </h3>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const TransactionCard = ({ transaction }) => {
        const customer = customers.find(c => c.id === transaction.customerId);
        const isCredit = transaction.type === 'credit';
        const firstItem = transaction.items?.[0];

        return (
            <div className="card p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-4">
                    {/* Left Section - Image and Details */}
                    <div className="flex items-center gap-4 flex-1">
                        {/* Transaction Icon or First Item Image */}
                        <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                            {isCredit ? (
                                <i className="ph ph-arrow-down-right text-xl text-green-600" />
                            ) : (
                                <i className="ph ph-arrow-up-right text-xl text-red-600" />
                            )}
                        </div>
                        {/* Transaction Details */}
                        <div className="flex-1">
                            <div className="flex items-center justify-between">
                                <h4 className="font-medium">
                                    {customer?.name || 'Unknown Customer'}
                                </h4>
                                <span className={`text-sm font-medium ${isCredit ? 'text-green-600' : 'text-red-600'}`}>
                                    {isCredit ? '+' : '-'}₹{Math.abs(transaction.amount).toLocaleString()}
                                </span>
                            </div>
                            <div className="flex items-center gap-4 mt-1">
                                <p className="text-sm text-gray-500">
                                    {transaction.description}
                                </p>
                                <div className="flex items-center gap-1 text-sm text-gray-500">
                                    <i className={`ph ph-${transaction.paymentMethod === 'cash' ? 'money' : 'credit-card'} text-base`} />
                                    <span>
                                        {transaction.paymentMethod === 'cash' ? 'Cash' :
                                            transaction.paymentMethod === 'upi' ? 'UPI' :
                                                transaction.paymentMethod === 'wallet' ? 'Wallet' : 'Card'}
                                    </span>
                                </div>
                            </div>
                            <p className="text-xs text-gray-400 mt-1">
                                {formatDate(transaction.date, 'long')}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const SearchBar = () => {
        return (
            <div className="flex items-center gap-4 mb-6 bg-white p-4 rounded-lg shadow-sm">
                <div className="flex-1 relative">
                    <i className="ph ph-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search transactions..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>
                <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                    <option value="all">All Transactions</option>
                    <option value="credit">💰 Credits</option>
                    <option value="debit">📤 Debits</option>
                </select>
                <select
                    value={selectedCustomer || ''}
                    onChange={(e) => setSelectedCustomer(e.target.value || null)}
                    className="px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                    <option value="">All Customers</option>
                    {customers.map(customer => (
                        <option key={customer.id} value={customer.id}>
                            {customer.name}
                        </option>
                    ))}
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
            <div className="p-4 text-center text-red-600">
                {error}
            </div>
        );
    }

    return (
        <div className="p-4">
            <SummaryCards />
            <SearchBar />
            <div className="space-y-4">
                {filteredTransactions.map(transaction => (
                    <TransactionCard
                        key={transaction.id}
                        transaction={transaction}
                    />
                ))}
            </div>
        </div>
    );
} 