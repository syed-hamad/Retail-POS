// BluetoothPrinting.js - Service for handling Bluetooth thermal printer connections
// This service uses Web Bluetooth API which is supported in Chrome and Edge, but not Safari or Firefox

/**
 * BluetoothPrinting provides methods to connect to and print to Bluetooth thermal printers
 * using Web Bluetooth API
 */
class BluetoothPrinting {
    constructor() {
        // Initialize printer sizes first
        this.printerSizes = {
            '2inch': 32,  // 2-inch thermal printer (32 characters)
            '3inch': 48,  // 3-inch thermal printer (48 characters)
            '4inch': 64   // 4-inch thermal printer (64 characters)
        };

        this.printer = null;
        this.connected = false;
        this.device = null;
        this.characteristic = null;
        this.encoder = new TextEncoder();

        // Initialize printer width after printerSizes is defined
        const size = this.getSavedPrinterWidth();
        this.printerWidth = size || this.printerSizes['3inch']; // Default to 48 characters (standard 3-inch)

        // Try to restore the last successful connection info from localStorage
        this.lastConnectedDevice = this.getSavedPrinter();

        // Track attempts to auto-reconnect to prevent infinite loops
        this.reconnectAttempted = false;

        // Cache for loaded logo images
        this.imageCache = new Map();

        // Initialize managed printers list
        this.managedPrinters = this.getSavedPrinters() || [];

        // Initialize active printer selection - defaults to the most recently used printer
        this.activePrinterId = this.getActivePrinterId();
    }

    /**
     * Initialize the BluetoothPrinting service and potentially restore connection
     * Call this method when the app starts
     */
    initialize() {
        console.log('Initializing BluetoothPrinting service');

        // Reset flags
        this.reconnectAttempted = false;

        // Attempt to silently reconnect if we have a saved printer and browser supports it
        if (this.isSupported() && this.lastConnectedDevice && !this.connected) {
            console.log('Attempting to restore printer connection on initialization');
            setTimeout(() => {
                this.attemptSilentReconnect()
                    .then(success => {
                        if (success) {
                            console.log('Successfully restored printer connection on initialization');
                            // Add event listeners for browser visibility changes
                            this._setupVisibilityListeners();
                        }
                    })
                    .catch(err => {
                        console.error('Failed to restore printer connection:', err);
                    });
            }, 1000); // Slight delay to ensure DOM is fully loaded
        }
    }

    /**
     * Print a KOT (Kitchen Order Ticket) for a specific order
     * This method handles all aspects of printing including connections and error handling
     * @param {string} orderId - The ID of the order to print
     * @param {string} [channel] - Optional order channel for printer selection
     * @returns {Promise<boolean>} True if printing was successful
     */
    async printKOT(orderId, channel = 'Default') {
        if (!orderId) {
            this._showToast("No order ID provided for KOT printing", "error");
            return false;
        }

        try {
            return await this._printReceipt(orderId, 'kot', null, false, channel);
        } catch (error) {
            console.error('Error in printKOT:', error);
            this._showToast(`Failed to print KOT: ${error.message}`, "error");
            return false;
        }
    }

    /**
     * Print a bill receipt for a specific order
     * This method handles all aspects of printing including connections and error handling
     * @param {string} orderId - The ID of the order to print
     * @param {string} [paymentMode] - Optional payment mode to include on the bill
     * @param {boolean} [autoPrint=false] - Whether to attempt auto-printing without dialog
     * @param {string} [channel] - Optional order channel for printer selection
     * @returns {Promise<boolean>} True if printing was successful
     */
    async printBill(orderId, paymentMode, autoPrint = false, channel = 'Default') {
        if (!orderId) {
            this._showToast("No order ID provided for bill printing", "error");
            return false;
        }

        try {
            return await this._printReceipt(orderId, 'bill', paymentMode, autoPrint, channel);
        } catch (error) {
            console.error('Error in printBill:', error);
            this._showToast(`Failed to print bill: ${error.message}`, "error");
            return false;
        }
    }

    /**
     * Shared printing function used by both printKOT and printBill
     * @param {string} orderId - The ID of the order to print
     * @param {string} type - The type of receipt ('kot' or 'bill')
     * @param {string} [paymentMode] - Optional payment mode for bills
     * @param {boolean} [autoPrint=false] - Whether to attempt auto-printing without dialog
     * @param {string} [channel] - Optional order channel for printer selection
     * @returns {Promise<boolean>} True if printing was successful
     * @private
     */
    async _printReceipt(orderId, type, paymentMode, autoPrint = false, channel = 'Default') {
        // Fetch order data
        const orderData = await this.getOrderData(orderId);
        if (!orderData) {
            this._showToast("Order not found", "error");
            return false;
        }

        // Use order's channel if not provided
        if (!channel && orderData.priceVariant) {
            channel = orderData.priceVariant;
        }

        // Generate HTML for the receipt
        const receiptHtml = this.generateReceiptHTML(orderData, type, paymentMode);

        // Find the appropriate printer for this channel and receipt type
        const printer = this.getPrinterForChannel(channel, type);

        // Determine display name for receipt type
        const receiptName = type === 'kot' ? 'KOT' : 'bill';

        // Try Bluetooth printing first if supported
        if (this.isSupported()) {
            try {
                // Try printer-specific or default connection
                await this._connectToPrinter(printer, receiptName);

                // Convert HTML to printer-compatible canvas data and send
                await this._sendReceiptToPrinter(receiptHtml, receiptName);

                return true;
            } catch (error) {
                // Handle printer error and try browser printing if appropriate
                const errorType = this._handlePrinterError(error);

                // If it's a user cancellation, don't attempt fallback
                if (errorType === "user_cancelled") {
                    return false;
                }

                // Try browser printing as fallback
                return await this._fallbackToBrowserPrinting(receiptHtml, receiptName, autoPrint);
            }
        } else {
            // No Bluetooth support, use browser print directly
            return await this._fallbackToBrowserPrinting(receiptHtml, receiptName, autoPrint);
        }
    }

    /**
     * Attempts to connect to a specific printer or default printer
     * @param {Object} printer - Specific printer to use or null for default flow
     * @param {string} receiptName - Name of receipt for user messages
     * @returns {Promise<boolean>} True if successfully connected
     * @private
     */
    async _connectToPrinter(printer, receiptName) {
        // If we have a specific printer for this channel, use it
        if (printer) {
            // Save current connection state
            const previousDevice = this.device;
            const previousConnected = this.connected;
            const previousCharacteristic = this.characteristic;

            try {
                // Temporarily set this device as the last connected device
                this.lastConnectedDevice = {
                    id: printer.deviceId,
                    name: printer.name
                };

                // Only show a connection message if we're not already connected
                if (!this.connected) {
                    this._showToast(`Connecting to ${printer.name || 'printer'}...`, "info");
                }

                // Connect to this specific printer
                await this.ensurePrinterConnection();
                return true;
            } catch (specificPrinterError) {
                console.error(`Error using specific printer:`, specificPrinterError);

                // Restore previous connection state for fallback
                this.device = previousDevice;
                this.connected = previousConnected;
                this.characteristic = previousCharacteristic;

                // Continue to default connection path
            }
        }

        // Default printing path - only show connection messages if we're not connected yet
        if (!this.connected) {
            if (this.lastConnectedDevice) {
                this._showToast("Connecting to printer...", "info");
            } else {
                this._showToast(`Select a printer for ${receiptName}`, "info");
            }
        }

        await this.ensurePrinterConnection();
        return true;
    }

    /**
     * Send receipt to the connected printer
     * @param {string} receiptHtml - HTML content to print
     * @param {string} receiptName - Name of receipt for user messages
     * @returns {Promise<boolean>} True if successfully sent to printer
     * @private
     */
    async _sendReceiptToPrinter(receiptHtml, receiptName) {
        // We're connected now, show a single printing message
        this._showToast(`Printing ${receiptName}...`, "info");

        // Convert HTML to printer-compatible canvas data
        const data = await this.htmlToCanvas(receiptHtml);

        // Send to printer
        await this.sendData(data);
        this._showToast(`${receiptName} printed successfully`, "success");

        // Save the connected printer to the printer list
        this.savePrinter();

        return true;
    }

    /**
     * Fallback to browser printing when Bluetooth printing fails
     * @param {string} receiptHtml - HTML content to print
     * @param {string} receiptName - Name of receipt for user messages
     * @param {boolean} autoPrint - Whether to attempt auto-printing
     * @returns {Promise<boolean>} True if browser printing was successful
     * @private
     */
    async _fallbackToBrowserPrinting(receiptHtml, receiptName, autoPrint) {
        this._showToast(`Attempting browser print for ${receiptName}...`, "info");
        try {
            await this.browserPrint(receiptHtml, autoPrint);
            this._showToast(`${receiptName} printed successfully via browser`, "success");
            return true;
        } catch (fallbackErr) {
            console.error("Browser print fallback failed:", fallbackErr);
            this._showToast(`Browser print failed: ${fallbackErr.message}`, "error");
            return false;
        }
    }

