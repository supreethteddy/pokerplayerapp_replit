#!/bin/bash

# Poker Player App - APK Build Script
# This script builds the web app and generates an Android APK

set -e  # Exit on error

echo "🚀 Starting APK build process..."
echo ""

# Step 1: Build web app
echo "📦 Step 1: Building web app..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Web app build failed!"
    exit 1
fi

echo "✅ Web app built successfully!"
echo ""

# Step 2: Sync with Capacitor
echo "🔄 Step 2: Syncing with Capacitor..."
npx cap sync android

if [ $? -ne 0 ]; then
    echo "❌ Capacitor sync failed!"
    exit 1
fi

echo "✅ Capacitor sync completed!"
echo ""

# Step 3: Build Android APK
echo "🤖 Step 3: Building Android APK..."
cd android

# Make sure gradlew is executable
chmod +x gradlew

# Build debug APK
./gradlew assembleDebug

if [ $? -ne 0 ]; then
    echo "❌ APK build failed!"
    cd ..
    exit 1
fi

cd ..

echo ""
echo "✅ APK build completed successfully!"
echo ""
echo "📱 APK Location:"
echo "   Debug: android/app/build/outputs/apk/debug/app-debug.apk"
echo ""
echo "📋 To install on device:"
echo "   adb install android/app/build/outputs/apk/debug/app-debug.apk"
echo ""
echo "🎉 Done!"

