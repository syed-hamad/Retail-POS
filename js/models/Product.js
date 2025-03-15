// Product model for product data
class Product {
    constructor(data = {}) {
        this.id = data.id || '';
        this.cat = data.cat || '';
        this.title = data.title || '';
        this.sellerId = data.sellerId || '';
        this.sellerBusinessName = data.sellerBusinessName || '';
        this.sellerAvatar = data.sellerAvatar || '';
        this.desc = data.desc || '';
        this.tag = data.tag || '';
        this.date = data.date ? new Date(data.date) : new Date();
        this.mrp = data.mrp || 0;
        this.price = data.price || 0;
        this.imgs = data.imgs && data.imgs.length > 0 ? data.imgs : [Product.DUMMY_THUMB];
        this.videos = data.videos && data.videos.length > 0 ? data.videos : [];
        this.colors = data.colors || [];
        this.sizes = data.sizes || [];
        this.recipe = data.recipe || [];
        this.allowCOD = data.allowCOD || false;
        this.active = data.active || false;
        this.veg = data.veg || false;
        this.stock = data.stock || 0;
        this.priceVariants = data.priceVariants || {};
        this.charges = data.charges || [];
        this.orderIndex = data.orderIndex || 0;
    }

    // Create a Product from JSON data
    static fromJson(json) {
        return new Product(json);
    }

    // Create a Product from Firestore document
    static fromDoc(doc, priceVariant = null) {
        if (!doc || !doc.exists) return null;

        const data = doc.data();
        let varPrice = null;

        if (priceVariant && data.priceVariants && data.priceVariants[priceVariant]) {
            varPrice = data.priceVariants[priceVariant];
        }

        return new Product({
            id: doc.id,
            cat: data.cat,
            title: data.title,
            sellerId: data.sellerId,
            sellerBusinessName: data.sellerBusinessName,
            sellerAvatar: data.sellerAvatar,
            desc: data.desc || '',
            tag: data.tag || '',
            date: data.date ? data.date.toDate ? data.date.toDate() : new Date(data.date) : new Date(),
            mrp: varPrice || data.mrp,
            price: varPrice || data.price,
            imgs: data.imgs || [],
            videos: data.videos || [],
            colors: data.colors || [],
            sizes: data.sizes || [],
            recipe: data.recipe || [],
            allowCOD: data.allowCOD || false,
            active: data.active || false,
            veg: data.veg || false,
            stock: data.stock || 0,
            priceVariants: data.priceVariants || {},
            charges: data.charges || [],
            orderIndex: data.orderIndex || 0
        });
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
            tag: this.tag,
            date: this.date,
            mrp: this.mrp,
            price: this.price,
            imgs: this.imgs,
            videos: this.videos,
            colors: this.colors,
            sizes: this.sizes,
            recipe: this.recipe,
            allowCOD: this.allowCOD,
            active: this.active,
            veg: this.veg,
            stock: this.stock,
            priceVariants: this.priceVariants,
            charges: this.charges,
            orderIndex: this.orderIndex
        };
    }

    // Check if product has a discount
    get hasDiscount() {
        return this.mrp != null && this.price != null && this.mrp > this.price;
    }

    // Calculate discount percentage
    get discount() {
        if (this.hasDiscount) {
            return Math.ceil(((this.mrp - this.price) * 100) / this.mrp);
        }
        return 0;
    }

    // Get URL-friendly title
    get titleUrl() {
        if (!this.title) return '';
        return this.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .substring(0, this.title.length > 100 ? 100 : this.title.length);
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
        this.date = data.date ? new Date(data.date) : new Date();
        this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
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
            date: this.date,
            updatedAt: this.updatedAt
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