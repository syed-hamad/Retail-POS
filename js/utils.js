// Utility function to calculate time duration
function getTimeDuration(date) {
    if (!date) return null;

    const now = new Date();
    const orderDate = date.toDate ? date.toDate() : new Date(date);
    const diffMs = now - orderDate;

    // Calculate minutes for color-coding
    const minutes = Math.floor(diffMs / (1000 * 60));

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
    if (!date) return '';

    const dateObj = date.toDate ? date.toDate() : new Date(date);

    if (format === 'short') {
        return dateObj.toLocaleDateString();
    } else if (format === 'long') {
        return dateObj.toLocaleString('en-IN', {
            weekday: 'long',
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    } else if (format === 'time') {
        return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    return dateObj.toLocaleString();
} 