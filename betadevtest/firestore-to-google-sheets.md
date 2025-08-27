# Worked _Note from Arun_GEMINI


# Pull Data from Firestore to Google Sheets using Google Apps Script

This guide explains how to pull data from a Firestore database to a Google Sheet using Google Apps Script.

This process involves using the Firestore REST API, as there is no native Firestore service in Apps Script. We will set up an OAuth2 flow to securely authenticate and fetch the data.

### **Step 1: Prerequisites**

Before writing any code, you need to configure your Google Cloud and Apps Script projects.

1.  **Get your Google Cloud Project ID:** Find the ID of the Google Cloud project that contains your Firestore database. You can find this on the [Google Cloud Console dashboard](https://console.cloud.google.com/home/dashboard).
2.  **Enable the Firestore API:** In your Google Cloud Project, ensure the **Cloud Firestore API** is enabled. You can enable it [here](https://console.cloud.google.com/apis/library/firestore.googleapis.com).
3.  **Create a Google Sheet and Apps Script Project:**
    *   Create a new Google Sheet.
    *   Go to **Extensions > Apps Script** to open the script editor.
4.  **Associate Apps Script with GCP Project:**
    *   In the Apps Script editor, click on **Project Settings** (the gear icon on the left).
    *   Under "Google Cloud Platform (GCP) Project", click on **Change project**.
    *   Enter your GCP Project Number and click **Set project**.
5.  **Create OAuth 2.0 Credentials:**
    *   Go to the [Credentials page](https://console.cloud.google.com/apis/credentials) in the Google Cloud Console.
    *   Click **+ CREATE CREDENTIALS** and select **OAuth client ID**.
    *   If prompted, configure the **OAuth consent screen**.
        *   Select **External** and click **CREATE**.
        *   Fill in the required fields (App name, User support email, Developer contact information).
        *   Click **SAVE AND CONTINUE** until you are back at the Credentials screen.
    *   For **Application type**, select **Web application**.
    *   Under **Authorized redirect URIs**, click **+ ADD URI**.
    *   In your Apps Script editor, go to **File > Project properties > Scopes** and copy the **Script ID**.
    *   The redirect URI is `https://script.google.com/macros/d/YOUR_SCRIPT_ID/usercallback`. Replace `YOUR_SCRIPT_ID` with the copied Script ID.
    *   Paste the full redirect URI into the Google Cloud Console and click **CREATE**.
    *   Copy the **Client ID** and **Client Secret**.
6.  **Add the OAuth2 for Apps Script Library:** This library simplifies the authentication process.
    *   In the Apps Script editor, click **Libraries** next to the "Files" list.
    *   In the "Add a library" field, paste this script ID: `1B7FSrk57A1B1Ld32V_YDI4cEHpF4U2oDiGPhGF259Q3LflOf2KFNGO_s`
    *   Click **Look up**.
    *   Select the latest version and click **Add**.

### **Step 2: The Apps Script Code**

Copy and paste the following code into the `Code.gs` file in your Apps Script editor.

```javascript
// ----------------- USER CONFIGURATION -----------------
// 1. Enter your Google Cloud Project ID.
const GCP_PROJECT_ID = 'your-gcp-project-id'; 

// 2. Enter the name of the Firestore collection you want to pull.
const FIRESTORE_COLLECTION = 'your-collection-name';

// 3. Enter the name of the sheet where data will be placed.
const SHEET_NAME = 'Sheet1'; 
// ----------------------------------------------------


/**
 * Creates a custom menu in the Google Sheet UI to run the script.
 */
function onOpen() {
  SpreadsheetApp.getUi()
      .createMenu('Firestore Sync')
      .addItem('Pull Data from Firestore', 'pullDataFromFirestore')
      .addToUi();
}

/**
 * Main function to orchestrate fetching data from Firestore and writing to the sheet.
 */
function pullDataFromFirestore() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) {
    SpreadsheetApp.getUi().alert(`Sheet "${SHEET_NAME}" not found.`);
    return;
  }

  const firestoreService = getFirestoreService();
  if (!firestoreService.hasAccess()) {
    SpreadsheetApp.getUi().alert('Authorization required. Please run the script again and grant permissions.');
    showAuthorizationDialog(firestoreService);
    return;
  }

  const firestoreApiUrl = `https://firestore.googleapis.com/v1/projects/${GCP_PROJECT_ID}/databases/(default)/documents/${FIRESTORE_COLLECTION}`;

  const options = {
    headers: {
      'Authorization': 'Bearer ' + firestoreService.getAccessToken()
    },
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(firestoreApiUrl, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    if (responseCode >= 200 && responseCode < 300) {
      const data = JSON.parse(responseBody);
      writeDataToSheet(sheet, data.documents);
      SpreadsheetApp.getUi().alert('Data successfully pulled from Firestore!');
    } else {
      throw new Error(`Error fetching data: ${responseCode} - ${responseBody}`);
    }
  } catch (e) {
    Logger.log(e);
    SpreadsheetApp.getUi().alert(`An error occurred: ${e.message}`);
  }
}

/**
 * Writes the formatted Firestore data into the specified Google Sheet.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet The sheet to write to.
 * @param {Array<Object>} documents The array of document objects from Firestore.
 */
function writeDataToSheet(sheet, documents) {
  if (!documents || documents.length === 0) {
    Logger.log('No documents found in the collection.');
    sheet.clear();
    sheet.getRange(1, 1).setValue('No documents found.');
    return;
  }

  // Extract headers from the fields of the first document
  const headers = Object.keys(documents[0].fields);
  
  // Prepare data rows for the sheet
  const rows = documents.map(doc => {
    return headers.map(header => {
      const field = doc.fields[header];
      // Firestore REST API wraps values in a type object (e.g., { stringValue: '...' })
      // This code extracts the actual value.
      if (field) {
        const valueType = Object.keys(field)[0];
        return field[valueType];
      }
      return ''; // Return empty string for missing fields
    });
  });

  // Clear previous content and write new data
  sheet.clear();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}


/**
 * Configures and returns an OAuth2 service for Firestore.
 * @return {Service} An OAuth2 service instance.
 */
function getFirestoreService() {
  // Enter your Client ID and Secret from the Google Cloud Console.
  const CLIENT_ID = 'YOUR_CLIENT_ID';
  const CLIENT_SECRET = 'YOUR_CLIENT_SECRET';

  return OAuth2.createService('Firestore')
      .setAuthorizationBaseUrl('https://accounts.google.com/o/oauth2/auth')
      .setTokenUrl('https://accounts.google.com/o/oauth2/token')
      .setClientId(CLIENT_ID)
      .setClientSecret(CLIENT_SECRET)
      .setCallbackFunction('authCallback')
      .setPropertyStore(PropertiesService.getUserProperties())
      .setScope([
        'https://www.googleapis.com/auth/datastore',
        'https://www.googleapis.com/auth/cloud-platform'
      ]);
}

/**
 * Handles the OAuth2 callback.
 * @param {Object} request The request object from the OAuth2 redirect.
 * @return {HtmlOutput} A success or failure message to display to the user.
 */
function authCallback(request) {
  const firestoreService = getFirestoreService();
  const isAuthorized = firestoreService.handleCallback(request);
  if (isAuthorized) {
    return HtmlService.createHtmlOutput('Success! You can close this tab and run the script again.');
  } else {
    return HtmlService.createHtmlOutput('Denied. You can close this tab and try again.');
  }
}

/**
 * Displays a dialog with the authorization URL.
 * @param {Service} service The OAuth2 service.
 */
function showAuthorizationDialog(service) {
  const authorizationUrl = service.getAuthorizationUrl();
  const template = HtmlService.createTemplate(
      '<p>Please <a href="<?= url ?>" target="_blank">authorize</a> the script to access your data. ' +
      'After authorizing, please run the script again.</p>');
  template.url = authorizationUrl;
  const htmlOutput = template.evaluate().setWidth(300).setHeight(100);
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Authorization Required');
}
```

### **Step 3: How to Run the Script**

1.  **Fill in Your Details:** In the `Code.gs` file, replace the placeholder values for `GCP_PROJECT_ID` and `FIRESTORE_COLLECTION` with your actual project ID and the name of the a collection you want to access.
2.  **Save and Refresh:** Save the script project. Then, reload your Google Sheet. A new menu item named **Firestore Sync** should appear.
3.  **First-Time Authorization:**
    *   Click **Firestore Sync > Pull Data from Firestore**.
    *   A dialog will pop up saying "Authorization Required". Click the **authorize** link.
    *   A new window will open. Choose your Google account.
    *   You may see a warning that "Google hasn't verified this app". Click **Advanced**, then click **Go to [Your Script Name] (unsafe)**.
    *   Review the permissions and click **Allow**.
    *   You will see a "Success!" message. You can now close that browser tab.
4.  **Run the Script Again:** Go back to your Google Sheet and click **Firestore Sync > Pull Data from Firestore** one more time. The script will now execute, fetch the data from your specified Firestore collection, and populate the sheet.

### **Important Considerations**

*   **Data Structure:** The script assumes all documents in your collection have a similar structure. It uses the fields from the *first* document to create the column headers.
*   **Data Types:** The code is designed to extract common data types like strings (`stringValue`), numbers (`integerValue`, `doubleValue`), and booleans (`booleanValue`). If you use more complex Firestore types like `mapValue` or `arrayValue`, you will need to add more sophisticated parsing logic inside the `writeDataToSheet` function.
*   **Permissions:** The user running the script must have at least "Cloud Datastore User" (read access) permissions for the Firestore database in the Google Cloud project.
*   **Quotas:** Be mindful of Google Cloud and Apps Script quotas. Frequent executions with large datasets might hit `UrlFetchApp` or Firestore read operation limits.
