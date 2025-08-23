#!/bin/bash

# Production Deployment Script for Club Invoice Calculator
# This script automates the deployment process to Firebase Hosting

set -e

echo "🚀 Starting production deployment..."

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Installing..."
    npm install -g firebase-tools
fi

# Check if user is logged in to Firebase
if ! firebase projects:list &> /dev/null; then
    echo "🔐 Please login to Firebase..."
    firebase login
fi

# Initialize Firebase project if not already done
if [ ! -f "firebase.json" ]; then
    echo "📁 Initializing Firebase project..."
    firebase init hosting --public . --single-page-app true --yes
fi

# Build optimization (if Tailwind CSS is installed locally)
if [ -f "package.json" ] && grep -q "tailwindcss" package.json; then
    echo "🎨 Building optimized CSS..."
    npm install
    npx tailwindcss -i ./src/input.css -o ./dist/output.css --minify
fi

# Deploy to Firebase
echo "📤 Deploying to Firebase Hosting..."
firebase deploy --only hosting

echo "✅ Deployment completed successfully!"
echo "🌐 Your app is now live at: https://your-project-id.web.app"
echo ""
echo "📋 Next steps:"
echo "1. Update your domain in Firebase Console"
echo "2. Configure custom domain (optional)"
echo "3. Set up monitoring and analytics"
echo "4. Test all functionality in production"
