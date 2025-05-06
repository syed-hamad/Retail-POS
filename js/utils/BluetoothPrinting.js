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

        // Add printer width configuration after printerSizes is initialized
        this.printerWidth = this.getSavedPrinterWidth() || 48; // Default to 48 characters (standard 3-inch)

        // Try to restore the last successful connection info from localStorage
        this.lastConnectedDevice = this.getSavedPrinter();

        // Track attempts to auto-reconnect to prevent infinite loops
        this.reconnectAttempted = false;
    }

    /**
     * Set the printer width configuration
     * @param {string} size - The printer size ('2inch', '3inch', '4inch')
     */
    setPrinterSize(size) {
        if (this.printerSizes && this.printerSizes[size]) {
            this.printerWidth = this.printerSizes[size];
            this.savePrinterWidth(size);
        } else {
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
            // Add null check for size and this.printerSizes[size]
            return (size && this.printerSizes[size]) ? this.printerSizes[size] : this.printerSizes['3inch'];
        } catch (error) {
            console.error('Error retrieving saved printer width:', error);
            // Ensure safe fallback even if this.printerSizes is undefined
            return 48; // Default to 3-inch (48 characters)
        }
    }

    /**
     * Format text to fit the printer width
     * @param {string} text - The text to format
     * @param {Object} options - Formatting options
     * @returns {string} Formatted text
     * @private
     */
    formatText(text, options = {}) {
        const {
            align = 'left',  // left, center, right
            bold = false,
            doubleWidth = false,
            doubleHeight = false
        } = options;

        // Calculate effective width based on text modifiers
        let effectiveWidth = this.printerWidth;
        if (doubleWidth) effectiveWidth = Math.floor(effectiveWidth / 2);

        // Split text into words
        const words = text.split(' ');
        let lines = [];
        let currentLine = '';

        // Word wrap
        for (const word of words) {
            if (currentLine.length + word.length + 1 <= effectiveWidth) {
                currentLine += (currentLine ? ' ' : '') + word;
            } else {
                if (currentLine) lines.push(currentLine);
                currentLine = word;
            }
        }
        if (currentLine) lines.push(currentLine);

        // Apply alignment
        lines = lines.map(line => {
            switch (align) {
                case 'center':
                    const padding = Math.max(0, Math.floor((effectiveWidth - line.length) / 2));
                    return ' '.repeat(padding) + line;
                case 'right':
                    const rightPad = Math.max(0, effectiveWidth - line.length);
                    return ' '.repeat(rightPad) + line;
                default: // left
                    return line;
            }
        });

        return lines.join('\n');
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
                    // Try to reconnect to the last connected device by ID
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
                    console.log('Error reconnecting to saved printer, falling back to device selection:', reconnectError);

                    // Fallback to regular device selection if reconnection fails
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
                        // This will catch when a user cancels the device selection dialog
                        if (deviceSelectError.name === "NotFoundError") {
                            console.log('Device selection cancelled by user');
                            throw new Error('Device selection cancelled by user');
                        }
                        throw deviceSelectError;
                    }
                }
            } else if (action === 'select-new') {
                // Request device without strict filtering to allow discovering all devices
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
                    if (deviceSelectError.name === "NotFoundError") {
                        console.log('Device selection cancelled by user');
                        throw new Error('Device selection cancelled by user');
                    }
                    throw deviceSelectError;
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
            const orderRef = window.sdk.db.collection("Orders").doc(orderId);
            const orderDoc = await orderRef.get();
            const orderData = orderDoc.data();

            if (!orderData) {
                throw new Error("Order not found");
            }

            // Connect to printer if not already connected
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
            const orderRef = window.sdk.db.collection("Orders").doc(orderId);
            const orderDoc = await orderRef.get();
            const orderData = orderDoc.data();

            if (!orderData) {
                throw new Error("Order not found");
            }

            // Connect to printer if not already connected
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

        // Add feed before cutting
        commands.push(0x1B, 0x64, 0x02); // Feed 2 lines

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