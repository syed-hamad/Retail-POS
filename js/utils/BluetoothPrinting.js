// BluetoothPrinting.js - Service for handling Bluetooth thermal printer connections
// This service uses Web Bluetooth API which is supported in Chrome and Edge, but not Safari or Firefox

/**
 * BluetoothPrinting provides methods to connect to and print to Bluetooth thermal printers
 * using Web Bluetooth API
 */
class BluetoothPrinting {
    constructor() {
        this.printer = null;
        this.connected = false;
        this.device = null;
        this.characteristic = null;
        this.encoder = new TextEncoder();
    }

    /**
     * Check if Web Bluetooth is supported by the browser
     */
    isSupported() {
        return !!navigator.bluetooth;
    }

    /**
     * Connect to a Bluetooth printer device
     * Must be called from a user gesture (like a button click)
     */
    async connect() {
        if (!this.isSupported()) {
            throw new Error('Web Bluetooth is not supported in this browser. Please use Chrome or Edge.');
        }

        try {
            // Request device without strict filtering to allow discovering all devices
            // This will let the user pick from all available Bluetooth devices
            try {
                this.device = await navigator.bluetooth.requestDevice({
                    // Instead of filters, use acceptAllDevices to show all available devices
                    acceptAllDevices: true,
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
            } catch (deviceSelectError) {
                // This will catch when a user cancels the device selection dialog
                // navigator.bluetooth.requestDevice() throws a NotFoundError when the selection is cancelled
                if (deviceSelectError.name === "NotFoundError") {
                    console.log('Device selection cancelled by user');
                    // Re-throw with a clearer message indicating user cancellation
                    throw new Error('Device selection cancelled by user');
                }
                throw deviceSelectError;
            }

            console.log('Device selected:', this.device.name || 'Unknown device');

            // Connect to GATT server
            try {
                const server = await this.device.gatt.connect();
                console.log('Connected to GATT server');

                // Get all available services
                const services = await server.getPrimaryServices();
                console.log('Available services:', services.map(s => s.uuid));

                if (services.length === 0) {
                    throw new Error('No services found on the device');
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
                return true;
            } catch (gattError) {
                // Handle the "Unsupported device" error
                if (gattError.name === "NetworkError" && gattError.message.includes("Unsupported device")) {
                    console.error("Network Error: Unsupported device");
                    throw new Error("This device is not supported as a printer. Please select a compatible Bluetooth printer.");
                }
                throw gattError;
            }
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

        try {
            // Chunk the data if needed (some Bluetooth implementations have max packet sizes)
            const CHUNK_SIZE = 512;
            for (let i = 0; i < data.length; i += CHUNK_SIZE) {
                const chunk = data.slice(i, i + CHUNK_SIZE);
                // Use writeWithoutResponse if available, otherwise use write
                if (this.characteristic.properties.writeWithoutResponse) {
                    await this.characteristic.writeValueWithoutResponse(chunk);
                } else {
                    await this.characteristic.writeValue(chunk);
                }
            }
            return true;
        } catch (error) {
            console.error('Error sending data to printer:', error);
            throw error;
        }
    }

    /**
     * Print a KOT (Kitchen Order Ticket) for a specific order
     * @param {string} orderId - The ID of the order to print
     */
    async printKOT(orderId) {
        try {
            // Fetch order data
            const orderRef = window.sdk.collection("Orders").doc(orderId);
            const orderDoc = await orderRef.get();
            const orderData = orderDoc.data();

            if (!orderData) {
                throw new Error("Order not found");
            }

            // Connect to printer if not already connected
            if (!this.connected) {
                try {
                    await this.connect();
                } catch (connectError) {
                    // Handle user cancellation with a specific error
                    if (connectError.message.includes("Device selection cancelled")) {
                        throw new Error("Printing cancelled: No printer selected");
                    }
                    // Handle unsupported device error
                    if (connectError.name === "NetworkError" && connectError.message.includes("Unsupported device") ||
                        connectError.message.includes("not supported as a printer")) {
                        throw new Error("This device cannot be used for printing. Please select a compatible Bluetooth printer.");
                    }
                    throw connectError;
                }
            }

            // Format the KOT data - build ESC/POS commands
            const data = await this.formatKOTData(orderData);

            // Send to printer
            await this.sendData(data);
            return true;
        } catch (error) {
            console.error('Error printing KOT:', error);
            throw error;
        }
    }

    /**
     * Print a bill receipt for a specific order
     * @param {string} orderId - The ID of the order to print
     */
    async printBill(orderId) {
        try {
            // Fetch order data
            const orderRef = window.sdk.collection("Orders").doc(orderId);
            const orderDoc = await orderRef.get();
            const orderData = orderDoc.data();

            if (!orderData) {
                throw new Error("Order not found");
            }

            // Connect to printer if not already connected
            if (!this.connected) {
                try {
                    await this.connect();
                } catch (connectError) {
                    // Handle user cancellation with a specific error
                    if (connectError.message.includes("Device selection cancelled")) {
                        throw new Error("Printing cancelled: No printer selected");
                    }
                    // Handle unsupported device error
                    if (connectError.name === "NetworkError" && connectError.message.includes("Unsupported device") ||
                        connectError.message.includes("not supported as a printer")) {
                        throw new Error("This device cannot be used for printing. Please select a compatible Bluetooth printer.");
                    }
                    throw connectError;
                }
            }

            // Format the bill data - build ESC/POS commands
            const data = await this.formatBillData(orderData);

            // Send to printer
            await this.sendData(data);
            return true;
        } catch (error) {
            console.error('Error printing bill:', error);
            throw error;
        }
    }

    /**
     * Format order data into ESC/POS commands for a KOT
     * @param {Object} order - The order data
     * @returns {Uint8Array} - Formatted printer commands
     */
    async formatKOTData(order) {
        // Simple ESC/POS command builder
        // This is a minimal implementation - for production use a full ESC/POS library
        const commands = [];

        // Helper to add text commands
        const addText = (text) => {
            commands.push(...this.encoder.encode(text + '\n'));
        };

        // Helper to add center-aligned text
        const addCenteredText = (text) => {
            // ESC/POS center alignment command
            commands.push(0x1B, 0x61, 0x01);
            addText(text);
            // ESC/POS left alignment command (reset)
            commands.push(0x1B, 0x61, 0x00);
        };

        // Helper to add emphasized text
        const addEmphasized = (text) => {
            // ESC/POS emphasize command
            commands.push(0x1B, 0x45, 0x01);
            addText(text);
            // ESC/POS emphasize off command
            commands.push(0x1B, 0x45, 0x00);
        };

        // Helper to add double height text
        const addDoubleHeight = (text) => {
            // ESC/POS double height command
            commands.push(0x1B, 0x21, 0x10);
            addText(text);
            // ESC/POS normal size command
            commands.push(0x1B, 0x21, 0x00);
        };

        // Add a horizontal line
        const addLine = () => {
            addText('--------------------------------');
        };

        // Initialize printer
        commands.push(0x1B, 0x40); // ESC @

        // Format the KOT header
        addCenteredText('KITCHEN ORDER TICKET');
        addCenteredText(window.UserSession?.seller?.businessName || 'Liquid POS');
        addLine();

        // Order details
        addEmphasized(`ORDER #: ${order.billNo || order.id?.substring(0, 6) || 'N/A'}`);
        addText(`Table: ${order.tableId || 'N/A'}`);
        addText(`Time: ${new Date().toLocaleString()}`);
        if (order.sourceName) {
            addText(`Source: ${order.sourceName}`);
        }

        addLine();
        addEmphasized('ITEMS:');

        // Item details
        if (order.items && order.items.length > 0) {
            order.items.forEach((item, index) => {
                const quantity = item.quantity || item.qnt || 1;
                const title = item.title || `Item ${index + 1}`;
                addText(`${quantity}x ${title}`);

                // Add special instructions if any
                if (item.instructions) {
                    commands.push(0x1B, 0x45, 0x00); // Emphasize off
                    addText(`  Notes: ${item.instructions}`);
                }
            });
        } else {
            addText('No items');
        }

        // Add order instructions if any
        if (order.instructions) {
            addLine();
            addEmphasized('SPECIAL INSTRUCTIONS:');
            addText(order.instructions);
        }

        addLine();
        addCenteredText('*Thank You*');

        // Cut paper - full cut
        commands.push(0x1D, 0x56, 0x00);

        return new Uint8Array(commands);
    }

    /**
     * Format order data into ESC/POS commands for a bill
     * @param {Object} order - The order data
     * @returns {Uint8Array} - Formatted printer commands
     */
    async formatBillData(order) {
        // Simple ESC/POS command builder
        const commands = [];

        // Helper to add text commands
        const addText = (text) => {
            commands.push(...this.encoder.encode(text + '\n'));
        };

        // Helper to add center-aligned text
        const addCenteredText = (text) => {
            // ESC/POS center alignment command
            commands.push(0x1B, 0x61, 0x01);
            addText(text);
            // ESC/POS left alignment command (reset)
            commands.push(0x1B, 0x61, 0x00);
        };

        // Helper to add emphasized text
        const addEmphasized = (text) => {
            // ESC/POS emphasize command
            commands.push(0x1B, 0x45, 0x01);
            addText(text);
            // ESC/POS emphasize off command
            commands.push(0x1B, 0x45, 0x00);
        };

        // Helper to add right-aligned text
        const addRightAlignedText = (text) => {
            // ESC/POS right alignment command
            commands.push(0x1B, 0x61, 0x02);
            addText(text);
            // ESC/POS left alignment command (reset)
            commands.push(0x1B, 0x61, 0x00);
        };

        // Add a horizontal line
        const addLine = () => {
            addText('--------------------------------');
        };

        // Initialize printer
        commands.push(0x1B, 0x40); // ESC @

        // Business details
        const seller = window.UserSession?.seller || {};
        addCenteredText(seller.businessName || 'Liquid POS');
        if (seller.phone) addCenteredText(`Phone: ${seller.phone}`);
        if (seller.address) addCenteredText(`Address: ${seller.address}`);
        if (seller.storeLink) addCenteredText(`Web: ${seller.storeLink}`);
        if (seller.gstEnabled && seller.gstIN) addCenteredText(`GST: ${seller.gstIN}`);

        addLine();

        // Order details
        addText(`Bill No: #${order.billNo || order.id?.substring(0, 6) || 'N/A'}`);
        if (order.sourceName) addText(`Order from: ${order.sourceName}`);
        addText(`Date: ${new Date(order.date?.toDate ? order.date.toDate() : order.date || new Date()).toLocaleString()}`);

        if (order.custName) {
            addText(`Customer: ${order.custName}`);
            if (order.custPhone) addText(`Phone: ${order.custPhone}`);
        }

        addLine();
        addEmphasized('ITEMS:');

        // Item details
        let subTotal = 0;
        if (order.items && order.items.length > 0) {
            addText('Qty  Item                 Price  Amount');
            addLine();

            order.items.forEach((item, index) => {
                const quantity = item.quantity || item.qnt || 1;
                const title = item.title || `Item ${index + 1}`;
                const price = item.price || 0;
                const amount = quantity * price;
                subTotal += amount;

                // Format as columns
                const qtyStr = quantity.toString().padEnd(4);
                const titleStr = title.substring(0, 18).padEnd(20);
                const priceStr = price.toFixed(2).padStart(6);
                const amountStr = amount.toFixed(2).padStart(8);

                addText(`${qtyStr}${titleStr}${priceStr}  ${amountStr}`);
            });
        } else {
            addText('No items');
        }

        addLine();

        // Summary
        addRightAlignedText(`Sub Total: ₹${order.subTotal?.toFixed(2) || subTotal.toFixed(2)}`);

        if (order.discount && order.discount > 0) {
            addRightAlignedText(`Discount: - ₹${order.discount.toFixed(2)}`);
        }

        // Add charges if any
        if (order.charges && order.charges.length > 0) {
            order.charges.forEach(charge => {
                const chargeName = charge.name || 'Charge';
                const chargeValue = parseFloat(charge.value) || 0;
                addRightAlignedText(`${chargeName}: ₹${chargeValue.toFixed(2)}`);
            });
        }

        addLine();
        addEmphasized(`TOTAL: ₹${order.total?.toFixed(2) || (subTotal - (order.discount || 0)).toFixed(2)}`);

        // Payment info
        addText(`Payment mode: ${order.payMode || 'CASH'}`);

        addLine();
        addCenteredText('Thank you!');
        addCenteredText(`${new Date().toLocaleString()}`);

        // Cut paper - full cut
        commands.push(0x1D, 0x56, 0x00);

        return new Uint8Array(commands);
    }
}

// Create a singleton instance
window.BluetoothPrinting = new BluetoothPrinting(); 