# Google OAuth Setup Guide for Supabase

## Current Status
- ✅ Google authentication button is implemented and ready
- ❌ Supabase Google OAuth provider needs configuration

## Required Supabase Configuration

### Step 1: Configure Google OAuth in Supabase Dashboard

1. Go to your Supabase project dashboard: https://supabase.com/dashboard/project/oyhnpnymlezjusnwpjeu
2. Navigate to **Authentication** → **Providers**
3. Find **Google** provider and click **Configure**

### Step 2: Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API (if not already enabled)
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client IDs**
5. Set **Application type**: Web application
6. Add **Authorized redirect URIs**:
   ```
   https://oyhnpnymlezjusnwpjeu.supabase.co/auth/v1/callback
   ```

### Step 3: Copy Credentials to Supabase

1. Copy **Client ID** and **Client Secret** from Google Cloud Console
2. Paste them in Supabase Google provider configuration
3. Save the configuration

### Step 4: Test Google Authentication

Once configured, users can:
- Click "Log In with Google" or "Sign Up with Google"
- Complete OAuth flow with Google
- Automatically get created in the players table
- Access the dashboard immediately

## Current Implementation Details

- ✅ Supabase OAuth integration ready
- ✅ Automatic user creation in players table
- ✅ Proper error handling and user feedback
- ✅ Loading states during authentication
- ✅ Redirect to dashboard on success

## Technical Notes

The Google authentication flow:
1. User clicks Google button
2. Redirects to Google OAuth
3. Google redirects back to Supabase
4. Supabase creates auth.users record
5. Our system automatically creates players record
6. User lands on dashboard with full access

After configuration, Google authentication will work seamlessly alongside email/password authentication.