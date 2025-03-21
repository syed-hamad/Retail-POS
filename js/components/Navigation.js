// Sidebar Navigation Component
function SidebarNav({ tabs, activeTab, setActiveTab }) {
    return (
        <div className="hidden md:flex flex-col w-64 border-r h-full fixed left-0 top-0 pt-16" style={{ backgroundColor: "#fff8f8" }}>
            <div className="px-3 py-8">
                <div className="flex items-center justify-center mb-8">
                    <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center">
                        <i className="ph ph-storefront text-red-500 text-2xl"></i>
                    </div>
                    <div className="ml-3">
                        <h2 className="text-xl font-bold text-gray-800">Liquid POS</h2>
                        <p className="text-sm text-gray-500">Restaurant Management</p>
                    </div>
                </div>
                <div className="flex flex-col space-y-2">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center space-x-3 p-3 rounded-xl transition-colors ${activeTab === tab.id
                                ? 'bg-red-500 text-white shadow-sm'
                                : 'hover:bg-pink-50 text-gray-600'
                                }`}
                        >
                            <i className={`ph ph-${tab.icon} text-xl`} />
                            <span className="font-medium">{tab.label}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

// Bottom Navigation Component
function BottomNav({ tabs, activeTab, setActiveTab }) {
    return (
        <nav className="md:hidden fixed bottom-0 w-full bg-white border-t shadow-lg" style={{ backgroundColor: "#fff8f8" }}>
            <div className="grid grid-cols-5 h-16">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex flex-col items-center justify-center transition-colors ${activeTab === tab.id 
                            ? 'text-red-500' 
                            : 'text-gray-600'
                        }`}
                    >
                        <div className={`w-10 h-10 flex items-center justify-center rounded-full ${activeTab === tab.id ? 'bg-red-50' : ''}`}>
                            <i className={`ph ph-${tab.icon} text-xl`} />
                        </div>
                        <span className="text-xs mt-0.5 font-medium">{tab.label}</span>
                    </button>
                ))}
            </div>
        </nav>
    );
} 