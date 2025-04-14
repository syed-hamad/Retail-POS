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
    const [showTrends, setShowTrends] = React.useState(false);
    const [isExporting, setIsExporting] = React.useState(false);

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
                const ordersSnapshot = await sdk.db.collection("Orders")
                    .orderBy("date", "desc")
                    .limit(100)
                    .get();

                const orders = ordersSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                const customersSnapshot = await sdk.db.collection("Customers")
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

    // Function to export transactions to CSV
    const exportToCSV = () => {
        setIsExporting(true);

        try {
            // Get currently filtered transactions
            const dataToExport = filteredTransactions.map(transaction => {
                const customer = customers.find(c => c.id === transaction.customerId);
                const itemsSummary = transaction.items?.map(item => `${item.qnt}x ${item.title}`).join(", ") || "";

                return {
                    date: formatDate(transaction.date, 'full'),
                    orderId: transaction.orderId || 'N/A',
                    customerName: customer?.name || 'Unknown',
                    customerPhone: customer?.phone || 'N/A',
                    amount: Math.abs(transaction.amount).toFixed(2),
                    paymentMethod: transaction.paymentMethod === 'cash' ? 'Cash' :
                        transaction.paymentMethod === 'upi' ? 'UPI/Card' :
                            transaction.paymentMethod === 'wallet' ? 'Wallet' : 'Credit',
                    transactionType: transaction.type === 'credit' ? 'Sale' : 'Wallet Payment',
                    items: itemsSummary
                };
            });

            // Create CSV header and rows
            const headers = ["Date & Time", "Order ID", "Customer", "Phone", "Amount", "Payment Method", "Type", "Items"];
            const csvContent = [
                headers.join(","),
                ...dataToExport.map(row => [
                    `"${row.date}"`,
                    `"${row.orderId}"`,
                    `"${row.customerName}"`,
                    `"${row.customerPhone}"`,
                    row.amount,
                    `"${row.paymentMethod}"`,
                    `"${row.transactionType}"`,
                    `"${row.items}"`
                ].join(","))
            ].join("\n");

            // Create a download link
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const dateStr = new Date().toLocaleDateString().replace(/\//g, '-');

            link.setAttribute('href', url);
            link.setAttribute('download', `passbook-transactions-${dateStr}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Show success notification (assuming you have a toast notification system)
            // If you don't have one, you can omit this
            if (window.showToast) {
                window.showToast(`Exported ${dataToExport.length} transactions successfully`, 'success');
            }
        } catch (err) {
            console.error('Export failed:', err);
            // Show error notification
            if (window.showToast) {
                window.showToast('Failed to export transactions', 'error');
            }
        } finally {
            setIsExporting(false);
        }
    };

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
            <div className="bg-white p-5 rounded-lg shadow-sm">
                {/* Reports Header with Date Filter and Export Button */}
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center">
                        <h3 className="text-lg font-medium text-gray-800">Reports</h3>
                        <button
                            onClick={exportToCSV}
                            disabled={isExporting || filteredTransactions.length === 0}
                            className="ml-4 px-3 py-1.5 text-sm bg-primary bg-opacity-10 text-primary hover:bg-opacity-20 rounded-lg flex items-center transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <i className={`ph ${isExporting ? 'ph-spinner ph-spin' : 'ph-download-simple'} mr-1.5`}></i>
                            {isExporting ? 'Exporting...' : 'Export CSV'}
                        </button>
                    </div>
                    <select
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                        {dateRangeOptions.map(option => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                </div>

                {/* Custom Date Range Picker */}
                {dateFilter === 'custom' && (
                    <div className="flex items-center gap-4 mb-5">
                        <input
                            type="date"
                            value={customDateRange.start?.toISOString().split('T')[0] || ''}
                            onChange={(e) => setCustomDateRange(prev => ({
                                ...prev,
                                start: e.target.value ? new Date(e.target.value) : null
                            }))}
                            className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm"
                        />
                        <span className="text-gray-500">to</span>
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
                <div className="grid grid-cols-2 gap-4 mb-4">
                    {/* Sales Card */}
                    <div
                        className={`card p-4 border-2 rounded-lg ${activeFilters.includes('Sales') ? 'border-primary border-opacity-30' : 'border-transparent'} bg-white transition-all hover:shadow-sm`}
                        onClick={() => toggleFilter('Sales')}
                    >
                        <div className="flex justify-between items-center">
                            <p className="text-sm text-gray-600">Sales</p>
                            <span className="text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded-full flex items-center">
                                <i className="ph ph-trending-up mr-1"></i>
                                100%
                            </span>
                        </div>
                        <h3 className="text-2xl font-semibold text-gray-800 mt-1.5">
                            ₹{summary.credit.toFixed(0)}
                        </h3>
                    </div>

                    {/* Wallet Balance Card */}
                    <div
                        className={`card p-4 border-2 rounded-lg ${activeFilters.includes('Wallet') ? 'border-primary border-opacity-30' : 'border-transparent'} bg-white transition-all hover:shadow-sm`}
                        onClick={() => toggleFilter('Wallet')}
                    >
                        <div className="flex justify-between items-center">
                            <p className="text-sm text-gray-600">Wallet</p>
                            <span className="text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded-full flex items-center">
                                <i className="ph ph-trending-up mr-1"></i>
                                100%
                            </span>
                        </div>
                        <h3 className="text-2xl font-semibold text-gray-800 mt-1.5">
                            ₹{summary.wallet.toFixed(0)}
                        </h3>
                    </div>
                </div>

                {/* Second Row - Payment Methods (3 columns) */}
                <div className="grid grid-cols-3 gap-4">
                    {/* Cash Card */}
                    <div
                        className={`card p-4 border-2 rounded-lg ${activeFilters.includes('Cash') ? 'border-primary border-opacity-30' : 'border-transparent'} bg-white transition-all hover:shadow-sm`}
                        onClick={() => toggleFilter('Cash')}
                    >
                        <p className="text-sm text-gray-600">Cash</p>
                        <h3 className="text-xl font-semibold text-gray-800 mt-1.5">
                            ₹{summary.cash.toFixed(0)}
                        </h3>
                    </div>

                    {/* UPI/Card Card */}
                    <div
                        className={`card p-4 border-2 rounded-lg ${activeFilters.includes('UPI/Card') ? 'border-primary border-opacity-30' : 'border-transparent'} bg-white transition-all hover:shadow-sm`}
                        onClick={() => toggleFilter('UPI/Card')}
                    >
                        <p className="text-sm text-gray-600">UPI/Card</p>
                        <h3 className="text-xl font-semibold text-gray-800 mt-1.5">
                            ₹{summary.upi.toFixed(0)}
                        </h3>
                    </div>

                    {/* Credit Card */}
                    <div
                        className={`card p-4 border-2 rounded-lg ${activeFilters.includes('Credit') ? 'border-primary border-opacity-30' : 'border-transparent'} bg-white transition-all hover:shadow-sm`}
                        onClick={() => toggleFilter('Credit')}
                    >
                        <p className="text-sm text-gray-600">Credit</p>
                        <h3 className="text-xl font-semibold text-gray-800 mt-1.5">
                            ₹{summary.debit.toFixed(0)}
                        </h3>
                    </div>
                </div>

                {/* Toggle Button for Trends (Desktop Only) */}
                <div className="mt-5 hidden md:flex justify-end">
                    <button
                        onClick={() => setShowTrends(prev => !prev)}
                        className="text-sm text-primary flex items-center gap-1 hover:underline py-1"
                    >
                        <i className={`ph ph-${showTrends ? 'chart-line-down' : 'chart-line-up'}`}></i>
                        {showTrends ? 'Hide Trends' : 'Show Trends'}
                    </button>
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
        } else if (format === 'full') {
            return d.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        }

        return d.toLocaleString();
    };

    const TransactionCard = ({ transaction }) => {
        const customer = customers.find(c => c.id === transaction.customerId);
        const firstItem = transaction.items?.[0];
        const [expanded, setExpanded] = React.useState(false);

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

        // Get a summary of items (e.g. "2× Pizza, 3× Burger")
        const getItemsSummary = () => {
            if (!transaction.items || transaction.items.length === 0) return "";

            // Group items by title and count quantities
            const itemCounts = {};
            transaction.items.forEach(item => {
                const title = item.title || "Unknown";
                const qnt = Number(item.qnt) || 1;

                if (itemCounts[title]) {
                    itemCounts[title] += qnt;
                } else {
                    itemCounts[title] = qnt;
                }
            });

            // Format as "2× Pizza, 3× Burger"
            return Object.entries(itemCounts)
                .map(([title, count]) => `${count}× ${title}`)
                .slice(0, 2) // Show only first 2 types
                .join(", ") + (Object.keys(itemCounts).length > 2 ? "..." : "");
        };

        const paymentInfo = getPaymentMethodInfo(transaction.paymentMethod);
        const hasImage = firstItem && (firstItem.thumb || firstItem.imageUrl);
        const totalItems = transaction.items?.reduce((sum, item) => sum + (Number(item.qnt) || 1), 0) || 0;

        const toggleExpand = () => {
            setExpanded(!expanded);
        };

        return (
            <div className={`border-b border-gray-100 transition-all ${expanded ? 'bg-gray-50' : 'hover:bg-gray-50'}`}>
                <div
                    className="p-4 cursor-pointer"
                    onClick={toggleExpand}
                >
                    <div className="flex items-center gap-3">
                        {/* Transaction Icon or First Item Image */}
                        <div className="relative w-12 h-12 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm">
                            {hasImage ? (
                                <img
                                    src={firstItem.thumb || firstItem.imageUrl}
                                    alt={firstItem.title}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        e.target.onerror = null;
                                        e.target.parentNode.innerHTML = `<i class="${getItemIcon(firstItem)} text-amber-700 text-xl"></i>`;
                                    }}
                                />
                            ) : (
                                <i className={`${getItemIcon(firstItem)} text-amber-700 text-xl`}></i>
                            )}
                            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 rounded-lg">
                                <span className="text-white text-xs font-medium">
                                    {totalItems}
                                </span>
                            </div>
                        </div>

                        {/* Transaction Details */}
                        <div className="flex-1">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="font-medium text-gray-800 flex items-center">
                                        {firstItem?.title || transaction.description}
                                        <i className={`ph ph-caret-${expanded ? 'up' : 'down'} ml-2 text-gray-400 text-xs`}></i>
                                    </h4>
                                    <div className="flex flex-wrap items-center gap-x-3 text-xs text-gray-500 mt-0.5">
                                        <span>{formatDate(transaction.date, 'long')}</span>
                                        {customer && (
                                            <span className="flex items-center">
                                                <i className="ph ph-user text-gray-400 mr-1"></i>
                                                {customer.name}
                                            </span>
                                        )}
                                    </div>
                                    {!expanded && transaction.items && transaction.items.length > 0 && (
                                        <p className="text-xs text-gray-500 mt-1.5 line-clamp-1">
                                            {getItemsSummary()}
                                        </p>
                                    )}
                                </div>
                                <div className="text-right">
                                    <p className="text-lg font-medium text-gray-800">₹{Math.abs(transaction.amount).toFixed(2)}</p>
                                    <p className="text-xs text-gray-500 flex items-center justify-end mt-0.5">
                                        <i className={`${paymentInfo.icon} mr-1`}></i>
                                        {paymentInfo.text}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Expanded Details */}
                {expanded && (
                    <div className="p-4 pt-0 bg-gray-50 border-t border-gray-100">
                        <div className="grid gap-4">
                            {/* Order Items Table */}
                            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                                <h5 className="text-sm font-medium mb-3 flex items-center text-gray-700">
                                    <i className="ph ph-shopping-cart mr-2 text-primary"></i>
                                    Order Items
                                </h5>
                                {transaction.items && transaction.items.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-gray-100">
                                                    <th className="text-left py-2 font-medium text-xs text-gray-500">Item</th>
                                                    <th className="text-center py-2 font-medium text-xs text-gray-500">Qty</th>
                                                    <th className="text-right py-2 font-medium text-xs text-gray-500">Price</th>
                                                    <th className="text-right py-2 font-medium text-xs text-gray-500">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {transaction.items.map((item, index) => (
                                                    <tr key={index} className="border-b border-gray-50">
                                                        <td className="py-2.5 flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-md bg-amber-50 flex-shrink-0 flex items-center justify-center overflow-hidden">
                                                                {item.thumb || item.imageUrl ? (
                                                                    <img
                                                                        src={item.thumb || item.imageUrl}
                                                                        alt={item.title}
                                                                        className="w-full h-full object-cover"
                                                                        onError={(e) => {
                                                                            e.target.onerror = null;
                                                                            e.target.parentNode.innerHTML = `<i class="${getItemIcon(item)} text-amber-700 text-xs"></i>`;
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <i className={`${getItemIcon(item)} text-amber-700 text-xs`}></i>
                                                                )}
                                                            </div>
                                                            <span className="font-medium text-gray-700">{item.title}</span>
                                                        </td>
                                                        <td className="py-2.5 text-center text-gray-600">{item.qnt}</td>
                                                        <td className="py-2.5 text-right text-gray-600">₹{Number(item.price).toFixed(2)}</td>
                                                        <td className="py-2.5 text-right font-medium text-gray-700">
                                                            ₹{(Number(item.price) * Number(item.qnt)).toFixed(2)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot>
                                                <tr className="border-t border-gray-200">
                                                    <td colSpan="3" className="py-3 text-right font-medium text-gray-600">Total</td>
                                                    <td className="py-3 text-right font-semibold text-gray-800">₹{Math.abs(transaction.amount).toFixed(2)}</td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500 text-center py-2">No items to display</p>
                                )}
                            </div>

                            {/* Transaction Details Card */}
                            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                                <h5 className="text-sm font-medium mb-3 flex items-center text-gray-700">
                                    <i className="ph ph-info mr-2 text-blue-600"></i>
                                    Transaction Details
                                </h5>
                                <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                                    {/* Left Column */}
                                    <div>
                                        <div className="mb-3">
                                            <div className="text-xs text-gray-500">Order ID</div>
                                            <div className="font-medium text-gray-700">{transaction.orderId || 'N/A'}</div>
                                        </div>
                                        <div className="mb-3">
                                            <div className="text-xs text-gray-500">Date & Time</div>
                                            <div className="font-medium text-gray-700">{formatDate(transaction.date, 'full')}</div>
                                        </div>
                                        <div className="mb-3">
                                            <div className="text-xs text-gray-500">Type</div>
                                            <div className="font-medium text-gray-700">{transaction.type === 'credit' ? 'Sale' : 'Wallet Payment'}</div>
                                        </div>
                                    </div>
                                    {/* Right Column */}
                                    <div>
                                        <div className="mb-3">
                                            <div className="text-xs text-gray-500">Payment Method</div>
                                            <div className="font-medium text-gray-700 flex items-center">
                                                <i className={`${paymentInfo.icon} mr-2 text-gray-600`}></i>
                                                {paymentInfo.text}
                                            </div>
                                        </div>
                                        {customer && (
                                            <div className="mb-3">
                                                <div className="text-xs text-gray-500">Customer</div>
                                                <div className="font-medium text-gray-700 flex items-center">
                                                    <i className="ph ph-user mr-2 text-gray-600"></i>
                                                    {customer.name || 'Unknown Customer'}
                                                </div>
                                            </div>
                                        )}
                                        <div className="mb-3">
                                            <div className="text-xs text-gray-500">Total Amount</div>
                                            <div className="font-medium text-lg text-primary">
                                                ₹{Math.abs(transaction.amount).toFixed(2)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // New component for transaction analysis (only shown on desktop)
    const TransactionTrends = () => {
        if (!showTrends) return null;

        // Calculate top products
        const productCounts = {};
        filteredTransactions.forEach(transaction => {
            transaction.items?.forEach(item => {
                if (item.title) {
                    productCounts[item.title] = (productCounts[item.title] || 0) + 1;
                }
            });
        });

        const topProducts = Object.keys(productCounts)
            .map(title => ({ title, count: productCounts[title] }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        return (
            <div className="bg-white p-4 rounded-lg shadow-sm mt-4 hidden md:block">
                <h3 className="text-lg font-medium mb-4">Transaction Analysis</h3>

                <div className="grid grid-cols-2 gap-4">
                    {/* Top Products */}
                    <div className="border rounded-lg p-4">
                        <h4 className="text-base font-medium mb-3 flex items-center">
                            <i className="ph ph-fire mr-2 text-amber-500"></i>
                            Popular Products
                        </h4>
                        {topProducts.length > 0 ? (
                            <div className="space-y-2">
                                {topProducts.map((product, index) => (
                                    <div key={index} className="flex justify-between items-center">
                                        <span className="text-sm">{product.title}</span>
                                        <span className="text-xs px-2 py-1 bg-gray-100 rounded-full">
                                            {product.count} orders
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500">No product data available</p>
                        )}
                    </div>

                    {/* Payment Method Distribution */}
                    <div className="border rounded-lg p-4">
                        <h4 className="text-base font-medium mb-3 flex items-center">
                            <i className="ph ph-credit-card mr-2 text-blue-500"></i>
                            Payment Methods
                        </h4>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-sm flex items-center">
                                    <i className="ph ph-money mr-1 text-green-600"></i>
                                    Cash
                                </span>
                                <span className="text-xs px-2 py-1 bg-gray-100 rounded-full">
                                    ₹{summary.cash.toFixed(0)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm flex items-center">
                                    <i className="ph ph-qr-code mr-1 text-blue-600"></i>
                                    UPI/Card
                                </span>
                                <span className="text-xs px-2 py-1 bg-gray-100 rounded-full">
                                    ₹{summary.upi.toFixed(0)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm flex items-center">
                                    <i className="ph ph-credit-card mr-1 text-red-600"></i>
                                    Credit
                                </span>
                                <span className="text-xs px-2 py-1 bg-gray-100 rounded-full">
                                    ₹{summary.debit.toFixed(0)}
                                </span>
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
            <div className="p-4 max-w-5xl mx-auto">
                <SummaryCards />
                <div className="mt-8 text-center bg-white p-8 rounded-lg shadow-sm">
                    <i className="ph ph-credit-card text-4xl text-gray-400"></i>
                    <h3 className="mt-2 text-lg font-semibold text-gray-700">No Transactions</h3>
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
        <div className="p-4 max-w-5xl mx-auto">
            <SummaryCards />
            <TransactionTrends />
            <div className="mt-5 bg-white rounded-lg overflow-hidden shadow-sm">
                <div className="py-3 px-4 bg-gray-50 border-b flex justify-between items-center">
                    <h3 className="font-medium text-gray-700">Recent Transactions</h3>
                    <span className="text-xs text-gray-500">{filteredTransactions.length} transactions</span>
                </div>
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