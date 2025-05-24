/**
 * PrintTemplate.js - Classes for managing thermal printer receipt templates
 * This module provides PrintSection and PrintTemplate classes for creating and managing
 * receipt templates for thermal printers.
 */

/**
 * PrintSection represents a section of content in a receipt template
 * with its own formatting options
 */
class PrintSection {
    constructor(options = {}) {
        this.template = options.template || '';
        this.alignment = options.alignment || 'TextAlign.left';
        this.fontSize = options.fontSize || 20;
        this.isBold = options.isBold || false;
        this.variables = {};
    }

    /**
     * Process content variables and replace with actual values
     * @returns {string} Processed content with variables replaced
     */
    resolveVariables() {
        if (!this.template) return '';

        let result = this.template;

        // Replace all variable placeholders with their values
        Object.entries(this.variables).forEach(([key, value]) => {
            const placeholder = `#${key}`;
            if (result.includes(placeholder)) {
                result = result.replace(new RegExp(placeholder, 'g'), value);
            }
        });

        return result;
    }

    /**
     * Generate HTML representation of this section for preview or printing
     * @returns {string} HTML content
     */
    toHTML() {
        const content = this.resolveVariables();
        if (!content.trim()) return '';

        // Map alignment to Tailwind classes
        let alignClass;
        switch (this.alignment) {
            case 'TextAlign.center': alignClass = 'text-center'; break;
            case 'TextAlign.right': alignClass = 'text-right'; break;
            default: alignClass = 'text-left'; break;
        }

        // Map font size and bold to Tailwind classes
        const fontSizeClass = this.fontSize > 24 ? 'text-lg' : '';
        const boldClass = this.isBold ? 'font-bold' : '';

        let html = `<div class="${alignClass} ${fontSizeClass} ${boldClass} w-full whitespace-pre-wrap overflow-hidden my-1">`;

        // Process each line individually
        const lines = content.split('\n');
        lines.forEach((line, index) => {
            if (line.trim()) {
                html += `${line}${index < lines.length - 1 ? '<br>' : ''}`;
            }
        });

        html += `</div>`;

        return html;
    }

    /**
     * Generate ESC/POS commands for this section
     * @param {TextEncoder} encoder - TextEncoder instance for converting text to bytes
     * @returns {Array} Array of command bytes
     */
    toPrinterCommands(encoder) {
        const commands = [];
        const content = this.resolveVariables();

        if (!content.trim()) return commands;

        // Initialize formatting
        commands.push(0x1B, 0x40); // ESC @ - Initialize printer

        // Set alignment
        switch (this.alignment) {
            case 'TextAlign.center':
                commands.push(0x1B, 0x61, 0x01); // Center align
                break;
            case 'TextAlign.right':
                commands.push(0x1B, 0x61, 0x02); // Right align
                break;
            default:
                commands.push(0x1B, 0x61, 0x00); // Left align
                break;
        }

        // Set bold if needed
        if (this.isBold) {
            commands.push(0x1B, 0x45, 0x01); // Bold ON
        }

        // Set font size if needed
        if (this.fontSize > 24) {
            commands.push(0x1D, 0x21, 0x11); // Double height and width
        }

        // Process and send each line
        const lines = content.split('\n');
        lines.forEach(line => {
            const trimmedLine = line.trim();
            if (trimmedLine) {
                commands.push(...encoder.encode(trimmedLine + '\n'));
            }
        });

        // Reset formatting after this section
        if (this.fontSize > 24) {
            commands.push(0x1D, 0x21, 0x00); // Normal size
        }

        if (this.isBold) {
            commands.push(0x1B, 0x45, 0x00); // Bold OFF
        }

        // Return to default alignment
        commands.push(0x1B, 0x61, 0x00);

        return commands;
    }
}

/**
 * PrintTemplate manages a collection of PrintSection objects and provides methods
 * for generating complete print output
 */
class PrintTemplate {
    constructor(options = {}) {
        this.type = options.type || 'bill'; // 'bill' or 'kot'
        this.printerWidth = options.printerWidth || 48; // Default to 3-inch width
        this.encoder = new TextEncoder();
        this.variables = {};
        this.sections = (options.sections || []).map(section => new PrintSection(section));
    }

