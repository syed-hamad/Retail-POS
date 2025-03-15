// Utility function to safely parse date
function parseDate(date) {
    if (!date) return null;

    try {
        // If it's a Firebase Timestamp
        if (date.toDate) {
            return date.toDate();
        }

        // If it's already a Date object
        if (date instanceof Date) {
            return isNaN(date.getTime()) ? null : date;
        }

        // If it's a timestamp number
        if (typeof date === 'number') {
            const d = new Date(date);
            return isNaN(d.getTime()) ? null : d;
        }

        // If it's an ISO string or other string format
        if (typeof date === 'string') {
            const d = new Date(date);
            return isNaN(d.getTime()) ? null : d;
        }

        return null;
    } catch (e) {
        console.error('Error parsing date:', e);
        return null;
    }
}

// Utility function to calculate time duration
function getTimeDuration(date) {
    const parsedDate = parseDate(date);
    if (!parsedDate) return null;

    const now = new Date();
    const diffMs = now - parsedDate;

    // If the difference is negative (future date) or invalid
    if (diffMs < 0 || isNaN(diffMs)) return null;

    // Calculate minutes for color-coding
    const minutes = Math.floor(diffMs / (1000 * 60));

    // For very recent times (less than 1 minute)
    if (minutes < 1) {
        const seconds = Math.floor(diffMs / 1000);
        return {
            display: seconds < 30 ? 'just now' : `${seconds} seconds`,
            minutes: 0
        };
    }

    // For display purposes, we'll show different formats based on duration
    const months = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30));
    if (months > 0) {
        return {
            display: `${months} ${months === 1 ? 'month' : 'months'}`,
            minutes: minutes
        };
    }

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (days > 0) {
        return {
            display: `${days} ${days === 1 ? 'day' : 'days'}`,
            minutes: minutes
        };
    }

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    if (hours > 0) {
        return {
            display: `${hours} ${hours === 1 ? 'hour' : 'hours'}`,
            minutes: minutes
        };
    }

    return {
        display: `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`,
        minutes: minutes
    };
}

// Utility function for logging
function pp(message) {
    console.log(message);
}

// Utility function to format currency
function formatCurrency(amount) {
    return `₹${Number(amount).toLocaleString('en-IN')}`;
}

// Utility function to format date
function formatDate(date, format = 'short') {
    const parsedDate = parseDate(date);
    if (!parsedDate) return '';

    try {
        switch (format) {
            case 'short':
                return parsedDate.toLocaleDateString('en-IN');
            case 'long':
                return parsedDate.toLocaleString('en-IN', {
                    weekday: 'long',
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                });
            case 'time':
                return parsedDate.toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                });
            case 'full':
                return parsedDate.toLocaleString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                });
            default:
                return parsedDate.toLocaleString('en-IN');
        }
    } catch (e) {
        console.error('Error formatting date:', e);
        return '';
    }
}

// Utility functions to match Flutter DateModifiers extension
function prettyTime(date) {
    const parsedDate = parseDate(date);
    if (!parsedDate) return '';

    const now = new Date();
    const diff = now - parsedDate;

    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) {
        return `${seconds} sec ago`;
    }

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
        return `${minutes} min ago`;
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return `${hours} hours ago`;
    }

    const days = Math.floor(hours / 24);
    if (days < 30) {
        return `${days} days ago`;
    }

    const months = Math.floor(days / 30);
    if (months < 12) {
        return `${months} months ago`;
    }

    const years = Math.floor(days / 365);
    return `${years} years ago`;
}

function prettyShortTime(date) {
    const parsedDate = parseDate(date);
    if (!parsedDate) return '';

    const now = new Date();
    const diff = now - parsedDate;

    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) {
        return `${seconds} sec`;
    }

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
        return `${minutes} min`;
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return `${hours} hrs`;
    }

    const days = Math.floor(hours / 24);
    if (days < 30) {
        return `${days} days`;
    }

    const months = Math.floor(days / 30);
    if (months < 12) {
        return `${months} months`;
    }

    const years = Math.floor(days / 365);
    return `${years} years`;
}

function tinyDate(date) {
    const parsedDate = parseDate(date);
    if (!parsedDate) return '';

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dateDay = new Date(parsedDate);
    dateDay.setHours(0, 0, 0, 0);

    if (dateDay.getTime() === today.getTime()) {
        return "Today";
    } else if (dateDay.getTime() === yesterday.getTime()) {
        return "Yesterday";
    } else if (dateDay.getTime() === tomorrow.getTime()) {
        return "Tomorrow";
    } else if (dateDay.getFullYear() === today.getFullYear()) {
        return parsedDate.toLocaleDateString('en-US', {
            weekday: 'long',
            day: '2-digit',
            month: 'long'
        });
    } else {
        return parsedDate.toLocaleDateString('en-US', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
    }
}

function tinyDateTime(date) {
    const parsedDate = parseDate(date);
    if (!parsedDate) return '';

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dateDay = new Date(parsedDate);
    dateDay.setHours(0, 0, 0, 0);

    const timeStr = parsedDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });

    if (dateDay.getTime() === today.getTime()) {
        return `Today, ${timeStr}`;
    } else if (dateDay.getTime() === yesterday.getTime()) {
        return `Yesterday, ${timeStr}`;
    } else if (dateDay.getTime() === tomorrow.getTime()) {
        return `Tomorrow, ${timeStr}`;
    } else if (dateDay.getFullYear() === today.getFullYear()) {
        return parsedDate.toLocaleDateString('en-US', {
            weekday: 'long',
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    } else {
        return parsedDate.toLocaleDateString('en-US', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    }
}

// Format duration as HH:MM
function formatDurationHM(durationMs) {
    if (!durationMs || isNaN(durationMs)) return '00:00';

    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// Format duration as HH:MM:SS
function formatDurationHMS(durationMs) {
    if (!durationMs || isNaN(durationMs)) return '00:00:00';

    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((durationMs % (1000 * 60)) / 1000);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Helper function for two-digit formatting
function toTwoDigits(n) {
    return n.toString().padStart(2, '0');
}

// Utility function to show toast notifications
function showToast(message, type = 'info') {
    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'fixed top-4 right-4 z-50 flex flex-col gap-2';
        document.body.appendChild(toastContainer);
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `px-4 py-2 rounded-lg shadow-lg text-white flex items-center ${type === 'error' ? 'bg-red-500' :
        type === 'success' ? 'bg-green-500' :
            'bg-blue-500'
        }`;

    // Add icon based on type
    const icon = document.createElement('i');
    icon.className = `ph ${type === 'error' ? 'ph-x-circle' :
        type === 'success' ? 'ph-check-circle' :
            'ph-info'
        } mr-2`;
    toast.appendChild(icon);

    // Add message
    const text = document.createElement('span');
    text.textContent = message;
    toast.appendChild(text);

    // Add to container
    toastContainer.appendChild(toast);

    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.add('opacity-0', 'transition-opacity', 'duration-300');
        setTimeout(() => {
            toastContainer.removeChild(toast);
            // Remove container if empty
            if (toastContainer.children.length === 0) {
                document.body.removeChild(toastContainer);
            }
        }, 300);
    }, 3000);
} 