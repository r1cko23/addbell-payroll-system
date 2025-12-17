'use strict';

/**
 * Storage Module
 * Handles data persistence using localStorage
 */

const Storage = (function() {
    const STORAGE_KEYS = {
        EMPLOYEES: 'payroll_employees',
        ATTENDANCE: 'payroll_attendance'
    };

    /**
     * Saves data to localStorage
     * @param {string} key - Storage key
     * @param {*} data - Data to save
     */
    function save(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Error saving to localStorage:', error);
            return false;
        }
    }

    /**
     * Loads data from localStorage
     * @param {string} key - Storage key
     * @returns {*} Parsed data or null if not found
     */
    function load(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Error loading from localStorage:', error);
            return null;
        }
    }

    /**
     * Removes data from localStorage
     * @param {string} key - Storage key
     */
    function remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('Error removing from localStorage:', error);
            return false;
        }
    }

    /**
     * Clears all payroll data from localStorage
     */
    function clearAll() {
        try {
            Object.values(STORAGE_KEYS).forEach(key => {
                localStorage.removeItem(key);
            });
            return true;
        } catch (error) {
            console.error('Error clearing localStorage:', error);
            return false;
        }
    }

    // Employee Management
    /**
     * Saves employees to localStorage
     * @param {Array} employees - Array of employee objects
     */
    function saveEmployees(employees) {
        return save(STORAGE_KEYS.EMPLOYEES, employees);
    }

    /**
     * Loads employees from localStorage
     * @returns {Array} Array of employee objects
     */
    function loadEmployees() {
        return load(STORAGE_KEYS.EMPLOYEES) || [];
    }

    /**
     * Adds a new employee
     * @param {object} employee - Employee object
     */
    function addEmployee(employee) {
        const employees = loadEmployees();
        employees.push(employee);
        return saveEmployees(employees);
    }

    /**
     * Updates an existing employee
     * @param {string} employeeId - Employee ID
     * @param {object} updatedData - Updated employee data
     */
    function updateEmployee(employeeId, updatedData) {
        const employees = loadEmployees();
        const index = employees.findIndex(emp => emp.id === employeeId);
        
        if (index !== -1) {
            employees[index] = { ...employees[index], ...updatedData };
            return saveEmployees(employees);
        }
        return false;
    }

    /**
     * Deletes an employee
     * @param {string} employeeId - Employee ID
     */
    function deleteEmployee(employeeId) {
        const employees = loadEmployees();
        const filtered = employees.filter(emp => emp.id !== employeeId);
        return saveEmployees(filtered);
    }

    /**
     * Gets an employee by ID
     * @param {string} employeeId - Employee ID
     * @returns {object|null} Employee object or null
     */
    function getEmployee(employeeId) {
        const employees = loadEmployees();
        return employees.find(emp => emp.id === employeeId) || null;
    }

    // Attendance Management
    /**
     * Saves attendance records to localStorage
     * @param {Array} attendanceRecords - Array of attendance objects
     */
    function saveAttendance(attendanceRecords) {
        return save(STORAGE_KEYS.ATTENDANCE, attendanceRecords);
    }

    /**
     * Loads attendance records from localStorage
     * @returns {Array} Array of attendance objects
     */
    function loadAttendance() {
        return load(STORAGE_KEYS.ATTENDANCE) || [];
    }

    /**
     * Adds a new attendance record
     * @param {object} attendance - Attendance object
     */
    function addAttendance(attendance) {
        const records = loadAttendance();
        records.push(attendance);
        return saveAttendance(records);
    }

    /**
     * Updates an existing attendance record
     * @param {string} attendanceId - Attendance ID
     * @param {object} updatedData - Updated attendance data
     */
    function updateAttendance(attendanceId, updatedData) {
        const records = loadAttendance();
        const index = records.findIndex(rec => rec.id === attendanceId);
        
        if (index !== -1) {
            records[index] = { ...records[index], ...updatedData };
            return saveAttendance(records);
        }
        return false;
    }

    /**
     * Deletes an attendance record
     * @param {string} attendanceId - Attendance ID
     */
    function deleteAttendance(attendanceId) {
        const records = loadAttendance();
        const filtered = records.filter(rec => rec.id !== attendanceId);
        return saveAttendance(filtered);
    }

    /**
     * Gets attendance records for a specific employee
     * @param {string} employeeId - Employee ID
     * @returns {Array} Array of attendance records
     */
    function getEmployeeAttendance(employeeId) {
        const records = loadAttendance();
        return records.filter(rec => rec.employeeId === employeeId);
    }

    /**
     * Gets attendance records for a specific employee within a date range
     * @param {string} employeeId - Employee ID
     * @param {string} startDate - Start date (YYYY-MM-DD)
     * @param {string} endDate - End date (YYYY-MM-DD)
     * @returns {Array} Array of attendance records
     */
    function getEmployeeAttendanceByDateRange(employeeId, startDate, endDate) {
        const records = getEmployeeAttendance(employeeId);
        return records.filter(rec => {
            return rec.date >= startDate && rec.date <= endDate;
        }).sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    /**
     * Generates a unique ID
     * @returns {string} Unique ID
     */
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // Public API
    return {
        // Generic storage methods
        save,
        load,
        remove,
        clearAll,
        
        // Employee methods
        saveEmployees,
        loadEmployees,
        addEmployee,
        updateEmployee,
        deleteEmployee,
        getEmployee,
        
        // Attendance methods
        saveAttendance,
        loadAttendance,
        addAttendance,
        updateAttendance,
        deleteAttendance,
        getEmployeeAttendance,
        getEmployeeAttendanceByDateRange,
        
        // Utility
        generateId
    };
})();