    /**
     * Process order data and prepare template variables
     * @param {Object} orderData - The order data
     * @param {Object} options - Additional options (seller info)
     */
    processOrderData(orderData, options = {}) {
        const { seller = {} } = options;

        // Generate variables from order data
        this.variables = this._prepareVariablesFromOrder(orderData, seller);

        // Apply variables to all sections
        this.sections.forEach(section => {
            section.variables = this.variables;
        });
    }

    /**
     * Generate HTML for the template as a complete HTML document
     * @returns {string} Complete HTML document ready for preview or printing
     */
    toHTML() {
        // Generate the content HTML
        let contentHtml = `<div class="printer-container w-full max-w-[58mm] mx-auto">`;

        this.sections.forEach(section => {
            const sectionHtml = section.toHTML();
            if (sectionHtml) {
                contentHtml += sectionHtml;
                contentHtml += `<div class="border-b border-dashed border-gray-300"></div>`;
            }
        });

        contentHtml += `</div>`;

        // Return a complete HTML document
        return `
            <html>
                <head>
                    <title>Print Preview</title>
                    <style>
                        @media print {
                            @page { 
                                size: 58mm auto;
                                margin: 0;
                            }
                            body { 
                                width: 58mm;
                            }
                        }
                        
                        body {
                            font-family: monospace;
                            line-height: 1;
                            font-size: 10px;
                            width: 58mm;
                            margin: 0 auto;
                            padding: 1px;
                        }
                    </style>
                </head>
                <body>${contentHtml}</body>
            </html>
        `;
    }

    /**
     * Generate complete ESC/POS commands for all sections
     * @returns {Uint8Array} Complete command bytes
     */
    toPrinterCommands() {
        const commands = [];

        // Initialize printer
        commands.push(0x1B, 0x40); // ESC @ - Initialize printer

        // Process each section
        this.sections.forEach(section => {
            const sectionCommands = section.toPrinterCommands(this.encoder);
            commands.push(...sectionCommands);

            // Add separator between sections (if not empty)
            if (sectionCommands.length > 0) {
                commands.push(0x1B, 0x64, 1); // Feed 1 line
                commands.push(0x1D, 0x2A, 1, Math.min(255, this.printerWidth), 0); // Set horizontal line
                commands.push(0x1D, 0x2F, 0); // Print horizontal line
                commands.push(0x1B, 0x64, 1); // Feed 1 line
            }
        });

        // Add feed and cut at the end
        commands.push(0x1B, 0x64, 4); // Feed 4 lines
        commands.push(0x1D, 0x56, 0x41); // Partial cut

        return new Uint8Array(commands);
    }

    /**
     * Prepare variables from order data (private method)
     * @param {Object} orderData - The order data
     * @param {Object} seller - Seller data
     * @returns {Object} Variables for template
     * @private
     */
    _prepareVariablesFromOrder(orderData, seller) {
        const variables = {
            // Basic business info
            businessName: `${seller.businessName || 'Your Business'}`,
            logo: seller.logo ?
                `<div class="text-center"><img src="${seller.logo}" alt="Logo" class="max-w-[45mm] max-h-[15mm] mx-auto"></div>` :
                '<div class="text-center"><i class="ph ph-storefront text-2xl"></i></div>',
            phone: seller.phone ? `${seller.phone}` : '',
            address: seller.address ? `${seller.address}` : '',
            storeLink: seller.website ? `${seller.website}` : '',
            gstIN: seller.gstIN ? `${seller.gstIN}` : '',

            // Order details
            billNo: `${orderData.billNo || orderData.id?.substring(0, 8) || 'N/A'}`,
            orderSource: `${orderData.priceVariant || 'Default'}`,
            payMode: `${orderData.payMode || 'CASH'}`,
            timestamp: `${new Date(orderData.date?.toDate ? orderData.date.toDate() : orderData.date || new Date()).toLocaleString()}`,
            cut: '<div class="border-t border-dashed my-1 border-gray-400"></div>',
            upiQR: orderData.upiQR ? `<div class="text-center"><i class="ph ph-qr-code text-4xl"></i></div>` : ''
        };

        // Prepare items list for both templates if items exist
        if (orderData.items && orderData.items.length > 0) {
            // For bill template
            variables.itemsList = this._generateBillItemsList(orderData.items);

            // For KOT template
            variables.kotItemsList = this._generateKOTItemsList(orderData.items);

            // Calculate subtotal for bill
            const subtotal = orderData.items.reduce((total, item) => {
                const quantity = parseFloat(item.quantity || item.qnt || 1);
                const price = parseFloat(item.price || 0);
                return total + (quantity * price);
            }, 0);

            variables.subtotal = `${subtotal.toFixed(2)}`;

            // Handle discount
            const discount = orderData.discount ? parseFloat(orderData.discount) : 0;
            if (discount > 0) {
                variables.discount = `${discount.toFixed(2)}`;
            }

            // Handle charges
            let chargesHtml = '';
            if (orderData.charges && Array.isArray(orderData.charges)) {
                orderData.charges.forEach(charge => {
                    if (charge.value && parseFloat(charge.value) !== 0) {
                        chargesHtml += `${charge.name}: ${parseFloat(charge.value).toFixed(2)}`;
                    }
                });
            }
            variables.charges = chargesHtml;

            // Handle total
            let total = orderData.total;
            if (!total) {
                let calculatedTotal = subtotal;

                if (orderData.charges && Array.isArray(orderData.charges)) {
                    orderData.charges.forEach(charge => {
                        if (charge.value) {
                            calculatedTotal += parseFloat(charge.value);
                        }
                    });
                }

                if (orderData.discount) {
                    calculatedTotal -= parseFloat(orderData.discount);
                }

                total = calculatedTotal;
            }

            variables.total = `${typeof total === 'number' ? total.toFixed(2) : total || '0.00'}`;
        }

        return variables;
    }

