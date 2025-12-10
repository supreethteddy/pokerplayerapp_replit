# 📱 Capacitor Android APK Build Guide
## Complete Guide to Building APK for Poker Player App

---

## ✅ Prerequisites

Before building the APK, ensure you have:

1. **Java Development Kit (JDK) 17 or higher**
   ```bash
   java -version
   # Should show version 17 or higher
   ```

2. **Android Studio** (for Android SDK)
   - Download from: https://developer.android.com/studio
   - Install Android SDK (API Level 33+ recommended)
   - Set `ANDROID_HOME` environment variable

3. **Node.js and npm** (already installed)
   ```bash
   node -version
   npm -version
   ```

4. **Gradle** (usually comes with Android Studio, or install separately)

---

## 🚀 Quick Build Commands

### Build Debug APK (for testing)
```bash
npm run android:apk
```

This command will:
1. Build the web app (`npm run build`)
2. Sync with Capacitor (`npx cap sync android`)
3. Build the Android APK (`./gradlew assembleDebug`)

**Output Location:** `android/app/build/outputs/apk/debug/app-debug.apk`

### Build Release APK (for distribution)
```bash
npm run build
npx cap sync android
cd android
./gradlew assembleRelease
```

**Output Location:** `android/app/build/outputs/apk/release/app-release.apk`

---

## 📋 Step-by-Step Build Process

### Step 1: Build the Web App
```bash
npm run build
```
This creates optimized production files in the `dist` directory.

### Step 2: Sync with Capacitor
```bash
npx cap sync android
```
This copies the web assets to the Android project and updates native dependencies.

### Step 3: Build Android APK

#### Option A: Using Command Line (Recommended)
```bash
cd android
./gradlew assembleDebug
```

#### Option B: Using Android Studio
1. Open Android Studio
2. Open the `android` folder
3. Wait for Gradle sync to complete
4. Go to **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
5. Wait for build to complete
6. Click "locate" when build finishes

### Step 4: Find Your APK
- **Debug APK:** `android/app/build/outputs/apk/debug/app-debug.apk`
- **Release APK:** `android/app/build/outputs/apk/release/app-release.apk`

---

## 🔐 Signing APK for Release (Optional but Recommended)

### Create a Keystore
```bash
keytool -genkey -v -keystore poker-player-release.keystore -alias poker-player -keyalg RSA -keysize 2048 -validity 10000
```

### Configure Signing in `android/app/build.gradle`

Add this before the `android` block:
```gradle
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
```

Add this inside the `android` block:
```gradle
signingConfigs {
    release {
        if (keystorePropertiesFile.exists()) {
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
            storeFile file(keystoreProperties['storeFile'])
            storePassword keystoreProperties['storePassword']
        }
    }
}
```

Update the `release` buildType:
```gradle
buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled false
        proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
    }
}
```

### Create `android/keystore.properties`
```properties
storeFile=../poker-player-release.keystore
storePassword=YOUR_STORE_PASSWORD
keyAlias=poker-player
keyPassword=YOUR_KEY_PASSWORD
```

**⚠️ Important:** Add `keystore.properties` to `.gitignore` to keep credentials secure!

---

## 🛠️ Troubleshooting

### Issue: "Command not found: gradlew"
**Solution:** Make sure you're in the `android` directory and the file has execute permissions:
```bash
cd android
chmod +x gradlew
./gradlew assembleDebug
```

### Issue: "SDK location not found"
**Solution:** Set `ANDROID_HOME` environment variable:
```bash
# macOS/Linux
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/platform-tools

# Windows
set ANDROID_HOME=C:\Users\YourUsername\AppData\Local\Android\Sdk
set PATH=%PATH%;%ANDROID_HOME%\tools;%ANDROID_HOME%\platform-tools
```

### Issue: "Java version mismatch"
**Solution:** Ensure you're using JDK 17 or higher:
```bash
# Check Java version
java -version

# Set JAVA_HOME if needed
export JAVA_HOME=/path/to/jdk17
```

### Issue: Build fails with "OutOfMemoryError"
**Solution:** Increase Gradle memory in `android/gradle.properties`:
```properties
org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m
```

### Issue: "SDK Build Tools version mismatch"
**Solution:** Update Android SDK Build Tools:
```bash
# In Android Studio: Tools → SDK Manager → SDK Tools → Android SDK Build-Tools
# Or via command line:
sdkmanager "build-tools;33.0.0"
```

---

## 📱 Testing the APK

### Install on Device/Emulator

#### Using ADB (Android Debug Bridge)
```bash
# Connect device via USB and enable USB debugging
adb devices

# Install APK
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

#### Using Android Studio
1. Connect device or start emulator
2. Click **Run** button (green play icon)
3. Select device/emulator
4. App will install and launch automatically

---

## 🔄 Development Workflow

### 1. Make Changes to Web App
Edit files in `client/src/`

### 2. Rebuild and Sync
```bash
npm run build
npx cap sync android
```

### 3. Test in Android Studio
```bash
npm run android:open
```
This opens the Android project in Android Studio where you can run/debug.

---

## 📦 Package Scripts Reference

| Script | Description |
|--------|-------------|
| `npm run build` | Build web app for production |
| `npm run cap:sync` | Sync web assets to native platforms |
| `npm run cap:copy` | Copy web assets only |
| `npm run cap:update` | Update Capacitor dependencies |
| `npm run android:open` | Open Android project in Android Studio |
| `npm run android:sync` | Build web app and sync to Android |
| `npm run android:build` | Build debug APK |
| `npm run android:build:release` | Build release APK |
| `npm run android:apk` | Complete build process (build + sync + APK) |

---

## 🎯 Configuration Files

### Capacitor Config (`capacitor.config.ts`)
- App ID: `com.pokerplayer.app`
- App Name: `Poker Player App`
- Web Directory: `dist`

### Android Config (`android/app/build.gradle`)
- Package Name: `com.pokerplayer.app`
- Min SDK: 22 (Android 5.1)
- Target SDK: 34 (Android 14)
- Version Code: 1
- Version Name: "1.0"

---

## 📝 Important Notes

1. **Always sync after building:** Run `npx cap sync android` after `npm run build`
2. **Debug vs Release:** Debug APKs are larger but easier to test. Release APKs are optimized and signed.
3. **APK Size:** The initial APK may be large (~10-15MB) due to bundled assets. Consider code splitting for production.
4. **Permissions:** Check `AndroidManifest.xml` for required permissions (internet, network state, etc.)
5. **API Endpoints:** Ensure your API endpoints are accessible from mobile devices (use production URLs, not localhost)

---

## 🚀 Next Steps

1. **Test APK** on multiple devices/Android versions
2. **Optimize** app size and performance
3. **Set up CI/CD** for automated builds
4. **Publish to Google Play Store** (requires Google Play Developer account)

---

## 📚 Additional Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Android Developer Guide](https://developer.android.com/guide)
- [Gradle Build System](https://gradle.org/)
- [APK Signing Guide](https://developer.android.com/studio/publish/app-signing)

---

**Last Updated:** Based on Capacitor 8.0.0 and Android Gradle Plugin 8.13.0

