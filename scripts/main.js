'use strict';

/**
 * Main Application Controller
 * Handles UI interactions and coordinates between modules
 */

(function() {
    // State
    let currentTab = 'attendance';
    let editingEmployeeId = null;

    // DOM Elements - will be initialized after DOM loads
    let elements = {};

    /**
     * Initializes the application
     */
    function init() {
        initializeElements();
        initializeEventListeners();
        loadEmployeesUI();
        loadAttendanceUI();
        loadHolidaysUI();
        setCurrentDate();
    }

    /**
     * Initializes DOM element references
     */
    function initializeElements() {
        elements = {
            // Navigation
            navButtons: document.querySelectorAll('.nav-btn'),
            
            // Tabs
            attendanceTab: document.getElementById('attendance-tab'),
            employeesTab: document.getElementById('employees-tab'),
            payslipTab: document.getElementById('payslip-tab'),
            holidaysTab: document.getElementById('holidays-tab'),
            
            // Employee Form
            employeeFormCard: document.getElementById('employee-form-card'),
            employeeForm: document.getElementById('employee-form'),
            employeeId: document.getElementById('employee-id'),
            employeeName: document.getElementById('employee-name'),
            employeeRateDay: document.getElementById('employee-rate-day'),
            employeeRateHour: document.getElementById('employee-rate-hour'),
            addEmployeeBtn: document.getElementById('add-employee-btn'),
            cancelEmployeeBtn: document.getElementById('cancel-employee-btn'),
            employeeTbody: document.getElementById('employee-tbody'),
            
            // Attendance Form
            attendanceEmployee: document.getElementById('attendance-employee'),
            attendanceDate: document.getElementById('attendance-date'),
            attendanceType: document.getElementById('attendance-type'),
            regularHours: document.getElementById('regular-hours'),
            overtimeHours: document.getElementById('overtime-hours'),
            nightDiffHours: document.getElementById('night-diff-hours'),
            saveAttendanceBtn: document.getElementById('save-attendance-btn'),
            calculatePreviewBtn: document.getElementById('calculate-preview-btn'),
            calculationPreview: document.getElementById('calculation-preview'),
            previewDetails: document.getElementById('preview-details'),
            attendanceTbody: document.getElementById('attendance-tbody'),
            
            // Payslip
            payslipEmployee: document.getElementById('payslip-employee'),
            payslipStartDate: document.getElementById('payslip-start-date'),
            payslipEndDate: document.getElementById('payslip-end-date'),
            generatePayslipBtn: document.getElementById('generate-payslip-btn'),
            payslipResult: document.getElementById('payslip-result'),
            payslipPeriod: document.getElementById('payslip-period'),
            payslipEmpId: document.getElementById('payslip-emp-id'),
            payslipEmpName: document.getElementById('payslip-emp-name'),
            payslipRateDay: document.getElementById('payslip-rate-day'),
            payslipRateHour: document.getElementById('payslip-rate-hour'),
            payslipBreakdownTbody: document.getElementById('payslip-breakdown-tbody'),
            payslipTotalGross: document.getElementById('payslip-total-gross'),
            printPayslipBtn: document.getElementById('print-payslip-btn'),
            exportPayslipBtn: document.getElementById('export-payslip-btn'),
            
            // Holidays
            regularHolidaysTbody: document.getElementById('regular-holidays-tbody'),
            nonWorkingHolidaysTbody: document.getElementById('non-working-holidays-tbody')
        };
    }

    /**
     * Initializes event listeners
     */
    function initializeEventListeners() {
        // Navigation
        elements.navButtons.forEach(btn => {
            btn.addEventListener('click', handleTabChange);
        });
        
        // Employee Management
        elements.addEmployeeBtn.addEventListener('click', showEmployeeForm);
        elements.cancelEmployeeBtn.addEventListener('click', hideEmployeeForm);
        elements.employeeForm.addEventListener('submit', handleEmployeeSubmit);
        
        // Attendance
        elements.saveAttendanceBtn.addEventListener('click', handleAttendanceSave);
        elements.calculatePreviewBtn.addEventListener('click', handleCalculatePreview);
        elements.attendanceDate.addEventListener('change', handleDateChange);
        
        // Payslip
        elements.generatePayslipBtn.addEventListener('click', handleGeneratePayslip);
        elements.printPayslipBtn.addEventListener('click', handlePrintPayslip);
        elements.exportPayslipBtn.addEventListener('click', handleExportPayslip);
    }

    /**
     * Sets current date in date inputs
     */
    function setCurrentDate() {
        const today = new Date().toISOString().split('T')[0];
        elements.attendanceDate.value = today;
        elements.payslipEndDate.value = today;
        
        // Set start date to beginning of current month
        const firstDay = new Date();
        firstDay.setDate(1);
        elements.payslipStartDate.value = firstDay.toISOString().split('T')[0];
    }

    /**
     * Handles tab navigation
     */
    function handleTabChange(e) {
        const tabName = e.target.dataset.tab;
        
        // Update active states
        elements.navButtons.forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        
        // Hide all tabs
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Show selected tab
        document.getElementById(`${tabName}-tab`).classList.add('active');
        currentTab = tabName;
    }

    // ==================== EMPLOYEE MANAGEMENT ====================
    
    /**
     * Shows the employee form
     */
    function showEmployeeForm() {
        elements.employeeFormCard.style.display = 'block';
        elements.employeeForm.reset();
        editingEmployeeId = null;
        elements.employeeId.disabled = false;
    }

    /**
     * Hides the employee form
     */
    function hideEmployeeForm() {
        elements.employeeFormCard.style.display = 'none';
        elements.employeeForm.reset();
        editingEmployeeId = null;
    }

    /**
     * Handles employee form submission
     */
    function handleEmployeeSubmit(e) {
        e.preventDefault();
        
        const employee = {
            id: elements.employeeId.value.trim(),
            name: elements.employeeName.value.trim(),
            ratePerDay: parseFloat(elements.employeeRateDay.value),
            ratePerHour: parseFloat(elements.employeeRateHour.value)
        };
        
        if (editingEmployeeId) {
            Storage.updateEmployee(editingEmployeeId, employee);
            alert('Employee updated successfully!');
        } else {
            // Check if employee ID already exists
            const existing = Storage.getEmployee(employee.id);
            if (existing) {
                alert('Employee ID already exists!');
                return;
            }
            Storage.addEmployee(employee);
            alert('Employee added successfully!');
        }
        
        hideEmployeeForm();
        loadEmployeesUI();
        updateEmployeeDropdowns();
    }

    /**
     * Loads and displays employees
     */
    function loadEmployeesUI() {
        const employees = Storage.loadEmployees();
        
        if (employees.length === 0) {
            elements.employeeTbody.innerHTML = '<tr><td colspan="5" class="text-center">No employees yet. Add your first employee!</td></tr>';
            return;
        }
        
        elements.employeeTbody.innerHTML = employees.map(emp => `
            <tr>
                <td>${escapeHtml(emp.id)}</td>
                <td>${escapeHtml(emp.name)}</td>
                <td>₱${emp.ratePerDay.toFixed(2)}</td>
                <td>₱${emp.ratePerHour.toFixed(2)}</td>
                <td>
                    <button class="btn btn-sm btn-secondary" onclick="editEmployee('${emp.id}')">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteEmployee('${emp.id}')">Delete</button>
                </td>
            </tr>
        `).join('');
        
        updateEmployeeDropdowns();
    }

    /**
     * Updates employee dropdowns
     */
    function updateEmployeeDropdowns() {
        const employees = Storage.loadEmployees();
        const options = employees.map(emp => 
            `<option value="${emp.id}">${escapeHtml(emp.name)} (${escapeHtml(emp.id)})</option>`
        ).join('');
        
        elements.attendanceEmployee.innerHTML = '<option value="">-- Select Employee --</option>' + options;
        elements.payslipEmployee.innerHTML = '<option value="">-- Select Employee --</option>' + options;
    }

    /**
     * Edits an employee
     */
    window.editEmployee = function(employeeId) {
        const employee = Storage.getEmployee(employeeId);
        if (!employee) return;
        
        elements.employeeId.value = employee.id;
        elements.employeeName.value = employee.name;
        elements.employeeRateDay.value = employee.ratePerDay;
        elements.employeeRateHour.value = employee.ratePerHour;
        
        elements.employeeId.disabled = true;
        editingEmployeeId = employeeId;
        elements.employeeFormCard.style.display = 'block';
        
        // Switch to employees tab
        document.querySelector('[data-tab="employees"]').click();
    };

    /**
     * Deletes an employee
     */
    window.deleteEmployee = function(employeeId) {
        if (!confirm('Are you sure you want to delete this employee?')) return;
        
        Storage.deleteEmployee(employeeId);
        loadEmployeesUI();
        updateEmployeeDropdowns();
        alert('Employee deleted successfully!');
    };

    // ==================== ATTENDANCE MANAGEMENT ====================
    
    /**
     * Handles date change to auto-detect day type
     */
    function handleDateChange() {
        const date = elements.attendanceDate.value;
        if (!date) return;
        
        const dayType = PhilippineHolidays.getDayType(date);
        elements.attendanceType.value = dayType;
    }

    /**
     * Handles calculate preview
     */
    function handleCalculatePreview() {
        const employeeId = elements.attendanceEmployee.value;
        if (!employeeId) {
            alert('Please select an employee');
            return;
        }
        
        const employee = Storage.getEmployee(employeeId);
        const calculation = PayrollCalculator.calculatePay({
            dayType: elements.attendanceType.value,
            regularHours: parseFloat(elements.regularHours.value) || 0,
            overtimeHours: parseFloat(elements.overtimeHours.value) || 0,
            nightDiffHours: parseFloat(elements.nightDiffHours.value) || 0,
            ratePerHour: employee.ratePerHour
        });
        
        displayCalculationPreview(calculation);
    }

    /**
     * Displays calculation preview
     */
    function displayCalculationPreview(calculation) {
        elements.calculationPreview.style.display = 'block';
        
        let html = '';
        calculation.details.forEach(detail => {
            html += `
                <div class="preview-item">
                    <span class="preview-label">${detail.description}</span>
                    <span class="preview-value">₱${detail.amount.toFixed(2)}</span>
                </div>
            `;
        });
        
        html += `
            <div class="preview-item preview-total">
                <span class="preview-label">Total Amount</span>
                <span class="preview-value">₱${calculation.total.toFixed(2)}</span>
            </div>
        `;
        
        elements.previewDetails.innerHTML = html;
    }

    /**
     * Handles attendance save
     */
    function handleAttendanceSave() {
        const employeeId = elements.attendanceEmployee.value;
        const date = elements.attendanceDate.value;
        
        if (!employeeId || !date) {
            alert('Please select an employee and date');
            return;
        }
        
        const employee = Storage.getEmployee(employeeId);
        const regularHours = parseFloat(elements.regularHours.value) || 0;
        const overtimeHours = parseFloat(elements.overtimeHours.value) || 0;
        const nightDiffHours = parseFloat(elements.nightDiffHours.value) || 0;
        
        if (regularHours === 0 && overtimeHours === 0 && nightDiffHours === 0) {
            alert('Please enter at least some hours');
            return;
        }
        
        const calculation = PayrollCalculator.calculatePay({
            dayType: elements.attendanceType.value,
            regularHours,
            overtimeHours,
            nightDiffHours,
            ratePerHour: employee.ratePerHour
        });
        
        const attendance = {
            id: Storage.generateId(),
            employeeId,
            employeeName: employee.name,
            date,
            dayType: elements.attendanceType.value,
            regularHours,
            overtimeHours,
            nightDiffHours,
            amount: calculation.total
        };
        
        Storage.addAttendance(attendance);
        alert('Attendance saved successfully!');
        
        // Reset form
        elements.regularHours.value = 0;
        elements.overtimeHours.value = 0;
        elements.nightDiffHours.value = 0;
        elements.calculationPreview.style.display = 'none';
        
        loadAttendanceUI();
    }

    /**
     * Loads and displays attendance records
     */
    function loadAttendanceUI() {
        const records = Storage.loadAttendance();
        
        if (records.length === 0) {
            elements.attendanceTbody.innerHTML = '<tr><td colspan="8" class="text-center">No attendance records yet</td></tr>';
            return;
        }
        
        // Sort by date descending
        records.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        elements.attendanceTbody.innerHTML = records.map(rec => `
            <tr>
                <td>${rec.date}</td>
                <td>${escapeHtml(rec.employeeName)}</td>
                <td><span class="badge badge-info">${getDayTypeLabel(rec.dayType)}</span></td>
                <td>${rec.regularHours}</td>
                <td>${rec.overtimeHours}</td>
                <td>${rec.nightDiffHours}</td>
                <td>₱${rec.amount.toFixed(2)}</td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="deleteAttendance('${rec.id}')">Delete</button>
                </td>
            </tr>
        `).join('');
    }

    /**
     * Deletes an attendance record
     */
    window.deleteAttendance = function(attendanceId) {
        if (!confirm('Are you sure you want to delete this attendance record?')) return;
        
        Storage.deleteAttendance(attendanceId);
        loadAttendanceUI();
        alert('Attendance record deleted successfully!');
    };

    /**
     * Gets human-readable day type label
     */
    function getDayTypeLabel(dayType) {
        const labels = {
            'regular': 'Regular Day',
            'sunday': 'Sunday/Rest Day',
            'non-working-holiday': 'Non-Working Holiday',
            'regular-holiday': 'Regular Holiday',
            'sunday-special-holiday': 'Sunday + Special Holiday',
            'sunday-regular-holiday': 'Sunday + Regular Holiday'
        };
        return labels[dayType] || dayType;
    }

    // ==================== PAYSLIP GENERATION ====================
    
    /**
     * Handles payslip generation
     */
    function handleGeneratePayslip() {
        const employeeId = elements.payslipEmployee.value;
        const startDate = elements.payslipStartDate.value;
        const endDate = elements.payslipEndDate.value;
        
        if (!employeeId || !startDate || !endDate) {
            alert('Please select an employee and date range');
            return;
        }
        
        const employee = Storage.getEmployee(employeeId);
        const attendance = Storage.getEmployeeAttendanceByDateRange(employeeId, startDate, endDate);
        
        if (attendance.length === 0) {
            alert('No attendance records found for this period');
            return;
        }
        
        const payroll = PayrollCalculator.calculatePayrollPeriod(attendance, employee.ratePerHour);
        
        displayPayslip(employee, startDate, endDate, payroll);
    }

    /**
     * Displays the payslip
     */
    function displayPayslip(employee, startDate, endDate, payroll) {
        elements.payslipResult.style.display = 'block';
        
        // Employee info
        elements.payslipPeriod.textContent = `${formatDate(startDate)} - ${formatDate(endDate)}`;
        elements.payslipEmpId.textContent = employee.id;
        elements.payslipEmpName.textContent = employee.name;
        elements.payslipRateDay.textContent = `₱${employee.ratePerDay.toFixed(2)}`;
        elements.payslipRateHour.textContent = `₱${employee.ratePerHour.toFixed(2)}`;
        
        // Breakdown
        let breakdownHtml = '';
        const summaryMap = new Map();
        
        // Aggregate by description
        payroll.detailedBreakdown.forEach(day => {
            day.details.forEach(detail => {
                const key = detail.description;
                if (summaryMap.has(key)) {
                    const existing = summaryMap.get(key);
                    existing.hours += detail.hours;
                    existing.amount += detail.amount;
                } else {
                    summaryMap.set(key, {
                        description: detail.description,
                        hours: detail.hours,
                        rate: detail.rate,
                        amount: detail.amount
                    });
                }
            });
        });
        
        summaryMap.forEach(item => {
            breakdownHtml += `
                <tr>
                    <td>${item.description}</td>
                    <td>${item.hours.toFixed(2)}</td>
                    <td>₱${item.rate.toFixed(2)}</td>
                    <td>₱${item.amount.toFixed(2)}</td>
                </tr>
            `;
        });
        
        elements.payslipBreakdownTbody.innerHTML = breakdownHtml;
        elements.payslipTotalGross.textContent = `₱${payroll.totalGrossPay.toFixed(2)}`;
        
        // Scroll to payslip
        elements.payslipResult.scrollIntoView({ behavior: 'smooth' });
    }

    /**
     * Handles print payslip
     */
    function handlePrintPayslip() {
        window.print();
    }

    /**
     * Handles export payslip to CSV
     */
    function handleExportPayslip() {
        const employeeId = elements.payslipEmployee.value;
        const startDate = elements.payslipStartDate.value;
        const endDate = elements.payslipEndDate.value;
        
        if (!employeeId) {
            alert('Please generate a payslip first');
            return;
        }
        
        const employee = Storage.getEmployee(employeeId);
        const attendance = Storage.getEmployeeAttendanceByDateRange(employeeId, startDate, endDate);
        const payroll = PayrollCalculator.calculatePayrollPeriod(attendance, employee.ratePerHour);
        
        // Create CSV content
        let csv = 'Addbell Payroll System - Payslip\n';
        csv += `Employee ID,${employee.id}\n`;
        csv += `Employee Name,${employee.name}\n`;
        csv += `Period,${startDate} to ${endDate}\n`;
        csv += `Rate/Day,${employee.ratePerDay}\n`;
        csv += `Rate/Hour,${employee.ratePerHour}\n\n`;
        csv += 'Description,Hours,Rate,Amount\n';
        
        const summaryMap = new Map();
        payroll.detailedBreakdown.forEach(day => {
            day.details.forEach(detail => {
                const key = detail.description;
                if (summaryMap.has(key)) {
                    const existing = summaryMap.get(key);
                    existing.hours += detail.hours;
                    existing.amount += detail.amount;
                } else {
                    summaryMap.set(key, {
                        description: detail.description,
                        hours: detail.hours,
                        rate: detail.rate,
                        amount: detail.amount
                    });
                }
            });
        });
        
        summaryMap.forEach(item => {
            csv += `${item.description},${item.hours.toFixed(2)},${item.rate.toFixed(2)},${item.amount.toFixed(2)}\n`;
        });
        
        csv += `\nTotal Gross Pay,,, ${payroll.totalGrossPay.toFixed(2)}\n`;
        
        // Download CSV
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `payslip_${employee.id}_${startDate}_${endDate}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    }

    // ==================== HOLIDAYS ====================
    
    /**
     * Loads and displays holidays
     */
    function loadHolidaysUI() {
        // Regular holidays
        const regularHolidays = PhilippineHolidays.getRegularHolidays();
        elements.regularHolidaysTbody.innerHTML = regularHolidays.map(holiday => `
            <tr>
                <td>${formatDate(holiday.date)}</td>
                <td>${escapeHtml(holiday.name)}</td>
                <td><span class="badge badge-warning">${holiday.type}</span></td>
            </tr>
        `).join('');
        
        // Non-working holidays
        const nonWorkingHolidays = PhilippineHolidays.getNonWorkingHolidays();
        elements.nonWorkingHolidaysTbody.innerHTML = nonWorkingHolidays.map(holiday => `
            <tr>
                <td>${formatDate(holiday.date)}</td>
                <td>${escapeHtml(holiday.name)}</td>
                <td><span class="badge badge-info">${holiday.type}</span></td>
            </tr>
        `).join('');
    }

    // ==================== UTILITY FUNCTIONS ====================
    
    /**
     * Escapes HTML to prevent XSS
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Formats date for display
     */
    function formatDate(dateString) {
        const date = new Date(dateString + 'T00:00:00');
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    }

    // Initialize app when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

