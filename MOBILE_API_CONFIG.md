# Mobile API Configuration Guide

## 🔧 Setting API Base URL for Mobile Builds

The mobile app needs to know where your backend API is located. There are two ways to configure this:

### Method 1: Environment Variable (Recommended)

Create a `.env` file in the project root with:

```env
VITE_API_BASE_URL=https://your-production-api.com/api
```

**Important:** Replace `https://your-production-api.com/api` with your actual backend API URL.

### Method 2: Update Config File Directly

If you don't use environment variables, edit `client/src/lib/api/config.ts` and replace:

```typescript
return 'https://your-production-api.com/api';
```

With your actual production API URL.

## 📱 Current Configuration

The app automatically detects:
- **Web Development**: Uses `http://localhost:3000/api` if running on localhost
- **Mobile App**: Uses `VITE_API_BASE_URL` if set, otherwise falls back to the hardcoded URL in the config file
- **Production Web**: Uses the current origin + `/api`

## ✅ After Configuration

1. Rebuild the web app:
   ```bash
   npm run build
   ```

2. Sync with Capacitor:
   ```bash
   npx cap sync android
   ```

3. Rebuild the APK:
   ```bash
   cd android && ./gradlew assembleDebug
   ```

## 🔍 Verifying Configuration

To verify the API URL is set correctly:

1. Open the app on your device
2. Check the browser console (if using remote debugging)
3. Look for API calls - they should go to your configured URL

## ⚠️ Important Notes

- **HTTP vs HTTPS**: The app is configured to allow HTTP connections for development. For production, ensure your API uses HTTPS.
- **CORS**: Make sure your backend API allows requests from your mobile app's origin.
- **Network Security**: The Android app has network security config that allows cleartext traffic for development. Remove this for production builds.

