[![Netlify Status](https://api.netlify.com/api/v1/badges/a55b4ac6-6b6f-4857-bb6b-aa526abc7081/deploy-status)](https://app.netlify.com/projects/rotaractdues/deploys)

# Rotaract Club Invoice Calculator

An interactive tool developed by Rotaract South Asia MDIO (RSAMDIO) to help Rotaractors estimate their Club Invoices with precision and ease. This tool provides a user-friendly interface to manage a member roster, calculate dues, and generate detailed reports.

**Live Demo:** [**dues.rsamdio.org**](https://dues.rsamdio.org/)

## Features

*   **Easy to Use:** Simple and intuitive interface for quick calculations.
*   **Bulk Upload Support:** Upload member rosters via Excel (.xlsx, .xls) or CSV files for efficient processing.
*   **Real-time Calculations:** Instantly view estimated dues as you add or modify member information.
*   **Individual Member Management:** Add, edit, and remove individual members from the roster.
*   **Prorated Dues Calculation:** Accurately calculates prorated dues based on join and leave dates.
*   **Tax Configuration:** Allows users to input a tax percentage to see the total invoice amount including tax.
*   **PDF Report Generation:** Generate a detailed PDF report of the invoice summary and member roster.
*   **Instructional Pop-up:** A helpful guide for new users to get started quickly.
*   **Responsive Design:** Works on all devices, from desktops to mobile phones.

## Technologies Used

*   **HTML5**
*   **Tailwind CSS:** For a modern and responsive user interface.
*   **JavaScript (ES6+):** For all interactive functionalities and calculations.
*   **XLSX.js & PapaParse.js:** Libraries for handling Excel and CSV file parsing.
*   **jsPDF & jspdf-autotable:** For generating PDF reports.
*   **Web Worker:** For non-blocking PDF generation.

## Getting Started

To run the project locally, follow these steps:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/zeospec/ClubInvoiceCalculator.git
    ```
2.  **Navigate to the project directory:**
    ```bash
    cd ClubInvoiceCalculator
    ```
3.  **Open `index.html` in your web browser.**

No special setup or server is required.

### Adding Members

1.  **Individually:** Use the "Add New Member" form on the left column to input member details (Name, Club Base, Join Date, and optional Leave Date).
2.  **Bulk Upload:**
    *   Click "Browse Files" or drag and drop your Excel/CSV file into the designated area.
    *   Ensure your file follows the expected format:
        *   **Column A:** Member Name (e.g., John Doe)
        *   **Column B:** Join Date (YYYY-MM-DD format)
        *   **Column C:** Club Base (Community-Based or University-Based)
        *   **Column D:** Leave Date (YYYY-MM-DD format, leave blank if still active)
    *   Templates are provided for your convenience. You can either **download a CSV template** for offline use or **make a copy of the Google Sheets template** for easy online collaboration.

### Invoice Summary

*   Select the desired "Invoice of January" year.
*   Adjust the "Tax Percentage (%)" as needed.
*   The "Base RI Dues" and "Total with Tax" will update in real-time.
*   View a breakdown of full-year and prorated dues, as well as total members and prorated months.

### Member Roster

*   All added members will be listed in the "Member Roster" table.
*   You can edit member details by clicking the edit button next to each member.
*   Remove members using the delete button.
*   Use the "Reset Roster" button to clear all members from the list.

## Contributing

Contributions are welcome! Please follow these steps to contribute:

1.  Fork the repository.
2.  Create a new branch (`git checkout -b feature/your-feature-name`).
3.  Make your changes.
4.  Commit your changes (`git commit -m 'Add some feature'`).
5.  Push to the branch (`git push origin feature/your-feature-name`).
6.  Open a pull request.

## Disclaimer

All calculations are indicative estimates. Actual figures may vary based on various factors including but not limited to variation in data and RI Policies.

## Contact

PDRR Arun Teja Godavarthi
rotaract3191drr@gmail.com

## Copyright

© 2025 Rotaract South Asia MDIO. All rights reserved.