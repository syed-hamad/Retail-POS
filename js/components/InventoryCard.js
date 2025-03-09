// Inventory Card Component
function InventoryCard({ item, onEdit, onDelete }) {
    return (
        <div className="card p-4">
            <div className="flex items-start gap-4">
                {/* Item Details */}
                <div className="flex-1">
                    <div className="flex items-center justify-between">
                        <h3 className="font-medium text-lg">{item.name}</h3>
                        <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded-full text-xs ${item.quantity > item.minQuantity ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
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
                {/* Action Buttons */}
                <div className="flex flex-col gap-2">
                    <button
                        className="p-2 hover:bg-gray-100 rounded-full"
                        onClick={() => onEdit && onEdit(item)}
                    >
                        <i className="ph ph-plus-circle text-gray-600" />
                    </button>
                    <button
                        className="p-2 hover:bg-gray-100 rounded-full"
                        onClick={() => onEdit && onEdit(item)}
                    >
                        <i className="ph ph-pencil text-gray-600" />
                    </button>
                    <button
                        className="p-2 hover:bg-gray-100 rounded-full"
                        onClick={() => onDelete && onDelete(item.id)}
                    >
                        <i className="ph ph-trash text-gray-600" />
                    </button>
                </div>
            </div>
        </div>
    );
} 