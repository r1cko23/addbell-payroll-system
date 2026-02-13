# Logo Assets

This folder contains the source logo files for Addbell Technical Services, Inc.

## Logo Files

- Source logo file should be placed here (PNG, JPG, or SVG format)

## Logo Usage

The logo is converted to WebP format and placed in `/public/` for use in the application.

### Logo Files Needed:
- `/public/addbell-logo.jpg` - Main logo for sidebars, login page, payslips, and favicon

### Logo Specifications

- **Format:** JPG (from Official Logo Cropped.jpg)
- **Location:** `/public/addbell-logo.jpg`
- **Recommended Size:** 
  - Logo: 500x185px or similar aspect ratio
  - Favicon: 32x32px or 64x64px

### Where Logo is Used

1. **Sidebar** (`components/Sidebar.tsx`)
   - Displayed in the main navigation sidebar
   - Size: h-16 (64px height)

2. **Employee Portal Sidebar** (`components/EmployeePortalSidebar.tsx`)
   - Displayed in employee portal navigation
   - Size: h-12 (48px height)

3. **Login Page** (`app/login/LoginPageClient.tsx`)
   - Displayed prominently on the login page
   - Size: h-32 (128px height)

4. **Payslips** (`components/PayslipPrint.tsx`, `components/PayslipMultiPrint.tsx`)
   - Displayed on printed payslips
   - Size: 100px height

5. **PDF Exports** (`app/employees/page.tsx`, `app/reports/page.tsx`)
   - Included in PDF reports and exports

6. **Favicon** (`app/layout.tsx`)
   - Browser tab icon

## Updating the Logo

To update the logo:

1. Place your Addbell logo file in this folder (e.g., `addbell-logo.png`)
2. Convert to WebP format (if needed):
   ```bash
   # Using ImageMagick or similar tool
   convert "addbell-logo.png" -quality 90 -resize 500x500 public/addbell-logo.webp
   convert "addbell-logo.png" -quality 90 -resize 64x64 public/addbell-favicon.webp
   ```
3. All references will automatically use the new logo

## Notes

- Ensure the logo has a transparent background for best results
- Maintain aspect ratio when resizing
- Use WebP format for optimal performance and file size
