import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import * as jose from "https://deno.land/x/jose@v4.14.4/index.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const FIREBASE_SERVICE_ACCOUNT = Deno.env.get("FIREBASE_SERVICE_ACCOUNT") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Generate a Google OAuth2 Access Token using the Service Account JSON
 */
async function getAccessToken(serviceAccount: any) {
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const privateKey = await jose.importPKCS8(serviceAccount.private_key, "RS256");
  const jwt = await new jose.SignJWT(claim)
    .setProtectedHeader({ alg: "RS256" })
    .sign(privateKey);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const data = await res.json();
  if (data.error) {
    throw new Error(`Token exchange failed: ${data.error_description || data.error}`);
  }
  return data.access_token;
}

serve(async (req) => {
  // CORS handling
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey",
      },
    });
  }

  try {
    const { title, body, playerId, data } = await req.json();

    console.log(`🔔 [FCM v1] Preparing notification: "${title}" to player ${playerId || "ALL"}`);

    if (!FIREBASE_SERVICE_ACCOUNT) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT secret is not set.");
    }

    // 🔥 FIX: Sanitize the string to handle accidental wrapping quotes ('{}' or "{}")
    let rawConfig = FIREBASE_SERVICE_ACCOUNT.trim();
    if ((rawConfig.startsWith("'") && rawConfig.endsWith("'")) || (rawConfig.startsWith('"') && rawConfig.endsWith('"'))) {
      rawConfig = rawConfig.slice(1, -1);
    }
    
    // 🔥 FIX: Handle structural literal newlines/tabs that break JSON.parse
    // Replacing them with spaces preserves JSON structure and allows parsing.
    rawConfig = rawConfig.replace(/\r/g, ' ').replace(/\n/g, ' ').replace(/\t/g, ' ');

    const serviceAccount = JSON.parse(rawConfig);
    const PROJECT_ID = serviceAccount.project_id;

    // 1. Get OAuth2 Access Token
    const accessToken = await getAccessToken(serviceAccount);

    // 2. Fetch tokens from Supabase
    let query = supabase.from("device_tokens").select("token");
    if (playerId) {
      query = query.eq("player_id", playerId);
    }

    const { data: tokensData, error: tokensError } = await query;
    if (tokensError) throw tokensError;

    if (!tokensData || tokensData.length === 0) {
      console.log("ℹ️ [FCM v1] No registered devices found. Skipping.");
      return new Response(JSON.stringify({ success: true, message: "No devices found" }), { status: 200 });
    }

    const tokens = tokensData.map((t) => t.token);
    console.log(`📱 [FCM v1] Sending to ${tokens.length} devices.`);

    // 3. Send notifications via FCM v1
    // Note: FCM v1 handles one token per request. For bulk, you loop or use multicast if available (multicast is legacy).
    // In v1, it's recommended to send individually or use a loop.
    const results = await Promise.all(
      tokens.map(async (token) => {
        const fcmRes = await fetch(
          `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: {
                token: token,
                notification: {
                  title,
                  body,
                },
                data: data || {}, // Custom data must be strings
                android: {
                  priority: "high",
                  notification: {
                    sound: "default",
                    click_action: "OPEN_ACTIVITY_1"
                  }
                },
                apns: {
                  payload: {
                    aps: {
                      sound: "default",
                      badge: 1,
                    }
                  }
                }
              },
            }),
          }
        );
        return fcmRes.json();
      })
    );

    console.log(`✅ [FCM v1] Sent ${results.length} notifications.`);

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("❌ [FCM v1] Error:", error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
