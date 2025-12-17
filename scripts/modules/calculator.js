'use strict';

/**
 * Payroll Calculator Module
 * Implements all payroll calculation formulas based on Philippine labor standards
 */

const PayrollCalculator = (function() {
    
    /**
     * Calculates Regular Overtime Pay
     * Formula: HRS x RATE/HR x 1.25
     * @param {number} hours - Overtime hours worked
     * @param {number} ratePerHour - Employee's hourly rate
     * @returns {number} Overtime pay amount
     */
    function calculateRegularOT(hours, ratePerHour) {
        return hours * ratePerHour * 1.25;
    }

    /**
     * Calculates Sunday/Rest Day Pay
     * Formula: HRS x RATE/HR x 1.3
     * @param {number} hours - Hours worked on Sunday/Rest Day
     * @param {number} ratePerHour - Employee's hourly rate
     * @returns {number} Sunday/Rest Day pay amount
     */
    function calculateSundayRestDay(hours, ratePerHour) {
        return hours * ratePerHour * 1.3;
    }

    /**
     * Calculates Sunday/Rest Day Overtime Pay
     * Formula: (HRS x RATE/HR x 1.3) x 1.3
     * @param {number} hours - Overtime hours worked on Sunday/Rest Day
     * @param {number} ratePerHour - Employee's hourly rate
     * @returns {number} Sunday/Rest Day overtime pay amount
     */
    function calculateSundayRestDayOT(hours, ratePerHour) {
        return (hours * ratePerHour * 1.3) * 1.3;
    }

    /**
     * Calculates Sunday + Special Holiday Pay
     * Formula: HRS x RATE/HR x 1.5
     * @param {number} hours - Hours worked on Sunday that falls on special holiday
     * @param {number} ratePerHour - Employee's hourly rate
     * @returns {number} Pay amount
     */
    function calculateSundaySpecialHoliday(hours, ratePerHour) {
        return hours * ratePerHour * 1.5;
    }

    /**
     * Calculates Sunday + Regular Holiday Pay
     * Formula: HRS x RATE/HR x 2.6
     * @param {number} hours - Hours worked on Sunday that falls on regular holiday
     * @param {number} ratePerHour - Employee's hourly rate
     * @returns {number} Pay amount
     */
    function calculateSundayRegularHoliday(hours, ratePerHour) {
        return hours * ratePerHour * 2.6;
    }

    /**
     * Calculates Non-Working Holiday Pay
     * Formula: HRS x RATE/HR x 1.3
     * @param {number} hours - Hours worked on non-working holiday
     * @param {number} ratePerHour - Employee's hourly rate
     * @returns {number} Non-working holiday pay amount
     */
    function calculateNonWorkingHoliday(hours, ratePerHour) {
        return hours * ratePerHour * 1.3;
    }

    /**
     * Calculates Non-Working Holiday Overtime Pay
     * Formula: (HRS x RATE/HR x 1.3) x 1.3
     * @param {number} hours - Overtime hours worked on non-working holiday
     * @param {number} ratePerHour - Employee's hourly rate
     * @returns {number} Non-working holiday overtime pay amount
     */
    function calculateNonWorkingHolidayOT(hours, ratePerHour) {
        return (hours * ratePerHour * 1.3) * 1.3;
    }

    /**
     * Calculates Regular Holiday Pay
     * Formula: HRS x RATE/HR x 2
     * @param {number} hours - Hours worked on regular holiday
     * @param {number} ratePerHour - Employee's hourly rate
     * @returns {number} Regular holiday pay amount
     */
    function calculateRegularHoliday(hours, ratePerHour) {
        return hours * ratePerHour * 2;
    }

    /**
     * Calculates Regular Holiday Overtime Pay
     * Formula: (HRS x RATE/HR x 2) x 1.3
     * @param {number} hours - Overtime hours worked on regular holiday
     * @param {number} ratePerHour - Employee's hourly rate
     * @returns {number} Regular holiday overtime pay amount
     */
    function calculateRegularHolidayOT(hours, ratePerHour) {
        return (hours * ratePerHour * 2) * 1.3;
    }

    /**
     * Calculates Regular Holiday on Rest Day/Sunday Pay
     * Formula: HRS x RATE/HR x 2.6
     * @param {number} hours - Hours worked on regular holiday that falls on Sunday/Rest Day
     * @param {number} ratePerHour - Employee's hourly rate
     * @returns {number} Pay amount
     */
    function calculateRegularHolidayRestDay(hours, ratePerHour) {
        return hours * ratePerHour * 2.6;
    }

    /**
     * Calculates Regular Holiday on Rest Day/Sunday Overtime Pay
     * Formula: (HRS x RATE/HR x 2.6) x 1.3
     * @param {number} hours - Overtime hours worked on regular holiday that falls on Sunday/Rest Day
     * @param {number} ratePerHour - Employee's hourly rate
     * @returns {number} Overtime pay amount
     */
    function calculateRegularHolidayRestDayOT(hours, ratePerHour) {
        return (hours * ratePerHour * 2.6) * 1.3;
    }

    /**
     * Calculates Night Differential Pay
     * Formula: HRS x RATE/HR x 0.1
     * @param {number} hours - Night differential hours (10PM-6AM)
     * @param {number} ratePerHour - Employee's hourly rate
     * @returns {number} Night differential pay amount
     */
    function calculateNightDiff(hours, ratePerHour) {
        return hours * ratePerHour * 0.1;
    }

    /**
     * Calculates Regular Day Pay
     * Formula: HRS x RATE/HR
     * @param {number} hours - Regular hours worked
     * @param {number} ratePerHour - Employee's hourly rate
     * @returns {number} Regular pay amount
     */
    function calculateRegularPay(hours, ratePerHour) {
        return hours * ratePerHour;
    }

    /**
     * Main calculation function that determines the appropriate formula based on day type
     * @param {object} params - Calculation parameters
     * @param {string} params.dayType - Type of day (regular, sunday, holiday, etc.)
     * @param {number} params.regularHours - Regular hours worked
     * @param {number} params.overtimeHours - Overtime hours worked
     * @param {number} params.nightDiffHours - Night differential hours
     * @param {number} params.ratePerHour - Employee's hourly rate
     * @returns {object} Breakdown of all pay components and total
     */
    function calculatePay(params) {
        const {
            dayType,
            regularHours = 0,
            overtimeHours = 0,
            nightDiffHours = 0,
            ratePerHour
        } = params;

        const breakdown = {
            regularPay: 0,
            overtimePay: 0,
            nightDiffPay: 0,
            description: '',
            details: []
        };

        // Calculate based on day type
        switch (dayType) {
            case 'regular':
                if (regularHours > 0) {
                    breakdown.regularPay = calculateRegularPay(regularHours, ratePerHour);
                    breakdown.details.push({
                        description: 'Regular Hours',
                        hours: regularHours,
                        rate: ratePerHour,
                        amount: breakdown.regularPay
                    });
                }
                if (overtimeHours > 0) {
                    breakdown.overtimePay = calculateRegularOT(overtimeHours, ratePerHour);
                    breakdown.details.push({
                        description: 'Regular Overtime (1.25x)',
                        hours: overtimeHours,
                        rate: ratePerHour * 1.25,
                        amount: breakdown.overtimePay
                    });
                }
                break;

            case 'sunday':
                if (regularHours > 0) {
                    breakdown.regularPay = calculateSundayRestDay(regularHours, ratePerHour);
                    breakdown.details.push({
                        description: 'Sunday/Rest Day (1.3x)',
                        hours: regularHours,
                        rate: ratePerHour * 1.3,
                        amount: breakdown.regularPay
                    });
                }
                if (overtimeHours > 0) {
                    breakdown.overtimePay = calculateSundayRestDayOT(overtimeHours, ratePerHour);
                    breakdown.details.push({
                        description: 'Sunday/Rest Day OT (1.69x)',
                        hours: overtimeHours,
                        rate: ratePerHour * 1.69,
                        amount: breakdown.overtimePay
                    });
                }
                break;

            case 'non-working-holiday':
                if (regularHours > 0) {
                    breakdown.regularPay = calculateNonWorkingHoliday(regularHours, ratePerHour);
                    breakdown.details.push({
                        description: 'Non-Working Holiday (1.3x)',
                        hours: regularHours,
                        rate: ratePerHour * 1.3,
                        amount: breakdown.regularPay
                    });
                }
                if (overtimeHours > 0) {
                    breakdown.overtimePay = calculateNonWorkingHolidayOT(overtimeHours, ratePerHour);
                    breakdown.details.push({
                        description: 'Non-Working Holiday OT (1.69x)',
                        hours: overtimeHours,
                        rate: ratePerHour * 1.69,
                        amount: breakdown.overtimePay
                    });
                }
                break;

            case 'regular-holiday':
                if (regularHours > 0) {
                    breakdown.regularPay = calculateRegularHoliday(regularHours, ratePerHour);
                    breakdown.details.push({
                        description: 'Regular Holiday (2x)',
                        hours: regularHours,
                        rate: ratePerHour * 2,
                        amount: breakdown.regularPay
                    });
                }
                if (overtimeHours > 0) {
                    breakdown.overtimePay = calculateRegularHolidayOT(overtimeHours, ratePerHour);
                    breakdown.details.push({
                        description: 'Regular Holiday OT (2.6x)',
                        hours: overtimeHours,
                        rate: ratePerHour * 2.6,
                        amount: breakdown.overtimePay
                    });
                }
                break;

            case 'sunday-special-holiday':
                if (regularHours > 0) {
                    breakdown.regularPay = calculateSundaySpecialHoliday(regularHours, ratePerHour);
                    breakdown.details.push({
                        description: 'Sunday + Special Holiday (1.5x)',
                        hours: regularHours,
                        rate: ratePerHour * 1.5,
                        amount: breakdown.regularPay
                    });
                }
                if (overtimeHours > 0) {
                    breakdown.overtimePay = calculateSundaySpecialHoliday(overtimeHours, ratePerHour) * 1.3;
                    breakdown.details.push({
                        description: 'Sunday + Special Holiday OT (1.95x)',
                        hours: overtimeHours,
                        rate: ratePerHour * 1.95,
                        amount: breakdown.overtimePay
                    });
                }
                break;

            case 'sunday-regular-holiday':
                if (regularHours > 0) {
                    breakdown.regularPay = calculateSundayRegularHoliday(regularHours, ratePerHour);
                    breakdown.details.push({
                        description: 'Sunday + Regular Holiday (2.6x)',
                        hours: regularHours,
                        rate: ratePerHour * 2.6,
                        amount: breakdown.regularPay
                    });
                }
                if (overtimeHours > 0) {
                    breakdown.overtimePay = calculateRegularHolidayRestDayOT(overtimeHours, ratePerHour);
                    breakdown.details.push({
                        description: 'Sunday + Regular Holiday OT (3.38x)',
                        hours: overtimeHours,
                        rate: ratePerHour * 3.38,
                        amount: breakdown.overtimePay
                    });
                }
                break;
        }

        // Calculate night differential (applies to all day types)
        if (nightDiffHours > 0) {
            breakdown.nightDiffPay = calculateNightDiff(nightDiffHours, ratePerHour);
            breakdown.details.push({
                description: 'Night Differential (0.1x)',
                hours: nightDiffHours,
                rate: ratePerHour * 0.1,
                amount: breakdown.nightDiffPay
            });
        }

        // Calculate total
        breakdown.total = breakdown.regularPay + breakdown.overtimePay + breakdown.nightDiffPay;

        return breakdown;
    }

    /**
     * Calculates total payroll for a period
     * @param {Array} attendanceRecords - Array of attendance records
     * @param {number} ratePerHour - Employee's hourly rate
     * @returns {object} Complete payroll breakdown
     */
    function calculatePayrollPeriod(attendanceRecords, ratePerHour) {
        let totalRegularPay = 0;
        let totalOvertimePay = 0;
        let totalNightDiffPay = 0;
        const detailedBreakdown = [];

        attendanceRecords.forEach(record => {
            const calculation = calculatePay({
                dayType: record.dayType,
                regularHours: record.regularHours,
                overtimeHours: record.overtimeHours,
                nightDiffHours: record.nightDiffHours,
                ratePerHour: ratePerHour
            });

            totalRegularPay += calculation.regularPay;
            totalOvertimePay += calculation.overtimePay;
            totalNightDiffPay += calculation.nightDiffPay;

            detailedBreakdown.push({
                date: record.date,
                dayType: record.dayType,
                ...calculation
            });
        });

        return {
            totalRegularPay,
            totalOvertimePay,
            totalNightDiffPay,
            totalGrossPay: totalRegularPay + totalOvertimePay + totalNightDiffPay,
            detailedBreakdown
        };
    }

    // Public API
    return {
        calculateRegularOT,
        calculateSundayRestDay,
        calculateSundayRestDayOT,
        calculateSundaySpecialHoliday,
        calculateSundayRegularHoliday,
        calculateNonWorkingHoliday,
        calculateNonWorkingHolidayOT,
        calculateRegularHoliday,
        calculateRegularHolidayOT,
        calculateRegularHolidayRestDay,
        calculateRegularHolidayRestDayOT,
        calculateNightDiff,
        calculateRegularPay,
        calculatePay,
        calculatePayrollPeriod
    };
})();

