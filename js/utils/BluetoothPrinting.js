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
    _handlePrinterError(error) {
        console.error('Printer error:', error);
        
        // User cancelled the connection
        if (error.message?.includes("cancelled") || 
            error.message?.includes("No printer selected") ||
            error.name === "NotFoundError") {
            this._showToast("Printing cancelled by user", "info");
            return "user_cancelled";
        } 
        
        // Incompatible device errors
        if (error.message?.includes("No suitable service") ||
            error.message?.includes("No services found") ||
            error.message?.includes("not supported as a printer") ||
            error.message?.includes("cannot be used for printing") ||
            (error.name === 'NetworkError' && error.message?.includes("Unsupported device"))) {
            this._showToast("Could not connect to printer. Please select a compatible thermal printer.", "error");
            return "incompatible_device";
        }
        
        // Generic connection errors
        if (error.name === "NetworkError" || 
            error.message?.includes("disconnected") ||
            error.message?.includes("connection") ||
            error.message?.includes("GATT")) {
            this._showToast(`Printer connection error: ${error.message}`, "error");
            return "connection_error";
        }
        
        // Generic errors
        this._showToast(`Printing error: ${error.message}`, "error");
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
                <div style="margin-bottom: 4px;">${isKOT ? 'KOT' : 'Bill'} #: ${orderData.billNo || orderData.id?.substring(0,8) || 'N/A'}</div>
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
     * Browser-based print function using hidden iframe
     * @param {string} htmlContent - The HTML content to print
     * @param {boolean} autoPrint - Whether to attempt auto-printing without dialog
     * @returns {Promise<boolean>} True if printing was successful
     */
    async browserPrint(htmlContent, autoPrint = false) {
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

                if (printFrame.contentWindow.document.readyState === 'complete') {
                    doPrint();
                } else {
                    printFrame.onload = doPrint;
                }
            } catch (error) {
                console.error("Error setting up browser print:", error);
                reject(error);
            }
        });
    }

    /**
     * Convert HTML to ESC/POS commands for thermal printers
     * This is a simplified version that extracts text and basic formatting
     * @param {string} html - HTML content to convert
     * @returns {Uint8Array} ESC/POS commands for the printer
     */
    async htmlToEscPos(html) {
        try {
            let doc;
            
            // Create a DOM parser to parse the HTML
            if (typeof DOMParser !== 'undefined') {
                // Browser environment
                const parser = new DOMParser();
                doc = parser.parseFromString(html, 'text/html');
            } else {
                // Fallback for non-browser environments
                console.warn("DOMParser not available, using simplified HTML parsing");
                // Create a very simple text-only extraction
                const textContent = html.replace(/<[^>]*>/g, ' ')
                                       .replace(/\s+/g, ' ')
                                       .trim();
                
                // Initialize commands array
                const commands = [];
                
                // Initialize printer
                commands.push(0x1B, 0x40); // ESC @ - Initialize printer
                
                // Add text content
                commands.push(...this.encoder.encode(textContent));
                
                // Add feed and cut
                commands.push(0x1B, 0x64, 5); // Feed 5 lines
                commands.push(0x1D, 0x56, 0x41); // Partial cut
                
                return new Uint8Array(commands);
            }
            
            // Initialize commands array for ESC/POS
            const commands = [];
            
            // Initialize printer
            commands.push(0x1B, 0x40); // ESC @ - Initialize printer
            
            // Extract and process text nodes
            this.processNode(doc.body, commands);
            
            // Add feed and cut at the end
            commands.push(0x1B, 0x64, 5); // Feed 5 lines
            commands.push(0x1D, 0x56, 0x41); // Partial cut
            
            return new Uint8Array(commands);
        } catch (error) {
            console.error("Error converting HTML to ESC/POS:", error);
            
            // Fallback to basic text with minimal formatting
            try {
                const commands = [];
                
                // Initialize printer
                commands.push(0x1B, 0x40); // ESC @ - Initialize printer
                
                // Extract text content by removing HTML tags
                const textContent = html.replace(/<[^>]*>/g, ' ')
                                       .replace(/\s+/g, ' ')
                                       .trim();
                
                // Add text with basic formatting
                commands.push(0x1D, 0x21, 0x00); // Normal size
                commands.push(0x1B, 0x45, 0x01); // Bold ON
                commands.push(0x1B, 0x61, 0x01); // Center align
                commands.push(...this.encoder.encode("--- RECEIPT ---\n\n"));
                commands.push(0x1B, 0x45, 0x00); // Bold OFF
                commands.push(0x1B, 0x61, 0x00); // Left align
                
                // Add the extracted text content
                commands.push(...this.encoder.encode(textContent));
                
                // Add feed and cut
                commands.push(0x1B, 0x64, 5); // Feed 5 lines
                commands.push(0x1D, 0x56, 0x41); // Partial cut
                
                return new Uint8Array(commands);
            } catch (fallbackError) {
                console.error("Fallback text extraction failed:", fallbackError);
                throw error; // Throw the original error
            }
        }
    }
    
    /**
     * Process an HTML node and its children to generate ESC/POS commands
     * @param {Node} node - DOM node to process
     * @param {Array} commands - Array to append commands to
     * @private
     */
    processNode(node, commands) {
        // Handle different node types
        if (node.nodeType === Node.TEXT_NODE) {
            // Text node - add the text content if not empty (without automatic newline)
            const text = node.textContent.trim();
            if (text) {
                commands.push(...this.encoder.encode(text));
            }
            return;
        }
        
        if (node.nodeType !== Node.ELEMENT_NODE) {
            return; // Skip non-element nodes
        }
        
        // Process element based on tag name
        const tagName = node.tagName.toLowerCase();
        let style = null;
        
        try {
            // Try to get computed style if in browser environment
            style = window.getComputedStyle ? window.getComputedStyle(node) : null;
        } catch (e) {
            // Handle absence of window/DOM environment (in case of SSR)
            style = null;
        }
        
        // Default formatting
        let addNewline = false;
        let centerAlign = false;
        let applyBold = false;
        let textSize = 0x00; // Normal size
        
        // Extract style attributes from inline style if computed style is not available
        if (!style && node.getAttribute) {
            const textAlign = node.getAttribute('style')?.match(/text-align:\s*([^;]+)/i)?.[1];
            const fontWeight = node.getAttribute('style')?.match(/font-weight:\s*([^;]+)/i)?.[1];
            const fontSize = node.getAttribute('style')?.match(/font-size:\s*([^;]+)/i)?.[1];
            
            centerAlign = textAlign === 'center';
            applyBold = fontWeight === 'bold' || fontWeight === '700' || fontWeight === '800';
            
            // Simple fontSize parsing for inline styles
            if (fontSize) {
                if (fontSize.includes('px')) {
                    const size = parseInt(fontSize);
                    if (size >= 20) {
                        textSize = 0x11; // Double height, double width
                    } else if (size >= 16) {
                        textSize = 0x01; // Normal height, double width
                    }
                }
            }
        } else if (style) {
            // Use computed style
            centerAlign = style.textAlign === 'center';
            applyBold = style.fontWeight === 'bold' || parseInt(style.fontWeight) >= 700;
            
            const fontSize = parseInt(style.fontSize);
            if (fontSize >= 20) {
                textSize = 0x11; // Double height, double width
            } else if (fontSize >= 16) {
                textSize = 0x01; // Normal height, double width
            }
        }
        
        // Apply alignment
        if (centerAlign) {
            commands.push(0x1B, 0x61, 0x01); // Center align
        } else {
            commands.push(0x1B, 0x61, 0x00); // Left align (default)
        }
        
        // Apply bold if needed
        if (applyBold) {
            commands.push(0x1B, 0x45, 0x01); // Bold ON
        }
        
        // Apply text size
        if (textSize !== 0x00) {
            commands.push(0x1D, 0x21, textSize);
        }
        
        // Special handling for specific elements
        switch (tagName) {
            case 'br':
                commands.push(...this.encoder.encode('\n'));
                return;
                
            case 'hr':
                commands.push(...this.encoder.encode('-'.repeat(this.printerWidth) + '\n'));
                return;
                
            case 'div':
            case 'p':
            case 'h1':
            case 'h2':
            case 'h3':
            case 'h4':
            case 'h5':
            case 'h6':
                addNewline = true;
                break;
                
            case 'img':
                // Image not supported in this basic implementation
                // We could extend this to handle simple images using graphics mode
                commands.push(...this.encoder.encode('[IMAGE]'));
                addNewline = true;
                break;
        }
        
        // Process all child nodes
        for (const child of node.childNodes) {
            this.processNode(child, commands);
        }
        
        // Add newline if needed after processing all children
        if (addNewline) {
            commands.push(...this.encoder.encode('\n'));
        }
        
        // Reset formatting
        if (applyBold) {
            commands.push(0x1B, 0x45, 0x00); // Bold OFF
        }
        
        if (textSize !== 0x00) {
            commands.push(0x1D, 0x21, 0x00); // Normal size
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

            // Get all available services
            const services = await server.getPrimaryServices();
            if (services.length === 0) {
                throw new Error('No services found on the device');
            }

            // Try to find a service we can use for printing
            let service = null;
            let characteristic = null;

            // Try each service to find a writable characteristic
            for (const s of services) {
                try {
                    const chars = await s.getCharacteristics();

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
                throw new Error('No suitable service or characteristic found');
            }

            this.characteristic = characteristic;
            this.connected = true;
            this.reconnectAttempted = false;

            // Set up disconnection listener to reset state
            this.device.addEventListener('gattserverdisconnected', () => {
                console.log('Bluetooth device disconnected');
                this.connected = false;
                this.characteristic = null;
            });

            console.log('Silent reconnect successful');
            return true;
        } catch (error) {
            console.error('Silent reconnect failed:', error);
            this.connected = false;
            this.reconnectAttempted = false;
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
            }
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
     * @returns {Promise<boolean>} True if printing was successful
     */
    async printKOT(orderId) {
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

            // Generate HTML for the KOT
            const kotHtml = this.generateReceiptHTML(orderData, 'kot');
            
            // Show initial status message
            if (this.connected && this.characteristic) {
                this._showToast("Printing KOT using connected printer...", "info");
            } else if (this.lastConnectedDevice) {
                this._showToast("Connecting to printer for KOT...", "info");
            } else if (this.isSupported()) {
                this._showToast("Select a printer to print KOT", "info");
            }

            // Try Bluetooth printing first if supported
            if (this.isSupported()) {
                try {
                    // Connect to printer if not already connected
                    await this.ensurePrinterConnection();
                    
                    // Convert HTML to ESC/POS commands
                    const data = await this.htmlToEscPos(kotHtml);
                    
                    // Send to printer
                    await this.sendData(data);
                    this._showToast("KOT printed successfully", "success");
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
            } else {
                // No Bluetooth support, use browser print directly
                try {
                    await this.browserPrint(kotHtml, false);
                    this._showToast("KOT printed successfully", "success");
                    return true;
                } catch (err) {
                    console.error("Browser print failed:", err);
                    this._showToast(`Browser print failed: ${err.message}`, "error");
                    return false;
                }
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
     * @returns {Promise<boolean>} True if printing was successful
     */
    async printBill(orderId, paymentMode, autoPrint = false) {
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

            // Generate HTML for the bill
            const billHtml = this.generateReceiptHTML(orderData, 'bill', paymentMode);
            
            // Show initial status message
            if (this.connected && this.characteristic) {
                this._showToast("Printing bill using connected printer...", "info");
            } else if (this.lastConnectedDevice) {
                this._showToast("Connecting to printer for bill...", "info");
            } else if (this.isSupported()) {
                this._showToast("Select a printer to print bill", "info");
            }

            // Try Bluetooth printing first if supported
            if (this.isSupported()) {
                try {
                    // Connect to printer if not already connected
                    await this.ensurePrinterConnection();
                    
                    // Convert HTML to ESC/POS commands
                    const data = await this.htmlToEscPos(billHtml);
                    
                    // Send to printer
                    await this.sendData(data);
                    this._showToast("Bill printed successfully", "success");
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