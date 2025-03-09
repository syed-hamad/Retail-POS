// Sidebar Navigation Component
function SidebarNav({ tabs, activeTab, setActiveTab }) {
    return (
        <div className="hidden md:flex flex-col w-64 bg-white border-r h-full fixed left-0 top-0 pt-16">
            <div className="flex flex-col p-4 space-y-2">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center space-x-3 p-3 rounded-lg transition-colors ${activeTab === tab.id
                            ? 'bg-primary/10 text-primary'
                            : 'hover:bg-gray-100 text-gray-600'
                            }`}
                    >
                        <i className={`ph ph-${tab.icon} text-xl`} />
                        <span className="font-medium">{tab.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

// Bottom Navigation Component
function BottomNav({ tabs, activeTab, setActiveTab }) {
    return (
        <nav className="md:hidden fixed bottom-0 w-full bg-white border-t">
            <div className="grid grid-cols-5 h-16">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex flex-col items-center justify-center ${activeTab === tab.id ? 'text-primary' : 'text-gray-600'
                            }`}
                    >
                        <i className={`ph ph-${tab.icon} text-xl`} />
                        <span className="text-xs mt-1">{tab.label}</span>
                    </button>
                ))}
            </div>
        </nav>
    );
} 