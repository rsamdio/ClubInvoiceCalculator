[![Netlify Status](https://api.netlify.com/api/v1/badges/a55b4ac6-6b6f-4857-bb6b-aa526abc7081/deploy-status)](https://app.netlify.com/projects/rotaractdues/deploys)

# Rotaract Club Invoice Calculator

An interactive tool developed by Rotaract South Asia MDIO (RSAMDIO) to help Rotaractors estimate their Club Invoices with precision and ease. This tool provides a user-friendly interface to manage a member roster, calculate dues, and generate detailed reports.

**Live Demo:** [**dues.rsamdio.org**](https://dues.rsamdio.org/)

## 🚀 Features

### Core Functionality
*   **Easy to Use:** Simple and intuitive interface for quick calculations with real-time updates
*   **Bulk Upload Support:** Upload member rosters via Excel (.xlsx, .xls) or CSV files for efficient processing
*   **Real-time Calculations:** Instantly view estimated dues as you add or modify member information
*   **Individual Member Management:** Add, edit, and remove individual members from the roster with inline editing capabilities
*   **Prorated Dues Calculation:** Accurately calculates prorated dues based on join and leave dates
*   **Tax Configuration:** Allows users to input a tax percentage to see the total invoice amount including tax

### Advanced Features
*   **PDF Report Generation:** Generate detailed PDF reports of the invoice summary and member roster with professional formatting
*   **Pagination Support:** Efficiently handle large member rosters with customizable page sizes (10, 25, 50, 100 members per page)
*   **Form Validation:** Comprehensive client-side validation with real-time error feedback
*   **Instructional Pop-up:** A helpful guide for new users to get started quickly
*   **Responsive Design:** Works seamlessly on all devices, from desktops to mobile phones
*   **Performance Optimized:** Uses web workers for non-blocking PDF generation and debounced calculations
*   **Template Downloads:** Pre-built CSV templates for easy data import
*   **Data Export:** Export member data in various formats for record keeping

### User Experience
*   **Auto-save Functionality:** Form data persistence across browser sessions
*   **Keyboard Navigation:** Full keyboard support for accessibility
*   **Loading States:** Visual feedback during file processing and PDF generation
*   **Error Handling:** Comprehensive error messages and recovery options
*   **Mobile-First Design:** Optimized touch interface for mobile devices

## 🛠️ Technologies Used

### Frontend
*   **HTML5:** Semantic markup and modern web standards
*   **Tailwind CSS:** Utility-first CSS framework for responsive design
*   **JavaScript (ES6+):** Modern JavaScript with async/await and modules
*   **Web Workers:** Background processing for PDF generation

### Libraries & Dependencies
*   **XLSX.js:** Excel file parsing and manipulation
*   **PapaParse.js:** Fast CSV parsing with error handling
*   **jsPDF & jspdf-autotable:** Professional PDF generation with table support
*   **Google Analytics:** Usage tracking and analytics

### Performance & SEO
*   **Lazy Loading:** Optimized resource loading
*   **SEO Optimization:** Comprehensive meta tags and structured data
*   **PWA Ready:** Progressive Web App capabilities
*   **CDN Integration:** Fast content delivery via CDN

## 📦 Getting Started

### Prerequisites
*   Modern web browser (Chrome, Firefox, Safari, Edge)
*   No server setup required - runs entirely in the browser

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/zeospec/ClubInvoiceCalculator.git
    ```

2.  **Navigate to the project directory:**
    ```bash
    cd ClubInvoiceCalculator
    ```

3.  **Open `index.html` in your web browser:**
    ```bash
    # On macOS/Linux
    open index.html
    
    # On Windows
    start index.html
    
    # Or simply double-click the file
    ```

**No special setup, build process, or server is required!**

## 📖 Usage Guide

### Adding Members

#### Individual Member Addition
1.  Use the "Add New Member" form on the left column
2.  Input member details:
    *   **Name:** Full name (letters and spaces only)
    *   **Club Base:** Select Community-Based or University-Based
    *   **Join Date:** Date when member joined (YYYY-MM-DD format)
    *   **Leave Date:** Optional - date when member left (YYYY-MM-DD format)
3.  Click "Add Member" to add to the roster

#### Bulk Upload
1.  Click "Browse Files" or drag and drop your Excel/CSV file
2.  Ensure your file follows the expected format:
    *   **Column A:** Member Name (e.g., John Doe)
    *   **Column B:** Join Date (YYYY-MM-DD format)
    *   **Column C:** Club Base (Community-Based or University-Based)
    *   **Column D:** Leave Date (YYYY-MM-DD format, leave blank if still active)
3.  Review the preview and confirm upload
4.  Templates are available for download:
    *   **CSV Template:** Download for offline use
    *   **Google Sheets Template:** For online collaboration

### Managing the Invoice

#### Invoice Summary Configuration
*   Select the desired "Invoice of January" year
*   Adjust the "Tax Percentage (%)" as needed
*   View real-time updates of "Base RI Dues" and "Total with Tax"
*   See breakdown of full-year and prorated dues

#### Member Roster Management
*   **View Members:** All added members listed in a paginated table
*   **Edit Members:** Click the edit button (✏️) next to each member for inline editing
*   **Delete Members:** Use the delete button (🗑️) to remove members
*   **Reset Roster:** Clear all members using the "Reset Roster" button
*   **Search & Filter:** Navigate through large rosters with pagination controls

### Generating Reports

#### PDF Report Features
*   **Professional Formatting:** Clean, official-looking reports
*   **Complete Summary:** Invoice totals, member counts, and breakdowns
*   **Member Details:** Full roster with individual calculations
*   **Custom Branding:** RSAMDIO branding and professional styling
*   **Print Ready:** Optimized for printing and sharing

## 🔧 Configuration

### File Format Requirements

#### Excel Files (.xlsx, .xls)
- Must contain exactly 4 columns in order: Name, Join Date, Club Base, Leave Date
- First row can be headers (will be automatically skipped)
- Dates must be in YYYY-MM-DD format

#### CSV Files (.csv)
- Comma-separated values
- Same column structure as Excel files
- UTF-8 encoding recommended

### Browser Compatibility
- **Chrome:** 60+ (Recommended)
- **Firefox:** 55+
- **Safari:** 12+
- **Edge:** 79+

## 🤝 Contributing

We welcome contributions from the Rotaract community! Please follow these steps:

1.  **Fork the repository**
2.  **Create a feature branch:**
    ```bash
    git checkout -b feature/your-feature-name
    ```
3.  **Make your changes** following the existing code style
4.  **Test thoroughly** on different browsers and devices
5.  **Commit your changes:**
    ```bash
    git commit -m 'Add some feature'
    ```
6.  **Push to your branch:**
    ```bash
    git push origin feature/your-feature-name
    ```
7.  **Open a pull request** with a detailed description

### Development Guidelines
- Follow existing code style and conventions
- Add comments for complex logic
- Test on multiple browsers
- Ensure mobile responsiveness
- Update documentation for new features

## 🐛 Troubleshooting

### Common Issues

#### File Upload Problems
- **File not loading:** Ensure file format is .xlsx, .xls, or .csv
- **Wrong data:** Check column order and date format
- **Large files:** Consider splitting into smaller files for better performance

#### Calculation Issues
- **Incorrect dues:** Verify join/leave dates are in YYYY-MM-DD format
- **Tax not applying:** Ensure tax percentage is a valid number
- **Real-time updates not working:** Refresh the page and try again

#### Browser Issues
- **PDF not generating:** Try a different browser or update your current browser
- **Slow performance:** Close other tabs and refresh the page
- **Mobile issues:** Use landscape orientation for better experience

## 📄 License

This project is developed and maintained by Rotaract South Asia MDIO.

## ⚠️ Disclaimer

All calculations are indicative estimates. Actual figures may vary based on various factors including but not limited to variation in data and RI Policies. This tool is designed to assist with planning and should not be considered as official financial advice.

## 📞 Contact

**PDRR Arun Teja Godavarthi**  
Email: rotaract3191drr@gmail.com

**Technical Support**  
For technical issues or feature requests, please open an issue on GitHub.

## 📊 Project Status

- **Last Updated:** January 7, 2025
- **Version:** 2.0.0
- **Status:** Active Development
- **Deployment:** Netlify (Production)

## Copyright

© 2025 Rotaract South Asia MDIO. All rights reserved.