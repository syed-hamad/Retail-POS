// Passbook Component
function Passbook() {
    const [transactions, setTransactions] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [filterType, setFilterType] = React.useState('all');
    const [selectedCustomer, setSelectedCustomer] = React.useState(null);
    const [customers, setCustomers] = React.useState([]);
    const [dateFilter, setDateFilter] = React.useState('last7');
    const [customDateRange, setCustomDateRange] = React.useState({ start: null, end: null });
    const [activeFilters, setActiveFilters] = React.useState(['Cash', 'UPI/Card', 'Credit', 'Wallet', 'Sales']);

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

    const toggleFilter = (filter, isExclusive = false) => {
        const dependentFilters = ["Cash", "UPI/Card", "Credit"];

        setActiveFilters(prev => {
            let newFilters = [...prev];

            if (newFilters.includes(filter)) {
                newFilters = newFilters.filter(f => f !== filter);

                // If Sales is removed and not exclusive, also remove dependent filters
                if (filter === "Sales" && !isExclusive) {
                    newFilters = newFilters.filter(f => !dependentFilters.includes(f));
                }
            } else {
                newFilters.push(filter);

                // If Sales is added and not exclusive, add all dependent filters
                if (filter === "Sales" && !isExclusive) {
                    dependentFilters.forEach(f => {
                        if (!newFilters.includes(f)) newFilters.push(f);
                    });
                }
            }

            if (!isExclusive) {
                // If none of the dependent filters are active, remove Sales
                if (dependentFilters.every(f => !newFilters.includes(f))) {
                    newFilters = newFilters.filter(f => f !== "Sales");
                }

                // If any dependent filters are active, add Sales
                if (dependentFilters.some(f => newFilters.includes(f)) && !newFilters.includes("Sales")) {
                    newFilters.push("Sales");
                }
            }

            // Remove duplicates
            return [...new Set(newFilters)];
        });
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

                if (!isDateInRange(transaction.date, dateRange)) {
                    return false;
                }

                // Filter by payment method based on activeFilters
                if (!activeFilters.includes(transaction.paymentMethod === 'cash' ? 'Cash' :
                    transaction.paymentMethod === 'upi' ? 'UPI/Card' :
                        transaction.paymentMethod === 'wallet' ? 'Wallet' : 'Credit')) {
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
    }, [transactions, selectedCustomer, dateFilter, customDateRange, searchQuery, customers, activeFilters]);

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
        const dateRangeOptions = [
            { value: 'today', label: 'Today' },
            { value: 'yesterday', label: 'Yesterday' },
            { value: 'last7', label: 'Last 7 days' },
            { value: 'last30', label: 'Last 30 days' },
            { value: 'thisMonth', label: 'This Month' },
            { value: 'custom', label: 'Custom' }
        ];

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
                        {dateRangeOptions.map(option => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
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
                    <div
                        className={`card p-4 border-2 ${activeFilters.includes('Sales') ? 'border-primary border-opacity-30' : 'border-transparent'}`}
                        onClick={() => toggleFilter('Sales')}
                    >
                        <div className="flex justify-between items-center">
                            <p className="text-sm text-gray-600">Sales</p>
                            <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded-full flex items-center">
                                <i className="ph ph-trending-up mr-1"></i>
                                100%
                            </span>
                        </div>
                        <h3 className="text-2xl font-bold mt-1">
                            ₹{summary.credit.toFixed(0)}
                        </h3>
                    </div>

                    {/* Wallet Balance Card */}
                    <div
                        className={`card p-4 border-2 ${activeFilters.includes('Wallet') ? 'border-primary border-opacity-30' : 'border-transparent'}`}
                        onClick={() => toggleFilter('Wallet')}
                    >
                        <div className="flex justify-between items-center">
                            <p className="text-sm text-gray-600">Wallet</p>
                            <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded-full flex items-center">
                                <i className="ph ph-trending-up mr-1"></i>
                                100%
                            </span>
                        </div>
                        <h3 className="text-2xl font-bold mt-1">
                            ₹{summary.wallet.toFixed(0)}
                        </h3>
                    </div>
                </div>

                {/* Second Row - Payment Methods (3 columns) */}
                <div className="grid grid-cols-3 gap-3">
                    {/* Cash Card */}
                    <div
                        className={`card p-4 border-2 ${activeFilters.includes('Cash') ? 'border-primary border-opacity-30' : 'border-transparent'}`}
                        onClick={() => toggleFilter('Cash')}
                    >
                        <p className="text-sm text-gray-600">Cash</p>
                        <h3 className="text-2xl font-bold mt-1">
                            ₹{summary.cash.toFixed(0)}
                        </h3>
                    </div>

                    {/* UPI/Card Card */}
                    <div
                        className={`card p-4 border-2 ${activeFilters.includes('UPI/Card') ? 'border-primary border-opacity-30' : 'border-transparent'}`}
                        onClick={() => toggleFilter('UPI/Card')}
                    >
                        <p className="text-sm text-gray-600">UPI/Card</p>
                        <h3 className="text-2xl font-bold mt-1">
                            ₹{summary.upi.toFixed(0)}
                        </h3>
                    </div>

                    {/* Credit Card */}
                    <div
                        className={`card p-4 border-2 ${activeFilters.includes('Credit') ? 'border-primary border-opacity-30' : 'border-transparent'}`}
                        onClick={() => toggleFilter('Credit')}
                    >
                        <p className="text-sm text-gray-600">Credit</p>
                        <h3 className="text-2xl font-bold mt-1">
                            ₹{summary.debit.toFixed(0)}
                        </h3>
                    </div>
                </div>
            </div>
        );
    };

    const formatDate = (date, format = 'short') => {
        if (!date) return '';

        const d = new Date(date);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (format === 'short') {
            return d.toLocaleDateString();
        } else if (format === 'long') {
            // Check if date is today, yesterday or some other day
            if (d.getFullYear() === today.getFullYear() &&
                d.getMonth() === today.getMonth() &&
                d.getDate() === today.getDate()) {
                return `Today, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}`;
            } else if (d.getFullYear() === yesterday.getFullYear() &&
                d.getMonth() === yesterday.getMonth() &&
                d.getDate() === yesterday.getDate()) {
                return `Yesterday, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}`;
            } else {
                return `${d.toLocaleDateString()}, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}`;
            }
        }

        return d.toLocaleString();
    };

    const TransactionCard = ({ transaction }) => {
        const customer = customers.find(c => c.id === transaction.customerId);
        const firstItem = transaction.items?.[0];

        // Determine the appropriate icon based on the item title
        const getItemIcon = (item) => {
            if (!item) return "ph ph-coffee";

            const title = item.title?.toLowerCase() || "";

            if (title.includes("shake") || title.includes("juice")) return "ph ph-cup";
            if (title.includes("salad")) return "ph ph-salad";
            if (title.includes("dog") || title.includes("sandwich")) return "ph ph-hamburger";
            if (title.includes("fries")) return "ph ph-french-fries";

            // Default icon
            return "ph ph-coffee";
        };

        // Determine payment method icon and text
        const getPaymentMethodInfo = (method) => {
            switch (method) {
                case 'cash': return { icon: "ph ph-money", text: "Cash" };
                case 'upi': return { icon: "ph ph-qr-code", text: "UPI/Card" };
                case 'wallet': return { icon: "ph ph-wallet", text: "Wallet" };
                default: return { icon: "ph ph-credit-card", text: "Card" };
            }
        };

        const paymentInfo = getPaymentMethodInfo(transaction.paymentMethod);
        const hasImage = firstItem && (firstItem.thumb || firstItem.imageUrl);

        return (
            <div className="hover:bg-gray-50 border-b border-gray-100 p-4">
                <div className="flex items-center gap-3">
                    {/* Transaction Icon or First Item Image */}
                    <div className="relative w-11 h-11 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {hasImage ? (
                            <img
                                src={firstItem.thumb || firstItem.imageUrl}
                                alt={firstItem.title}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.parentNode.innerHTML = `<i class="${getItemIcon(firstItem)} text-amber-800 text-xl"></i>`;
                                }}
                            />
                        ) : (
                            <i className={`${getItemIcon(firstItem)} text-amber-800 text-xl`}></i>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40 rounded-lg">
                            <span className="text-white text-xs font-semibold">
                                {transaction.items?.length || 1}
                            </span>
                        </div>
                    </div>

                    {/* Transaction Details */}
                    <div className="flex-1">
                        <div className="flex justify-between items-start">
                            <div>
                                <h4 className="font-medium text-gray-800">
                                    {firstItem?.title || transaction.description}
                                </h4>
                                <p className="text-xs text-gray-500">
                                    {formatDate(transaction.date, 'long')}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-lg font-semibold">₹{Math.abs(transaction.amount).toFixed(2)}</p>
                                <p className="text-xs text-gray-500 flex items-center justify-end">
                                    <i className={`${paymentInfo.icon} mr-1`}></i>
                                    {paymentInfo.text}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
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

    if (filteredTransactions.length === 0) {
        return (
            <div className="p-4">
                <SummaryCards />
                <div className="mt-8 text-center">
                    <i className="ph ph-credit-card text-4xl text-gray-400"></i>
                    <h3 className="mt-2 text-lg font-semibold">No Transactions</h3>
                    <p className="text-sm text-gray-500">
                        {activeFilters.length === 0
                            ? "No transactions found for the selected filters"
                            : "It will appear when POS sale is done"}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4">
            <SummaryCards />
            <div className="mt-4 bg-white rounded-lg overflow-hidden shadow-sm">
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