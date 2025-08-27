# Rotaract Club Invoice Calculator

A modern, responsive web application for calculating club membership invoices with Firebase integration, real-time data synchronization, and comprehensive member management.

## Features

### Core Functionality
- **Member Management**: Add, edit, and manage club members with join/leave dates
- **Invoice Calculation**: Automatic calculation of prorated and full-year invoices
- **Tax Handling**: Configurable tax percentage with detailed breakdown
- **Currency Conversion**: Real-time currency rate conversion
- **Bulk Import**: Excel/CSV file upload for bulk member addition
- **PDF Export**: Generate professional invoice PDFs
- **Data Persistence**: Cloud storage with Firebase Firestore

### Performance Optimizations
- DOM caching for frequently accessed elements
- Event delegation for dynamic content
- Memory leak prevention
- Resource preloading
- Error handling with circuit breaker pattern
- Performance monitoring and analytics

### User Experience
- Responsive design for all devices
- Real-time calculations
- Progressive loading
- Offline capability
- Error recovery
- User-friendly feedback

## Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ClubInvoiceCalculator
   ```

2. **Deploy to Firebase Hosting**
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase init hosting
   firebase deploy
   ```

3. **Configure Firebase**
   - Update `firebase-config.js` with your Firebase project credentials
   - Enable Authentication and Firestore in Firebase Console
   - Set up security rules for Firestore

## Usage

### Adding Members
1. Click "Add Member" button
2. Fill in member details (name, join date, member type)
3. Click "Add" to save

### Bulk Import
1. Download the CSV template
2. Fill in member data
3. Upload the file
4. Review and confirm import

### Calculating Invoices
1. Set tax percentage and currency rate
2. Select invoice year
3. View automatic calculations
4. Download PDF invoice

### Data Management
- **Save to Cloud**: Login with Google account to save data
- **Load from Cloud**: Automatically loads saved data on login
- **Export Data**: Download CSV for backup

## Configuration

### Firebase Setup
```javascript
// firebase-config.js
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id",
  measurementId: "your-measurement-id"
};
```

### Security Rules
```javascript
// Firestore security rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /invoice_summaries/{docId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Performance

### Optimizations Implemented
- **DOM Caching**: Reduces query overhead
- **Event Delegation**: Efficient event handling
- **Memory Management**: Prevents memory leaks
- **Resource Preloading**: Faster loading times
- **Error Recovery**: Graceful failure handling

### Monitoring
- Firebase Analytics integration
- Performance metrics tracking
- Error logging and reporting
- User interaction analytics

## Security

### Content Security Policy
- Strict CSP implementation
- XSS protection
- Frame protection
- Resource restrictions

### Data Protection
- User authentication required
- Data isolation by user
- Secure Firebase rules
- Input validation and sanitization

## Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## Troubleshooting

### Common Issues

**Firebase Connection Issues**
- Check internet connection
- Verify Firebase configuration
- Ensure Firestore is enabled

**Performance Issues**
- Clear browser cache
- Close other tabs
- Check network connection

**Data Not Loading**
- Verify authentication
- Check Firestore permissions
- Refresh the page

### Error Recovery
- Automatic retry mechanism
- Graceful degradation
- User-friendly error messages
- Offline capability

## Support

For technical support or feature requests, please contact the development team.

## License

This project is licensed under the MIT License.

## newdev rebuild notes

- Local vendor libraries are placed under `newdev/vendor/` and referenced from HTML and the PDF worker.
- Minified assets are generated via `build_minify.py`. Run:

```
python3 newdev/build_minify.py
```

- Production HTML references `styles.min.css`, `app.min.js`, `modules/security.min.js`, `modules/calculations.min.js`, and `pdf-worker.min.js`.
- Tailwind is still loaded via CDN to preserve exact UI/UX. Consider migrating to a local Tailwind build to remove the CDN without changing classes.