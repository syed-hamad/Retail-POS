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

        // print byte size
        console.log("DATA SIZE",data.byteLength);

        const MAX_RETRIES = 3;
        const RETRY_DELAY_MS = 300; // Increased retry delay
        const INTER_CHUNK_DELAY_MS = 100; // New delay between chunks

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const CHUNK_SIZE = (this.characteristic?.service?.device?.gatt?.server?.maxGATTCharacteristicWriteSize)
                    ? Math.min(this.characteristic.service.device.gatt.server.maxGATTCharacteristicWriteSize, 200) // Cap at 200 even if printer reports higher
                    : 200;
                for (let i = 0; i < data.length; i += CHUNK_SIZE) {
                    const chunk = data.slice(i, i + CHUNK_SIZE);
                    if (this.characteristic.properties.writeWithoutResponse) {
                        await this.characteristic.writeValueWithoutResponse(chunk);
                    } else {
                        await this.characteristic.writeValue(chunk);
                    }
                    // Add a small delay between sending chunks
                    if (data.length > CHUNK_SIZE && i < data.length - CHUNK_SIZE) { // Only delay if there are more chunks
                        await new Promise(resolve => setTimeout(resolve, INTER_CHUNK_DELAY_MS));
                    }
                }
                return true; // Success
            } catch (error) {
                console.warn(`Attempt ${attempt} to send data failed:`, error.message);
                if (attempt === MAX_RETRIES) {
                    console.error('Error sending data to printer after multiple retries:', error);
                    throw error; // Rethrow error after max retries
                }
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
     * @param {string} orderId - The ID of the order to print
     */
    async printKOT(orderId) {
        try {
            // Fetch order data
            const orderData = await this.getOrderData(orderId);

            // Connect to printer if not already connected
            await this.ensurePrinterConnection();

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
            const orderData = await this.getOrderData(orderId);

            // Connect to printer if not already connected
            await this.ensurePrinterConnection();

            // Format the bill data - build ESC/POS commands
            const data = this.formatBillData(orderData);

            // Send to printer
            await this.sendData(data);
            return true;
        } catch (error) {
            console.error('Error printing bill:', error);
            throw error;
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
     * Format order data into ESC/POS commands for a KOT
     * @param {Object} order - The order data
     * @returns {Uint8Array} - Formatted printer commands
     */
    async formatKOTData(order) {
        // Use common formatter with basic options (no centered text)
        const {
            commands,
            printerWidth,
            printerSizeName,
            addText,
            addLine,
            truncate,
            formatOrderNumber,
            formatDateTime,
            createTextSizes
        } = this.createPrinterFormatter();

        // Define text size constants based on printer width
        const TEXT_SIZE = createTextSizes();

        // Top margin
        commands.push(0x1B, 0x64, 1); // Feed 1 line for 2-inch

        // Table number (if exists)
        if (order.tableId) {
            commands.push(0x1B, 0x61, 0x01); // Center
            commands.push(0x1D, 0x21, TEXT_SIZE.TABLE);
            addText('TABLE ' + order.tableId);
            addText(''); // Extra space
        }

        // Order number
        commands.push(0x1B, 0x61, 0x01); // Center
        commands.push(0x1D, 0x21, TEXT_SIZE.ORDER);
        const orderNum = formatOrderNumber(order);
        addText('ORDER #' + orderNum);

        // Time in clear format
        commands.push(0x1D, 0x21, TEXT_SIZE.NORMAL); // Normal for all printers
        const time = formatDateTime(order.date, true);
        addText(time);

        // Distinctive separator
        addLine();

        // Items section
        if (order.items && order.items.length > 0) {
            order.items.forEach((item, index) => {
                // Quantity
                const qty = item.quantity || item.qnt || 1;
                commands.push(0x1B, 0x61, 0x00); // Left align
                commands.push(0x1D, 0x21, TEXT_SIZE.QUANTITY);
                addText(qty + 'x', false);

                // Item name
                commands.push(0x1D, 0x21, TEXT_SIZE.ITEM);
                // Adjust title width based on printer size
                const qtyLength = String(qty).length;
                const titleMaxWidth = printerWidth - (printerSizeName === '2inch' ? qtyLength + 2 : qtyLength * 2 + 2);
                const title = truncate(item.title || 'Unknown Item', Math.floor(titleMaxWidth));
                addText(' ' + title);

                // Special instructions for item
                if (item.instructions) {
                    commands.push(0x1D, 0x21, TEXT_SIZE.NORMAL); // Normal size for all printers
                    addText('  ' + item.instructions.trim());
                }

                // Add separator between items
                if (index < order.items.length - 1) {
                    commands.push(0x1D, 0x21, TEXT_SIZE.NORMAL); // Normal size
                    addText('- - - - - - - -');
                }

                // Space between items
                addText('');
            });
        }

        // General instructions if any
        if (order.instructions) {
            addLine();
            commands.push(0x1B, 0x61, 0x01); // Center
            commands.push(0x1D, 0x21, TEXT_SIZE.NOTES_HEADER);
            addText('NOTES');

            commands.push(0x1B, 0x61, 0x00); // Left align
            commands.push(0x1D, 0x21, TEXT_SIZE.NORMAL); // Normal size for all printers
            let notes = order.instructions.trim();
            while (notes.length > 0) {
                addText(truncate(notes, printerWidth));
                notes = notes.substring(printerWidth);
            }
        }

        // Bottom margin and cut
        commands.push(0x1B, 0x64, 3); // Feed 3 lines
        commands.push(0x1D, 0x56, 0x41); // Partial cut

        return new Uint8Array(commands);
    }

    /**
     * Format order data into ESC/POS commands for a bill
     * @param {Object} order - The order data
     * @returns {Uint8Array} - Formatted printer commands
     */
    formatBillData(order) {
        // Use common formatter with centered text option enabled
        const {
            commands,
            printerSizeName,
            addText,
            addLine,
            addCenteredText,
            formatOrderNumber,
            formatDateTime,
            createTextSizes
        } = this.createPrinterFormatter(true);

        // Define text size constants based on printer width
        const TEXT_SIZE = createTextSizes(true);

        // Header
        const seller = window.UserSession?.seller || {};

        // Business name
        commands.push(0x1D, 0x21, TEXT_SIZE.HEADER);
        addCenteredText(seller.businessName || 'Your Business');
        commands.push(0x1D, 0x21, TEXT_SIZE.NORMAL);

        // Business details
        commands.push(0x1B, 0x21, 0x00); // Normal for all printers
        if (seller.address) addCenteredText(seller.address);
        if (seller.phone) addCenteredText(`Ph: ${seller.phone}`);
        if (seller.gstEnabled && seller.gstIN) {
            addCenteredText('GSTIN:');
            addCenteredText(seller.gstIN);
        }
        commands.push(0x1B, 0x21, 0x00);

        addLine();

        // Bill details in normal text
        const orderNum = formatOrderNumber(order);
        addText(`Bill #: ${orderNum}`);

        const dateTime = formatDateTime(order.date);
        addText(`Date: ${dateTime.date}`);
        addText(`Time: ${dateTime.time}`);

        if (order.customer?.name) {
            addText(`Cust: ${order.customer.name}`);
        }

        addLine();

        // Items header
        commands.push(0x1D, 0x21, TEXT_SIZE.HEADER);
        addCenteredText('ITEMS');
        commands.push(0x1D, 0x21, TEXT_SIZE.NORMAL);

        // Calculate totals
        let subTotal = 0;
        let totalGST = 0;
        let totalCharges = 0;
        let totalDiscount = 0;

        // Items list with running total calculation
        if (order.items && order.items.length > 0) {
            commands.push(0x1B, 0x21, 0x00); // Normal size
            order.items.forEach(item => {
                const qty = item.quantity || item.qnt || 1;
                const price = parseFloat(item.price || 0);
                const amount = qty * price;
                subTotal += amount;

                addText(item.title || 'Unknown Item');
                addText(`${qty} x ${price.toFixed(2)} = ${amount.toFixed(2)}`);
            });
        }

        addLine();

        // Totals section with clear formatting
        // Normal size for all printers
        commands.push(0x1D, 0x21, TEXT_SIZE.NORMAL);
        addText(`Sub Total: ${subTotal.toFixed(2)}`);

        // GST calculations if enabled
        if (seller.gstEnabled) {
            const gst = subTotal * 0.18;
            totalGST = gst;
            addText(`CGST (9%): ${(gst / 2).toFixed(2)}`);
            addText(`SGST (9%): ${(gst / 2).toFixed(2)}`);
        }

        // Additional charges
        if (order.charges && Array.isArray(order.charges)) {
            order.charges.forEach(charge => {
                if (charge.value) {
                    const chargeValue = parseFloat(charge.value);
                    totalCharges += chargeValue;
                    addText(`${charge.name}: ${chargeValue.toFixed(2)}`);
                }
            });
        }

        // Discount
        if (order.discount && parseFloat(order.discount) > 0) {
            totalDiscount = parseFloat(order.discount);
            addText(`Discount: -${totalDiscount.toFixed(2)}`);
        }

        addLine();

        // Calculate final total
        const grandTotal = subTotal + totalGST + totalCharges - totalDiscount;

        // Grand total
        commands.push(0x1D, 0x21, TEXT_SIZE.TOTAL);
        addCenteredText('TOTAL');
        addCenteredText(`Rs. ${grandTotal.toFixed(2)}`);
        commands.push(0x1D, 0x21, TEXT_SIZE.NORMAL);

        addLine();

        // Payment details - normal size for all printers
        commands.push(0x1D, 0x21, TEXT_SIZE.NORMAL);
        addText(`Payment: ${order.payMode || 'CASH'}`);

        // Footer
        addLine();
        commands.push(0x1D, 0x21, TEXT_SIZE.FOOTER);
        addCenteredText('Thank You!');
        addCenteredText('Visit Again');
        commands.push(0x1D, 0x21, TEXT_SIZE.NORMAL);

        if (seller.website) {
            addCenteredText(seller.website);
        }

        // Feed and Cut
        commands.push(0x1B, 0x64, 0x04); // Feed 4 lines
        commands.push(0x1D, 0x56, 0x00); // Full cut
        commands.push(0x1B, 0x45, 0x00); // Bold OFF

        return new Uint8Array(commands);
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