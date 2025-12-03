# Green Pasture People Management Inc. - Payroll System

A comprehensive web-based payroll system designed for tracking employee attendance and calculating payroll based on Philippine labor standards.

## Features

- **Employee Management**: Add, edit, and manage employee records with rate per day and rate per hour
- **Attendance Tracking**: Record daily attendance with regular hours, overtime, and night differential
- **Automatic Day Type Detection**: Automatically detects Sundays and Philippine holidays
- **Payroll Calculation**: Accurate calculation based on Philippine labor law formulas
- **Payslip Generation**: Generate detailed payslips for any date range
- **Export Functionality**: Export payslips to CSV format
- **Print Support**: Print-friendly payslip layout
- **Data Persistence**: All data stored locally in browser localStorage

## Payroll Formulas

The system implements the following Philippine labor standard formulas:

### Regular Day
- **Regular Hours**: `HRS × RATE/HR`
- **Regular Overtime**: `HRS × RATE/HR × 1.25`

### Sunday/Rest Day
- **Sunday/Rest Day**: `HRS × RATE/HR × 1.3`
- **Sunday/Rest Day OT**: `(HRS × RATE/HR × 1.3) × 1.3`

### Non-Working Holiday
- **Non-Working Holiday**: `HRS × RATE/HR × 1.3`
- **Non-Working Holiday OT**: `(HRS × RATE/HR × 1.3) × 1.3`

### Regular Holiday
- **Regular Holiday**: `HRS × RATE/HR × 2`
- **Regular Holiday OT**: `(HRS × RATE/HR × 2) × 1.3`

### Special Cases
- **Sunday + Special Holiday**: `HRS × RATE/HR × 1.5`
- **Sunday + Regular Holiday**: `HRS × RATE/HR × 2.6`
- **Sunday + Regular Holiday OT**: `(HRS × RATE/HR × 2.6) × 1.3`

### Night Differential
- **Night Diff (10PM-6AM)**: `HRS × RATE/HR × 0.1`

## Philippine Holidays 2025

The system includes all official Philippine holidays for 2025:

### Regular Holidays (Double Pay)
- New Year's Day (January 1)
- Maundy Thursday (March 29)
- Good Friday (March 30)
- Araw ng Kagitingan (April 9)
- Labor Day (May 1)
- Independence Day (June 12)
- National Heroes Day (August 25)
- Bonifacio Day (November 30)
- Christmas Day (December 25)
- Rizal Day (December 30)

### Non-Working Holidays (130% Pay)
- Chinese New Year (February 9)
- EDSA People Power Revolution (February 25)
- Black Saturday (March 31)
- Ninoy Aquino Day (August 21)
- All Saints' Day (November 1)
- All Souls' Day (November 2)
- Feast of the Immaculate Conception (December 8)
- Christmas Eve (December 24)
- Day after Christmas (December 26)
- New Year's Eve (December 31)

## Setup Instructions

1. **Clone or Download**: Download all files to your local machine
2. **File Structure**: Ensure the following structure:
   ```
   payroll-app/
   ├── index.html
   ├── styles/
   │   └── main.css
   ├── scripts/
   │   ├── modules/
   │   │   ├── holidays.js
   │   │   ├── calculator.js
   │   │   └── storage.js
   │   └── main.js
   └── README.md
   ```
3. **Open Application**: Open `index.html` in a modern web browser
4. **No Server Required**: This is a client-side application that runs entirely in the browser

## Usage Guide

### 1. Add Employees
1. Navigate to the **Employees** tab
2. Click **+ Add Employee**
3. Enter employee details:
   - Employee ID (unique identifier)
   - Full Name
   - Rate per Day
   - Rate per Hour
4. Click **Save Employee**

### 2. Record Attendance
1. Navigate to the **Attendance** tab
2. Select an employee from the dropdown
3. Select the date (system auto-detects if it's a holiday or Sunday)
4. Choose or verify the day type
5. Enter hours:
   - Regular Hours
   - Overtime Hours
   - Night Differential Hours (10PM-6AM)
6. Click **Preview Calculation** to see the breakdown
7. Click **Save Attendance** to record

### 3. Generate Payslip
1. Navigate to the **Payslip** tab
2. Select an employee
3. Choose start and end dates for the pay period
4. Click **Generate Payslip**
5. Review the detailed breakdown
6. Options:
   - **Print Payslip**: Opens print dialog
   - **Export to CSV**: Downloads payslip as CSV file

### 4. View Holidays
1. Navigate to the **Holidays** tab
2. View all Philippine holidays for 2025
3. Separated into Regular and Non-Working holidays

## Browser Compatibility

- Chrome (recommended)
- Firefox
- Safari
- Edge
- Any modern browser with ES6+ support and localStorage

## Data Storage

All data is stored locally in your browser's localStorage. This means:
- ✅ No server required
- ✅ Fast performance
- ✅ Privacy - data stays on your device
- ⚠️ Data is browser-specific
- ⚠️ Clearing browser data will delete all records

## Security Features

- Input sanitization to prevent XSS attacks
- No sensitive data transmitted over network
- Client-side only operation
- Proper HTML escaping for all user inputs

## Accessibility

- Keyboard navigation support
- Proper ARIA labels
- Focus indicators for interactive elements
- Semantic HTML structure
- Screen reader compatible

## Performance

- Optimized CSS with modern layout techniques
- Minimal JavaScript overhead
- Fast localStorage operations
- Responsive design for all screen sizes

## Future Enhancements

Potential features for future versions:
- Deductions management (SSS, PhilHealth, Pag-IBIG, Tax)
- Multiple pay periods support
- Employee photo upload
- Advanced reporting and analytics
- Data backup/restore functionality
- Multi-user support with authentication

## Support

For issues or questions, please refer to the documentation or contact your system administrator.

## License

© 2025 Green Pasture People Management Inc. All rights reserved.

## Version

Version 1.0.0 - Initial Release

