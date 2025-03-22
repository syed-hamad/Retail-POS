// Product model for product data
class Product {
    constructor(data) {
        // Basic properties
        this.id = data.id || '';
        this.title = data.title || '';
        this.desc = data.desc || '';
        this.cat = data.cat || 'Uncategorized';
        this.imgs = data.imgs || [];
        this.price = data.price || 0;
        this.mrp = data.mrp || 0;
        this.active = data.active !== false; // default to true
        this.veg = data.veg !== undefined ? data.veg : true; // default to vegetarian

        // Seller info
        this.sellerId = data.sellerId || '';
        this.sellerBusinessName = data.sellerBusinessName || '';
        this.sellerAvatar = data.sellerAvatar || '';

        // Calculated properties
        this.hasDiscount = this.price < this.mrp;
        this.discountPercent = this.hasDiscount ? Math.round(((this.mrp - this.price) / this.mrp) * 100) : 0;

        // Additional properties
        this.barcode = data.barcode || '';
        this.sku = data.sku || '';
        this.stock = data.stock || 0;
        this.date = data.date ? new Date(data.date) : new Date();
    }

    // Create a Product from a Firestore document
    static fromDoc(doc, priceVariant = 'default') {
        if (!doc || !doc.exists) {
            console.warn('Attempted to create Product from non-existent document');
            return null;
        }

        try {
            const data = doc.data();
            if (!data) {
                console.warn('Document exists but has no data');
                return null;
            }

            data.id = doc.id;

            // Handle price variants
            if (data.priceVariants && data.priceVariants[priceVariant]) {
                data.price = data.priceVariants[priceVariant];
            }

            return new Product(data);
        } catch (error) {
            console.error('Error creating Product from document:', error);
            return null;
        }
    }

    // Convert to a simple object for storing in Firestore
    toFirestore() {
        return {
            title: this.title,
            desc: this.desc,
            cat: this.cat,
            imgs: this.imgs,
            price: this.price,
            mrp: this.mrp,
            discount: this.discountPercent,
            active: this.active,
            veg: this.veg,
            sellerId: this.sellerId,
            sellerBusinessName: this.sellerBusinessName,
            sellerAvatar: this.sellerAvatar,
            barcode: this.barcode,
            sku: this.sku,
            stock: this.stock,
            date: this.date
        };
    }

    // Create a Product from JSON data
    static fromJson(json) {
        return new Product(json);
    }

    // Convert Product to JSON
    toJson() {
        return {
            id: this.id,
            cat: this.cat,
            title: this.title,
            sellerId: this.sellerId,
            sellerBusinessName: this.sellerBusinessName,
            sellerAvatar: this.sellerAvatar,
            desc: this.desc,
            imgs: this.imgs,
            price: this.price,
            mrp: this.mrp,
            discount: this.discountPercent,
            active: this.active,
            veg: this.veg,
            stock: this.stock,
            date: this.date,
            barcode: this.barcode,
            sku: this.sku
        };
    }

    // Get URL-friendly title
    get titleUrl() {
        if (!this.title) return '';
        return this.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .substring(0, this.title.length > 100 ? 100 : this.title.length);
    }

    // Calculate discount percentage
    get discountPercentage() {
        if (this.hasDiscount) {
            return Math.ceil(((this.mrp - this.price) * 100) / this.mrp);
        }
        return 0;
    }

    // Get recipe items
    get recipeItems() {
        if (!this.recipe || this.recipe.length === 0) return [];
        return this.recipe.map(item => InventoryItem.fromJson(item));
    }

    // Calculate maximum production based on inventory
    getMaxProduction(allInventoryItems) {
        let maxProductionScale = 0;

        if (this.recipeItems.length > 0) {
            const recipeItemNames = this.recipeItems.map(r => r.name);
            const relevantItems = allInventoryItems.filter(i => recipeItemNames.includes(i.name));

            if (relevantItems.length > 0) {
                const productions = relevantItems.map(item => item.getMaxProduction(this));
                maxProductionScale = Math.min(...productions);
            }
        }

        return maxProductionScale;
    }
}

// Inventory Item model
class InventoryItem {
    constructor(data = {}) {
        this.id = data.id || '';
        this.name = data.name || '';
        this.quantity = data.quantity || 0;
        this.unit = data.unit || '';
        this.minQuantity = data.minQuantity || 0;
        this.date = data.date ? new Date(data.date) : new Date();
        this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
        this.lastUpdated = data.lastUpdated || data.updatedAt || new Date().toISOString();
    }

    static fromJson(json) {
        return new InventoryItem(json);
    }

    toJson() {
        return {
            id: this.id,
            name: this.name,
            quantity: this.quantity,
            unit: this.unit,
            minQuantity: this.minQuantity,
            date: this.date,
            updatedAt: this.updatedAt,
            lastUpdated: this.lastUpdated
        };
    }

    // Calculate max production for a product
    getMaxProduction(product) {
        const recipeItem = product.recipeItems.find(r => r.name === this.name);
        if (!recipeItem || recipeItem.quantity <= 0) return 0;

        return Math.floor(this.quantity / recipeItem.quantity);
    }
}

// Charge model for additional charges
class Charge {
    constructor(data = {}) {
        this.name = data.name || '';
        this.value = data.value || 0;
        this.type = data.type || 'percentage'; // 'percentage' or 'fixed'
    }

    static fromJson(json) {
        return new Charge(json);
    }

    toJson() {
        return {
            name: this.name,
            value: this.value,
            type: this.type
        };
    }

    // Calculate charge amount based on base price
    calculate(basePrice) {
        if (this.type === 'percentage') {
            return (basePrice * this.value) / 100;
        }
        return this.value;
    }
}

// Default placeholder image
Product.DUMMY_THUMB = "https://firebasestorage.googleapis.com/v0/b/frihbi-app.appspot.com/o/assets%2Fproduct-placeholder.png?alt=media&token=183bdac4-2f9b-4645-8147-7cfa921ba0e9";

// Make classes available globally
window.Product = Product;
window.InventoryItem = InventoryItem;
window.Charge = Charge; 