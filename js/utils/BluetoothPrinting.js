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
     * Generate HTML for a receipt or KOT based on order data
     * This centralized method generates consistent HTML for both browser printing and Bluetooth printing
     * @param {Object} orderData - The order data object
     * @param {string} type - 'bill' or 'kot' to determine the type of receipt
     * @param {string} [paymentMode] - Optional payment mode for bills
     * @returns {string} HTML content for the receipt
     */
    generateReceiptHTML(orderData, type, paymentMode) {
        const seller = window.UserSession?.seller || {};
        const isKOT = type.toLowerCase() === 'kot';
        const isBill = type.toLowerCase() === 'bill';
        const paperWidth = '58mm'; // Standard thermal paper width

        let html = `
            <div style="font-family: 'Courier New', monospace; width: ${paperWidth}; margin: 0 auto; padding: 2px;">`;

        // Logo Section (for bills only)
        if (isBill) {
            html += `
                <!-- Logo Section -->
                ${seller.logo ?
                    `<div style="text-align: center; margin-bottom: 8px;">
                        <img src="${seller.logo}" alt="Logo" style="max-width: 45mm; max-height: 15mm;">
                    </div>` :
                    `<div style="text-align: center; margin-bottom: 8px; font-size: 24px;">
                        <i class="ph ph-storefront"></i>
                    </div>`
                }`;
        }

        // Header Section
        html += `
            <!-- Header Section -->
            <div style="text-align: center; font-weight: 700;">`;

        if (isBill) {
            html += `
                <div style="font-size: 14px; margin-bottom: 4px;">${seller.gstEnabled ? 'TAX INVOICE' : 'BILL/RECEIPT'}</div>
                <div style="font-size: 16px; margin-bottom: 4px;">${seller.businessName || 'Your Business'}</div>
                ${seller.address ?
                    `<div style="font-size: 10px; margin-bottom: 2px;">${seller.address}</div>` : ''}
                ${seller.phone ?
                    `<div style="font-size: 10px; margin-bottom: 2px;">Ph: ${seller.phone}</div>` : ''}
                ${seller.gstEnabled && seller.gstIN ?
                    `<div style="font-size: 10px; margin-bottom: 2px;">GSTIN: ${seller.gstIN}</div>` : ''}`;
        } else if (isKOT) {
            html += `
                <div style="font-size: 20px; margin-bottom: 4px; font-weight: 800;">KOT</div>`;

            // Table info for KOT (if available)
            if (orderData.tableId) {
                html += `
                    <div style="font-size: 18px; margin-bottom: 4px;">TABLE ${orderData.tableId}</div>`;
            }
        }

        html += `</div>`;

        // Separator
        html += `<div style="border-bottom: 1px dashed #000; margin: 8px 0;"></div>`;

        // Order details
        html += `
            <!-- Order Details -->
            <div style="font-size: 12px; font-weight: 600;">
                <div style="margin-bottom: 4px;">${isKOT ? 'KOT' : 'Bill'} #: ${orderData.billNo || orderData.id?.substring(0, 8) || 'N/A'}</div>
                <div style="margin-bottom: 4px;">Date: ${new Date(orderData.date?.toDate ? orderData.date.toDate() : orderData.date || new Date()).toLocaleDateString()}</div>
                <div style="margin-bottom: 4px;">Time: ${new Date(orderData.date?.toDate ? orderData.date.toDate() : orderData.date || new Date()).toLocaleTimeString()}</div>
                ${orderData.custName || orderData.customer?.name ?
                `<div style="margin-bottom: 4px;">Customer: ${orderData.custName || orderData.customer?.name}</div>` : ''}
                ${orderData.tableId ?
                `<div style="margin-bottom: 4px;">Table: ${orderData.tableId}</div>` : ''}
            </div>`;

        // Separator
        html += `<div style="border-bottom: 1px dashed #000; margin: 8px 0;"></div>`;

        // Items Section
        html += `
            <!-- Items Section -->
            <div style="font-size: 14px; font-weight: 700; text-align: center; margin-bottom: 8px;">ITEMS</div>`;

        // Initialize totals for bills
        let calculatedSubTotal = 0;
        let totalTaxableAmount = 0;
        let totalCGST = 0;
        let totalSGST = 0;

        if (orderData.items && orderData.items.length > 0) {
            orderData.items.forEach(item => {
                const quantity = parseFloat(item.quantity || item.qnt || 1);
                const price = parseFloat(item.price || 0);
                const amount = quantity * price;

                if (isBill) {
                    calculatedSubTotal += amount;

                    // Calculate tax if GST is enabled
                    if (seller.gstEnabled) {
                        const taxableAmount = amount;
                        totalTaxableAmount += taxableAmount;
                        const cgst = taxableAmount * 0.09;
                        const sgst = taxableAmount * 0.09;
                        totalCGST += cgst;
                        totalSGST += sgst;
                    }

                    html += `
                        <div style="font-size: 12px; margin-bottom: 8px;">
                            <div style="font-weight: 600;">${item.title || 'Unknown Item'}</div>
                            <div style="display: flex; justify-content: space-between;">
                                <span>${quantity} x ${price.toFixed(2)}</span>
                                <span style="font-weight: 600;">${amount.toFixed(2)}</span>
                            </div>
                        </div>`;
                } else if (isKOT) {
                    // KOT format - emphasize quantity more for kitchen staff
                    html += `
                        <div style="font-size: 14px; margin-bottom: 12px; display: flex;">
                            <div style="font-size: 18px; font-weight: 700; margin-right: 8px; min-width: 30px;">${quantity}x</div>
                            <div style="font-weight: 600;">${item.title || 'Unknown Item'}</div>
                        </div>`;

                    // Add item-specific instructions if any
                    if (item.instructions) {
                        html += `
                            <div style="font-size: 12px; margin: -8px 0 12px 38px; font-style: italic;">
                                ${item.instructions.trim()}
                            </div>`;
                    }
                }
            });
        }

        // For Bills only: add totals section
        if (isBill) {
            html += `
                <div style="border-bottom: 1px dashed #000; margin: 8px 0;"></div>
                <div style="font-size: 12px; font-weight: 600;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span>Sub Total:</span>
                        <span>${calculatedSubTotal.toFixed(2)}</span>
                    </div>`;

            // Add GST details if enabled
            if (seller.gstEnabled) {
                html += `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span>CGST (9%):</span>
                        <span>${totalCGST.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span>SGST (9%):</span>
                        <span>${totalSGST.toFixed(2)}</span>
                    </div>`;
            }

            // Add other charges
            if (orderData.charges && Array.isArray(orderData.charges)) {
                orderData.charges.forEach(charge => {
                    if (charge.value && parseFloat(charge.value) !== 0) {
                        html += `
                            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                                <span>${charge.name || 'Charge'}:</span>
                                <span>${parseFloat(charge.value).toFixed(2)}</span>
                            </div>`;
                    }
                });
            }

            // Add discount if any
            if (orderData.discount && parseFloat(orderData.discount) > 0) {
                html += `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px; color: #22C55E;">
                        <span>Discount:</span>
                        <span>-${parseFloat(orderData.discount).toFixed(2)}</span>
                    </div>`;
            }

            // Calculate final total - this is a simplification, in practice we should use the order's total or calculate properly
            const grandTotal = orderData.total || calculatedSubTotal + totalCGST + totalSGST - (parseFloat(orderData.discount) || 0);

            // Final total
            html += `
                <div style="border-top: 2px solid #000; border-bottom: 2px solid #000; margin: 8px 0; padding: 8px 0;">
                    <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 700;">
                        <span>TOTAL:</span>
                        <span>₹${typeof grandTotal === 'number' ? grandTotal.toFixed(2) : grandTotal}</span>
                    </div>
                </div>

                <!-- Payment Details -->
                <div style="font-size: 12px; font-weight: 600; margin-bottom: 8px;">
                    <div>Payment Mode: ${paymentMode || orderData.payMode || 'CASH'}</div>
                    ${orderData.notes ? `<div style="margin-top: 4px;">${orderData.notes}</div>` : ''}
                </div>`;

            // Footer for bills
            html += `
                <!-- Footer -->
                <div style="text-align: center; margin-top: 12px;">
                    <div style="font-size: 14px; font-weight: 700; margin-bottom: 4px;">Thank You!</div>
                    <div style="font-size: 12px; margin-bottom: 4px;">Visit Again</div>
                    ${seller.website ?
                    `<div style="font-size: 10px;">${seller.website}</div>` : ''}
                </div>`;
        } else if (isKOT) {
            // Special instructions for KOT
            if (orderData.instructions) {
                html += `
                    <div style="border-bottom: 1px dashed #000; margin: 8px 0;"></div>
                    <div style="font-size: 14px; font-weight: 700; text-align: center; margin-bottom: 4px;">NOTES</div>
                    <div style="font-size: 12px; margin-bottom: 8px;">
                        ${orderData.instructions.trim()}
                    </div>`;
            }
        }

        // Close main container
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
                    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
                    <link href="https://cdn.jsdelivr.net/npm/phosphor-icons@1.4.2/src/css/icons.min.css" rel="stylesheet">
                    <style>
                        @media print {
                            @page { 
                                size: 58mm auto;
                                margin: 0mm;
                                padding: 0mm;
                            }
                            body { 
                                margin: 0;
                                padding: 0;
                                color: #000;
                                background: #fff;
                                width: 58mm;
                            }
                            * {
                                font-family: 'Inter', 'Courier New', monospace;
                                line-height: 1.2;
                                -webkit-print-color-adjust: exact;
                                print-color-adjust: exact;
                            }
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
        // Handle different sections based on class names or positions
        // Header section - typically centered
        const headerElements = element.querySelectorAll('div[style*="text-align: center"]');
        if (headerElements.length > 0) {
            commands.push(0x1B, 0x61, 0x01); // Center align

            headerElements.forEach(header => {
                // Look for large text that might be a title
                const largeTexts = header.querySelectorAll('div[style*="font-size: 16px"], div[style*="font-size: 14px"], div[style*="font-size: 20px"]');

                largeTexts.forEach(largeText => {
                    const text = largeText.innerText.trim();
                    if (text) {
                        // Make titles bold
                        commands.push(0x1B, 0x45, 0x01); // Bold ON
                        commands.push(...this.encoder.encode(text + '\n'));
                        commands.push(0x1B, 0x45, 0x00); // Bold OFF
                    }
                });

                // Handle other header content
                const otherTexts = header.querySelectorAll('div:not([style*="font-size: 16px"]):not([style*="font-size: 14px"]):not([style*="font-size: 20px"])');
                otherTexts.forEach(textElement => {
                    const text = textElement.innerText.trim();
                    if (text) {
                        commands.push(...this.encoder.encode(text + '\n'));
                    }
                });
            });

            commands.push(0x1B, 0x61, 0x00); // Left align
        }

        // Find separator lines
        const separators = element.querySelectorAll('div[style*="border-bottom: 1px dashed"]');
        if (separators.length > 0) {
            commands.push(...this.encoder.encode('-'.repeat(this.printerWidth) + '\n'));
        }

        // Order details section
        const orderDetails = element.querySelectorAll('div[style*="font-size: 12px"][style*="font-weight: 600"]');
        if (orderDetails.length > 0) {
            orderDetails.forEach(detail => {
                const lines = detail.innerText.split('\n');
                lines.forEach(line => {
                    if (line.trim()) {
                        commands.push(...this.encoder.encode(line.trim() + '\n'));
                    }
                });
            });
        }

        // Find Items Section header
        const itemsHeader = element.querySelector('div[style*="text-align: center"][style*="margin-bottom: 8px"]');
        if (itemsHeader) {
            commands.push(...this.encoder.encode('\n'));
            commands.push(0x1B, 0x61, 0x01); // Center align
            commands.push(0x1B, 0x45, 0x01); // Bold ON
            commands.push(...this.encoder.encode(itemsHeader.innerText.trim() + '\n'));
            commands.push(0x1B, 0x45, 0x00); // Bold OFF
            commands.push(0x1B, 0x61, 0x00); // Left align
        }

        // Find and process items
        const items = element.querySelectorAll('div[style*="margin-bottom: 8px"] > div[style*="font-weight: 600"]');
        if (items.length > 0) {
            items.forEach(item => {
                const itemName = item.innerText.trim();
                const itemParent = item.parentElement;
                const itemDetails = itemParent.querySelector('div[style*="display: flex"]');

                if (itemName) {
                    commands.push(0x1B, 0x45, 0x01); // Bold ON
                    commands.push(...this.encoder.encode(itemName + '\n'));
                    commands.push(0x1B, 0x45, 0x00); // Bold OFF
                }

                if (itemDetails) {
                    commands.push(...this.encoder.encode(itemDetails.innerText.trim() + '\n'));
                }
            });
        }

        // For KOT, handle quantity x item format differently
        const kotItems = element.querySelectorAll('div[style*="display: flex"] > div[style*="font-size: 18px"]');
        if (kotItems.length > 0) {
            kotItems.forEach(quantityElement => {
                const itemElement = quantityElement.nextElementSibling;
                if (itemElement) {
                    const quantity = quantityElement.innerText.trim();
                    const itemName = itemElement.innerText.trim();

                    commands.push(0x1B, 0x45, 0x01); // Bold ON
                    commands.push(...this.encoder.encode(quantity + ' ' + itemName + '\n'));
                    commands.push(0x1B, 0x45, 0x00); // Bold OFF

                    // Look for instructions
                    const parentDiv = quantityElement.parentElement;
                    const instructionsDiv = parentDiv.nextElementSibling;
                    if (instructionsDiv && instructionsDiv.getAttribute('style')?.includes('font-style: italic')) {
                        commands.push(...this.encoder.encode('  ' + instructionsDiv.innerText.trim() + '\n'));
                    }
                }
            });
        }

        // Total section for bills
        const totalSection = element.querySelector('div[style*="border-top: 2px solid"][style*="border-bottom: 2px solid"]');
        if (totalSection) {
            commands.push(...this.encoder.encode('-'.repeat(this.printerWidth) + '\n'));
            commands.push(0x1B, 0x45, 0x01); // Bold ON
            commands.push(...this.encoder.encode(totalSection.innerText.trim() + '\n'));
            commands.push(0x1B, 0x45, 0x00); // Bold OFF
        }

        // Payment details
        const paymentDetails = element.querySelector('div[style*="font-size: 12px"][style*="margin-bottom: 8px"]:not([style*="text-align: center"])');
        if (paymentDetails && paymentDetails.innerText.includes('Payment Mode')) {
            commands.push(...this.encoder.encode(paymentDetails.innerText.trim() + '\n'));
        }

        // Footer
        const footer = element.querySelector('div[style*="text-align: center"][style*="margin-top: 12px"]');
        if (footer) {
            commands.push(...this.encoder.encode('\n'));
            commands.push(0x1B, 0x61, 0x01); // Center align
            commands.push(...this.encoder.encode(footer.innerText.trim()));
            commands.push(0x1B, 0x61, 0x00); // Left align
        }
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

            // Generate HTML for the KOT
            const kotHtml = this.generateReceiptHTML(orderData, 'kot');

            // Find the appropriate printer for this channel and KOT
            const printer = this.getPrinterForChannel(channel, 'kot');

            // Try Bluetooth printing first if supported
            if (this.isSupported()) {
                try {
                    // Connect to printer if not already connected
                    // If we have a specific printer for this channel, use it
                    if (printer) {
                        // Save current connection state
                        const previousDevice = this.device;
                        const previousConnected = this.connected;
                        const previousCharacteristic = this.characteristic;

                        // Try to connect to the specific printer
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

                            // Only show one toast message right before actually printing
                            this._showToast("Printing KOT...", "info");

                            // Convert HTML to printer-compatible canvas data
                            const data = await this.htmlToCanvas(kotHtml);

                            // Send to printer
                            await this.sendData(data);
                            this._showToast("KOT printed successfully", "success");

                            // Save this printer as the last connected
                            this.savePrinter();

                            return true;
                        } catch (specificPrinterError) {
                            console.error(`Error using specific printer for channel ${channel}:`, specificPrinterError);

                            // Restore previous connection state for fallback
                            this.device = previousDevice;
                            this.connected = previousConnected;
                            this.characteristic = previousCharacteristic;

                            // Fall through to try the default printing path
                        }
                    }

                    // Default printing path - only show one toast message at a time
                    if (!this.connected) {
                        // Only show connection message if we're not connected yet
                        if (this.lastConnectedDevice) {
                            this._showToast("Connecting to printer...", "info");
                        } else {
                            this._showToast("Select a printer for KOT", "info");
                        }
                    }

                    await this.ensurePrinterConnection();

                    // We're connected now, show a single printing message
                    this._showToast("Printing KOT...", "info");

                    // Convert HTML to printer-compatible canvas data
                    const data = await this.htmlToCanvas(kotHtml);

                    // Send to printer
                    await this.sendData(data);
                    this._showToast("KOT printed successfully", "success");

                    // Save the connected printer to the printer list
                    this.savePrinter();

                    return true;
                } catch (error) {
                    // Handle error based on type
                    const errorType = this._handlePrinterError(error);

                    // If it's a user cancellation, don't attempt fallback
                    if (errorType === "user_cancelled") {
                        return false;
                    }

                    // For other errors, try browser printing as fallback
                    this._showToast("Attempting browser print for KOT...", "info");
                    try {
                        await this.browserPrint(kotHtml, false);
                        this._showToast("KOT printed successfully via browser", "success");
                        return true;
                    } catch (fallbackErr) {
                        console.error("Browser print fallback failed:", fallbackErr);
                        this._showToast(`Browser print failed: ${fallbackErr.message}`, "error");
                        return false;
                    }
                }
            }
            // No Bluetooth support, use browser print directly
            try {
                this._showToast("Printing KOT via browser...", "info");
                await this.browserPrint(kotHtml, false);
                this._showToast("KOT printed successfully", "success");
                return true;
            } catch (err) {
                console.error("Browser print failed:", err);
                this._showToast(`Browser print failed: ${err.message}`, "error");
                return false;
            }
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

            // Generate HTML for the bill
            const billHtml = this.generateReceiptHTML(orderData, 'bill', paymentMode);

            // Find the appropriate printer for this channel and bill
            const printer = this.getPrinterForChannel(channel, 'bill');

            // Try Bluetooth printing first if supported
            if (this.isSupported()) {
                try {
                    // If we have a specific printer for this channel, use it
                    if (printer) {
                        // Save current connection state
                        const previousDevice = this.device;
                        const previousConnected = this.connected;
                        const previousCharacteristic = this.characteristic;

                        // Try to connect to the specific printer
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

                            // Only show one toast message right before actually printing
                            this._showToast("Printing bill...", "info");

                            // Convert HTML to printer-compatible canvas data
                            const data = await this.htmlToCanvas(billHtml);

                            // Send to printer
                            await this.sendData(data);
                            this._showToast("Bill printed successfully", "success");

                            // Save the connected printer to the printer list
                            this.savePrinter();

                            return true;
                        } catch (specificPrinterError) {
                            console.error(`Error using specific printer for channel ${channel}:`, specificPrinterError);

                            // Restore previous connection state for fallback
                            this.device = previousDevice;
                            this.connected = previousConnected;
                            this.characteristic = previousCharacteristic;

                            // Fall through to try the default printing path
                        }
                    }

                    // Default printing path - only show one toast message at a time
                    if (!this.connected) {
                        // Only show connection message if we're not connected yet
                        if (this.lastConnectedDevice) {
                            this._showToast("Connecting to printer...", "info");
                        } else {
                            this._showToast("Select a printer for bill", "info");
                        }
                    }

                    // Connect to printer if not already connected
                    await this.ensurePrinterConnection();

                    // We're connected now, show a single printing message
                    this._showToast("Printing bill...", "info");

                    // Convert HTML to printer-compatible canvas data
                    const data = await this.htmlToCanvas(billHtml);

                    // Send to printer
                    await this.sendData(data);
                    this._showToast("Bill printed successfully", "success");

                    // Save the connected printer to the printer list
                    this.savePrinter();

                    return true;
                } catch (error) {
                    // Handle error based on type
                    const errorType = this._handlePrinterError(error);

                    // If it's a user cancellation, don't attempt fallback
                    if (errorType === "user_cancelled") {
                        return false;
                    }

                    // For other errors, try browser printing as fallback
                    this._showToast("Attempting browser print for bill...", "info");
                    try {
                        await this.browserPrint(billHtml, autoPrint);
                        this._showToast("Bill printed successfully via browser", "success");
                        return true;
                    } catch (fallbackErr) {
                        console.error("Browser print fallback failed:", fallbackErr);
                        this._showToast(`Browser print failed: ${fallbackErr.message}`, "error");
                        return false;
                    }
                }
            } else {
                // No Bluetooth support, use browser print directly
                try {
                    this._showToast("Printing bill via browser...", "info");
                    await this.browserPrint(billHtml, autoPrint);
                    this._showToast("Bill printed successfully", "success");
                    return true;
                } catch (err) {
                    console.error("Browser print failed:", err);
                    this._showToast(`Browser print failed: ${err.message}`, "error");
                    return false;
                }
            }
        } catch (error) {
            console.error('Error in printBill:', error);
            this._showToast(`Failed to print bill: ${error.message}`, "error");
            return false;
        }
    }

    /**
     * Initialize common printer formatter elements
     * @param {boolean} [useCentered=false] - Whether to include centered text helper
     * @returns {Object} Object with commands array and helper functions
     * @private
     */
    createPrinterFormatter(useCentered = false) {
        const commands = [];
        const printerWidth = this.printerWidth;

        // Get printer size name for better readability in code
        const getPrinterSizeName = () => {
            for (const [sizeName, width] of Object.entries(this.printerSizes)) {
                if (width === printerWidth) {
                    return sizeName;
                }
            }
            return '3inch'; // Default fallback
        };

        const printerSizeName = getPrinterSizeName();

        // Common helper functions
        const addText = (text, addNewline = true) => {
            commands.push(...this.encoder.encode(text + (addNewline ? '\n' : '')));
        };

        const addLine = () => {
            addText('-'.repeat(printerWidth));
        };

        // Optional centered text helper for bill receipts
        const addCenteredText = useCentered ? (text) => {
            commands.push(0x1B, 0x61, 0x01); // Center
            addText(text);
            commands.push(0x1B, 0x61, 0x00); // Left align
        } : null;

        const truncate = (text, maxLength) => {
            if (!text) return '';
            return text.length > maxLength ? text.substring(0, maxLength) : text;
        };

        // Helper for formatting order/bill number consistently
        const formatOrderNumber = (order) => {
            return order.billNo || order.id?.substring(0, 6) || 'N/A';
        };

        // Helper for formatting date and time
        const formatDateTime = (date, timeOnly = false) => {
            const dateObj = date?.toDate ? date.toDate() : (date || new Date());

            if (timeOnly) {
                return dateObj.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                });
            }

            return {
                date: dateObj.toLocaleDateString(),
                time: dateObj.toLocaleTimeString()
            };
        };

        // Text size definitions based on printer width
        const createTextSizes = (forBill = false) => {
            if (forBill) {
                return {
                    NORMAL: 0x00,
                    HEADER: printerSizeName === '2inch' ? 0x00 : 0x31, // Normal for 2-inch, Double height + Double width for larger
                    SUBHEADER: printerSizeName === '2inch' ? 0x00 : 0x11, // Normal for 2-inch, Double height for larger
                    TOTAL: printerSizeName === '2inch' ? 0x00 : 0x31, // Normal for 2-inch, Double height + Double width for larger
                    FOOTER: printerSizeName === '2inch' ? 0x00 : 0x11 // Normal for 2-inch, Double height for larger
                };
            } else {
                return {
                    NORMAL: 0x00,
                    TABLE: printerSizeName === '2inch' ? 0x01 : 0x33, // Double width for 2-inch, Quadruple height + double width for larger
                    ORDER: printerSizeName === '2inch' ? 0x00 : 0x22, // Normal for 2-inch, Double height + Double width for larger
                    QUANTITY: printerSizeName === '2inch' ? 0x00 : 0x33, // Normal for 2-inch, Quadruple height + double width for larger
                    ITEM: printerSizeName === '2inch' ? 0x00 : 0x22, // Normal for 2-inch, Double height + Double width for larger
                    NOTES_HEADER: printerSizeName === '2inch' ? 0x00 : 0x22 // Normal for 2-inch, Double height + Double width for larger
                };
            }
        };

        // Initialize printer
        commands.push(0x1B, 0x40); // Initialize printer

        // Set base font and turn bold on
        commands.push(0x1B, 0x21, 0x00); // Font A
        commands.push(0x1B, 0x45, 0x01); // Bold ON

        return {
            commands,
            printerWidth,
            printerSizeName,
            addText,
            addLine,
            addCenteredText,
            truncate,
            formatOrderNumber,
            formatDateTime,
            createTextSizes
        };
    }

    /**
     * Load an image from a URL and convert it to a printer-compatible bitmap
     * @param {string} imageUrl - URL of the image to load
     * @param {number} maxWidth - Maximum width for the image in pixels (usually printer width * 8)
     * @returns {Promise<Uint8Array>} - Commands for printing the image or null if failed
     * @private
     */
    async loadLogoImage(imageUrl) {
        if (!imageUrl) return null;

        // Check cache first
        if (this.imageCache.has(imageUrl)) {
            return this.imageCache.get(imageUrl);
        }

        try {
            // Determine maximum width based on printer size
            const printerWidthPixels = this.printerWidth * 8; // Each character is about 8 pixels
            const maxHeight = 100; // Limit maximum height to avoid large prints

            return new Promise((resolve, reject) => {
                const img = new Image();

                img.onload = () => {
                    try {
                        // Create a canvas to process the image
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');

                        // Calculate dimensions while preserving aspect ratio
                        let width = img.width;
                        let height = img.height;

                        // Scale down if wider than printer width
                        if (width > printerWidthPixels) {
                            const scale = printerWidthPixels / width;
                            width = printerWidthPixels;
                            height = Math.floor(height * scale);
                        }

                        // Further limit height if needed
                        if (height > maxHeight) {
                            const scale = maxHeight / height;
                            height = maxHeight;
                            width = Math.floor(width * scale);
                        }

                        // Ensure width is a multiple of 8 for byte alignment
                        width = Math.floor(width / 8) * 8;

                        // Set canvas dimensions
                        canvas.width = width;
                        canvas.height = height;

                        // Draw and process image
                        ctx.fillStyle = 'white';
                        ctx.fillRect(0, 0, width, height);
                        ctx.drawImage(img, 0, 0, width, height);

                        // Get image data
                        const imageData = ctx.getImageData(0, 0, width, height);
                        const pixels = imageData.data;

                        // Process image data for printer
                        const commands = [];

                        // Center alignment
                        commands.push(0x1B, 0x61, 0x01);

                        // Calculate bytes needed for each line (width / 8)
                        const bytesPerLine = width / 8;

                        // Use GS v 0 raster bit image command - more compatible with various printers
                        commands.push(0x1D, 0x76, 0x30, 0x00);

                        // xL, xH - width in bytes (low, high bytes)
                        commands.push(bytesPerLine & 0xFF);
                        commands.push((bytesPerLine >> 8) & 0xFF);

                        // yL, yH - height in pixels (low, high bytes)
                        commands.push(height & 0xFF);
                        commands.push((height >> 8) & 0xFF);

                        // Convert image data to bitmap
                        for (let y = 0; y < height; y++) {
                            for (let x = 0; x < bytesPerLine; x++) {
                                let b = 0;
                                for (let bit = 0; bit < 8; bit++) {
                                    const xPos = x * 8 + bit;
                                    const i = (y * width + xPos) * 4;

                                    // Convert to grayscale and check threshold
                                    const gray = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];

                                    // Set bit if pixel is dark (invert because thermal printers print black)
                                    if (gray < 128) {
                                        b |= (0x80 >> bit);
                                    }
                                }
                                commands.push(b);
                            }
                        }

                        // Return to left alignment
                        commands.push(0x1B, 0x61, 0x00);

                        // Create result and cache it
                        const result = new Uint8Array(commands);
                        this.imageCache.set(imageUrl, result);

                        resolve(result);
                    } catch (error) {
                        console.error('Error processing logo image:', error);
                        resolve(null);
                    }
                };

                img.onerror = () => {
                    console.error('Failed to load logo image:', imageUrl);
                    resolve(null);
                };

                // Set crossOrigin to allow processing images from other domains
                img.crossOrigin = 'anonymous';
                img.src = imageUrl;
            });
        } catch (error) {
            console.error('Error in loadLogoImage:', error);
            return null;
        }
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