    /**
     * Send raw data to the printer
     * @param {Uint8Array} data - ESC/POS command bytes to send to the printer
     */
    async sendData(data) {
        if (!this.connected || !this.characteristic) {
            throw new Error('Printer not connected. Call connect() first.');
        }

        // Log byte size
        console.log("Printer data size:", data.byteLength, "bytes");

        const MAX_RETRIES = 3;
        const RETRY_DELAY_MS = 500; // Increased retry delay
        const INTER_CHUNK_DELAY_MS = 100; // Increased delay between chunks
        const DEFAULT_CHUNK_SIZE = 300; // Smaller chunk size for better reliability

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                // Get the best chunk size, but don't exceed our default
                const CHUNK_SIZE = (this.characteristic?.service?.device?.gatt?.server?.maxGATTCharacteristicWriteSize)
                    ? Math.min(this.characteristic.service.device.gatt.server.maxGATTCharacteristicWriteSize, DEFAULT_CHUNK_SIZE)
                    : DEFAULT_CHUNK_SIZE;

                // Break data into chunks and send with delays between chunks
                for (let i = 0; i < data.length; i += CHUNK_SIZE) {
                    const chunk = data.slice(i, i + CHUNK_SIZE);

                    // Log progress for debugging
                    if (i % 1000 === 0 || i + CHUNK_SIZE >= data.length) {
                        console.log(`Sending chunk ${i}-${i + chunk.length} of ${data.length} bytes`);
                    }

                    // Choose write method based on characteristic properties
                    if (this.characteristic.properties.writeWithoutResponse) {
                        await this.characteristic.writeValueWithoutResponse(chunk);
                    } else {
                        await this.characteristic.writeValue(chunk);
                    }

                    // Add a delay between chunks to give the printer time to process
                    if (data.length > CHUNK_SIZE && i < data.length - CHUNK_SIZE) {
                        await new Promise(resolve => setTimeout(resolve, INTER_CHUNK_DELAY_MS));
                    }
                }

                console.log("Data transmission successful");
                return true;
            } catch (error) {
                console.warn(`Attempt ${attempt} to send data failed:`, error.message);

                if (attempt === MAX_RETRIES) {
                    console.error('Error sending data to printer after multiple retries:', error);
                    throw error; // Rethrow error after max retries
                }

                // Wait longer between retries
                console.log(`Retrying in ${RETRY_DELAY_MS * attempt}ms...`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
            }
        }