    /**
     * Generate HTML for bill items list
     * @param {Array} items - Order items
     * @returns {string} HTML for items list
     * @private
     */
    _generateBillItemsList(items) {
        let html = `<div class="flex w-full font-bold border-b border-dashed border-gray-400">
            <div class="w-[10%]">Qty</div>
            <div class="w-[70%]">Item</div>
            <div class="w-[20%] text-right">Amt</div>
        </div>`;

        // Add items
        items.forEach(item => {
            const quantity = parseFloat(item.quantity || item.qnt || 1);
            const price = parseFloat(item.price || 0);
            const amount = quantity * price;
            const itemName = (item.title || 'Unknown Item').substring(0, 20); // Limit item name length

            html += `<div class="flex w-full text-xs">
                <div class="w-[10%]">${quantity}</div>
                <div class="w-[70%]">${itemName}</div>
                <div class="w-[20%] text-right">${amount.toFixed(2)}</div>
            </div>`;
        });

        html += '<div class="border-t border-dashed border-gray-400 mt-0.5"></div>';
        return html;
    }

    /**
     * Generate HTML for KOT items list
     * @param {Array} items - Order items
     * @returns {string} HTML for KOT items list
     * @private
     */
    _generateKOTItemsList(items) {
        let html = `<div class="text-center font-bold text-xs">KITCHEN ORDER</div>
        <div class="border-t border-dashed border-gray-400 mb-0.5"></div>`;

        items.forEach(item => {
            const quantity = parseFloat(item.quantity || item.qnt || 1);

            html += `<div class="flex text-xs">
                <div class="w-5 font-bold">${quantity}x</div>
                <div class="flex-1 font-bold">${item.title || 'Unknown Item'}</div>
            </div>`;

            if (item.instructions) {
                html += `<div class="pl-5 italic text-xs">
                    Note: ${item.instructions.trim()}
                </div>`;
            }
        });

        html += '<div class="border-t border-dashed border-gray-400 mt-0.5"></div>';
        return html;
    }

    /**
     * Create a default template for bills or KOT
     * @param {Object} options - Options for template creation
     * @param {string} options.type - 'bill' or 'kot'
     * @param {Object} options.orderData - Order data for context-specific templates
     * @param {Object} options.seller - Seller data with business information
     * @param {number} options.printerWidth - The printer width in characters (optional)
     * @param {Object} options.templateData - Custom template data (optional)
     * @returns {PrintTemplate} A new PrintTemplate instance
     */
    static create(options = {}) {
        const {
            type = 'bill',
            orderData = {},
            seller = {},
            printerWidth = 48,
            templateData = null
        } = options;

        // Create template based on provided template data or default templates
        const template = templateData
            ? new PrintTemplate({
                type: templateData.type || type,
                printerWidth,
                sections: templateData.sections || []
            })
            : type.toLowerCase() === 'kot'
                ? this._createDefaultKOT(orderData, printerWidth)
                : this._createDefaultBill(orderData, printerWidth);

        // Process order data if provided
        if (orderData && Object.keys(orderData).length > 0) {
            template.processOrderData(orderData, { seller });
        }

        return template;
    }

