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
}

/**
 * PrintTemplate manages a collection of PrintSection objects and provides methods
 * for generating complete print output
 */
class PrintTemplate {
    /**
     * Create a new PrintTemplate
     * @param {Object} options - Options for template creation
     * @param {string} options.type - 'bill' or 'kot'
     * @param {number} options.printerWidth - The printer width in characters
     * @param {Array} options.sections - Array of section configurations
     * @param {Object} options.orderData - Order data for context-specific templates
     * @param {Object} options.seller - Seller data with business information
     * @param {Object} options.templateData - Custom template data (optional)
     */
    constructor(options = {}) {
        const {
            type = 'bill',
            printerWidth = 48,
            sections = [],
            orderData = {},
            seller = {},
            templateData = null
        } = options;

        this.type = type;
        this.printerWidth = printerWidth;
        this.encoder = new TextEncoder();
        this.variables = {};

        // Initialize sections based on provided template data, sections, or defaults
        if (templateData) {
            this.type = templateData.type || type;
            this.sections = (templateData.sections || []).map(section => new PrintSection(section));
        } else if (sections && sections.length > 0) {
            this.sections = sections.map(section => new PrintSection(section));
        } else {
            // Create default template based on type
            this.sections = this.type.toLowerCase() === 'kot'
                ? this._createDefaultKOTSections(orderData)
                : this._createDefaultBillSections(orderData);
        }

        // Process order data if provided
        if (orderData && Object.keys(orderData).length > 0) {
            this.processOrderData(orderData, { seller });
        }
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
     * @returns {Promise<Uint8Array>} Complete command bytes
     */
    async toPrinterCommands() {
        // Get HTML content from toHTML method
        const htmlContent = this.toHTML();

        // Create an iframe to render the HTML
        const iframe = document.createElement('iframe');
        iframe.style.visibility = 'hidden';
        iframe.style.position = 'absolute';
        iframe.style.width = '58mm'; // The HTML content is designed for 58mm
        iframe.style.height = 'auto'; // Let height adjust to content
        document.body.appendChild(iframe);

        // Write HTML content to iframe
        iframe.contentDocument.open();
        iframe.contentDocument.write(htmlContent);
        iframe.contentDocument.close();

        // Wait for iframe content to load
        await new Promise(resolve => {
            iframe.onload = resolve;
            setTimeout(resolve, 1000); // Fallback timeout
        });

        // Create canvas and get context
        const canvas = document.createElement('canvas');
        const receiptContent = iframe.contentDocument.body;

        // Increase the width to match standard 58mm thermal printer (384 dots)
        // Most 58mm thermal printers have a print width of 48mm (384 dots at 8 dots/mm)
        const width = 384;

        // Calculate height based on content and apply a scaling factor to make text larger
        const scaleFactor = 1.5; // Increase this for larger print
        const height = Math.ceil(receiptContent.scrollHeight * (width / receiptContent.offsetWidth) * scaleFactor);

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, width, height);

        // Scale up the content before rendering
        ctx.scale(scaleFactor, scaleFactor);

        // Use html2canvas to render the content to canvas
        // Check if html2canvas is available
        if (typeof html2canvas === 'undefined') {
            console.error('html2canvas library is required but not loaded');
            throw new Error('html2canvas library is required');
        }

        const canvasResult = await html2canvas(receiptContent, {
            canvas: canvas,
            width: width / scaleFactor, // Adjust for scaling
            height: height / scaleFactor, // Adjust for scaling
            scale: scaleFactor, // Apply scaling factor
            useCORS: true,
            backgroundColor: 'white'
        });

        // Get image data
        const imageDataUrl = canvasResult.toDataURL('image/png');

        // Preview image in new tab
        const previewWindow = window.open();
        previewWindow.document.write(`<img src="${imageDataUrl}" alt="Receipt Preview">`);

        // Clean up
        document.body.removeChild(iframe);

        // Generate ESC/POS commands for printing the image
        const commands = [];

        // Initialize printer
        commands.push(0x1B, 0x40); // ESC @ - Initialize printer

        // Convert the canvas to 1-bit monochrome bitmap data
        const imageData = ctx.getImageData(0, 0, width, height);
        const pixels = imageData.data;
        const widthBytes = Math.ceil(width / 8);
        const monochromeData = new Uint8Array(widthBytes * height);

        // Convert RGBA to 1-bit monochrome with improved contrast
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const pixelIndex = (y * width + x) * 4;
                // Calculate grayscale value with better weighting for human perception
                const grayscale =
                    0.299 * pixels[pixelIndex] +
                    0.587 * pixels[pixelIndex + 1] +
                    0.114 * pixels[pixelIndex + 2];

                // Use a lower threshold to make more pixels print (darker output)
                if (grayscale < 180) { // Higher threshold = more black pixels
                    const byteIndex = y * widthBytes + Math.floor(x / 8);
                    const bitIndex = 7 - (x % 8); // MSB first
                    monochromeData[byteIndex] |= (1 << bitIndex);
                }
            }
        }

        // GS v 0 - Print raster bit image
        commands.push(0x1D, 0x76, 0x30, 0);

        // Set image dimensions
        commands.push(widthBytes & 0xFF, (widthBytes >> 8) & 0xFF); // xL, xH - width bytes
        commands.push(height & 0xFF, (height >> 8) & 0xFF); // yL, yH - height pixels

        // Add the monochrome image data
        for (let i = 0; i < monochromeData.length; i++) {
            commands.push(monochromeData[i]);
        }

        // Add feed and cut at the end
        commands.push(0x1B, 0x64, 4); // Feed 4 lines
        commands.push(0x1D, 0x56, 0x41, 0); // Partial cut

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
     * Create default sections for bills
     * @param {Object} orderData - Order data for context-specific templates 
     * @returns {Array} Array of PrintSection instances
     * @private
     */
    _createDefaultBillSections(orderData = {}) {
        const sections = [];

        // Header section
        sections.push(new PrintSection({
            template: `${orderData.gstEnabled ? 'TAX INVOICE' : 'BILL/RECEIPT'}\n#businessName\n#address\nPhone: #phone\nWeb: #storeLink\nGST: #gstIN`,
            alignment: 'TextAlign.center',
            fontSize: 24,
            isBold: true
        }));

        // Order details section
        sections.push(new PrintSection({
            template: `Bill #: #billNo\nDate: #timestamp\n${orderData.custName || orderData.customer?.name ? `Customer: ${orderData.custName || orderData.customer?.name}` : ''}\n${orderData.tableId ? `Table: ${orderData.tableId}` : ''}\nOrder from: #orderSource`,
            alignment: 'TextAlign.left',
            fontSize: 20,
            isBold: false
        }));

        // Items section - use itemsListText for printer commands
        sections.push(new PrintSection({
            template: '#itemsList',
            alignment: 'TextAlign.left',
            fontSize: 20,
            isBold: false
        }));

        // Totals section
        sections.push(new PrintSection({
            template: `Sub Total: #subtotal\n${orderData.discount && parseFloat(orderData.discount) > 0 ? 'Discount: #discount\n' : ''}#charges\nTOTAL: #total`,
            alignment: 'TextAlign.right',
            fontSize: 20,
            isBold: true
        }));

        // Payment section
        sections.push(new PrintSection({
            template: `Payment Mode: #payMode\n${orderData.notes ? orderData.notes : ''}`,
            alignment: 'TextAlign.left',
            fontSize: 20,
            isBold: false
        }));

        // Footer
        sections.push(new PrintSection({
            template: `Thank You!\nVisit Again\n#storeLink`,
            alignment: 'TextAlign.center',
            fontSize: 20,
            isBold: false
        }));

        return sections;
    }

    /**
     * Create default sections for KOT (Kitchen Order Ticket)
     * @param {Object} orderData - Order data for context-specific templates
     * @returns {Array} Array of PrintSection instances
     * @private
     */
    _createDefaultKOTSections(orderData = {}) {
        const sections = [];

        // Header section
        sections.push(new PrintSection({
            template: `KOT\n${orderData.tableId ? `TABLE ${orderData.tableId}` : ''}`,
            alignment: 'TextAlign.center',
            fontSize: 24,
            isBold: true
        }));

        // Order details section
        sections.push(new PrintSection({
            template: `KOT #: #billNo\nDate: #timestamp\n${orderData.tableId ? `Table: ${orderData.tableId}` : ''}`,
            alignment: 'TextAlign.left',
            fontSize: 20,
            isBold: false
        }));

        // Items section - use kotItemsListText for printer commands
        sections.push(new PrintSection({
            template: '#kotItemsList',
            alignment: 'TextAlign.left',
            fontSize: 20,
            isBold: false
        }));

        // Notes section if instructions exist
        if (orderData.instructions) {
            sections.push(new PrintSection({
                template: `NOTES:\n${orderData.instructions.trim()}`,
                alignment: 'TextAlign.left',
                fontSize: 20,
                isBold: false
            }));
        }

        return sections;
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
