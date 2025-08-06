[![Netlify Status](https://api.netlify.com/api/v1/badges/a55b4ac6-6b6f-4857-bb6b-aa526abc7081/deploy-status)](https://app.netlify.com/projects/rotaractdues/deploys)

# Rotaract Club Invoice Calculator

An interactive tool developed by Rotaract South Asia MDIO (RSAMDIO) to help Rotaractors estimate their Club Invoices with precision and ease.

## Features

*   **Easy to Use:** Simple and intuitive interface for quick calculations.
*   **Bulk Upload Support:** Upload member rosters via Excel (.xlsx, .xls) or CSV files for efficient processing.
*   **Real-time Calculations:** Instantly view estimated dues as you add or modify member information.
*   **Individual Member Management:** Add, edit, and remove individual members from the roster.
*   **Prorated Dues Calculation:** Accurately calculates prorated dues based on join and leave dates.
*   **Tax Configuration:** Allows users to input a tax percentage to see the total invoice amount including tax.

## Technologies Used

*   **HTML5**
*   **Tailwind CSS:** For a modern and responsive user interface.
*   **JavaScript (ES6+):** For all interactive functionalities and calculations.
*   **XLSX.js & PapaParse.js:** Libraries for handling Excel and CSV file parsing.

## Getting Started

To use this tool, simply open the `invoice.html` file in your web browser. No special setup or server is required.

### Adding Members

1.  **Individually:** Use the "Add New Member" form on the left column to input member details (Name, Club Base, Join Date, and optional Leave Date).
2.  **Bulk Upload:**
    *   Click "Browse Files" or drag and drop your Excel/CSV file into the designated area.
    *   Ensure your file follows the expected format:
        *   **Column A:** Member Name (e.g., John Doe)
        *   **Column B:** Join Date (YYYY-MM-DD format)
        *   **Column C:** Club Base (Community-Based or University-Based)
        *   **Column D:** Leave Date (YYYY-MM-DD format, leave blank if still active)
    *   A template CSV file can be downloaded for your convenience.

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

## Disclaimer

All calculations are indicative estimates. Actual figures may vary based on various factors including but not limited to variation in data and RI Policies.

## Contact

PDRR Arun Teja Godavarthi
rotaract3191drr@gmail.com

## Copyright

© 2025 Rotaract South Asia MDIO. All rights reserved.
