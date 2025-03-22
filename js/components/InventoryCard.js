// Inventory Card Component
function InventoryCard({ item, onEdit, onDelete }) {
    return (
        <div className="bg-gradient-to-br from-warm-bg to-white rounded-xl p-4 border border-gray-200 shadow-section hover:shadow-md transition-all">
            <div className="flex items-start gap-4">
                {/* Item Details */}
                <div className="flex-1">
                    <div className="flex items-center justify-between">
                        <h3 className="font-medium text-lg">{item.name}</h3>
                        <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded-full text-xs ${item.quantity > item.minQuantity ? 'bg-gradient-to-r from-green-100 to-green-50 text-green-800' : 'bg-gradient-to-r from-red-100 to-red-50 text-red-800'}`}>
                                {item.quantity > item.minQuantity ? 'In Stock' : 'Low Stock'}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                        <div className="text-sm">
                            <span className="text-gray-500">Quantity: </span>
                            <span className="font-medium">{item.quantity} {item.unit}</span>
                        </div>
                        <div className="text-sm">
                            <span className="text-gray-500">Min Quantity: </span>
                            <span className="font-medium">{item.minQuantity} {item.unit}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                        <div className="text-sm">
                            <span className="text-gray-500">Last Updated: </span>
                            <span className="font-medium">
                                {new Date(item.lastUpdated).toLocaleDateString()}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-3">
                <button 
                    className="px-2 py-1.5 text-sm bg-gradient-to-r hover:from-red-50 hover:to-white text-red-500 border border-gray-200 rounded-lg flex items-center gap-1.5"
                    onClick={() => onEdit && onEdit(item)}
                >
                    <i className="ph ph-plus-circle"></i>
                    <span>Add Stock</span>
                </button>
                <button 
                    className="px-2 py-1.5 text-sm bg-gradient-to-r hover:from-red-50 hover:to-white text-red-500 border border-gray-200 rounded-lg flex items-center gap-1.5"
                    onClick={() => onEdit && onEdit(item)}
                >
                    <i className="ph ph-pencil-simple-line"></i>
                    <span>Edit</span>
                </button>
                <button 
                    className="px-2 py-1.5 text-sm bg-gradient-to-r hover:from-red-50 hover:to-white text-red-500 border border-gray-200 rounded-lg flex items-center gap-1.5"
                    onClick={() => onDelete && onDelete(item.id)}
                >
                    <i className="ph ph-trash"></i>
                    <span>Delete</span>
                </button>
            </div>
        </div>
    );
} 