        throw new Error('Failed to send data to printer after multiple retries.');
    }

    /**
     * Ensure printer is connected, trying silent reconnect first and then user-prompted connection if needed
     * @returns {Promise<boolean>} True if connection succeeded
     * @private
     */
    async ensurePrinterConnection() {
        if (!this.connected) {
            // First try silent reconnect if we have a saved printer
            const silentReconnected = await this.attemptSilentReconnect();

            // If silent reconnect fails, try regular connection with user interaction
            if (!silentReconnected) {
                try {
                    // Check if we have a saved printer to suggest
                    if (this.lastConnectedDevice) {
                        console.log(`Attempting to reconnect to last used printer: ${this.lastConnectedDevice.name}`);
                        // No toast notification here - let the calling method handle user-facing notifications
                    }

                    await this.connect();
                } catch (connectError) {
                    // Handle user cancellation with a specific error
                    if (connectError.message.includes("Device selection cancelled") ||
                        connectError.message.includes("cancelled by user")) {
                        throw new Error("Printing cancelled: No printer selected");
                    }
                    // Handle unsupported device errors with a friendly message
                    if (connectError.name === 'NetworkError' ||
                        connectError.message.includes('not supported as a printer') ||
                        connectError.message.includes('Unsupported device')) {
                        throw new Error("This device cannot be used for printing. Please select a compatible Bluetooth printer.");
                    }
                    throw connectError;
                }
            } else {
                console.log('Successfully reconnected to printer silently!');
                // Reset reconnect attempt flag since we had a successful connection
                this.reconnectAttempted = false;
            }
        } else {
            console.log('Printer already connected, no reconnection needed');
        }
        return true;
    }

    /**
     * Fetch order data from Firestore
     * @param {string} orderId - The ID of the order to fetch
     * @returns {Promise<Object>} The order data
     * @private
     */
    async getOrderData(orderId) {
        const orderRef = window.sdk.db.collection("Orders").doc(orderId);
        const orderDoc = await orderRef.get();
        const orderData = orderDoc.data();

        if (!orderData) {
            throw new Error("Order not found");
        }

        return orderData;
    }

    /**
     * Get list of saved printers
     * @returns {Array} List of saved printers
     */
    getSavedPrinters() {
        try {
            const savedPrinters = localStorage.getItem('managedPrinters');
            if (savedPrinters) {
                return JSON.parse(savedPrinters);
            }
        } catch (error) {
            console.error('Error retrieving saved printers:', error);
        }
        return [];
    }

    /**
     * Save the list of managed printers
     * @param {Array} printers - The printers to save
     * @private
     */
    savePrinters(printers) {
        try {
            localStorage.setItem('managedPrinters', JSON.stringify(printers));
            this.managedPrinters = printers;
        } catch (error) {
            console.error('Error saving printers:', error);
        }
    }

    /**
     * Get the active printer ID
     * @returns {string|null} The active printer ID or null if none
     */
    getActivePrinterId() {
        try {
            return localStorage.getItem('activePrinterId') || null;
        } catch (error) {
            console.error('Error retrieving active printer ID:', error);
            return null;
        }
    }

    /**
     * Set the active printer ID
     * @param {string} printerId - The ID of the printer to set as active
     */
    setActivePrinterId(printerId) {
        try {
            localStorage.setItem('activePrinterId', printerId);
            this.activePrinterId = printerId;
        } catch (error) {
            console.error('Error saving active printer ID:', error);
        }
    }

    /**
     * Add a printer to the managed printers list
     * @param {Object} printer - The printer to add
     * @param {boolean} setAsDefault - Whether to set this printer as the default
     * @returns {Object} The added printer with generated ID
     */
    addPrinter(printer, setAsDefault = false) {
        try {
            const printers = this.getSavedPrinters();

            // Generate a unique ID if none provided
            const newPrinter = {
                ...printer,
                id: printer.id || `printer_${Date.now()}`,
                isDefault: setAsDefault
            };

            // If this is marked as default, unmark any existing default
            if (setAsDefault) {
                printers.forEach(p => p.isDefault = false);
            }

            // Add the new printer
            printers.push(newPrinter);

            // Save the updated list
            this.savePrinters(printers);

            // If this is the first printer or default, set it as active
            if (setAsDefault || printers.length === 1) {
                this.setActivePrinterId(newPrinter.id);
            }

            return newPrinter;
        } catch (error) {
            console.error('Error adding printer:', error);
            throw error;
        }
    }

    /**
     * Update a printer's properties
     * @param {string} printerId - The ID of the printer to update
     * @param {Object} updates - The properties to update
     * @returns {Object|null} The updated printer or null if not found
     */
    updatePrinter(printerId, updates) {
        try {
            const printers = this.getSavedPrinters();
            const index = printers.findIndex(p => p.id === printerId);

            if (index === -1) {
                console.error(`Printer with ID ${printerId} not found`);
                return null;
            }

            // If setting this as default, unmark others
            if (updates.isDefault) {
                printers.forEach(p => p.isDefault = false);
            }

            // Update the printer
            printers[index] = {
                ...printers[index],
                ...updates
            };

            // Save the updated list
            this.savePrinters(printers);

            return printers[index];
        } catch (error) {
            console.error('Error updating printer:', error);
            throw error;
        }
    }

    /**
     * Remove a printer from the managed printers list
     * @param {string} printerId - The ID of the printer to remove
     * @returns {boolean} True if successful, false otherwise
     */
    removePrinter(printerId) {
        try {
            let printers = this.getSavedPrinters();
            const removedPrinter = printers.find(p => p.id === printerId);

            if (!removedPrinter) {
                return false;
            }

            // Remove the printer
            printers = printers.filter(p => p.id !== printerId);

            // If we removed the default printer, set a new default if possible
            if (removedPrinter.isDefault && printers.length > 0) {
                printers[0].isDefault = true;
            }

            // If we removed the active printer, set a new active if possible
            if (this.activePrinterId === printerId && printers.length > 0) {
                this.setActivePrinterId(printers[0].id);
            } else if (printers.length === 0) {
                this.setActivePrinterId(null);
            }

            // Save the updated list
            this.savePrinters(printers);

            return true;
        } catch (error) {
            console.error('Error removing printer:', error);
            throw error;
        }
    }

    /**
     * Get the appropriate printer for a given order channel and print type
     * @param {string} channel - The order channel ('Default', 'Swiggy', etc.)
     * @param {string} printType - The print type ('kot' or 'bill')
     * @returns {Object|null} The printer to use or null if none found
     */
    getPrinterForChannel(channel, printType) {
        const printers = this.getSavedPrinters();

        if (printers.length === 0) {
            return null;
        }

        // First, look for a printer specifically assigned to this channel and print type
        let printer = printers.find(p =>
            p.assignments &&
            p.assignments.some(a =>
                a.channel === channel &&
                (a.printType === printType || a.printType === 'all')
            )
        );

        // If none found, try to find a printer assigned to "All Channels" with this print type
        if (!printer) {
            printer = printers.find(p =>
                p.assignments &&
                p.assignments.some(a =>
                    a.channel === 'All Channels' &&
                    (a.printType === printType || a.printType === 'all')
                )
            );
        }

        // If still none found, use the default printer
        if (!printer) {
            printer = printers.find(p => p.isDefault);
        }

        // If still none found, use the first available printer
        if (!printer && printers.length > 0) {
            printer = printers[0];
        }

        return printer;
    }

    /**
     * Helper method to show toast notifications via ModalManager or fallback function
     * @param {string} message - The message to show
     * @param {string} [type='info'] - The type of toast (success, error, warning, info)
     * @private
     */
    _showToast(message, type = 'info') {
        if (window.ModalManager && typeof window.ModalManager.showToast === 'function') {
            window.ModalManager.showToast(message, { type });
        } else if (typeof window.showToast === 'function') {
            window.showToast(message, type);
        } else {
            console.log(`[Toast ${type}]: ${message}`);
        }
    }

    /**
     * Handle printer connection errors with appropriate user feedback
     * @param {Error} error - The error to handle
     * @returns {string} - Classification of the error
     * @private
     */
    _handlePrinterError(error, showToasts = true) {
        console.error('Printer error:', error);

        // User cancelled the connection
        if (error.message?.includes("cancelled") ||
            error.message?.includes("No printer selected") ||
            error.name === "NotFoundError") {
            if (showToasts) {
                this._showToast("Printing cancelled by user", "info");
            }
            return "user_cancelled";
        }

        // Incompatible device errors
        if (error.message?.includes("No suitable service") ||
            error.message?.includes("No services found") ||
            error.message?.includes("not supported as a printer") ||
            error.message?.includes("cannot be used for printing") ||
            (error.name === 'NetworkError' && error.message?.includes("Unsupported device"))) {
            if (showToasts) {
                this._showToast("Could not connect to printer. Please select a compatible thermal printer.", "error");
            }
            return "incompatible_device";
        }

        // Generic connection errors
        if (error.name === "NetworkError" ||
            error.message?.includes("disconnected") ||
            error.message?.includes("connection") ||
            error.message?.includes("GATT")) {
            if (showToasts) {
                this._showToast(`Printer connection error: ${error.message}`, "error");
            }
            return "connection_error";
        }

        // Generic errors
        if (showToasts) {
            this._showToast(`Printing error: ${error.message}`, "error");
        }
        return "other_error";
    }

    /**
     * Generate HTML for a receipt or KOT based on order data and template
     * This centralized method generates consistent HTML for both browser printing and Bluetooth printing
     * @param {Object} orderData - The order data object
     * @param {string} type - 'bill' or 'kot' to determine the type of receipt
     * @param {string} [paymentMode] - Optional payment mode for bills
     * @returns {string} HTML content for the receipt
     */
    generateReceiptHTML(orderData, type, paymentMode) {
        const seller = window.UserSession?.seller || {};
        const paperWidth = '58mm'; // Standard thermal paper width

        // Check if we have a custom template
        const hasCustomTemplate = seller.printTemplate &&
            seller.printTemplate[type.toLowerCase()] &&
            seller.printTemplate[type.toLowerCase()].sections &&
            seller.printTemplate[type.toLowerCase()].sections.length > 0;

        // If we have a custom template, use it
        if (hasCustomTemplate) {
            return this.generateTemplateBasedReceiptHTML(orderData, type, paymentMode, seller.printTemplate[type.toLowerCase()]);
        }

        // If no custom template, create a default template based on receipt type
        const defaultTemplate = this.createDefaultTemplate(type, orderData);

        // Use the template-based generation with our default template
        return this.generateTemplateBasedReceiptHTML(orderData, type, paymentMode, defaultTemplate);
    }

    /**
     * Create a default template based on receipt type
     * @param {string} type - 'bill' or 'kot'
     * @param {Object} orderData - Order data for context-specific templates
     * @returns {Object} A template object with sections
     * @private
     */
    createDefaultTemplate(type, orderData) {
        const isKOT = type.toLowerCase() === 'kot';
        const template = { sections: [] };

        // Header section
        template.sections.push({
            template: isKOT ?
                `<div style="font-size: 20px; font-weight: 800; text-align: center;">KOT</div>
                 ${orderData.tableId ? `<div style="font-size: 18px; text-align: center;">TABLE ${orderData.tableId}</div>` : ''}` :
                `${orderData.gstEnabled ? 'TAX INVOICE' : 'BILL/RECEIPT'}
                 #businessName
                 #address
                 Phone: #phone
                 Web: #storeLink
                 GST: #gstIN`,
            alignment: 'TextAlign.center',
            fontSize: 24,
            isBold: true
        });

        // Order details section
        template.sections.push({
            template: `${isKOT ? 'KOT' : 'Bill'} #: #billNo
                      Date: #timestamp
                      ${orderData.custName || orderData.customer?.name ? `Customer: ${orderData.custName || orderData.customer?.name}` : ''}
                      ${orderData.tableId ? `Table: ${orderData.tableId}` : ''}
                      ${!isKOT ? `Order from: #orderSource` : ''}`,
            alignment: 'TextAlign.left',
            fontSize: 20,
            isBold: false
        });

        // Items section
        template.sections.push({
            template: isKOT ? '#kotItemsList' : '#itemsList',
            alignment: 'TextAlign.left',
            fontSize: 20,
            isBold: false
        });

        // Totals section (for bills only)
        if (!isKOT) {
            template.sections.push({
                template: `Sub Total: #subtotal
                          ${orderData.discount && parseFloat(orderData.discount) > 0 ? 'Discount: #discount' : ''}
                          #charges
                          TOTAL: #total`,
                alignment: 'TextAlign.right',
                fontSize: 20,
                isBold: true
            });

            // Payment section
            template.sections.push({
                template: `Payment Mode: #payMode
                          ${orderData.notes ? orderData.notes : ''}`,
                alignment: 'TextAlign.left',
                fontSize: 20,
                isBold: false
            });

            // Footer
            template.sections.push({
                template: `Thank You!
                          Visit Again
                          #storeLink`,
                alignment: 'TextAlign.center',
                fontSize: 20,
                isBold: false
            });
        } else if (orderData.instructions) {
            // Notes section for KOT
            template.sections.push({
                template: `NOTES:
                          ${orderData.instructions.trim()}`,
                alignment: 'TextAlign.left',
                fontSize: 20,
                isBold: false
            });
        }

        return template;
    }

    /**
     * Process template variables and replace with actual values
     * @param {string} template - Template string with variables
     * @param {Object} orderData - Order data
     * @param {string} type - 'bill' or 'kot'
     * @param {string} paymentMode - Payment mode for bills
     * @param {Object} seller - Seller data
     * @returns {string} Processed template with variables replaced
     * @private
     */
    processTemplateVariables(template, orderData, type, paymentMode, seller) {
        if (!template) return '';

        let processedTemplate = template;

        // Basic replacements with printer-specific classes
        const replacements = {
            '#logo': seller.logo ?
                `<div class="printer-center"><img src="${seller.logo}" alt="Logo" style="max-width: 45mm; max-height: 15mm;"></div>` :
                '<div class="printer-center"><i class="ph ph-storefront" style="font-size: 24px;"></i></div>',
            '#businessName': `<div class="printer-center printer-large printer-bold">${seller.businessName || 'Your Business'}</div>`,
            '#phone': seller.phone ? `<div class="printer-center">Tel: ${seller.phone}</div>` : '',
            '#address': seller.address ? `<div class="printer-center">${seller.address}</div>` : '',
            '#storeLink': seller.website ? `<div class="printer-center">${seller.website}</div>` : '',
            '#gstIN': seller.gstIN ? `<div class="printer-center">GSTIN: ${seller.gstIN}</div>` : '',
            '#billNo': `<div class="printer-line">Bill #: ${orderData.billNo || orderData.id?.substring(0, 8) || 'N/A'}</div>`,
            '#orderSource': `<div class="printer-line">Source: ${orderData.priceVariant || 'Default'}</div>`,
            '#payMode': `<div class="printer-right">Payment: ${paymentMode || orderData.payMode || 'CASH'}</div>`,
            '#timestamp': `<div class="printer-center">${new Date(orderData.date?.toDate ? orderData.date.toDate() : orderData.date || new Date()).toLocaleString()}</div>`,
            '#cut': '<div class="printer-divider"></div>',
            '#upiQR': orderData.upiQR ? `<div class="printer-center"><div class="printer-qr"><i class="ph ph-qr-code"></i></div></div>` : ''
        };

        // Replace all simple variables
        Object.keys(replacements).forEach(key => {
            processedTemplate = processedTemplate.replace(new RegExp(key, 'g'), replacements[key]);
        });

        // Special handling for items list
        if (processedTemplate.includes('#itemsList')) {
            let itemsHtml = '';

            if (orderData.items && orderData.items.length > 0) {
                // Add header
                itemsHtml += `
                    <div class="printer-divider"></div>
                    <div class="printer-table">
                        <div class="printer-table-header">
                            <div class="printer-col-qty">Qty</div>
                            <div class="printer-col-name">Item</div>
                            <div class="printer-col-price">Amount</div>
                        </div>
                    </div>
                    <div class="printer-divider"></div>
                `;

                // Add items
                itemsHtml += '<div class="printer-table">';
                orderData.items.forEach(item => {
                    const quantity = parseFloat(item.quantity || item.qnt || 1);
                    const price = parseFloat(item.price || 0);
                    const amount = quantity * price;

                    // Pad quantity and price for alignment
                    const paddedQty = quantity.toString().padStart(2, ' ');
                    const paddedAmount = amount.toFixed(2).padStart(8, ' ');
                    const itemName = (item.title || 'Unknown Item').substring(0, 20); // Limit item name length

                    itemsHtml += `
                        <div class="printer-table-row">
                            <div class="printer-col-qty">${paddedQty}</div>
                            <div class="printer-col-name">${itemName}</div>
                            <div class="printer-col-price">${paddedAmount}</div>
                        </div>
                    `;
                });
                itemsHtml += '</div><div class="printer-divider"></div>';
            }

            processedTemplate = processedTemplate.replace('#itemsList', itemsHtml);
        }

        // Special handling for KOT items list
        if (processedTemplate.includes('#kotItemsList')) {
            let kotItemsHtml = '';

            if (orderData.items && orderData.items.length > 0) {
                kotItemsHtml += `
                    <div class="printer-center printer-large printer-bold">KITCHEN ORDER</div>
                    <div class="printer-divider"></div>
                `;

                orderData.items.forEach(item => {
                    const quantity = parseFloat(item.quantity || item.qnt || 1);

                    kotItemsHtml += `
                        <div class="printer-item printer-large">
                            <div class="printer-item-qty">${quantity}x</div>
                            <div class="printer-item-name printer-bold">${item.title || 'Unknown Item'}</div>
                        </div>
                    `;

                    if (item.instructions) {
                        kotItemsHtml += `
                            <div class="printer-line" style="padding-left: 30px; font-style: italic;">
                                Note: ${item.instructions.trim()}
                            </div>
                        `;
                    }
                });

                kotItemsHtml += '<div class="printer-divider"></div>';
            }

            processedTemplate = processedTemplate.replace('#kotItemsList', kotItemsHtml);
        }

        // Handle totals section
        if (processedTemplate.includes('#subtotal')) {
            let subtotal = 0;
            if (orderData.items && orderData.items.length > 0) {
                subtotal = orderData.items.reduce((total, item) => {
                    const quantity = parseFloat(item.quantity || item.qnt || 1);
                    const price = parseFloat(item.price || 0);
                    return total + (quantity * price);
                }, 0);
            }
            processedTemplate = processedTemplate.replace('#subtotal', `
                <div class="printer-total-row">
                    <div class="printer-total-label">Subtotal:</div>
                    <div class="printer-total-value">${subtotal.toFixed(2)}</div>
                </div>
            `);
        }

        // Handle discount
        if (processedTemplate.includes('#discount')) {
            const discount = orderData.discount ? parseFloat(orderData.discount) : 0;
            if (discount > 0) {
                processedTemplate = processedTemplate.replace('#discount', `
                    <div class="printer-total-row">
                        <div class="printer-total-label">Discount:</div>
                        <div class="printer-total-value">-${discount.toFixed(2)}</div>
                    </div>
                `);
            } else {
                processedTemplate = processedTemplate.replace('#discount', '');
            }
        }

        // Handle charges
        if (processedTemplate.includes('#charges')) {
            let chargesHtml = '';
            if (orderData.charges && Array.isArray(orderData.charges)) {
                orderData.charges.forEach(charge => {
                    if (charge.value && parseFloat(charge.value) !== 0) {
                        chargesHtml += `
                            <div class="printer-total-row">
                                <div class="printer-total-label">${charge.name}:</div>
                                <div class="printer-total-value">${parseFloat(charge.value).toFixed(2)}</div>
                            </div>
                        `;
                    }
                });
            }
            processedTemplate = processedTemplate.replace('#charges', chargesHtml);
        }

        // Handle total
        if (processedTemplate.includes('#total')) {
            let total = orderData.total;
            if (!total && orderData.items) {
                let subtotal = 0;
                if (orderData.items && orderData.items.length > 0) {
                    subtotal = orderData.items.reduce((total, item) => {
                        const quantity = parseFloat(item.quantity || item.qnt || 1);
                        const price = parseFloat(item.price || 0);
                        return total + (quantity * price);
                    }, 0);
                }

                if (orderData.charges && Array.isArray(orderData.charges)) {
                    orderData.charges.forEach(charge => {
                        if (charge.value) {
                            subtotal += parseFloat(charge.value);
                        }
                    });
                }

                if (orderData.discount) {
                    subtotal -= parseFloat(orderData.discount);
                }

                total = subtotal;
            }

            processedTemplate = processedTemplate.replace('#total', `
                <div class="printer-total-row printer-bold printer-large">
                    <div class="printer-total-label">TOTAL:</div>
                    <div class="printer-total-value">${typeof total === 'number' ? total.toFixed(2) : total || '0.00'}</div>
                </div>
            `);
        }

        return processedTemplate;
    }

    /**
     * Generate HTML receipt based on a custom template
     * @param {Object} orderData - The order data
     * @param {string} type - 'bill' or 'kot'
     * @param {string} paymentMode - Payment mode for bills
     * @param {Object} template - The template object with sections
     * @returns {string} Generated HTML
     * @private
     */
    generateTemplateBasedReceiptHTML(orderData, type, paymentMode, template) {
        const seller = window.UserSession?.seller || {};
        const paperWidth = '58mm'; // Standard thermal paper width

        // Initialize HTML with printer-specific container
        let html = `<div class="printer-container">`;

        // Process each template section
        if (template && template.sections && template.sections.length > 0) {
            template.sections.forEach(section => {
                // Get the content with variables replaced
                const content = this.processTemplateVariables(section.template, orderData, type, paymentMode, seller);

                // Determine alignment class
                let alignClass = 'printer-left';
                if (section.alignment === 'TextAlign.center') alignClass = 'printer-center';
                if (section.alignment === 'TextAlign.right') alignClass = 'printer-right';

                // Determine font size class
                const fontSize = section.fontSize || 24;
                const fontSizeClass = fontSize > 24 ? 'printer-large' : '';

                // Add the section content with appropriate classes
                html += `<div class="${alignClass} ${fontSizeClass} ${section.isBold ? 'printer-bold' : ''} printer-line">`;

                // Split by newlines and process each line
                const lines = content.split('\n');
                lines.forEach((line, index) => {
                    if (line.trim()) {
                        html += `${line}${index < lines.length - 1 ? '<br>' : ''}`;
                    }
                });

                html += `</div>`;

                // Add separator after non-empty sections
                if (content.trim()) {
                    html += `<div class="printer-divider"></div>`;
                }
            });
        }

        // Close the main container
        html += `</div>`;

        return html;
    }

    /**
     * Create a printable HTML document with proper styling
     * @param {string} contentHtml - The inner HTML content
     * @returns {string} Complete HTML document ready for printing
     */
    createPrintableHTML(contentHtml) {
        return `
            <html>
                <head>
                    <title>Print</title>
                    <style>
                        @font-face {
                            font-family: 'PrinterFont';
                            src: local('Courier New');
                            font-weight: normal;
                            font-style: normal;
                        }
                        
                        @media print {
                            @page { 
                                size: 58mm auto;
                                margin: 0mm;
                                padding: 0mm;
                            }
                            body { 
                                margin: 0;
                                padding: 0;
                                width: 58mm;
                                color: #000;
                                background: #fff;
                            }
                        }
                        
                        body {
                            font-family: 'PrinterFont', 'Courier New', monospace;
                            line-height: 1.2;
                            font-size: 12px;
                            width: 58mm;
                            margin: 0 auto;
                            padding: 4px;
                            background: white;
                            color: black;
                            -webkit-font-smoothing: none;
                        }

                        .printer-container {
                            width: 100%;
                            max-width: 58mm;
                            margin: 0 auto;
                            padding: 0;
                        }
                        
                        /* Table formatting for items */
                        .printer-table {
                            width: 100%;
                            table-layout: fixed;
                            border-collapse: collapse;
                        }

                        .printer-table-header {
                            display: flex;
                            width: 100%;
                            font-weight: bold;
                            border-bottom: 1px dashed #000;
                            padding: 2px 0;
                        }

                        .printer-table-row {
                            display: flex;
                            width: 100%;
                            padding: 2px 0;
                            white-space: pre;
                        }

                        .printer-col-qty {
                            width: 30px;
                            text-align: left;
                            flex-shrink: 0;
                            font-family: 'PrinterFont', 'Courier New', monospace;
                        }

                        .printer-col-name {
                            flex: 1;
                            padding: 0 4px;
                            white-space: nowrap;
                            overflow: hidden;
                            text-overflow: ellipsis;
                            font-family: 'PrinterFont', 'Courier New', monospace;
                        }

                        .printer-col-price {
                            width: 60px;
                            text-align: right;
                            flex-shrink: 0;
                            font-family: 'PrinterFont', 'Courier New', monospace;
                        }
                        
                        .printer-line {
                            white-space: pre;
                            overflow: hidden;
                            width: 100%;
                            margin: 2px 0;
                            font-family: 'PrinterFont', 'Courier New', monospace;
                        }
                        
                        .printer-center {
                            text-align: center;
                            width: 100%;
                        }
                        
                        .printer-right {
                            text-align: right;
                            width: 100%;
                        }

                        .printer-left {
                            text-align: left;
                            width: 100%;
                        }
                        
                        .printer-bold {
                            font-weight: bold;
                        }
                        
                        .printer-large {
                            font-size: 14px;
                            line-height: 1.4;
                        }
                        
                        .printer-divider {
                            border-top: 1px dashed #000;
                            margin: 4px 0;
                            width: 100%;
                        }
                        
                        .printer-qr {
                            width: 100px;
                            height: 100px;
                            margin: 8px auto;
                            border: 1px solid #000;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                        }

                        /* Ensure consistent spacing */
                        .printer-text {
                            letter-spacing: 0;
                            word-spacing: normal;
                        }

                        /* Totals section */
                        .printer-totals {
                            margin-top: 4px;
                            padding-top: 4px;
                            border-top: 1px dashed #000;
                        }

                        .printer-total-row {
                            display: flex;
                            justify-content: space-between;
                            padding: 2px 0;
                            white-space: pre;
                        }

                        .printer-total-label {
                            text-align: right;
                            padding-right: 8px;
                        }

                        .printer-total-value {
                            text-align: right;
                            width: 60px;
                        }
                    </style>
                </head>
                <body>${contentHtml}</body>
            </html>
        `;
    }

    /**
     * Creates a hidden iframe with the content to be printed
     * @param {string} htmlContent - The HTML content to render
     * @returns {Promise<HTMLIFrameElement>} The iframe element with rendered content
     * @private
     */
    async _createPrintFrame(htmlContent) {
        return new Promise((resolve, reject) => {
            try {
                const printFrame = document.createElement('iframe');
                Object.assign(printFrame.style, {
                    position: 'fixed',
                    top: '-9999px',
                    left: '-9999px',
                    width: '0',
                    height: '0',
                    border: '0'
                });

                document.body.appendChild(printFrame);
                printFrame.contentDocument.open();
                printFrame.contentDocument.write(this.createPrintableHTML(htmlContent));
                printFrame.contentDocument.close();

                if (printFrame.contentWindow.document.readyState === 'complete') {
                    resolve(printFrame);
                } else {
                    printFrame.onload = () => resolve(printFrame);
                }
            } catch (error) {
                console.error('Error creating print frame:', error);
                reject(error);
            }
        });
    }

    /**
     * Browser-based print function using hidden iframe
     * @param {string} htmlContent - The HTML content to print
     * @param {boolean} autoPrint - Whether to attempt auto-printing without dialog
     * @returns {Promise<boolean>} True if printing was successful
     */
    async browserPrint(htmlContent, autoPrint = false) {
        return new Promise(async (resolve, reject) => {
            try {
                const printFrame = await this._createPrintFrame(htmlContent);

                const doPrint = () => {
                    try {
                        // If autoPrint is enabled, try to use techniques that might suppress the dialog
                        if (autoPrint && window.navigator.userAgent.indexOf("Chrome") > -1) {
                            try {
                                printFrame.contentWindow.focus();
                                printFrame.contentWindow.document.execCommand('print', false, null);
                                resolve(true);
                            } catch (execErr) {
                                // Fall back to regular print if execCommand fails
                                console.warn("ExecCommand print failed, falling back:", execErr);
                                printFrame.contentWindow.print();
                                resolve(true);
                            }
                        } else {
                            // Regular print dialog for non-Chrome browsers or when autoPrint is disabled
                            printFrame.contentWindow.focus();
                            printFrame.contentWindow.print();
                            resolve(true);
                        }
                    } catch (printError) {
                        console.error("Error triggering browser print:", printError);
                        reject(new Error("Could not open print dialog. Please check browser pop-up settings."));
                    }

                    // Clean up the iframe after printing
                    setTimeout(() => {
                        if (document.body.contains(printFrame)) {
                            document.body.removeChild(printFrame);
                        }
                    }, 1500);
                };

                doPrint();
            } catch (error) {
                console.error("Error setting up browser print:", error);
                reject(error);
            }
        });
    }

    /**
     * Convert HTML to printer-compatible commands
     * This approach provides consistent output between browser and Bluetooth printing
     * @param {string} html - HTML content to convert
     * @returns {Promise<Uint8Array>} Commands for printing via Bluetooth
     */
    async htmlToCanvas(html) {
        try {
            const printFrame = await this._createPrintFrame(html);

            try {
                // Get the body element from the iframe
                const body = printFrame.contentDocument.body;

                // Initialize commands array for ESC/POS
                const commands = [];

                // Initialize printer
                commands.push(0x1B, 0x40); // ESC @ - Initialize printer

                // Process the content
                this.processDocumentForPrinting(body, commands);

                // Add feed and cut at the end
                commands.push(0x1B, 0x64, 5); // Feed 5 lines
                commands.push(0x1D, 0x56, 0x41); // Partial cut

                // Clean up
                document.body.removeChild(printFrame);

                // Return ESC/POS commands
                return new Uint8Array(commands);
            } catch (error) {
                if (document.body.contains(printFrame)) {
                    document.body.removeChild(printFrame);
                }
                console.error('Error processing HTML for printing:', error);
                throw error;
            }
        } catch (error) {
            console.error('Error setting up HTML to commands conversion:', error);
            throw error;
        }
    }

    /**
     * Process a document to generate ESC/POS commands
     * @param {HTMLElement} element - The element to process
     * @param {Array} commands - Array to append commands to
     * @private
     */
    processDocumentForPrinting(element, commands) {
        // Initialize printer
        commands.push(0x1B, 0x40); // ESC @ - Initialize printer

        // Process flex container items specially
        const flexContainers = element.querySelectorAll('div[style*="display: flex"]');
        if (flexContainers.length > 0) {
            // This is likely an items list with flex layout
            flexContainers.forEach(container => {
                const spans = container.querySelectorAll('span');
                if (spans.length === 3) { // Qty, Item, Amount format
                    const qty = spans[0].textContent.trim().padEnd(4);
                    const item = spans[1].textContent.trim();
                    const amount = spans[2].textContent.trim().padStart(8);

                    // Calculate available space for item name
                    const availableSpace = this.printerWidth - 12; // 4 for qty + 8 for amount
                    const truncatedItem = item.length > availableSpace
                        ? item.substring(0, availableSpace - 3) + '...'
                        : item.padEnd(availableSpace);

                    // Combine into single line with proper spacing
                    commands.push(...this.encoder.encode(qty + truncatedItem + amount + '\n'));
                }
            });
            return; // Skip regular processing for flex containers
        }

        // For regular content, process line by line
        const lines = this.extractTextContent(element).split('\n');

        lines.forEach(line => {
            const trimmedLine = line.trim();
            if (trimmedLine) {
                // Check if this line appears to be a header
                const isHeader =
                    (trimmedLine === trimmedLine.toUpperCase() &&
                        trimmedLine.length > 3) ||
                    /BILL|RECEIPT|KOT|INVOICE|TOTAL/.test(trimmedLine);

                // Check if this is an items header
                const isItemsHeader = /^Qty\s+Item\s+Amount$/.test(trimmedLine);

                if (isHeader) {
                    commands.push(0x1B, 0x61, 0x01); // Center align
                    commands.push(0x1B, 0x45, 0x01); // Bold ON
                    commands.push(...this.encoder.encode(trimmedLine + '\n'));
                    commands.push(0x1B, 0x45, 0x00); // Bold OFF
                    commands.push(0x1B, 0x61, 0x00); // Left align
                } else if (isItemsHeader) {
                    // Format items header with proper spacing
                    const header = 'Qty  Item' + ' '.repeat(this.printerWidth - 20) + 'Amount\n';
                    commands.push(0x1B, 0x45, 0x01); // Bold ON
                    commands.push(...this.encoder.encode(header));
                    commands.push(0x1B, 0x45, 0x00); // Bold OFF
                    commands.push(...this.encoder.encode('-'.repeat(this.printerWidth) + '\n'));
                } else {
                    commands.push(...this.encoder.encode(trimmedLine + '\n'));
                }
            }
        });

        // Reset to default line spacing
        commands.push(0x1B, 0x32); // ESC 2 - Default line spacing
    }

    /**
     * Extract text content from an HTML element, preserving structure
     * @param {HTMLElement} element - The element to extract text from
     * @returns {string} Extracted text with preserved line breaks
     * @private
     */
    extractTextContent(element) {
        let result = '';

        // Skip flex containers as they're handled separately
        if (element.getAttribute('style')?.includes('display: flex')) {
            return '';
        }

        // Process all child nodes
        const processNode = (node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                result += node.textContent;
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const tagName = node.tagName.toLowerCase();
                const style = node.getAttribute('style') || '';

                // Skip flex containers
                if (style.includes('display: flex')) {
                    return;
                }

                if (tagName === 'br') {
                    result += '\n';
                } else if (['div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li'].includes(tagName)) {
                    if (result && !result.endsWith('\n')) {
                        result += '\n';
                    }

                    for (const child of node.childNodes) {
                        processNode(child);
                    }

                    if (!result.endsWith('\n')) {
                        result += '\n';
                    }
                } else {
                    for (const child of node.childNodes) {
                        processNode(child);
                    }
                }
            }
        };

        processNode(element);
        return result.replace(/\n{3,}/g, '\n\n').trim();
    }

    /**
     * Set the printer width configuration
     * @param {string} size - The printer size ('2inch', '3inch', '4inch')
     */
    setPrinterSize(size) {
        if (this.printerSizes && this.printerSizes[size]) {
            // Update the instance property with the numeric value
            this.printerWidth = this.printerSizes[size];
            // Save the size identifier to localStorage
            this.savePrinterWidth(size);
            console.log(`Printer size set to ${size} (${this.printerWidth} characters)`);
        } else {
            console.error('Invalid printer size. Supported sizes are: 2inch, 3inch, 4inch');
            throw new Error('Invalid printer size. Supported sizes are: 2inch, 3inch, 4inch');
        }
    }

    /**
     * Save the printer width configuration to localStorage
     * @private
     */
    savePrinterWidth(size) {
        try {
            localStorage.setItem('printerWidth', size);
        } catch (error) {
            console.error('Error saving printer width:', error);
        }
    }

    /**
     * Get saved printer width from localStorage
     * @returns {number} The saved printer width in characters
     * @private
     */
    getSavedPrinterWidth() {
        try {
            // Ensure printerSizes is initialized
            if (!this.printerSizes) {
                return 48; // Default to 3-inch (48 characters)
            }

            const size = localStorage.getItem('printerWidth');
            // If size exists and it's a valid key in printerSizes, return the numeric value
            if (size && this.printerSizes[size]) {
                return this.printerSizes[size];
            }

            // Default to 3-inch (48 characters)
            return this.printerSizes['3inch'];
        } catch (error) {
            console.error('Error retrieving saved printer width:', error);
            // Ensure safe fallback even if this.printerSizes is undefined
            return 48; // Default to 3-inch (48 characters)
        }
    }

    /**
     * Check if Web Bluetooth is supported by the browser
     */
    isSupported() {
        return !!navigator.bluetooth;
    }

    /**
     * Save the current printer details to localStorage
     * @private
     */
    savePrinter() {
        if (!this.device) return;

        try {
            const printerInfo = {
                id: this.device.id,
                name: this.device.name || 'Unknown Printer'
            };

            localStorage.setItem('lastConnectedPrinter', JSON.stringify(printerInfo));
            this.lastConnectedDevice = printerInfo;
            console.log('Printer information saved:', printerInfo);

            // Add the printer to the managed printers list if not already there
            const printers = this.getSavedPrinters();
            const existingPrinter = printers.find(p => p.deviceId === this.device.id);

            if (!existingPrinter) {
                // Create a new printer entry for managed printers
                const newPrinter = {
                    id: `printer_${Date.now()}`,
                    name: this.device.name || 'Printer',
                    deviceId: this.device.id,
                    deviceName: this.device.name || 'Unknown Printer',
                    dateAdded: new Date().toISOString(),
                    lastConnected: new Date().toISOString()
                };

                // Add to managed printers
                printers.push(newPrinter);
                this.savePrinters(printers);
                console.log('Added printer to managed printers list:', newPrinter);
            } else {
                // Update the last connected timestamp
                existingPrinter.lastConnected = new Date().toISOString();
                this.savePrinters(printers);
                console.log('Updated printer last connected timestamp:', existingPrinter);
            }
        } catch (error) {
            console.error('Error saving printer information:', error);
        }
    }

    /**
     * Get saved printer details from localStorage
     * @returns {Object|null} The saved printer info or null if none exists
     */
    getSavedPrinter() {
        try {
            const savedPrinter = localStorage.getItem('lastConnectedPrinter');
            if (savedPrinter) {
                return JSON.parse(savedPrinter);
            }
        } catch (error) {
            console.error('Error retrieving saved printer:', error);
        }
        return null;
    }

    /**
     * Clear saved printer from localStorage
     */
    clearSavedPrinter() {
        try {
            localStorage.removeItem('lastConnectedPrinter');
            this.lastConnectedDevice = null;
        } catch (error) {
            console.error('Error clearing saved printer:', error);
        }
    }

    /**
     * Attempt to silently reconnect to the last used printer without UI interaction
     * This is called internally when a print operation is requested and we're not connected
     * @returns {Promise<boolean>} True if reconnection was successful
     * @private
     */
    async attemptSilentReconnect() {
        if (!this.isSupported() || !this.lastConnectedDevice || this.reconnectAttempted) {
            return false;
        }

        console.log('Attempting silent reconnect to saved printer:', this.lastConnectedDevice.name);
        this.reconnectAttempted = true;

        try {
            // Try to get the device by name
            this.device = await navigator.bluetooth.requestDevice({
                filters: [{
                    name: this.lastConnectedDevice.name
                }],
                optionalServices: [
                    '000018f0-0000-1000-8000-00805f9b34fb',  // Common printer service
                    '00001101-0000-1000-8000-00805f9b34fb',  // Serial Port Profile
                    '00001800-0000-1000-8000-00805f9b34fb',  // Generic Access Service
                    '00001801-0000-1000-8000-00805f9b34fb',  // Generic Attribute Service
                    '0000180a-0000-1000-8000-00805f9b34fb',  // Device Information Service
                    '0000ffff-0000-1000-8000-00805f9b34fb',  // Vendor specific service
                    '0000fff0-0000-1000-8000-00805f9b34fb',  // Vendor specific service
                    '0000ff00-0000-1000-8000-00805f9b34fb',  // Vendor specific service
                    '0000fe00-0000-1000-8000-00805f9b34fb',  // Vendor specific service
                    '00010000-0000-1000-8000-00805f9b34fb',  // Vendor specific service
                    '00000000-0000-1000-8000-00805f9b34fb'   // Vendor specific service
                ]
            });

            // Connect to GATT server
            const server = await this.device.gatt.connect();
            console.log('Silent reconnect: Connected to GATT server');

            // Get all services
            const services = await server.getPrimaryServices();
            console.log(`Found ${services.length} services`);

            // Try to find a writable characteristic in any of the services
            let service;
            let characteristic;

            // Try each service to find a writable characteristic
            for (const s of services) {
                try {
                    console.log(`Exploring service ${s.uuid}...`);
                    const chars = await s.getCharacteristics();
                    console.log(`Found ${chars.length} characteristics in service ${s.uuid}`);

                    // Find a writable characteristic
                    const writableChar = chars.find(c =>
                        c.properties.write || c.properties.writeWithoutResponse
                    );

                    if (writableChar) {
                        service = s;
                        characteristic = writableChar;
                        break;
                    }
                } catch (e) {
                    console.log(`Error exploring service ${s.uuid}:`, e);
                }
            }

            if (!service || !characteristic) {
                console.log('No suitable characteristic found during silent reconnect');
                return false;
            }

            console.log('Silent reconnect: Using service:', service.uuid);
            console.log('Silent reconnect: Using characteristic:', characteristic.uuid);

            this.characteristic = characteristic;
            this.connected = true;

            // Set up disconnection listener to reset state
            this.device.addEventListener('gattserverdisconnected', () => {
                console.log('Bluetooth device disconnected');
                this.connected = false;
                this.characteristic = null;
            });

            console.log('Silent reconnect successful');
            return true;
        } catch (err) {
            console.log('Silent reconnect failed:', err);
            // Use _handlePrinterError with showToasts=false to avoid showing notifications
            this._handlePrinterError(err, false);
            this.reconnectAttempted = false; // Reset so we can try again if needed
            return false;
        }
    }

    /**
     * Shows a modal to connect to a printer
     * @returns {Promise} Resolves when printer is selected or rejects if cancelled
     */
    async showPrinterConnectionModal() {
        return new Promise((resolve, reject) => {
            // If ModalManager is available, use it to create a modal
            if (window.ModalManager && typeof window.ModalManager.createCenterModal === 'function') {
                const hasSavedPrinter = !!this.lastConnectedDevice;

                const modalContent = `
                    <div class="py-2">
                        <div class="flex items-center justify-center mb-4">
                            <i class="ph ph-printer text-red-500 text-3xl"></i>
                        </div>
                        
                        ${hasSavedPrinter ? `
                            <div class="mb-4 bg-gray-50 p-3 rounded-lg">
                                <div class="font-medium text-gray-800 mb-1">Last Connected Printer</div>
                                <div class="flex items-center">
                                    <i class="ph ph-printer text-gray-500 mr-2"></i>
                                    <span>${this.lastConnectedDevice.name}</span>
                                </div>
                            </div>
                        ` : ''}
                        
                        <div class="space-y-3">
                            ${hasSavedPrinter ? `
                                <button id="use-saved-printer" class="w-full py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center">
                                    <i class="ph ph-printer mr-2"></i>
                                    Use Last Connected Printer
                                </button>
                            ` : ''}
                            
                            <button id="select-new-printer" class="w-full py-2.5 ${hasSavedPrinter ? 'bg-gray-100 text-gray-800 hover:bg-gray-200' : 'bg-red-500 text-white hover:bg-red-600'} rounded-lg transition-colors flex items-center justify-center">
                                <i class="ph ph-${hasSavedPrinter ? 'plus-circle' : 'printer'} mr-2"></i>
                                ${hasSavedPrinter ? 'Select Different Printer' : 'Select Printer'}
                            </button>
                            
                            <button id="cancel-printer-select" class="w-full py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                                Cancel
                            </button>
                        </div>
                    </div>
                `;

                const modal = window.ModalManager.createCenterModal({
                    id: 'printer-connection-modal',
                    title: 'Connect to Printer',
                    content: modalContent,
                    onShown: (modalControl) => {
                        // Handle using saved printer
                        const useSavedPrinterBtn = document.getElementById('use-saved-printer');
                        if (useSavedPrinterBtn) {
                            useSavedPrinterBtn.addEventListener('click', () => {
                                modalControl.close();
                                resolve('use-saved');
                            });
                        }

                        // Handle selecting new printer
                        const selectNewPrinterBtn = document.getElementById('select-new-printer');
                        if (selectNewPrinterBtn) {
                            selectNewPrinterBtn.addEventListener('click', () => {
                                modalControl.close();
                                resolve('select-new');
                            });
                        }

                        // Handle cancel
                        const cancelBtn = document.getElementById('cancel-printer-select');
                        if (cancelBtn) {
                            cancelBtn.addEventListener('click', () => {
                                modalControl.close();
                                reject(new Error('Device selection cancelled by user'));
                            });
                        }
                    }
                });
            } else {
                // If ModalManager is not available, go straight to selecting a new printer
                if (this.lastConnectedDevice && confirm(`Use last connected printer: ${this.lastConnectedDevice.name}?`)) {
                    resolve('use-saved');
                } else if (confirm('Select a printer?')) {
                    resolve('select-new');
                } else {
                    reject(new Error('Device selection cancelled by user'));
                }
            }
        });
    }

    /**
     * Shows a modal to select printer size
     */
    async showPrinterSizeModal() {
        return new Promise((resolve, reject) => {
            if (window.ModalManager && typeof window.ModalManager.createCenterModal === 'function') {
                // Get current size for highlighting the active button
                const currentSize = localStorage.getItem('printerWidth') || '3inch';

                const modalContent = `
                    <div class="py-2">
                        <div class="flex items-center justify-center mb-4">
                            <i class="ph ph-printer text-red-500 text-3xl"></i>
                        </div>
                        
                        <div class="mb-4">
                            <h3 class="text-gray-800 font-medium mb-2">Select Printer Size</h3>
                            <p class="text-gray-600 text-sm">Choose your printer's paper width for optimal formatting</p>
                        </div>
                        
                        <div class="space-y-3">
                            <button id="size-2inch" class="w-full py-2.5 ${currentSize === '2inch' ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'} rounded-lg transition-colors flex items-center justify-center gap-2">
                                <i class="ph ph-printer"></i>
                                2-inch (32 characters)
                            </button>
                            
                            <button id="size-3inch" class="w-full py-2.5 ${currentSize === '3inch' ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'} rounded-lg transition-colors flex items-center justify-center gap-2">
                                <i class="ph ph-printer"></i>
                                3-inch (48 characters)
                            </button>
                            
                            <button id="size-4inch" class="w-full py-2.5 ${currentSize === '4inch' ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'} rounded-lg transition-colors flex items-center justify-center gap-2">
                                <i class="ph ph-printer"></i>
                                4-inch (64 characters)
                            </button>
                        </div>
                    </div>
                `;

                const modal = window.ModalManager.createCenterModal({
                    id: 'printer-size-modal',
                    title: 'Printer Configuration',
                    content: modalContent,
                    onShown: (modalControl) => {
                        const handle2Inch = document.getElementById('size-2inch');
                        const handle3Inch = document.getElementById('size-3inch');
                        const handle4Inch = document.getElementById('size-4inch');

                        const handleSizeSelection = (size) => {
                            this.setPrinterSize(size); // Set size before closing modal
                            modalControl.close();
                            resolve(size);
                        };

                        if (handle2Inch) {
                            handle2Inch.addEventListener('click', () => handleSizeSelection('2inch'));
                        }

                        if (handle3Inch) {
                            handle3Inch.addEventListener('click', () => handleSizeSelection('3inch'));
                        }

                        if (handle4Inch) {
                            handle4Inch.addEventListener('click', () => handleSizeSelection('4inch'));
                        }
                    }
                });
            } else {
                // Fallback to simple prompt if ModalManager is not available
                const size = prompt('Select printer size (2inch, 3inch, 4inch):', '3inch');
                if (size && ['2inch', '3inch', '4inch'].includes(size)) {
                    this.setPrinterSize(size); // Set size before resolving
                    resolve(size);
                } else {
                    this.setPrinterSize('3inch'); // Set default size
                    resolve('3inch'); // Default to 3-inch if invalid or cancelled
                }
            }
        });
    }

    /**
     * Connect to a Bluetooth printer device
     * Must be called from a user gesture (like a button click)
     */
    async connect() {
        if (!this.isSupported()) {
            throw new Error('Web Bluetooth is not supported in this browser. Please use Chrome or Edge.');
        }

        // Check Bluetooth availability
        if (typeof navigator.bluetooth.getAvailability === 'function') {
            try {
                const isBluetoothAvailable = await navigator.bluetooth.getAvailability();
                if (!isBluetoothAvailable) {
                    console.error("Bluetooth adapter is not available. Please ensure Bluetooth is turned on in your system settings and that your browser has permission to access it.");
                    throw new Error('Bluetooth is not available on this device. Please turn on Bluetooth and grant browser permissions.');
                }
            } catch (availabilityError) {
                console.error("Error checking Bluetooth availability:", availabilityError);
                // We can still proceed, as getAvailability might not be supported or might fail for other reasons,
                // but requestDevice will ultimately determine usability.
            }
        }

        // If already connected, show size modal and return
        if (this.connected && this.device && this.characteristic) {
            await this.showPrinterSizeModal();
            return true;
        }

        try {
            // Show connection modal and handle printer selection
            let action;
            try {
                action = await this.showPrinterConnectionModal();
            } catch (modalError) {
                throw modalError; // User cancelled from the modal
            }

            // Handle different user actions
            if (action === 'use-saved' && this.lastConnectedDevice) {
                try {
                    console.info(`Attempting to reconnect to saved printer: ${this.lastConnectedDevice.name}. Ensure it's ON and discoverable.`);
                    this.device = await navigator.bluetooth.requestDevice({
                        filters: [{
                            name: this.lastConnectedDevice.name
                        }],
                        // Include all possible printer-related services as optional
                        optionalServices: [
                            '000018f0-0000-1000-8000-00805f9b34fb',  // Common printer service
                            '00001101-0000-1000-8000-00805f9b34fb',  // Serial Port Profile
                            '00001800-0000-1000-8000-00805f9b34fb',  // Generic Access Service
                            '00001801-0000-1000-8000-00805f9b34fb',  // Generic Attribute Service
                            '0000180a-0000-1000-8000-00805f9b34fb',  // Device Information Service
                            '0000ffff-0000-1000-8000-00805f9b34fb',  // Vendor specific service
                            '0000fff0-0000-1000-8000-00805f9b34fb',  // Vendor specific service
                            '0000ff00-0000-1000-8000-00805f9b34fb',  // Vendor specific service
                            '0000fe00-0000-1000-8000-00805f9b34fb',  // Vendor specific service
                            '00010000-0000-1000-8000-00805f9b34fb',  // Vendor specific service
                            '00000000-0000-1000-8000-00805f9b34fb'   // Vendor specific service
                        ]
                    });
                } catch (reconnectError) {
                    console.warn('Error reconnecting to saved printer, falling back to new device selection:', reconnectError.message);
                    // Fallback to regular device selection if reconnection fails
                    console.info("Attempting to select a new printer. Please ensure your Bluetooth printer is ON, in PAIRING/DISCOVERABLE mode, and close to your computer. Also, ensure Bluetooth is enabled on your computer and this website has Bluetooth permissions.");
                    try {
                        this.device = await navigator.bluetooth.requestDevice({
                            acceptAllDevices: true,
                            optionalServices: [
                                '000018f0-0000-1000-8000-00805f9b34fb',  // Common printer service
                                '00001101-0000-1000-8000-00805f9b34fb',  // Serial Port Profile
                                '00001800-0000-1000-8000-00805f9b34fb',  // Generic Access Service
                                '00001801-0000-1000-8000-00805f9b34fb',  // Generic Attribute Service
                                '0000180a-0000-1000-8000-00805f9b34fb',  // Device Information Service
                                '0000ffff-0000-1000-8000-00805f9b34fb',  // Vendor specific service
                                '0000fff0-0000-1000-8000-00805f9b34fb',  // Vendor specific service
                                '0000ff00-0000-1000-8000-00805f9b34fb',  // Vendor specific service
                                '0000fe00-0000-1000-8000-00805f9b34fb',  // Vendor specific service
                                '00010000-0000-1000-8000-00805f9b34fb',  // Vendor specific service
                                '00000000-0000-1000-8000-00805f9b34fb'   // Vendor specific service
                            ]
                        });
                    } catch (deviceSelectError) {
                        console.error('Error during printer selection (fallback from saved):', deviceSelectError);
                        if (deviceSelectError.name === "NotFoundError") {
                            throw new Error('Printer selection cancelled or no compatible devices found. Ensure printer is discoverable and try again.');
                        } else if (deviceSelectError.name === "SecurityError") {
                            throw new Error('Bluetooth permission denied. Please allow Bluetooth access for this site in your browser settings.');
                        }
                        throw new Error(`Printer selection failed: ${deviceSelectError.message}. Check Bluetooth settings and printer discoverability.`);
                    }
                }
            } else if (action === 'select-new') {
                console.info("Attempting to select a new printer. Please ensure your Bluetooth printer is ON, in PAIRING/DISCOVERABLE mode, and close to your computer. Also, ensure Bluetooth is enabled on your computer and this website has Bluetooth permissions.");
                try {
                    this.device = await navigator.bluetooth.requestDevice({
                        acceptAllDevices: true,
                        optionalServices: [
                            '000018f0-0000-1000-8000-00805f9b34fb',  // Common printer service
                            '00001101-0000-1000-8000-00805f9b34fb',  // Serial Port Profile
                            '00001800-0000-1000-8000-00805f9b34fb',  // Generic Access Service
                            '00001801-0000-1000-8000-00805f9b34fb',  // Generic Attribute Service
                            '0000180a-0000-1000-8000-00805f9b34fb',  // Device Information Service
                            '0000ffff-0000-1000-8000-00805f9b34fb',  // Vendor specific service
                            '0000fff0-0000-1000-8000-00805f9b34fb',  // Vendor specific service
                            '0000ff00-0000-1000-8000-00805f9b34fb',  // Vendor specific service
                            '0000fe00-0000-1000-8000-00805f9b34fb',  // Vendor specific service
                            '00010000-0000-1000-8000-00805f9b34fb',  // Vendor specific service
                            '00000000-0000-1000-8000-00805f9b34fb'   // Vendor specific service
                        ]
                    });
                } catch (deviceSelectError) {
                    console.error('Error during new printer selection:', deviceSelectError);
                    if (deviceSelectError.name === "NotFoundError") {
                        throw new Error('Printer selection cancelled or no compatible devices found. Ensure printer is discoverable and try again.');
                    } else if (deviceSelectError.name === "SecurityError") {
                        throw new Error('Bluetooth permission denied. Please allow Bluetooth access for this site in your browser settings.');
                    }
                    throw new Error(`Printer selection failed: ${deviceSelectError.message}. Check Bluetooth settings and printer discoverability.`);
                }
            } else {
                throw new Error('Invalid action selected');
            }

            console.log('Device selected:', this.device.name || 'Unknown device');

            // Connect to GATT server and retrieve services
            let server;
            let services;

            try {
                // Connect to GATT server
                server = await this.device.gatt.connect();
                console.log('Connected to GATT server');

                // Get all available services
                services = await server.getPrimaryServices();
                console.log('Available services:', services.map(s => s.uuid));

                if (services.length === 0) {
                    throw new Error('No services found on the device');
                }
            } catch (connectionError) {
                console.error('Network or connection error:', connectionError);

                // Handle specific error types with more helpful messages
                if (connectionError.name === 'NetworkError' ||
                    connectionError.message.includes('Unsupported device')) {
                    throw new Error('This device is not supported as a printer. Please select a compatible Bluetooth printer.');
                }

                // Re-throw the error if it doesn't match specific cases
                throw connectionError;
            }

            // Try to find a service we can use for printing
            let service = null;
            let characteristic = null;

            // Try each service to find a writable characteristic
            for (const s of services) {
                try {
                    console.log(`Exploring service ${s.uuid}...`);
                    const chars = await s.getCharacteristics();
                    console.log(`Found ${chars.length} characteristics in service ${s.uuid}`);

                    // Find a writable characteristic
                    const writableChar = chars.find(c =>
                        c.properties.write || c.properties.writeWithoutResponse
                    );

                    if (writableChar) {
                        service = s;
                        characteristic = writableChar;
                        break;
                    }
                } catch (e) {
                    console.log(`Error exploring service ${s.uuid}:`, e);
                }
            }

            if (!service || !characteristic) {
                throw new Error('No suitable service or characteristic found for printing. Make sure your printer is turned on and in pairing mode.');
            }

            console.log('Using service:', service.uuid);
            console.log('Using characteristic:', characteristic.uuid);

            this.characteristic = characteristic;
            this.connected = true;

            // Set up disconnection listener to reset state
            this.device.addEventListener('gattserverdisconnected', () => {
                console.log('Bluetooth device disconnected');
                this.connected = false;
                this.characteristic = null;
            });

            // Save successful connection
            this.savePrinter();

            // Show printer size selection modal after successful connection
            try {
                const selectedSize = await this.showPrinterSizeModal();
                this.setPrinterSize(selectedSize);
            } catch (error) {
                console.error('Error setting printer size:', error);
            }

            return true;
        } catch (error) {
            console.error('Error connecting to printer:', error);
            this.connected = false;
            throw error;
        }
    }

    /**
     * Disconnect from the current printer
     */
    async disconnect() {
        if (this.device && this.device.gatt.connected) {
            await this.device.gatt.disconnect();
        }
        this.connected = false;
        this.device = null;
        this.characteristic = null;
    }

    /**
     * Set up visibility change listeners to handle reconnection when tab becomes visible again
     * @private
     */
    _setupVisibilityListeners() {
        // Document visibility change can help restore connection when tab becomes active
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && !this.connected && this.lastConnectedDevice) {
                console.log('Document became visible, attempting to restore printer connection');
                this.reconnectAttempted = false; // Reset the flag to allow reconnection
                this.attemptSilentReconnect();
            }
        });

        // Also try to reconnect on focus
        window.addEventListener('focus', () => {
            if (!this.connected && this.lastConnectedDevice) {
                console.log('Window focused, attempting to restore printer connection');
                this.reconnectAttempted = false; // Reset the flag to allow reconnection
                this.attemptSilentReconnect();
            }
        });
    }

    generatePreviewHTML(contentHtml) {
        return `
            <html>
                <head>
                    <title>Print</title>
                    <style>
                        @font-face {
                            font-family: 'PrinterFont';
                            src: local('Courier New');
                            font-weight: normal;
                            font-style: normal;
                        }
                        
                        @media print {
                            @page { 
                                size: 58mm auto;
                                margin: 0mm;
                                padding: 0mm;
                            }
                            body { 
                                margin: 0;
                                padding: 0;
                                width: 58mm;
                                color: #000;
                                background: #fff;
                            }
                        }
                        
                        body {
                            font-family: 'PrinterFont', 'Courier New', monospace;
                            line-height: 1.2;
                            font-size: 12px;
                            width: 58mm;
                            margin: 0 auto;
                            padding: 8px;
                            background: white;
                            color: black;
                            -webkit-font-smoothing: none;
                        }
                        
                        /* Exact character width matching */
                        .printer-line {
                            white-space: pre;
                            overflow: hidden;
                            width: 100%;
                        }
                        
                        /* Center alignment that matches thermal printer */
                        .printer-center {
                            text-align: center;
                            width: 100%;
                        }
                        
                        /* Right alignment that matches thermal printer */
                        .printer-right {
                            text-align: right;
                            width: 100%;
                        }
                        
                        /* Bold text that matches thermal printer */
                        .printer-bold {
                            font-weight: bold;
                        }
                        
                        /* Double height text simulation */
                        .printer-large {
                            font-size: 14px;
                            line-height: 1.4;
                        }
                        
                        /* Divider lines that match thermal printer */
                        .printer-divider {
                            border-top: 1px dashed #000;
                            margin: 4px 0;
                        }
                        
                        /* Item list formatting */
                        .printer-item {
                            display: flex;
                            justify-content: space-between;
                            margin: 2px 0;
                        }
                        
                        .printer-item-qty {
                            width: 30px;
                            text-align: left;
                        }
                        
                        .printer-item-name {
                            flex: 1;
                            padding: 0 4px;
                        }
                        
                        .printer-item-price {
                            width: 60px;
                            text-align: right;
                        }
                        
                        /* QR code placeholder */
                        .printer-qr {
                            width: 100px;
                            height: 100px;
                            margin: 8px auto;
                            border: 1px solid #000;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                        }
                    </style>
                </head>
                <body>${contentHtml}</body>
            </html>
        `;
    }
}

// Create a singleton instance
window.BluetoothPrinting = new BluetoothPrinting();

// Global test function for direct console access
window.testPrinting = async function (orderId) {
    try {
        console.log("Test printing function called with orderId:", orderId);
        if (!window.BluetoothPrinting) {
            console.error("BluetoothPrinting is not initialized!");
            window.BluetoothPrinting = new BluetoothPrinting();
            console.log("Created new BluetoothPrinting instance");
        }

        console.log("About to call printBill...");
        await window.BluetoothPrinting.printBill(orderId);
        console.log("Print bill completed successfully");
        return true;
    } catch (error) {
        console.error("Error in test printing:", error);
        return false;
    }
};