    /**
     * Create a default template for bills (private method)
     * @param {Object} orderData - Order data for context-specific templates 
     * @param {number} printerWidth - The printer width in characters
     * @returns {PrintTemplate} A new PrintTemplate instance
     * @private
     */
    static _createDefaultBill(orderData = {}, printerWidth = 48) {
        const template = new PrintTemplate({
            type: 'bill',
            printerWidth: printerWidth
        });

        // Header section
        template.sections.push(new PrintSection({
            template: `${orderData.gstEnabled ? 'TAX INVOICE' : 'BILL/RECEIPT'}\n#businessName\n#address\nPhone: #phone\nWeb: #storeLink\nGST: #gstIN`,
            alignment: 'TextAlign.center',
            fontSize: 24,
            isBold: true
        }));

        // Order details section
        template.sections.push(new PrintSection({
            template: `Bill #: #billNo\nDate: #timestamp\n${orderData.custName || orderData.customer?.name ? `Customer: ${orderData.custName || orderData.customer?.name}` : ''}\n${orderData.tableId ? `Table: ${orderData.tableId}` : ''}\nOrder from: #orderSource`,
            alignment: 'TextAlign.left',
            fontSize: 20,
            isBold: false
        }));

        // Items section - use itemsListText for printer commands
        template.sections.push(new PrintSection({
            template: '#itemsList',
            alignment: 'TextAlign.left',
            fontSize: 20,
            isBold: false
        }));

        // Totals section
        template.sections.push(new PrintSection({
            template: `Sub Total: #subtotal\n${orderData.discount && parseFloat(orderData.discount) > 0 ? 'Discount: #discount\n' : ''}#charges\nTOTAL: #total`,
            alignment: 'TextAlign.right',
            fontSize: 20,
            isBold: true
        }));

        // Payment section
        template.sections.push(new PrintSection({
            template: `Payment Mode: #payMode\n${orderData.notes ? orderData.notes : ''}`,
            alignment: 'TextAlign.left',
            fontSize: 20,
            isBold: false
        }));

        // Footer
        template.sections.push(new PrintSection({
            template: `Thank You!\nVisit Again\n#storeLink`,
            alignment: 'TextAlign.center',
            fontSize: 20,
            isBold: false
        }));

        return template;
    }

    /**
     * Create a default template for KOT (Kitchen Order Ticket) (private method)
     * @param {Object} orderData - Order data for context-specific templates
     * @param {number} printerWidth - The printer width in characters
     * @returns {PrintTemplate} A new PrintTemplate instance
     * @private
     */
    static _createDefaultKOT(orderData = {}, printerWidth = 48) {
        const template = new PrintTemplate({
            type: 'kot',
            printerWidth: printerWidth
        });

        // Header section
        template.sections.push(new PrintSection({
            template: `KOT\n${orderData.tableId ? `TABLE ${orderData.tableId}` : ''}`,
            alignment: 'TextAlign.center',
            fontSize: 24,
            isBold: true
        }));

        // Order details section
        template.sections.push(new PrintSection({
            template: `KOT #: #billNo\nDate: #timestamp\n${orderData.tableId ? `Table: ${orderData.tableId}` : ''}`,
            alignment: 'TextAlign.left',
            fontSize: 20,
            isBold: false
        }));

        // Items section - use kotItemsListText for printer commands
        template.sections.push(new PrintSection({
            template: '#kotItemsList',
            alignment: 'TextAlign.left',
            fontSize: 20,
            isBold: false
        }));

        // Notes section if instructions exist
        if (orderData.instructions) {
            template.sections.push(new PrintSection({
                template: `NOTES:\n${orderData.instructions.trim()}`,
                alignment: 'TextAlign.left',
                fontSize: 20,
                isBold: false
            }));
        }

        return template;
    }
}

// Export the classes for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PrintSection, PrintTemplate };
} else {
    // For browser environments
    window.PrintSection = PrintSection;
    window.PrintTemplate = PrintTemplate;
}
