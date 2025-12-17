'use strict';

/**
 * Philippine Holidays Module
 * Manages regular and non-working holidays for the Philippines
 */

const PhilippineHolidays = (function() {
    // Regular Holidays 2025 (Double Pay)
    const regularHolidays = [
        { date: '2025-01-01', name: 'New Year\'s Day', type: 'Regular Holiday' },
        { date: '2025-03-29', name: 'Maundy Thursday', type: 'Regular Holiday' },
        { date: '2025-03-30', name: 'Good Friday', type: 'Regular Holiday' },
        { date: '2025-04-09', name: 'Araw ng Kagitingan (Bataan Day)', type: 'Regular Holiday' },
        { date: '2025-05-01', name: 'Labor Day', type: 'Regular Holiday' },
        { date: '2025-06-12', name: 'Independence Day', type: 'Regular Holiday' },
        { date: '2025-08-25', name: 'National Heroes Day', type: 'Regular Holiday' },
        { date: '2025-11-30', name: 'Bonifacio Day', type: 'Regular Holiday' },
        { date: '2025-12-25', name: 'Christmas Day', type: 'Regular Holiday' },
        { date: '2025-12-30', name: 'Rizal Day', type: 'Regular Holiday' }
    ];

    // Non-Working Holidays 2025 (130% Pay)
    const nonWorkingHolidays = [
        { date: '2025-02-09', name: 'Chinese New Year', type: 'Non-Working Holiday' },
        { date: '2025-02-25', name: 'EDSA People Power Revolution', type: 'Non-Working Holiday' },
        { date: '2025-03-31', name: 'Black Saturday', type: 'Non-Working Holiday' },
        { date: '2025-08-21', name: 'Ninoy Aquino Day', type: 'Non-Working Holiday' },
        { date: '2025-11-01', name: 'All Saints\' Day', type: 'Non-Working Holiday' },
        { date: '2025-11-02', name: 'All Souls\' Day', type: 'Non-Working Holiday' },
        { date: '2025-12-08', name: 'Feast of the Immaculate Conception', type: 'Non-Working Holiday' },
        { date: '2025-12-24', name: 'Christmas Eve', type: 'Non-Working Holiday' },
        { date: '2025-12-26', name: 'Day after Christmas', type: 'Non-Working Holiday' },
        { date: '2025-12-31', name: 'New Year\'s Eve', type: 'Non-Working Holiday' }
    ];

    /**
     * Checks if a given date is a regular holiday
     * @param {string} dateString - Date in YYYY-MM-DD format
     * @returns {boolean|object} False if not a holiday, holiday object if it is
     */
    function isRegularHoliday(dateString) {
        const holiday = regularHolidays.find(h => h.date === dateString);
        return holiday || false;
    }

    /**
     * Checks if a given date is a non-working holiday
     * @param {string} dateString - Date in YYYY-MM-DD format
     * @returns {boolean|object} False if not a holiday, holiday object if it is
     */
    function isNonWorkingHoliday(dateString) {
        const holiday = nonWorkingHolidays.find(h => h.date === dateString);
        return holiday || false;
    }

    /**
     * Checks if a given date is a Sunday
     * @param {string} dateString - Date in YYYY-MM-DD format
     * @returns {boolean} True if Sunday, false otherwise
     */
    function isSunday(dateString) {
        const date = new Date(dateString + 'T00:00:00');
        return date.getDay() === 0;
    }

    /**
     * Gets the day type for a given date
     * @param {string} dateString - Date in YYYY-MM-DD format
     * @returns {string} Day type identifier
     */
    function getDayType(dateString) {
        const sunday = isSunday(dateString);
        const regularHol = isRegularHoliday(dateString);
        const nonWorkingHol = isNonWorkingHoliday(dateString);

        if (sunday && regularHol) {
            return 'sunday-regular-holiday';
        } else if (sunday && nonWorkingHol) {
            return 'sunday-special-holiday';
        } else if (regularHol) {
            return 'regular-holiday';
        } else if (nonWorkingHol) {
            return 'non-working-holiday';
        } else if (sunday) {
            return 'sunday';
        } else {
            return 'regular';
        }
    }

    /**
     * Gets all regular holidays
     * @returns {Array} Array of regular holiday objects
     */
    function getRegularHolidays() {
        return [...regularHolidays];
    }

    /**
     * Gets all non-working holidays
     * @returns {Array} Array of non-working holiday objects
     */
    function getNonWorkingHolidays() {
        return [...nonWorkingHolidays];
    }

    /**
     * Adds a custom holiday
     * @param {string} date - Date in YYYY-MM-DD format
     * @param {string} name - Holiday name
     * @param {string} type - 'regular' or 'non-working'
     */
    function addCustomHoliday(date, name, type) {
        const holiday = { date, name, type: type === 'regular' ? 'Regular Holiday' : 'Non-Working Holiday' };
        
        if (type === 'regular') {
            // Check if already exists
            if (!regularHolidays.find(h => h.date === date)) {
                regularHolidays.push(holiday);
                regularHolidays.sort((a, b) => new Date(a.date) - new Date(b.date));
            }
        } else {
            if (!nonWorkingHolidays.find(h => h.date === date)) {
                nonWorkingHolidays.push(holiday);
                nonWorkingHolidays.sort((a, b) => new Date(a.date) - new Date(b.date));
            }
        }
    }

    // Public API
    return {
        isRegularHoliday,
        isNonWorkingHoliday,
        isSunday,
        getDayType,
        getRegularHolidays,
        getNonWorkingHolidays,
        addCustomHoliday
    };
})();

