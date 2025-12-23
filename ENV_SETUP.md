# Environment Variables Setup Guide

## ✅ Environment Files Created

I've created two files for you:

1. **`.env`** - Your actual environment configuration (already created with defaults)
2. **`.env.template`** - Template file for reference (safe to commit to git)

## 📋 Current Configuration

The `.env` file has been created with:

### ✅ Already Configured
- **VITE_API_BASE_URL** - Set to `http://localhost:3000/api` (your backend)
- **VITE_SUPABASE_URL** - Pre-filled with your existing Supabase URL
- **VITE_SUPABASE_ANON_KEY** - Pre-filled with your existing Supabase key
- **VITE_PUSHER_CLUSTER** - Set to `ap2` (default)

### ⚠️ Needs Configuration
- **VITE_PUSHER_KEY** - Empty (fill in if you use Pusher for real-time features)

## 🔧 Configuration Steps

### 1. Backend API URL

The most important variable for the new API integration:

```env
VITE_API_BASE_URL=http://localhost:3000/api
```

**For local development:**
- Make sure your NestJS backend is running on port 3000
- The API will be accessible at `http://localhost:3000/api`

**For production:**
```env
VITE_API_BASE_URL=https://api.yourpokerclub.com/api
```

### 2. Supabase (Already Configured)

Your Supabase credentials are already in the `.env` file from your existing configuration. No changes needed unless you want to use a different project.

### 3. Pusher (Optional)

If you're using Pusher for real-time features:

1. Go to [Pusher Dashboard](https://dashboard.pusher.com/)
2. Get your API key
3. Add it to `.env`:
   ```env
   VITE_PUSHER_KEY=your_actual_pusher_key_here
   ```

## 🚀 After Configuration

### Restart Dev Server

After creating or modifying `.env`, you **must restart** your Vite dev server:

```bash
# Stop the current server (Ctrl+C)
# Then restart
npm run dev
```

Vite only reads environment variables at startup, so changes won't take effect until you restart.

## ✅ Verify Configuration

You can verify your environment variables are loaded correctly:

1. Open browser console
2. Check the API config:
   ```javascript
   // In browser console
   console.log(import.meta.env.VITE_API_BASE_URL);
   ```

Or check the network tab when making API calls - the requests should go to your configured backend URL.

## 📝 Environment Variables Reference

| Variable | Purpose | Required | Default |
|----------|---------|----------|---------|
| `VITE_API_BASE_URL` | Backend API URL | ✅ Yes | `http://localhost:3000/api` |
| `VITE_SUPABASE_URL` | Supabase project URL | ✅ Yes | (from code) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key | ✅ Yes | (from code) |
| `VITE_PUSHER_KEY` | Pusher API key | ⚠️ Optional | (empty) |
| `VITE_PUSHER_CLUSTER` | Pusher cluster | ⚠️ Optional | `ap2` |
| `VITE_APP_NAME` | App name | ⚠️ Optional | `Poker Player Portal` |

## 🔒 Security Notes

- ✅ `.env` is in `.gitignore` - your secrets won't be committed
- ✅ `.env.template` is safe to commit (no real values)
- ⚠️ Never commit `.env` to version control
- ⚠️ Use different values for development and production

## 🐛 Troubleshooting

### Issue: API calls failing with CORS errors

**Solution:** Make sure your backend has CORS enabled:
```typescript
// In backend main.ts
app.enableCors({
  origin: 'http://localhost:5173', // Your Vite dev server
  credentials: true,
});
```

### Issue: Environment variables not loading

**Solution:**
1. Make sure file is named exactly `.env` (not `.env.local` or `.env.development`)
2. Restart your dev server after changes
3. Variables must start with `VITE_` to be exposed to the client

### Issue: Backend not found

**Solution:**
1. Verify backend is running: `curl http://localhost:3000/api`
2. Check `VITE_API_BASE_URL` in `.env`
3. Restart frontend dev server

## 📚 Related Documentation

- **API Integration Guide:** `PLAYER_PORTAL_API_INTEGRATION_COMPLETE.md`
- **Quick Reference:** `API_QUICK_REFERENCE.md`
- **Testing Guide:** `TESTING_GUIDE.md`

---

**Status:** ✅ `.env` file created and configured  
**Next Step:** Restart your dev server to load the new configuration!






