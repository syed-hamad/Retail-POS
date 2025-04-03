// CheckoutSheet component for handling order checkout
function CheckoutSheet({ cart, clearCallback, tableId, checkout, orderId, priceVariant, onClose }) {
    const [discount, setDiscount] = React.useState(0);
    const [instructions, setInstructions] = React.useState('');
    const [showDiscountModal, setShowDiscountModal] = React.useState(false);
    const [percentMode, setPercentMode] = React.useState(false);
    const [discountInput, setDiscountInput] = React.useState('');
    const [isProcessing, setIsProcessing] = React.useState(false);
    const [paymentMode, setPaymentMode] = React.useState('CASH'); // CASH, DIGITAL, CREDIT
    const [showInstructionsModal, setShowInstructionsModal] = React.useState(false);
    const [customer, setCustomer] = React.useState(null);
    const [showCustomerModal, setShowCustomerModal] = React.useState(false);
    const [customerSearch, setCustomerSearch] = React.useState('');
    const [customersList, setCustomersList] = React.useState([]);
    const [isLoadingCustomers, setIsLoadingCustomers] = React.useState(false);
    const [customersError, setCustomersError] = React.useState(null);

    // Calculate cart totals
    const cartSubTotal = React.useMemo(() => {
        if (!cart) return 0;
        return Object.values(cart).reduce((total, item) => total + (item.product.price * item.quantity), 0);
    }, [cart]);

    // Calculate charges (taxes, etc.)
    const charges = React.useMemo(() => {
        const finalCharges = [];

        if (!cart) return finalCharges;

        Object.values(cart).forEach(item => {
            const price = item.product.price;
            const qty = item.quantity;
            const total = price * qty;

            // Add product-specific charges - using optional chaining to prevent errors
            const productCharges = item.product.charges || [];
            productCharges.forEach(charge => {
                let amount = 0;
                let percentage = 0;

                if (charge.value && charge.value.includes('%')) {
                    // Percentage charge
                    const value = charge.value.replace('%', '').trim();
                    if (value) {
                        percentage = parseFloat(value);
                    }

                    if (charge.inclusive) {
                        amount = (total * percentage) / (100 + percentage);
                    } else {
                        amount = (total * percentage) / 100;
                    }

                    charge.name = `${charge.name.trim()} (${percentage}%)`;
                } else {
                    // Fixed amount charge
                    if (charge.value) {
                        amount = parseFloat(charge.value);
                    }
                }

                if (amount === 0) return;

                const existingCharge = finalCharges.find(c => c.name === charge.name);
                if (existingCharge) {
                    existingCharge.value = (parseFloat(existingCharge.value) + amount).toFixed(2);
                } else {
                    finalCharges.push({
                        ...charge,
                        value: amount.toFixed(2)
                    });
                }
            });
        });

        return finalCharges;
    }, [cart]);

    const cartTotal = React.useMemo(() => {
        let total = cartSubTotal - discount;

        // Add exclusive charges
        if (charges && charges.length > 0) {
            charges.forEach(charge => {
                if (!charge.inclusive && charge.value) {
                    total += parseFloat(charge.value);
                }
            });
        }

        return total;
    }, [cartSubTotal, discount, charges]);

    // Format date properly
    const formatDate = (dateStr) => {
        if (!dateStr) return "Just now";

        try {
            const date = new Date(dateStr);
            // Check if date is valid
            if (isNaN(date.getTime())) return "Just now";

            // Format the date
            return date.toLocaleString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        } catch (error) {
            console.error("Error formatting date:", error);
            return "Just now";
        }
    };

    // Search and fetch customer data
    const searchCustomers = async (query) => {
        if (!query || query.length < 2) {
            setCustomersList([]);
            return;
        }

        setIsLoadingCustomers(true);
        setCustomersError(null);

        try {
            // Simple query similar to the Flutter implementation
            const customersRef = window.sdk.collection("Customers");

            // Basic query without compound indexing requirements or sellerId filter (handled by SDK)
            let snapshot = await customersRef.get();

            // Filter results client-side (like the Flutter implementation)
            const customers = [];
            const queryLower = query.toLowerCase();

            snapshot.forEach(doc => {
                const data = doc.data();
                const name = (data.name || "").toLowerCase();
                const phone = (data.phone || "").toLowerCase();

                // Simple string contains check like the Flutter code
                if (name.includes(queryLower) || phone.includes(queryLower)) {
                    customers.push({
                        id: doc.id,
                        name: data.name || "",
                        phone: data.phone || "",
                        balance: data.balance || 0,
                        lastPurchase: data.lastPurchase,
                        ...data
                    });
                }
            });

            // Sort by name (client side)
            customers.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

            setCustomersList(customers);
        } catch (error) {
            console.error("Error fetching customers:", error);
            setCustomersError("Failed to load customers");
            setCustomersList([]);
        } finally {
            setIsLoadingCustomers(false);
        }
    };

    // Debounced search for better performance
    const debouncedSearchCustomers = React.useCallback(
        (() => {
            let timeoutId = null;
            return (query) => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
                timeoutId = setTimeout(() => {
                    searchCustomers(query);
                }, 300); // 300ms delay
            };
        })(),
        []
    );

    // Open customer selection modal
    const openCustomerModal = () => {
        setCustomerSearch('');
        setCustomersList([]);

        if (window.ModalManager && typeof window.ModalManager.createCenterModal === 'function') {
            const customerModalContent = `
                <div class="mb-5">
                    <!-- Search input -->
                    <div class="relative">
                        <input
                            type="text"
                            id="customer-search-input"
                            placeholder="Search by name or phone number"
                            class="w-full px-4 py-3 pl-10 pr-8 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400 bg-white shadow-sm"
                        />
                        <div class="absolute left-3 top-3.5" id="search-icon">
                            <i class="ph ph-magnifying-glass text-gray-400"></i>
                        </div>
                        <div class="absolute left-3 top-3.5 hidden" id="search-loading">
                            <div class="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                        <button
                            id="clear-search-btn"
                            class="absolute right-3 top-3 text-gray-400 hover:text-gray-600 hidden"
                        >
                            <i class="ph ph-x"></i>
                        </button>
                    </div>
                    <div class="mt-2 text-xs text-gray-500 flex justify-between items-center">
                        <span id="search-status">Enter 2+ characters to search</span>
                        <button 
                            id="refresh-customers-btn"
                            class="text-red-500 hover:text-red-600 flex items-center"
                        >
                            <i class="ph ph-arrows-clockwise mr-1 text-xs"></i>
                            Refresh
                        </button>
                    </div>

                    <!-- Create new customer form -->
                    <div class="border-t border-b my-4 py-4">
                        <div class="flex items-center justify-between mb-2">
                            <h4 class="text-sm font-medium text-gray-700">Add New Customer</h4>
                            <span class="text-xs text-gray-500">Required fields *</span>
                        </div>
                        <form id="new-customer-form" class="bg-white rounded-lg">
                            <div class="space-y-3">
                                <div>
                                    <div class="flex items-center mb-1">
                                        <label for="new-customer-name" class="text-sm text-gray-600">Name</label>
                                        <span class="text-red-500 ml-1">*</span>
                                    </div>
                                    <div class="relative">
                                        <i class="ph ph-user absolute left-3 top-2.5 text-gray-400"></i>
                                        <input
                                            id="new-customer-name"
                                            type="text"
                                            placeholder="Customer name"
                                            class="w-full pl-9 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-400"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label for="new-customer-phone" class="text-sm text-gray-600 block mb-1">Phone Number</label>
                                    <div class="relative">
                                        <i class="ph ph-phone absolute left-3 top-2.5 text-gray-400"></i>
                                        <input
                                            id="new-customer-phone"
                                            type="tel"
                                            placeholder="Phone number"
                                            class="w-full pl-9 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-400"
                                        />
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    class="w-full py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center"
                                >
                                    <i class="ph ph-user-plus mr-2"></i>
                                    Add Customer
                                </button>
                            </div>
                        </form>
                    </div>

                    <!-- Customer list -->
                    <div>
                        <h4 class="text-sm font-medium text-gray-700 mb-3" id="customers-list-title">
                            Recent Customers
                        </h4>
                        
                        <div id="customers-loading" class="flex justify-center items-center py-8">
                            <div class="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                            <span class="text-gray-500">Loading customers...</span>
                        </div>
                        
                        <div id="customers-error" class="text-center py-8 text-red-500 hidden">
                            <i class="ph ph-warning-circle text-2xl mb-2"></i>
                            <p id="error-message">Error loading customers</p>
                            <button 
                                id="try-again-btn"
                                class="mt-3 text-sm py-1.5 px-3 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors"
                            >
                                Try Again
                            </button>
                        </div>
                        
                        <div id="customers-empty" class="text-center py-8 text-gray-500 hidden">
                            <i class="ph ph-users text-3xl mb-2"></i>
                            <p id="empty-message">No customers found</p>
                            <p class="text-sm text-gray-400 mt-2">Try a different search or add a new customer</p>
                        </div>
                        
                        <div id="customers-list" class="space-y-2.5">
                            <!-- Customers will be added here dynamically -->
                        </div>
                    </div>
                </div>
            `;

            const customerModalFooter = `
                <div class="flex gap-3">
                    <button id="cancel-customer-select" class="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg">
                        Cancel
                    </button>
                </div>
            `;
        } else {
            setShowCustomerModal(true);
            // Load customers for the modal view
            loadRecentCustomers();
        }
    };

    // Load recent or top customers
    const loadRecentCustomers = async () => {
        setIsLoadingCustomers(true);
        setCustomersError(null);

        try {
            // Create simple query to get customers, avoiding complex indexing
            // No need for sellerId filter as it's handled by the SDK
            let customersRef = window.sdk.collection("Customers");
            let snapshot = await customersRef.get();

            // Process results
            const customers = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                customers.push({
                    id: doc.id,
                    name: data.name || "",
                    phone: data.phone || "",
                    balance: data.balance || 0,
                    lastPurchase: data.lastPurchase,
                    ...data
                });
            });

            // Sort by lastPurchase date if available (client-side)
            customers.sort((a, b) => {
                // If both have lastPurchase dates
                if (a.lastPurchase && b.lastPurchase) {
                    // Convert to Date objects if needed
                    const dateA = a.lastPurchase instanceof Date ? a.lastPurchase : new Date(a.lastPurchase);
                    const dateB = b.lastPurchase instanceof Date ? b.lastPurchase : new Date(b.lastPurchase);
                    // Reverse sort (newest first)
                    return dateB - dateA;
                }
                // If only one has lastPurchase
                if (a.lastPurchase) return -1;
                if (b.lastPurchase) return 1;
                // If neither has lastPurchase, sort by name
                return (a.name || "").localeCompare(b.name || "");
            });

            // Limit to 15 customers (client-side)
            setCustomersList(customers.slice(0, 15));
        } catch (error) {
            console.error("Error loading recent customers:", error);
            setCustomersError("Failed to load recent customers");
            setCustomersList([]);
        } finally {
            setIsLoadingCustomers(false);
        }
    };

    // Handle checkout
    const handleCheckout = async (mode) => {
        if (Object.keys(cart).length === 0) {
            showToast("Your cart is empty", "error");
            return;
        }

        // CREDIT mode requires a customer selection
        if (mode === 'CREDIT' && !customer) {
            showToast("Please select a customer for credit purchase", "error");
            openCustomerModal();
            return;
        }

        // Update payment mode if specified
        if (mode) {
            setPaymentMode(mode);
        }

        setIsProcessing(true);

        try {
            // Ensure orderId exists or create a new one
            const targetOrderId = orderId || window.sdk.collection("Orders").doc().id;
            const orderRef = window.sdk.collection("Orders").doc(targetOrderId);

            // Convert cart items to Order items format
            const items = Object.values(cart).map(cartItem => {
                try {
                    return window.Item.fromProduct(cartItem.product, cartItem.quantity);
                } catch (err) {
                    console.error("Error creating item from product:", err);
                    // Create fallback item if fromProduct fails
                    return {
                        data: {
                            pid: cartItem.product.id,
                            title: cartItem.product.title,
                            thumb: cartItem.product.imgs?.[0] || null,
                            cat: cartItem.product.cat || "Other",
                            mrp: cartItem.product.mrp || cartItem.product.price,
                            price: cartItem.product.price,
                            veg: cartItem.product.veg || false,
                            served: false,
                            qnt: cartItem.quantity
                        }
                    };
                }
            });

            // Validate charges format
            const validCharges = charges.map(charge => {
                if (typeof charge.toJson === 'function') {
                    return charge;
                } else {
                    // Create a simple charge object if toJson not available
                    return {
                        name: charge.name,
                        value: charge.value,
                        type: charge.type || 'fixed',
                        inclusive: charge.inclusive || false,
                        toJson: function () {
                            return {
                                name: this.name,
                                value: this.value,
                                type: this.type,
                                inclusive: this.inclusive
                            };
                        }
                    };
                }
            });

            // Create or update the order data
            let orderData;

            try {
                // Try using MOrder.fromItems first
                const order = window.MOrder.fromItems(
                    targetOrderId,
                    items,
                    discount,
                    priceVariant,
                    tableId,
                    instructions.trim(),
                    validCharges
                );
                orderData = order.data;

                // Add payment mode
                orderData.payMode = paymentMode;

                // Add customer details if a customer is selected
                if (customer) {
                    orderData.custId = customer.id;
                    orderData.custName = customer.name;
                    orderData.custPhone = customer.phone;
                }

                // For CREDIT payment mode, mark as unpaid
                if (paymentMode === 'CREDIT') {
                    orderData.paid = false;
                }
            } catch (err) {
                console.error("Error creating MOrder:", err);

                // Fallback for direct data creation
                const now = new Date();
                const seller = window.UserSession?.seller;
                const billNo = seller?.getBillNo ? seller.getBillNo() : Math.floor(Math.random() * 1000000);

                orderData = {
                    id: targetOrderId,
                    billNo: billNo,
                    items: items.map(item => item.data || item),
                    sellerId: seller?.id,
                    priceVariant: priceVariant,
                    tableId: tableId,
                    discount: discount,
                    paid: paymentMode !== 'CREDIT', // Set paid to false for CREDIT mode
                    status: [
                        {
                            label: "PLACED",
                            date: now
                        },
                        {
                            label: "KITCHEN",
                            date: now
                        }
                    ],
                    currentStatus: {
                        label: "KITCHEN",
                        date: now
                    },
                    charges: validCharges.map(c => typeof c.toJson === 'function' ? c.toJson() : c),
                    payMode: paymentMode,
                    instructions: instructions.trim(),
                    date: now
                };

                // Add customer details if a customer is selected
                if (customer) {
                    orderData.custId = customer.id;
                    orderData.custName = customer.name;
                    orderData.custPhone = customer.phone;
                }
            }

            if (!orderId) {
                // Create new order
                await orderRef.set(orderData);

                // If this is a CREDIT purchase, update the customer's balance
                if (paymentMode === 'CREDIT' && customer && customer.id) {
                    const customerRef = window.sdk.collection("Customers").doc(customer.id);

                    // Update customer's purchase history and balance
                    await customerRef.update({
                        lastPurchase: new Date(),
                        balance: window.firebase.firestore.FieldValue.increment(-cartTotal),
                        orders: window.firebase.firestore.FieldValue.arrayUnion({
                            id: targetOrderId,
                            amount: cartTotal,
                            date: new Date()
                        })
                    });
                }
            } else {
                // Update existing order
                // FIX: Use a manual approach instead of arrayUnion which might be undefined
                const existingDoc = await orderRef.get();
                const existingData = existingDoc.exists ? existingDoc.data() : {};

                // Initialize update data object
                let updateData = {};

                if (checkout) {
                    // If checkout mode, set paid flag based on payment mode
                    updateData = {
                        paid: paymentMode !== 'CREDIT',
                        payMode: paymentMode
                    };

                    // Add customer details if a customer is selected
                    if (customer) {
                        updateData.custId = customer.id;
                        updateData.custName = customer.name;
                        updateData.custPhone = customer.phone;
                    }

                    // Add a COMPLETED status if needed
                    const now = new Date();
                    const hasCompletedStatus = existingData.status &&
                        existingData.status.some(s => s.label === "COMPLETED");

                    if (!hasCompletedStatus) {
                        const newStatus = {
                            label: "COMPLETED",
                            date: now
                        };

                        updateData.status = [...(existingData.status || []), newStatus];
                        updateData.currentStatus = newStatus;
                    }

                    // Only add discount if it's set
                    if (discount > 0) {
                        updateData.discount = (existingData.discount || 0) + discount;
                    }

                    // If this is a CREDIT checkout, update the customer's balance
                    if (paymentMode === 'CREDIT' && customer && customer.id) {
                        const customerRef = window.sdk.collection("Customers").doc(customer.id);

                        // Update customer's purchase history and balance
                        await customerRef.update({
                            lastPurchase: new Date(),
                            balance: window.firebase.firestore.FieldValue.increment(-cartTotal),
                            orders: window.firebase.firestore.FieldValue.arrayUnion({
                                id: targetOrderId,
                                amount: cartTotal,
                                date: new Date()
                            })
                        });
                    }
                } else {
                    // If not in checkout mode, add items to the existing order
                    updateData = {
                        // Manually merge items arrays rather than using arrayUnion
                        items: [
                            ...(existingData.items || []),
                            ...items.map(e => e.data || e)
                        ],
                        discount: (existingData.discount || 0) + discount
                    };

                    // Add customer details if a customer is selected
                    if (customer) {
                        updateData.custId = customer.id;
                        updateData.custName = customer.name;
                        updateData.custPhone = customer.phone;
                    }
                }

                // Add instructions if specified
                if (instructions.trim()) {
                    updateData.instructions = instructions.trim();
                }

                await orderRef.update(updateData);
            }

            // Show success message for order completion
            if (checkout) {
                if (paymentMode === 'CREDIT') {
                    showToast("Credit order completed!");
                } else {
                    showToast("Order completed!");
                }

                // After checkout is complete, automatically print the bill
                if (window.BluetoothPrinting && window.BluetoothPrinting.isSupported()) {
                    try {
                        // Show toast about printer selection
                        if (window.ModalManager && typeof window.ModalManager.showToast === 'function') {
                            window.ModalManager.showToast("Select your Bluetooth printer to print bill", { type: "info" });
                        } else {
                            showToast("Select your Bluetooth printer to print bill", "info");
                        }

                        // Print the bill
                        await window.BluetoothPrinting.printBill(targetOrderId);

                        // Show success message
                        if (window.ModalManager && typeof window.ModalManager.showToast === 'function') {
                            window.ModalManager.showToast("Bill printed successfully", { type: "success" });
                        } else {
                            showToast("Bill printed successfully", "success");
                        }
                    } catch (btError) {
                        console.error("Bluetooth printing failed:", btError);

                        // Handle user cancellation errors
                        if (btError.message.includes("Device selection cancelled") ||
                            btError.message.includes("No printer selected") ||
                            btError.name === "NotFoundError") {
                            if (window.ModalManager && typeof window.ModalManager.showToast === 'function') {
                                window.ModalManager.showToast("Printer selection cancelled", { type: "info" });
                            } else {
                                showToast("Printer selection cancelled", "info");
                            }
                        }
                        // If it's a connection error or unsupported device, show helpful message
                        else if (btError.message.includes("No suitable service") ||
                            btError.message.includes("No services found") ||
                            btError.message.includes("not supported as a printer") ||
                            btError.message.includes("cannot be used for printing") ||
                            (btError.name === 'NetworkError' && btError.message.includes("Unsupported device"))) {
                            if (window.ModalManager && typeof window.ModalManager.showToast === 'function') {
                                window.ModalManager.showToast("Could not connect to printer. Please select a compatible thermal printer.", { type: "error" });
                            } else {
                                showToast("Could not connect to printer. Please select a compatible thermal printer.", "error");
                            }
                        }
                    }
                }
            } else {
                showToast("Order placed successfully!");
            }

            // Clear cart and close
            clearCallback && clearCallback();
            onClose && onClose();
        } catch (error) {
            console.error("Checkout error:", error);
            showToast("Failed to process order: " + (error.message || "Unknown error"), "error");
            setIsProcessing(false);
        }
    };

    // Handle discount application
    const applyDiscount = (amount) => {
        // If no amount is provided, use the current discountInput value
        if (amount === undefined) {
            amount = percentMode
                ? ((parseFloat(discountInput) || 0) * cartSubTotal / 100)
                : Math.min(parseFloat(discountInput) || 0, cartSubTotal);
        }

        if (isNaN(amount) || amount < 0) {
            if (window.ModalManager && typeof window.ModalManager.showToast === 'function') {
                window.ModalManager.showToast("Please enter a valid discount amount", { type: "error" });
            } else {
                showToast("Please enter a valid discount amount", "error");
            }
            return;
        }

        if (amount > cartSubTotal) {
            if (window.ModalManager && typeof window.ModalManager.showToast === 'function') {
                window.ModalManager.showToast("Discount cannot be greater than subtotal", { type: "error" });
            } else {
                showToast("Discount cannot be greater than subtotal", "error");
            }
            setDiscount(0);
        } else {
            setDiscount(amount);
            if (window.ModalManager && typeof window.ModalManager.showToast === 'function') {
                window.ModalManager.showToast(`Discount of ₹${amount.toFixed(2)} applied`, { type: "success" });
            } else {
                showToast(`Discount of ₹${amount.toFixed(2)} applied`, "success");
            }
        }
        setShowDiscountModal(false);
    };

    // Open discount modal
    const openDiscountModal = () => {
        if (window.ModalManager && typeof window.ModalManager.createCenterModal === 'function') {
            // Reset discount input when opening
            setDiscountInput('');

            const discountModalContent = `
                <div>
                    <!-- Toggle between percentage and fixed amount -->
                    <div class="flex items-center justify-between bg-gray-100 rounded-lg p-1 mb-4">
                        <button id="fixed-amount-btn" class="flex-1 py-2 rounded-md text-center ${!percentMode ? 'bg-white shadow-sm font-medium' : ''}">
                            Fixed Amount
                        </button>
                        <button id="percent-mode-btn" class="flex-1 py-2 rounded-md text-center ${percentMode ? 'bg-white shadow-sm font-medium' : ''}">
                            Percentage (%)
                        </button>
                    </div>

                    <!-- Input field -->
                    <div class="mb-5">
                        <label class="block text-sm text-gray-600 mb-2">
                            ${percentMode ? 'Discount Percentage' : 'Discount Amount'}
                        </label>
                        <div class="flex items-center border rounded-lg overflow-hidden shadow-sm">
                            <span class="px-3 py-2 bg-gray-100 text-gray-500">
                                ${percentMode ? '%' : '₹'}
                            </span>
                            <input
                                type="number"
                                id="discount-input"
                                value="${discountInput}"
                                placeholder="0"
                                class="flex-1 px-3 py-2 outline-none"
                            />
                        </div>
                        <p class="text-xs text-gray-500 mt-2">
                            ${percentMode
                    ? 'Enter percentage between 1-100'
                    : `Maximum discount: ₹${cartSubTotal}`}
                        </p>
                    </div>

                    <!-- Summary -->
                    <div class="bg-gray-50 rounded-lg p-4 mb-5">
                        <div class="flex justify-between mb-1">
                            <span class="text-gray-600">Subtotal:</span>
                            <span>₹${cartSubTotal}</span>
                        </div>
                        <div class="flex justify-between mb-1 text-green-600">
                            <span>Discount:</span>
                            <span id="discount-amount">
                                - ₹${percentMode
                    ? ((parseFloat(discountInput) || 0) * cartSubTotal / 100).toFixed(2)
                    : (Math.min(parseFloat(discountInput) || 0, cartSubTotal)).toFixed(2)
                }
                            </span>
                        </div>
                        <div class="flex justify-between font-medium text-lg pt-2 border-t">
                            <span>Final Total:</span>
                            <span id="final-total">
                                ₹${percentMode
                    ? (cartSubTotal - ((parseFloat(discountInput) || 0) * cartSubTotal / 100)).toFixed(2)
                    : (cartSubTotal - Math.min(parseFloat(discountInput) || 0, cartSubTotal)).toFixed(2)
                }
                            </span>
                        </div>
                    </div>
                </div>
            `;

            const discountFooter = `
                <div class="flex gap-3">
                    <button id="cancel-discount" class="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg">
                        Cancel
                    </button>
                    <button id="apply-discount" class="flex-1 py-2.5 bg-blue-600 text-white rounded-lg">
                        Apply Discount
                    </button>
                </div>
            `;

            const modal = window.ModalManager.createCenterModal({
                id: 'discount-modal',
                title: 'Apply Discount',
                content: discountModalContent,
                actions: discountFooter,
                onShown: (modalControl) => {
                    // Add event listeners
                    const fixedAmountBtn = document.getElementById('fixed-amount-btn');
                    const percentModeBtn = document.getElementById('percent-mode-btn');
                    const discountInput = document.getElementById('discount-input');
                    const cancelBtn = document.getElementById('cancel-discount');
                    const applyBtn = document.getElementById('apply-discount');

                    // Set up mode toggle
                    if (fixedAmountBtn) {
                        fixedAmountBtn.addEventListener('click', () => {
                            setPercentMode(false);
                            modalControl.close();
                            setTimeout(openDiscountModal, 50);
                        });
                    }

                    if (percentModeBtn) {
                        percentModeBtn.addEventListener('click', () => {
                            setPercentMode(true);
                            modalControl.close();
                            setTimeout(openDiscountModal, 50);
                        });
                    }

                    // Set up input changes
                    if (discountInput) {
                        discountInput.addEventListener('input', (e) => {
                            const newValue = e.target.value;
                            setDiscountInput(newValue);

                            // Update summary
                            const discountAmount = document.getElementById('discount-amount');
                            const finalTotal = document.getElementById('final-total');

                            if (discountAmount && finalTotal) {
                                const calculatedDiscount = percentMode
                                    ? ((parseFloat(newValue) || 0) * cartSubTotal / 100)
                                    : Math.min(parseFloat(newValue) || 0, cartSubTotal);

                                discountAmount.textContent = `- ₹${calculatedDiscount.toFixed(2)}`;
                                finalTotal.textContent = `₹${(cartSubTotal - calculatedDiscount).toFixed(2)}`;
                            }
                        });
                    }

                    // Set up buttons
                    if (cancelBtn) {
                        cancelBtn.addEventListener('click', () => modalControl.close());
                    }

                    if (applyBtn) {
                        applyBtn.addEventListener('click', () => {
                            applyDiscount();
                            modalControl.close();
                        });
                    }
                }
            });
        } else {
            setShowDiscountModal(true);
        }
    };

    // Open instructions modal
    const openInstructionsModal = () => {
        if (window.ModalManager && typeof window.ModalManager.createCenterModal === 'function') {
            const instructionsContent = `
                <div class="mb-5">
                    <textarea
                        id="instructions-textarea"
                        placeholder="Add any special instructions for this order..."
                        class="w-full p-3 border rounded-lg h-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >${instructions}</textarea>
                </div>
            `;

            const instructionsFooter = `
                <div class="flex gap-3">
                    <button id="cancel-instructions" class="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg">
                        Cancel
                    </button>
                    <button id="save-instructions" class="flex-1 py-2.5 bg-blue-600 text-white rounded-lg">
                        Save Instructions
                    </button>
                </div>
            `;

            const modal = window.ModalManager.createCenterModal({
                id: 'instructions-modal',
                title: 'Order Instructions',
                content: instructionsContent,
                actions: instructionsFooter,
                onShown: (modalControl) => {
                    // Add event listeners
                    const instructionsTextarea = document.getElementById('instructions-textarea');
                    const cancelBtn = document.getElementById('cancel-instructions');
                    const saveBtn = document.getElementById('save-instructions');

                    if (cancelBtn) {
                        cancelBtn.addEventListener('click', () => modalControl.close());
                    }

                    if (saveBtn) {
                        saveBtn.addEventListener('click', () => {
                            if (instructionsTextarea) {
                                setInstructions(instructionsTextarea.value);
                                if (window.ModalManager.showToast) {
                                    window.ModalManager.showToast("Instructions saved");
                                }
                            }
                            modalControl.close();
                        });
                    }
                }
            });
        } else {
            setShowInstructionsModal(true);
        }
    };

    if (Object.keys(cart).length === 0) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-end z-50" onClick={() => onClose?.()}>
            <div
                className="bg-white h-full w-full sm:max-w-md md:max-w-lg flex flex-col overflow-hidden shadow-lg"
                onClick={(e) => e.stopPropagation()}
                style={{ backgroundColor: "#fffcfc" }}
            >
                {/* Header */}
                <div className="sticky top-0 z-10 bg-white" style={{ backgroundColor: "#fff8f8" }}>
                    <div className="flex items-center justify-between p-4 border-b relative">
                        <div className="flex items-center">
                            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-3">
                                <i className="ph ph-shopping-cart text-red-600 text-xl"></i>
                            </div>
                            <h2 className="text-xl font-semibold text-gray-800">Checkout</h2>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={openDiscountModal}
                                className="p-2 hover:bg-red-50 rounded-full transition-colors"
                                title="Apply Discount"
                            >
                                <i className="ph ph-tag text-red-600"></i>
                            </button>
                            <button
                                onClick={openInstructionsModal}
                                className="p-2 hover:bg-red-50 rounded-full transition-colors"
                                title="Add Instructions"
                            >
                                <i className="ph ph-note-pencil text-gray-600"></i>
                            </button>
                            <button
                                onClick={() => onClose?.()}
                                className="p-2 hover:bg-red-50 rounded-full transition-colors"
                                aria-label="Close"
                            >
                                <i className="ph ph-x text-red-600"></i>
                            </button>
                        </div>
                    </div>

                    {/* Order Info */}
                    <div className="bg-pink-50 px-4 py-2 border-b flex justify-between items-center">
                        <div className="text-sm text-gray-600 flex items-center">
                            <i className="ph ph-shopping-bag text-red-500 mr-1"></i>
                            {Object.values(cart).reduce((total, item) => total + item.quantity, 0)} items
                        </div>
                        <div className="text-sm text-gray-600 flex items-center">
                            <i className="ph ph-calendar text-red-500 mr-1"></i>
                            {formatDate(new Date())}
                        </div>
                    </div>
                </div>

                {/* Main content - Scrollable area */}
                <div className="overflow-y-auto flex-1" style={{ scrollbarWidth: 'thin', backgroundColor: "#fffcfc" }}>
                    {/* Items list */}
                    <div className="p-4">
                        <h3 className="font-medium text-gray-700 mb-3">Order Items</h3>
                        <div className="space-y-3">
                            {Object.values(cart).map((item, index) => (
                                <div key={index} className="flex items-start p-3 bg-white rounded-xl shadow-sm hover:shadow transition-shadow duration-200">
                                    <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden mr-3 flex-shrink-0">
                                        {item.product.imgs && item.product.imgs.length > 0 ? (
                                            <img
                                                src={item.product.imgs[0]}
                                                alt={item.product.title}
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    e.target.onerror = null;
                                                    e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="%23ccc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
                                                }}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <i className="ph ph-image text-gray-400 text-xl" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-gray-900 text-lg">{item.product.title}</div>
                                        <div className="text-sm text-gray-600 mt-0.5">
                                            {item.quantity} × ₹{item.product.price}
                                        </div>
                                        {item.product.veg !== undefined && (
                                            <div className="mt-1">
                                                <span className={`inline-block w-4 h-4 border ${item.product.veg ? 'border-green-500' : 'border-red-500'} p-0.5 rounded-sm`}>
                                                    <span className={`block w-full h-full rounded-sm ${item.product.veg ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="font-medium text-right whitespace-nowrap text-red-600">
                                        ₹{(item.quantity * item.product.price).toFixed(2)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Instructions */}
                    <div className="px-4 pb-4">
                        <h3 className="font-medium text-gray-700 mb-2">Special Instructions</h3>
                        <textarea
                            value={instructions}
                            onChange={(e) => setInstructions(e.target.value)}
                            placeholder="Add any special instructions here"
                            className="w-full p-3 border border-gray-200 rounded-lg resize-none text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-400 bg-white"
                            rows="2"
                            maxLength={300}
                        />
                    </div>
                </div>

                {/* Order summary - Fixed at bottom */}
                <div className="bg-white border-t shadow-md" style={{ backgroundColor: "#fff8f8" }}>
                    <div className="p-4">
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Sub Total</span>
                                <span>₹{cartSubTotal.toFixed(2)}</span>
                            </div>

                            {/* Charges */}
                            {charges && charges.length > 0 && (
                                <div className="flex justify-between text-gray-600">
                                    <span>Tax & Charges</span>
                                    <div className="text-right">
                                        {charges.map((charge, index) => (
                                            <div key={index}>
                                                ₹{charge.value}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {discount > 0 && (
                                <div className="flex justify-between text-green-600">
                                    <span>Discount</span>
                                    <span>- ₹{discount.toFixed(2)}</span>
                                </div>
                            )}

                            <div className="flex justify-between font-bold text-lg pt-2 border-t mt-2">
                                <span>Total:</span>
                                <span className="text-red-600">₹{cartTotal.toFixed(2)}</span>
                            </div>
                        </div>

                        {/* Customer Section */}
                        <div className="mt-4">
                            {customer ? (
                                <div className="bg-red-50 rounded-lg mb-3 overflow-hidden">
                                    <div className="flex items-start p-3">
                                        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                                            <i className="ph ph-user text-red-600"></i>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-gray-900">{customer.name}</div>
                                            {customer.phone && (
                                                <div className="text-sm text-gray-600 flex items-center mt-0.5">
                                                    <i className="ph ph-phone text-xs mr-1.5"></i>
                                                    {customer.phone}
                                                </div>
                                            )}
                                            {typeof customer.balance === 'number' && customer.balance < 0 && (
                                                <div className="text-sm text-red-600 font-medium mt-1 flex items-center">
                                                    <i className="ph ph-currency-inr text-xs mr-1.5"></i>
                                                    Previous Due: {Math.abs(customer.balance).toFixed(2)}
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => setCustomer(null)}
                                            className="p-1.5 rounded-full hover:bg-red-100 text-red-600 transition-colors"
                                            title="Remove customer"
                                        >
                                            <i className="ph ph-x"></i>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="mb-3">
                                    {/* Search Input */}
                                    <div className="relative mb-2">
                                        <input
                                            type="text"
                                            placeholder="Search customers by name or phone"
                                            value={customerSearch}
                                            onChange={(e) => {
                                                setCustomerSearch(e.target.value);
                                                debouncedSearchCustomers(e.target.value);
                                            }}
                                            onFocus={() => {
                                                // Load recent customers when focused
                                                if (customersList.length === 0) {
                                                    loadRecentCustomers();
                                                }
                                            }}
                                            className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400 bg-white"
                                        />
                                        <div className="absolute left-3 top-3.5">
                                            {isLoadingCustomers ? (
                                                <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin"></div>
                                            ) : (
                                                <i className="ph ph-magnifying-glass text-gray-400"></i>
                                            )}
                                        </div>
                                        <div className="absolute right-3 top-3.5 flex">
                                            {customerSearch && (
                                                <button
                                                    onClick={() => {
                                                        setCustomerSearch('');
                                                        setCustomersList([]);
                                                    }}
                                                    className="p-0.5 text-gray-400 hover:text-gray-600"
                                                >
                                                    <i className="ph ph-x"></i>
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Quick Add New Customer Form - Displayed when no search results */}
                                    {customerSearch && customerSearch.length >= 2 && customersList.length === 0 && !isLoadingCustomers && (
                                        <div className="mt-2 p-3 bg-white border border-gray-200 rounded-lg">
                                            <div className="flex items-center justify-between mb-2">
                                                <h4 className="text-sm font-medium text-gray-700">Add "{customerSearch}" as new customer</h4>
                                                <span className="text-xs text-red-500">* Required</span>
                                            </div>

                                            <div className="space-y-3">
                                                <div>
                                                    <label className="text-xs text-gray-600 block mb-1">
                                                        Name <span className="text-red-500">*</span>
                                                    </label>
                                                    <div className="relative">
                                                        <i className="ph ph-user absolute left-3 top-2.5 text-gray-400"></i>
                                                        <input
                                                            id="quick-customer-name"
                                                            type="text"
                                                            defaultValue={customerSearch}
                                                            placeholder="Customer name"
                                                            className="w-full pl-9 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-400"
                                                        />
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="text-xs text-gray-600 block mb-1">Phone Number</label>
                                                    <div className="relative">
                                                        <i className="ph ph-phone absolute left-3 top-2.5 text-gray-400"></i>
                                                        <input
                                                            id="quick-customer-phone"
                                                            type="tel"
                                                            placeholder="Phone number"
                                                            className="w-full pl-9 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-400"
                                                        />
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        const nameInput = document.getElementById('quick-customer-name');
                                                        const phoneInput = document.getElementById('quick-customer-phone');

                                                        if (!nameInput.value.trim()) {
                                                            if (window.ModalManager && window.ModalManager.showToast) {
                                                                window.ModalManager.showToast("Customer name is required", { type: "error" });
                                                            } else {
                                                                showToast("Customer name is required", "error");
                                                            }
                                                            nameInput.focus();
                                                            return;
                                                        }

                                                        // Create new customer
                                                        const newCustomer = {
                                                            name: nameInput.value.trim(),
                                                            phone: phoneInput.value.trim(),
                                                            balance: 0,
                                                            createdAt: new Date(),
                                                            lastPurchase: new Date(),
                                                            sellerId: window.UserSession?.seller?.id
                                                        };

                                                        // Add to Firestore
                                                        window.sdk.collection("Customers").add(newCustomer)
                                                            .then(docRef => {
                                                                // Set as selected customer
                                                                setCustomer({
                                                                    ...newCustomer,
                                                                    id: docRef.id
                                                                });

                                                                if (window.ModalManager && window.ModalManager.showToast) {
                                                                    window.ModalManager.showToast("New customer added", { type: "success" });
                                                                } else {
                                                                    showToast("New customer added", "success");
                                                                }

                                                                setCustomerSearch('');
                                                                setCustomersList([]);
                                                            })
                                                            .catch(error => {
                                                                console.error("Error adding customer:", error);
                                                                if (window.ModalManager && window.ModalManager.showToast) {
                                                                    window.ModalManager.showToast("Failed to add customer", { type: "error" });
                                                                } else {
                                                                    showToast("Failed to add customer", "error");
                                                                }
                                                            });
                                                    }}
                                                    className="w-full py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center"
                                                >
                                                    <i className="ph ph-user-plus mr-2"></i>
                                                    Add Customer
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Autocomplete Results */}
                                    {(customersList.length > 0 || (customerSearch === '' && isLoadingCustomers)) && (
                                        <div className="absolute z-20 mt-1 w-full bg-white rounded-lg border border-gray-200 shadow-lg max-h-60 overflow-y-auto">
                                            {isLoadingCustomers ? (
                                                <div className="p-4 text-center text-gray-500">
                                                    <div className="w-5 h-5 border-2 border-red-400 border-t-transparent rounded-full animate-spin mx-auto mb-1"></div>
                                                    <div className="text-sm">Loading customers...</div>
                                                </div>
                                            ) : (
                                                <>
                                                    {customersList.map(cust => (
                                                        <div
                                                            key={cust.id}
                                                            className="p-2 hover:bg-red-50 cursor-pointer border-b border-gray-100 flex items-center"
                                                            onClick={() => {
                                                                setCustomer(cust);
                                                                setCustomerSearch('');
                                                                setCustomersList([]);
                                                            }}
                                                        >
                                                            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center mr-2">
                                                                <i className="ph ph-user text-gray-500"></i>
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="font-medium text-gray-800">{cust.name}</div>
                                                                <div className="flex items-center justify-between">
                                                                    <div className="text-sm text-gray-500 flex items-center">
                                                                        {cust.phone && (
                                                                            <span className="flex items-center mr-2">
                                                                                <i className="ph ph-phone text-xs mr-1"></i>
                                                                                {cust.phone}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    {cust.balance < 0 && (
                                                                        <div className="text-xs text-red-500">₹{Math.abs(cust.balance).toFixed(2)} due</div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {customersList.length === 0 && (
                                                        <div className="p-3 text-center text-gray-500">
                                                            <i className="ph ph-users text-xl mb-1"></i>
                                                            <div>No customers found</div>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Action buttons */}
                        {!checkout ? (
                            <div className="mt-4">
                                <button
                                    onClick={() => handleCheckout()}
                                    disabled={isProcessing}
                                    className={`w-full bg-red-500 text-white py-3 rounded-lg font-medium flex items-center justify-center hover:bg-red-600 transition-colors ${isProcessing ? 'opacity-75 cursor-not-allowed' : ''}`}
                                >
                                    {isProcessing ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            <span>Place Order</span>
                                            <i className="ph ph-arrow-right ml-2" />
                                        </>
                                    )}
                                </button>
                            </div>
                        ) : (
                            <div className="mt-4 space-y-3">
                                {/* Payment options - Now these directly complete the order */}
                                <h3 className="font-medium text-center text-gray-700 mb-2">Select Payment Method</h3>
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        onClick={() => handleCheckout('CASH')}
                                        disabled={isProcessing}
                                        className={`bg-red-500 text-white py-3 px-2 rounded-lg font-medium flex flex-col items-center justify-center hover:bg-red-600 transition-colors ${isProcessing ? 'opacity-75 cursor-not-allowed' : ''} ${paymentMode === 'CASH' ? 'ring-2 ring-red-300' : ''}`}
                                    >
                                        <i className="ph ph-money text-xl mb-1" />
                                        <span className="text-sm">Cash</span>
                                    </button>
                                    <button
                                        onClick={() => handleCheckout('DIGITAL')}
                                        disabled={isProcessing}
                                        className={`bg-red-500 text-white py-3 px-2 rounded-lg font-medium flex flex-col items-center justify-center hover:bg-red-600 transition-colors ${isProcessing ? 'opacity-75 cursor-not-allowed' : ''} ${paymentMode === 'DIGITAL' ? 'ring-2 ring-red-300' : ''}`}
                                    >
                                        <i className="ph ph-credit-card text-xl mb-1" />
                                        <span className="text-sm">UPI/Card</span>
                                    </button>
                                    <button
                                        onClick={() => handleCheckout('CREDIT')}
                                        disabled={isProcessing || !customer}
                                        className={`bg-red-500 text-white py-3 px-2 rounded-lg font-medium flex flex-col items-center justify-center hover:bg-red-600 transition-colors ${isProcessing || !customer ? 'opacity-75 cursor-not-allowed' : ''} ${paymentMode === 'CREDIT' ? 'ring-2 ring-red-300' : ''}`}
                                        title={!customer ? "Select a customer first" : ""}
                                    >
                                        <i className="ph ph-notebook text-xl mb-1" />
                                        <span className="text-sm">Credit</span>
                                    </button>
                                </div>

                                {/* Credit info if customer selected */}
                                {customer && typeof customer.balance === 'number' && (
                                    <div className="text-sm text-center text-gray-600 mt-2">
                                        {customer.balance < 0 ? (
                                            <>
                                                <span className="text-gray-700 font-medium">Current Due: </span>
                                                <span className="text-red-600 font-medium">₹{Math.abs(customer.balance).toFixed(2)}</span>
                                                <span className="mx-1">+</span>
                                                <span className="text-red-600 font-medium">₹{cartTotal.toFixed(2)}</span>
                                                <span className="mx-1">=</span>
                                                <span className="text-red-600 font-medium">₹{(Math.abs(customer.balance) + cartTotal).toFixed(2)}</span>
                                            </>
                                        ) : (
                                            <>
                                                <span className="text-gray-700 font-medium">New Due: </span>
                                                <span className="text-red-600 font-medium">₹{cartTotal.toFixed(2)}</span>
                                            </>
                                        )}
                                    </div>
                                )}

                                {/* Processing state indicator (replaces the Complete Order button) */}
                                {isProcessing && (
                                    <div className="mt-3 py-3 bg-gray-100 rounded-lg text-center text-gray-700">
                                        <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                                        Processing payment...
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* The rest of the modals remain unchanged */}
            {/* Discount Modal, Instructions Modal, Customer Selection Modal */}
            {/* ... existing modal code ... */}
        </div>
    );
}

// Add a method to create the checkout sheet with ModalManager
CheckoutSheet.createWithModalManager = function (options) {
    const { cart, clearCallback, tableId, checkout, orderId, priceVariant, onClose } = options;

    // If ModalManager doesn't exist or createSideDrawerModal isn't available, fallback to React rendering
    if (!window.ModalManager || typeof window.ModalManager.createSideDrawerModal !== 'function') {
        console.warn("ModalManager not available, using fallback rendering");
        return null; // Let the caller handle the fallback
    }

    // Create a container for ReactDOM to render into
    const container = document.createElement('div');
    document.body.appendChild(container);

    // Render the component into the container
    ReactDOM.render(
        <CheckoutSheet
            cart={cart}
            clearCallback={clearCallback}
            tableId={tableId}
            checkout={checkout}
            orderId={orderId}
            priceVariant={priceVariant}
            onClose={() => {
                if (onClose) onClose();
                // Clean up React component when modal is closed
                setTimeout(() => {
                    ReactDOM.unmountComponentAtNode(container);
                    container.remove();
                }, 0);
            }}
        />,
        container
    );

    // Return a control object that can be used to close the modal
    return {
        close: () => {
            if (onClose) onClose();
            // Clean up React component
            ReactDOM.unmountComponentAtNode(container);
            container.remove();
        }
    };
};

// Make component available globally
window.CheckoutSheet = CheckoutSheet; 