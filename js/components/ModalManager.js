// Immediate self-executing function to ensure ModalManager is initialized properly
(function () {
    // ModalManager - A reusable component for handling modals with consistent behavior
    const ModalManager = {
        // Add a flag to indicate the manager is fully initialized
        isReady: true,

        // Create or show a side drawer modal
        createSideDrawerModal: function (options) {
            const {
                id,                       // Required: Unique ID for the modal
                title,                    // Required: Modal title
                content,                  // Required: HTML content for the body
                width = '600px',          // Optional: Width of the drawer on desktop (default: 600px)
                onClose = () => { },       // Optional: Function to call when modal closes
                onShown = () => { },       // Optional: Function to call when modal is shown
                actions = null,           // Optional: Footer actions HTML
                customClass = '',         // Optional: Additional classes for the modal content
                closeOnBackdropClick = true, // Optional: Whether clicking outside closes the modal
                zIndex = 50              // Optional: z-index for the modal (default: 50)
            } = options;

            // Create or find modal container
            let container = document.getElementById(id);
            const isExisting = !!container;

            if (!container) {
                container = document.createElement('div');
                container.id = id;
                document.body.appendChild(container);
            }

            // Clear any existing content
            container.innerHTML = '';

            // Build the modal HTML
            container.innerHTML = `
            <div class="fixed inset-0 overflow-hidden" style="z-index: ${zIndex}; background-color: rgba(17, 24, 39, 0.5);">
                <!-- Mobile: Full Screen, Desktop: Right Side Drawer -->
                <div class="fixed inset-y-0 right-0 flex max-w-full">
                    <div class="w-screen max-w-full sm:max-w-[${width}] transform transition-all ease-in-out duration-300 
                        bg-white h-full flex flex-col shadow-xl ${customClass}">
                        <!-- Header -->
                        <div class="sticky top-0 z-10 flex items-center justify-between p-4 border-b bg-white">
                            <h1 class="text-xl font-medium">${title}</h1>
                            <div class="flex items-center">
                                <button id="${id}-close-btn" class="p-2 rounded-full text-gray-500 hover:bg-gray-100">
                                    <i class="ph ph-x"></i>
                                </button>
                            </div>
                        </div>
                        
                        <!-- Content -->
                        <div class="flex-1 overflow-auto">
                            ${content}
                        </div>
                        
                        ${actions ? `
                        <!-- Footer -->
                        <div class="p-4 border-t border-gray-200">
                            ${actions}
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;

            // Function to close the modal
            const closeModal = () => {
                container.remove();
                onClose();
            };

            // Add close button event listener
            document.getElementById(`${id}-close-btn`).addEventListener('click', closeModal);

            // Add backdrop click handler if enabled
            if (closeOnBackdropClick) {
                const handleOutsideClick = (event) => {
                    // Find the innermost modal container
                    const modalContent = container.querySelector('.flex-col');

                    // Check if click is outside the modal content
                    if (modalContent && !modalContent.contains(event.target)) {
                        closeModal();
                        document.removeEventListener('mousedown', handleOutsideClick);
                    }
                };

                // Use mousedown instead of click for better UX
                document.addEventListener('mousedown', handleOutsideClick);
            }

            // Return control object
            const modalControl = {
                close: closeModal,
                container: container,
                setContent: (newContent) => {
                    const contentContainer = container.querySelector('.flex-1.overflow-auto');
                    if (contentContainer) {
                        contentContainer.innerHTML = newContent;
                    }
                },
                setTitle: (newTitle) => {
                    const titleEl = container.querySelector('h1.text-xl');
                    if (titleEl) {
                        titleEl.textContent = newTitle;
                    }
                },
                setActions: (newActions) => {
                    let footerEl = container.querySelector('.border-t.border-gray-200');
                    if (footerEl) {
                        footerEl.innerHTML = newActions;
                    } else if (newActions) {
                        // Create footer if it doesn't exist
                        const modalContent = container.querySelector('.flex-col');
                        const footer = document.createElement('div');
                        footer.className = 'p-4 border-t border-gray-200';
                        footer.innerHTML = newActions;
                        modalContent.appendChild(footer);
                    }
                }
            };

            // Call the onShown callback with the control object
            setTimeout(() => onShown(modalControl), 100);

            return modalControl;
        },

        // Create or show a center modal (for small forms, alerts, etc.)
        createCenterModal: function (options) {
            const {
                id,                       // Required: Unique ID for the modal
                title,                    // Required: Modal title
                content,                  // Required: HTML content for the body
                size = 'md',              // Optional: 'sm', 'md', 'lg', 'xl' or custom width
                onClose = () => { },       // Optional: Function to call when modal closes
                onShown = () => { },       // Optional: Function to call when modal is shown
                actions = null,           // Optional: Footer actions HTML
                customClass = '',         // Optional: Additional classes for the modal content
                closeOnBackdropClick = true, // Optional: Whether clicking outside closes the modal
                zIndex = 50              // Optional: z-index for the modal (default: 50)
            } = options;

            // Map size to width class
            const sizeMap = {
                sm: 'max-w-sm',
                md: 'max-w-md',
                lg: 'max-w-lg',
                xl: 'max-w-xl'
            };

            const widthClass = sizeMap[size] || size;

            // Create or find modal container
            let container = document.getElementById(id);
            const isExisting = !!container;

            if (!container) {
                container = document.createElement('div');
                container.id = id;
                document.body.appendChild(container);
            }

            // Clear any existing content
            container.innerHTML = '';

            // Build the modal HTML
            container.innerHTML = `
            <div class="fixed inset-0 overflow-hidden" style="z-index: ${zIndex}; background-color: rgba(17, 24, 39, 0.5);">
                <div class="fixed inset-0 overflow-auto bg-gray-900 bg-opacity-50 flex items-center justify-center p-4">
                    <div class="bg-white w-full ${widthClass} rounded-lg shadow-xl ${customClass} flex flex-col max-h-[90vh]">
                        <!-- Header -->
                        <div class="sticky top-0 z-10 flex items-center justify-between p-4 border-b bg-white rounded-t-lg">
                            <h1 class="text-xl font-medium">${title}</h1>
                            <button id="${id}-close-btn" class="p-2 rounded-full text-gray-500 hover:bg-gray-100">
                                <i class="ph ph-x"></i>
                            </button>
                        </div>
                        
                        <!-- Content -->
                        <div class="flex-1 overflow-auto p-4">
                            ${content}
                        </div>
                        
                        ${actions ? `
                        <!-- Footer -->
                        <div class="p-4 border-t border-gray-200 rounded-b-lg">
                            ${actions}
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;

            // Function to close the modal
            const closeModal = () => {
                container.remove();
                onClose();
            };

            // Add close button event listener
            document.getElementById(`${id}-close-btn`).addEventListener('click', closeModal);

            // Add backdrop click handler if enabled
            if (closeOnBackdropClick) {
                const handleOutsideClick = (event) => {
                    // Find the innermost modal container
                    const modalContent = container.querySelector('.rounded-lg');

                    // Check if click is outside the modal content
                    if (modalContent && !modalContent.contains(event.target)) {
                        closeModal();
                        document.removeEventListener('mousedown', handleOutsideClick);
                    }
                };

                // Use mousedown instead of click for better UX
                document.addEventListener('mousedown', handleOutsideClick);
            }

            // Return control object
            const modalControl = {
                close: closeModal,
                container: container,
                setContent: (newContent) => {
                    const contentContainer = container.querySelector('.flex-1.overflow-auto');
                    if (contentContainer) {
                        contentContainer.innerHTML = newContent;
                    }
                },
                setTitle: (newTitle) => {
                    const titleEl = container.querySelector('h1.text-xl');
                    if (titleEl) {
                        titleEl.textContent = newTitle;
                    }
                },
                setActions: (newActions) => {
                    let footerEl = container.querySelector('.border-t.border-gray-200');
                    if (footerEl) {
                        footerEl.innerHTML = newActions;
                    } else if (newActions) {
                        // Create footer if it doesn't exist
                        const modalContent = container.querySelector('.rounded-lg');
                        const footer = document.createElement('div');
                        footer.className = 'p-4 border-t border-gray-200 rounded-b-lg';
                        footer.innerHTML = newActions;
                        modalContent.appendChild(footer);
                    }
                }
            };

            // Call the onShown callback with the control object
            setTimeout(() => onShown(modalControl), 100);

            return modalControl;
        },

        // Simple toast notification
        showToast: function (message, options = {}) {
            const {
                type = "success",           // 'success' or 'error'
                duration = 3000,            // Duration in ms
                position = "bottom-right"   // Position: 'bottom-right', 'bottom-left', 'top-right', 'top-left', 'top-center', 'bottom-center'
            } = options;

            // Position classes
            const positionClasses = {
                "bottom-right": "fixed bottom-4 right-4",
                "bottom-left": "fixed bottom-4 left-4",
                "top-right": "fixed top-4 right-4",
                "top-left": "fixed top-4 left-4",
                "top-center": "fixed top-4 left-1/2 transform -translate-x-1/2",
                "bottom-center": "fixed bottom-4 left-1/2 transform -translate-x-1/2"
            };

            // Create toast container if it doesn't exist
            let toastContainer = document.getElementById('toast-container');
            if (!toastContainer) {
                toastContainer = document.createElement('div');
                toastContainer.id = 'toast-container';
                toastContainer.className = `z-70 ${positionClasses[position]}`;
                document.body.appendChild(toastContainer);
            }

            // Create toast element
            const toast = document.createElement('div');
            toast.className = `p-3 rounded-lg shadow-lg mb-2 flex items-center ${type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`;
            toast.innerHTML = `
            <i class="ph ${type === 'success' ? 'ph-check-circle' : 'ph-x-circle'} mr-2"></i>
            <span>${message}</span>
        `;

            // Add to container and set timeout to remove
            toastContainer.appendChild(toast);

            // Animate in
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(20px)';
            toast.style.transition = 'opacity 0.3s, transform 0.3s';

            setTimeout(() => {
                toast.style.opacity = '1';
                toast.style.transform = 'translateY(0)';
            }, 10);

            // Set timeout to remove
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(-20px)';

                setTimeout(() => {
                    toast.remove();
                    if (toastContainer.children.length === 0) {
                        toastContainer.remove();
                    }
                }, 300);
            }, duration);

            // Return the toast element for possible manual control
            return toast;
        },

        // Confirm dialog - returns a Promise
        confirm: function (options) {
            const {
                title = "Confirm",
                message = "Are you sure?",
                confirmText = "Confirm",
                cancelText = "Cancel",
                confirmButtonClass = "bg-red-500 hover:bg-red-600 text-white",
                cancelButtonClass = "bg-gray-200 hover:bg-gray-300 text-gray-800",
                zIndex = 60
            } = options;

            return new Promise((resolve) => {
                const modalId = 'confirm-dialog-' + Date.now();

                const modal = this.createCenterModal({
                    id: modalId,
                    title: title,
                    content: `<p class="text-gray-700">${message}</p>`,
                    size: 'sm',
                    zIndex: zIndex,
                    actions: `
                <div class="flex justify-end space-x-2">
                    <button id="${modalId}-cancel" class="px-4 py-2 rounded-md ${cancelButtonClass}">
                        ${cancelText}
                    </button>
                    <button id="${modalId}-confirm" class="px-4 py-2 rounded-md ${confirmButtonClass}">
                        ${confirmText}
                    </button>
                </div>
            `,
                    onShown: (control) => {
                        document.getElementById(`${modalId}-cancel`).addEventListener('click', () => {
                            control.close();
                            resolve(false);
                        });

                        document.getElementById(`${modalId}-confirm`).addEventListener('click', () => {
                            control.close();
                            resolve(true);
                        });
                    }
                });
            });
        }
    };

    // Make available globally
    window.ModalManager = ModalManager;

    // Dispatch an event when ModalManager is ready
    document.dispatchEvent(new CustomEvent('modalmanager:ready'));
    console.log("ModalManager initialized and ready for use");
})(); 