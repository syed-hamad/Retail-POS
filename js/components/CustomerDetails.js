// CustomerDetails Component
function CustomerDetails() {
    // Instance properties
    this.customerListener = null;
    this.walletListener = null;

    this.showCustomerDetailsModal = function (customerData, existingModal = null) {
        const self = this;
        // Use the existing modal if provided, otherwise create a new one
        let modal;

        // Cancel any previous listeners
        if (this.customerListener) {
            this.customerListener();
            this.customerListener = null;
        }

        if (this.walletListener) {
            this.walletListener();
            this.walletListener = null;
        }

        // Set up real-time listener for this customer
        this.customerListener = sdk.db.collection("Customers").doc(customerData.id)
            .onSnapshot(doc => {
                if (doc.exists) {
                    // Update the customer data
                    const updatedData = {
                        id: doc.id,
                        ...doc.data()
                    };

                    // Update the UI with new customer data
                    this.updateCustomerUI(updatedData, modal);

                    // Update our reference to the customer data
                    customerData = updatedData;
                }
            }, error => {
                console.error("Error listening to customer updates:", error);
            });

        // Set up real-time listener for wallet transactions
        this.walletListener = sdk.db.collection("Wallet")
            .where("customerId", "==", customerData.id)
            .onSnapshot(() => {
                // When wallet changes, refresh transactions if transactions tab is active
                const transactionsTab = document.getElementById('tab-transactions');
                if (transactionsTab && transactionsTab.classList.contains('text-red-500')) {
                    this.loadTransactions(customerData);
                }
            }, error => {
                console.error("Error listening to wallet updates:", error);
            });

        const modalContent = `
            <!-- Customer Info -->
            <div class="p-4 border-b">
                <div class="flex items-center">
                    <div class="w-12 h-12 rounded-full bg-red-50 flex-shrink-0 flex items-center justify-center mr-4 border border-red-100">
                        <i class="ph ph-user text-red-400"></i>
                    </div>
                    <div class="flex-1">
                        <h2 class="text-lg font-medium">${customerData.name || 'Unknown'}</h2>
                        <p class="text-gray-500">${customerData.phone || 'No phone'}</p>
                    </div>
                </div>
                
                <!-- Balance Card -->
                <div class="mt-4 p-4 bg-red-50 rounded-lg">
                    <div class="flex justify-between items-center">
                        <div>
                            <p class="text-sm text-gray-600">Current Balance</p>
                            <p class="text-xl font-bold ${Number(customerData.balance || 0) < 0 ? 'text-red-600' : 'text-green-600'}">
                                ₹${Number(customerData.balance || 0) < 0
                ? `-${Math.abs(Number(customerData.balance || 0)).toLocaleString()}`
                : (Number(customerData.balance || 0)).toLocaleString()}
                            </p>
                        </div>
                        <div class="flex space-x-2">
                            ${Number(customerData.balance || 0) < 0 ? `
                                <button id="send-reminder" class="px-3 py-2 bg-red-500 text-white text-sm rounded-lg flex items-center hover:bg-red-600">
                                    <i class="ph ph-paper-plane-tilt mr-1.5"></i>
                                    Send Reminder
                                </button>
                            ` : ''}
                            <button id="deposit-balance" class="px-3 py-2 bg-red-500 text-white text-sm rounded-lg flex items-center hover:bg-red-600">
                                <i class="ph ph-plus-circle mr-1.5"></i>
                                Deposit Balance
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Tabs -->
            <div class="bg-white border-b">
                <div class="flex">
                    <button id="tab-orders" class="flex-1 py-3 px-4 text-center text-red-500 border-b-2 border-red-500 font-medium">
                        Orders
                    </button>
                    <button id="tab-transactions" class="flex-1 py-3 px-4 text-center text-gray-600">
                        Transactions
                    </button>
                </div>
            </div>
            
            <!-- Tab Content -->
            <div id="tab-content" class="flex-1 overflow-auto p-4">
                <div class="text-center py-8">
                    <div class="animate-spin inline-block w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full"></div>
                    <p class="mt-2 text-gray-600">Loading orders...</p>
                </div>
            </div>
        `;

        if (existingModal) {
            // Use existing modal, just update content and title
            modal = existingModal;
            modal.setContent(modalContent);
            modal.setTitle(customerData.name || 'Customer Details');
        } else {
            // Create a new modal
            modal = window.ModalManager.createSideDrawerModal({
                id: 'customer-details-modal',
                title: customerData.name || 'Customer Details',
                content: modalContent,
                customClass: '',
                closeOnBackdropClick: true,
                onClose: () => {
                    // Clean up listener when modal is closed
                    if (this.customerListener) {
                        this.customerListener();
                        this.customerListener = null;
                    }

                    if (this.walletListener) {
                        this.walletListener();
                        this.walletListener = null;
                    }
                }
            });
        }

        // Process the modal (regardless of whether it's new or existing)
        const setupModal = (modalControl) => {
            // Handle edit name button - add to the header
            const headerActions = modalControl.container.querySelector('.sticky.top-0 .flex.items-center');
            if (headerActions) {
                // Check if edit button already exists
                const existingEditBtn = headerActions.querySelector('#edit-customer-name');
                if (!existingEditBtn) {
                    const editBtn = document.createElement('button');
                    editBtn.id = 'edit-customer-name';
                    editBtn.className = 'mr-2 p-2 rounded-full text-gray-500 hover:bg-gray-100';
                    editBtn.innerHTML = '<i class="ph ph-pencil"></i>';
                    editBtn.addEventListener('click', () => {
                        this.handleEditName(customerData);
                    });

                    // Insert before the close button
                    headerActions.insertBefore(editBtn, headerActions.firstChild);
                }
            }

            // Add event listeners - ensure we don't add duplicates by checking for elements first
            const depositBtn = document.getElementById('deposit-balance');
            if (depositBtn) {
                // Remove existing listener to avoid duplicates
                const newDepositBtn = depositBtn.cloneNode(true);
                depositBtn.parentNode.replaceChild(newDepositBtn, depositBtn);
                newDepositBtn.addEventListener('click', () => {
                    this.handleDeposit(customerData);
                });
            }

            if (customerData.balance < 0) {
                const reminderBtn = document.getElementById('send-reminder');
                if (reminderBtn) {
                    // Remove existing listener to avoid duplicates
                    const newReminderBtn = reminderBtn.cloneNode(true);
                    reminderBtn.parentNode.replaceChild(newReminderBtn, reminderBtn);
                    newReminderBtn.addEventListener('click', () => {
                        this.handleSendReminder(customerData);
                    });
                }
            }

            // Set up tab switching
            const transactionsTab = document.getElementById('tab-transactions');
            const ordersTab = document.getElementById('tab-orders');

            if (transactionsTab) {
                const newTransactionsTab = transactionsTab.cloneNode(true);
                transactionsTab.parentNode.replaceChild(newTransactionsTab, transactionsTab);
                newTransactionsTab.addEventListener('click', () => {
                    this.switchTab('transactions', customerData);
                });
            }

            if (ordersTab) {
                const newOrdersTab = ordersTab.cloneNode(true);
                ordersTab.parentNode.replaceChild(newOrdersTab, ordersTab);
                newOrdersTab.addEventListener('click', () => {
                    this.switchTab('orders', customerData);
                });
            }

            // Load initial data
            this.loadOrders(customerData);
        };

        // If this is an existing modal, directly set it up
        if (existingModal) {
            setupModal(existingModal);
        } else {
            // For new modals, use the onShown callback
            modal.onShown = setupModal;
        }

        // Store modal control for later use
        this.modalControl = modal;

        return modal;
    };

    // Switch between tabs
    this.switchTab = function (tabName, customerData) {
        // Update tab styling
        if (tabName === 'transactions') {
            document.getElementById('tab-transactions').className = 'flex-1 py-3 px-4 text-center text-red-500 border-b-2 border-red-500 font-medium';
            document.getElementById('tab-orders').className = 'flex-1 py-3 px-4 text-center text-gray-600';
            this.loadTransactions(customerData);
        } else {
            document.getElementById('tab-orders').className = 'flex-1 py-3 px-4 text-center text-red-500 border-b-2 border-red-500 font-medium';
            document.getElementById('tab-transactions').className = 'flex-1 py-3 px-4 text-center text-gray-600';
            this.loadOrders(customerData);
        }
    };

    // Load transactions for a customer
    this.loadTransactions = async function (customerData) {
        const tabContent = document.getElementById('tab-content');
        tabContent.innerHTML = `
            <div class="text-center py-8">
                <div class="animate-spin inline-block w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full"></div>
                <p class="mt-2 text-gray-600">Loading transactions...</p>
            </div>
        `;

        try {
            // In a real implementation, this would fetch from the SDK
            const transactions = await this.fetchTransactionsForCustomer(customerData.id);

            if (transactions.length === 0) {
                tabContent.innerHTML = `
                    <div class="p-8 text-center text-gray-500">
                        No transactions found for this customer.
                    </div>
                `;
                return;
            }

            let html = '<ul>';
            for (const transaction of transactions) {
                html += `
                    <li class="border-b">
                        <div class="p-4">
                            <div class="flex justify-between">
                                <div class="flex">
                                    <div class="w-10 h-10 rounded-full flex items-center justify-center mr-3 
                                        ${transaction.type === 'CREDIT' ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}">
                                        <i class="ph ${transaction.type === 'CREDIT' ? 'ph-shopping-cart' : 'ph-currency-circle-dollar'}"></i>
                                    </div>
                                    <div>
                                        <p class="font-medium">
                                            ${transaction.type === 'CREDIT' ? 'Order Credit' : 'Wallet Deposit'}
                                        </p>
                                        <p class="text-sm text-gray-500">${this.formatDate(transaction.date)}</p>
                                        <p class="text-sm text-gray-500">${transaction.description}</p>
                                    </div>
                                </div>
                                <div class="text-right">
                                    <p class="font-medium ${transaction.type === 'CREDIT' ? 'text-red-500' : 'text-green-500'}">
                                        ${transaction.type === 'CREDIT' ? '-' : '+'}₹${transaction.amount.toLocaleString()}
                                    </p>
                                    <p class="text-sm text-gray-500">
                                        Balance: ₹${transaction.balance.toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </li>
                `;
            }
            html += '</ul>';

            tabContent.innerHTML = html;
        } catch (error) {
            tabContent.innerHTML = `
                <div class="p-8 text-center text-red-500">
                    Error loading transactions: ${error.message}
                </div>
            `;
        }
    };

    // Load orders for a customer
    this.loadOrders = async function (customerData) {
        const tabContent = document.getElementById('tab-content');
        tabContent.innerHTML = `
            <div class="text-center py-8">
                <div class="animate-spin inline-block w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full"></div>
                <p class="mt-2 text-gray-600">Loading orders...</p>
            </div>
        `;

        try {
            const orders = await this.fetchOrdersForCustomer(customerData.id);

            if (orders.length === 0) {
                tabContent.innerHTML = `
                    <div class="p-8 text-center text-gray-500">
                        <div class="mb-4">
                            <i class="ph ph-shopping-bag text-6xl text-gray-200"></i>
                        </div>
                        <p>No orders found for this customer.</p>
                    </div>
                `;
                return;
            }

            let html = '<ul class="space-y-4">';
            for (const order of orders) {
                html += `
                    <li class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                        <div class="p-4">
                            <div class="flex justify-between items-start mb-4">
                                <div class="flex items-center gap-3">
                                    <div class="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                                        <i class="ph ph-shopping-bag text-blue-500"></i>
                                    </div>
                                    <div>
                                        <h4 class="font-medium">Order #${order.billNo}</h4>
                                        <p class="text-sm text-gray-500">${this.formatDate(order.date)}</p>
                                    </div>
                                </div>
                                <div class="flex items-center gap-2">
                                    <span class="px-2.5 py-1 text-xs font-medium rounded-full ${order.paid ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'
                    }">
                                        ${order.paid ? 'Paid' : 'Pending'}
                                    </span>
                                    <span class="px-2.5 py-1 text-xs font-medium rounded-full ${order.payMode === 'CASH' ? 'bg-green-50 text-green-600' :
                        order.payMode === 'DIGITAL' ? 'bg-blue-50 text-blue-600' :
                            'bg-orange-50 text-orange-600'
                    }">
                                        ${order.payMode}
                                    </span>
                                </div>
                            </div>

                            <div class="border-t border-gray-100 -mx-4 px-4 py-3">
                                <div class="space-y-2">
                                    ${order.items.map(item => `
                                        <div class="flex justify-between items-center">
                                            <div class="flex items-center gap-2">
                                                <span class="w-6 h-6 flex items-center justify-center bg-gray-50 rounded text-xs font-medium">
                                                    ${item.quantity}x
                                                </span>
                                                <span class="text-sm">${item.title}</span>
                                            </div>
                                            <span class="text-sm font-medium">₹${item.total}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>

                            <div class="border-t border-gray-100 -mx-4 px-4 pt-3">
                                <div class="flex justify-between items-center text-sm">
                                    <span class="text-gray-600">Items Total</span>
                                    <span class="font-medium">₹${order.itemTotal}</span>
                                </div>
                                <div class="flex justify-between items-center text-sm mt-1">
                                    <span class="text-gray-600">Tax (18%)</span>
                                    <span class="font-medium">₹${order.taxAmount.toFixed(2)}</span>
                                </div>
                                ${order.discount > 0 ? `
                                    <div class="flex justify-between items-center text-sm mt-1">
                                        <span class="text-gray-600">Discount</span>
                                        <span class="font-medium text-green-600">-₹${order.discount}</span>
                                    </div>
                                ` : ''}
                                <div class="flex justify-between items-center font-medium mt-2 pt-2 border-t border-gray-100">
                                    <span>Total Amount</span>
                                    <span class="text-red-600">₹${(order.finalAmount - order.discount).toFixed(2)}</span>
                                </div>
                            </div>

                            ${order.instructions ? `
                                <div class="mt-3 text-sm text-gray-600">
                                    <i class="ph ph-note-pencil mr-1"></i>
                                    ${order.instructions}
                                </div>
                            ` : ''}
                        </div>
                    </li>
                `;
            }
            html += '</ul>';

            tabContent.innerHTML = html;
        } catch (error) {
            tabContent.innerHTML = `
                <div class="p-8 text-center text-red-500">
                    <div class="mb-2">
                        <i class="ph ph-warning text-3xl"></i>
                    </div>
                    <p>Error loading orders: ${error.message}</p>
                </div>
            `;
        }
    };

    // Fetch transactions for a customer from SDK
    this.fetchTransactionsForCustomer = async function (customerId) {
        try {
            // Get wallet transactions
            const walletSnapshot = await sdk.db.collection("Wallet")
                .where("customerId", "==", customerId)
                .get();

            const walletTrans = walletSnapshot.docs.map(doc => {
                const data = doc.data();
                // Handle both Firestore timestamp and JavaScript Date
                let transactionDate;
                if (data.date) {
                    // Check if it's a Firestore timestamp (has toDate method)
                    if (typeof data.date.toDate === 'function') {
                        transactionDate = data.date.toDate();
                    } else {
                        // Handle it as a JavaScript Date or timestamp number
                        transactionDate = new Date(data.date);
                    }
                } else {
                    transactionDate = new Date();
                }

                return {
                    id: doc.id,
                    amount: data.amount || 0,
                    type: 'DEPOSIT',
                    date: transactionDate,
                    description: `Deposited ₹${data.amount} in ${data.mode} payment.`,
                    balance: 0 // Will calculate
                };
            });

            // Get credit orders
            const ordersSnapshot = await sdk.db.collection("Orders")
                .where("custId", "==", customerId)
                .where("payMode", "==", "CREDIT")
                .get();

            const orderTrans = ordersSnapshot.docs.map(doc => {
                const data = doc.data();
                // Handle both Firestore timestamp and JavaScript Date
                let orderDate;
                if (data.placeDate) {
                    // Check if it's a Firestore timestamp (has toDate method)
                    if (typeof data.placeDate.toDate === 'function') {
                        orderDate = data.placeDate.toDate();
                    } else {
                        // Handle it as a JavaScript Date or timestamp number
                        orderDate = new Date(data.placeDate);
                    }
                } else {
                    orderDate = new Date();
                }

                return {
                    id: doc.id,
                    amount: data.total || 0,
                    type: 'CREDIT',
                    date: orderDate,
                    description: `Items: ${data.description || ''}`,
                    balance: 0, // Will calculate
                    order: { id: doc.id, ...data }
                };
            });

            // Combine and calculate running balance
            const allTrans = [...walletTrans, ...orderTrans].sort((a, b) => a.date - b.date);
            let balance = 0;

            for (const t of allTrans) {
                if (t.type === 'CREDIT') {
                    balance -= t.amount;
                } else {
                    balance += t.amount;
                }
                t.balance = balance;
            }

            // Return sorted by newest first
            return allTrans.sort((a, b) => b.date - a.date);
        } catch (error) {
            console.error("Error fetching transactions:", error);
            return [];
        }
    };

    // Fetch orders for a customer from SDK
    this.fetchOrdersForCustomer = async function (customerId) {
        try {
            // Get orders with customer ID
            const snapshot = await sdk.db.collection("Orders")
                .where("custId", "==", customerId)
                .orderBy("date", "desc")
                .get();

            // Map orders with detailed information
            return snapshot.docs.map(doc => {
                const data = doc.data();
                // Handle both Firestore timestamp and JavaScript Date
                let orderDate = null;
                if (data.date) {
                    orderDate = typeof data.date.toDate === 'function' ? data.date.toDate() : new Date(data.date);
                }

                // Calculate totals
                const itemTotal = data.items?.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || item.qnt || 1)), 0) || 0;
                const taxAmount = itemTotal * 0.18; // 18% tax
                const finalAmount = itemTotal + taxAmount;

                // Format items with details
                const formattedItems = data.items?.map(item => ({
                    title: item.title || 'Unknown Item',
                    price: item.price || 0,
                    quantity: item.quantity || item.qnt || 1,
                    total: (item.price || 0) * (item.quantity || item.qnt || 1),
                    served: item.served || false
                })) || [];

                return {
                    id: doc.id,
                    date: orderDate,
                    items: formattedItems,
                    itemTotal: itemTotal,
                    taxAmount: taxAmount,
                    finalAmount: finalAmount,
                    payMode: data.payMode || 'CASH',
                    paid: data.paid || false,
                    status: data.currentStatus?.label || 'PLACED',
                    billNo: data.billNo || doc.id.slice(-6),
                    instructions: data.instructions || '',
                    discount: data.discount || 0
                };
            });
        } catch (error) {
            console.error("Error fetching orders:", error);
            return [];
        }
    };

    // Format date helper
    this.formatDate = function (date) {
        if (!date) return 'N/A';
        try {
            return new Date(date).toLocaleDateString();
        } catch (e) {
            return 'N/A';
        }
    };

    // Handle deposit dialog
    this.handleDeposit = function (customerData) {
        const depositContent = `
            <div class="p-4">
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Customer</label>
                    <div class="flex items-center p-3 bg-gray-50 rounded-lg">
                        <div class="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center mr-3 border border-red-100">
                            <i class="ph ph-user text-red-400"></i>
                        </div>
                        <div>
                            <p class="font-medium">${customerData.name || 'Unknown'}</p>
                            <p class="text-sm text-gray-500">${customerData.phone || 'No phone'}</p>
                        </div>
                    </div>
                </div>
                <div class="mb-4">
                    <label for="deposit-amount" class="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                    <div class="relative">
                        <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                            <span class="text-gray-500">₹</span>
                        </div>
                        <input type="number" id="deposit-amount" class="block w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500" placeholder="0.00" min="1" step="1">
                    </div>
                </div>
                <div class="mb-6">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Payment Mode</label>
                    <div class="flex space-x-3">
                        <label class="flex-1 flex items-center border rounded-md p-3 cursor-pointer hover:bg-gray-50">
                            <input type="radio" name="payment-mode" value="CASH" class="mr-2" checked>
                            <span>Cash</span>
                        </label>
                        <label class="flex-1 flex items-center border rounded-md p-3 cursor-pointer hover:bg-gray-50">
                            <input type="radio" name="payment-mode" value="DIGITAL" class="mr-2">
                            <span>UPI</span>
                        </label>
                    </div>
                </div>
            </div>
        `;

        const depositActions = `
            <button id="submit-deposit" class="w-full bg-red-500 text-white py-3 px-4 rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 font-medium">
                Add Balance
            </button>
        `;

        const self = this;
        const depositModal = window.ModalManager.createSideDrawerModal({
            id: 'deposit-modal',
            title: 'Add Balance',
            content: depositContent,
            actions: depositActions,
            zIndex: 1060,
            closeOnBackdropClick: true,
            onShown: (modalControl) => {
                document.getElementById('submit-deposit').addEventListener('click', async function () {
                    const amount = Number(document.getElementById('deposit-amount').value);
                    const paymentMode = document.querySelector('input[name="payment-mode"]:checked').value;

                    if (!amount || amount <= 0) {
                        window.ModalManager.showToast('Please enter a valid amount', { type: 'error' });
                        return;
                    }

                    try {
                        // Add to wallet collection
                        await sdk.db.collection("Wallet").add({
                            amount: amount,
                            mode: paymentMode,
                            customerId: customerData.id,
                            date: new Date()
                        });

                        // Show success message
                        window.ModalManager.showToast(`Added ₹${amount} to ${customerData.name}'s balance`);

                        // Close modal
                        modalControl.close();

                        // Refresh data
                        self.showCustomerDetailsModal(customerData);

                        // Refresh customers list in main page
                        if (window.refreshCustomers && typeof window.refreshCustomers === 'function') {
                            window.refreshCustomers();
                        }
                    } catch (error) {
                        console.error("Error adding balance:", error);
                        window.ModalManager.showToast("Failed to add balance", { type: "error" });
                    }
                });
            }
        });
    };

    // Handle edit name dialog
    this.handleEditName = function (customerData) {
        const editNameContent = `
            <div class="p-4">
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input type="text" id="customer-name" class="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500" 
                           value="${customerData.name || ''}" placeholder="Customer name">
                </div>
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input type="tel" id="customer-phone" class="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500" 
                           value="${customerData.phone || ''}" placeholder="Phone number">
                </div>
            </div>
        `;

        const editNameActions = `
            <div class="flex justify-end space-x-2">
                <button id="cancel-edit" class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
                    Cancel
                </button>
                <button id="submit-edit" class="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600">
                    Save
                </button>
            </div>
        `;

        const self = this;
        const editModal = window.ModalManager.createSideDrawerModal({
            id: 'edit-name-modal',
            title: 'Edit Customer',
            content: editNameContent,
            actions: editNameActions,
            zIndex: 1060,
            closeOnBackdropClick: true,
            onShown: (modalControl) => {
                document.getElementById('cancel-edit').addEventListener('click', () => {
                    modalControl.close();
                });

                document.getElementById('submit-edit').addEventListener('click', async function () {
                    const name = document.getElementById('customer-name').value;
                    const phone = document.getElementById('customer-phone').value;
                    if (!name || !phone) return;

                    try {
                        await sdk.db.collection("Customers").doc(customerData.id).update({
                            name: name,
                            phone: phone
                        });

                        // Show success message
                        window.ModalManager.showToast(`Updated customer details`);

                        // Close modal
                        modalControl.close();

                        // Update customer object
                        customerData.name = name;
                        customerData.phone = phone;

                        // Refresh view
                        self.showCustomerDetailsModal(customerData);

                        // Refresh customers list
                        if (window.refreshCustomers && typeof window.refreshCustomers === 'function') {
                            window.refreshCustomers();
                        }
                    } catch (error) {
                        console.error("Error updating customer details:", error);
                        window.ModalManager.showToast("Failed to update details", { type: "error" });
                    }
                });

                // Focus the input field
                document.getElementById('customer-name').focus();
            }
        });
    };

    // Handle send reminder
    this.handleSendReminder = function (customerData) {
        if (!customerData.phone) {
            window.ModalManager.showToast("No phone number available for this customer", { type: "error" });
            return;
        }

        const balance = Number(customerData.balance || 0);
        if (balance >= 0) {
            window.ModalManager.showToast("This customer doesn't have a negative balance", { type: "error" });
            return;
        }

        const message = `Hi ${customerData.name || 'Customer'}, this is a reminder that you have an outstanding balance of ₹${Math.abs(balance)} with us. Please clear your dues at your earliest convenience. Thank you.`;

        window.open(`https://wa.me/${customerData.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');

        window.ModalManager.showToast("WhatsApp message opened", { type: "success" });
    };

    // Use common toast
    this.showToast = function (message, type = "success") {
        window.ModalManager.showToast(message, { type });
    };

    // Update the customer UI when data changes
    this.updateCustomerUI = function (customerData, modal) {
        if (!modal) return;

        // Update balance display
        const balanceElement = modal.container.querySelector('.mt-4.p-4.bg-red-50 p.text-xl.font-bold');
        if (balanceElement) {
            balanceElement.className = `text-xl font-bold ${Number(customerData.balance || 0) < 0 ? 'text-red-600' : 'text-green-600'}`;
            balanceElement.textContent = `₹${Number(customerData.balance || 0) < 0
                ? `-${Math.abs(Number(customerData.balance || 0)).toLocaleString()}`
                : (Number(customerData.balance || 0)).toLocaleString()}`;
        }

        // Check if we need to update reminder button visibility
        const actionsContainer = modal.container.querySelector('.mt-4.p-4.bg-red-50 .flex.space-x-2');
        if (actionsContainer) {
            const hasReminderBtn = !!actionsContainer.querySelector('#send-reminder');
            const shouldHaveReminderBtn = Number(customerData.balance || 0) < 0;

            if (shouldHaveReminderBtn && !hasReminderBtn) {
                // Add reminder button if needed
                const reminderBtn = document.createElement('button');
                reminderBtn.id = 'send-reminder';
                reminderBtn.className = 'px-3 py-2 bg-red-500 text-white text-sm rounded-lg flex items-center hover:bg-red-600';
                reminderBtn.innerHTML = '<i class="ph ph-paper-plane-tilt mr-1.5"></i>Send Reminder';
                reminderBtn.addEventListener('click', () => {
                    this.handleSendReminder(customerData);
                });
                actionsContainer.insertBefore(reminderBtn, actionsContainer.firstChild);
            } else if (!shouldHaveReminderBtn && hasReminderBtn) {
                // Remove reminder button if no longer needed
                actionsContainer.querySelector('#send-reminder').remove();
            }
        }
    };

    // Clean up when modal is closed
    this.closeModal = function () {
        // Clear the listeners
        if (this.customerListener) {
            this.customerListener();
            this.customerListener = null;
        }

        if (this.walletListener) {
            this.walletListener();
            this.walletListener = null;
        }

        if (this.modalControl) {
            this.modalControl.close();
            this.modalControl = null;
        }
    };
}

// Static method for global access
CustomerDetails.showCustomerDetailsModal = function (customer, existingModal) {
    const instance = new CustomerDetails();
    return instance.showCustomerDetailsModal(customer, existingModal);
};

// Make the component globally available
window.CustomerDetails = CustomerDetails; 