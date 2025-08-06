import { useState } from "react";
import { SignIn, useSignIn, useAuth } from "@clerk/clerk-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ClerkSignInPage() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const { isSignedIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-emerald-500" />
          <p className="text-white">Loading sign-in...</p>
        </div>
      </div>
    );
  }

  if (isSignedIn) {
    // Redirect will be handled by the parent component
    return null;
  }

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signIn || !setActive) return;

    setLoading(true);
    try {
      const result = await signIn.create({
        identifier: email,
        password,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        toast({
          title: "Welcome back!",
          description: "You've been signed in successfully.",
        });
      } else {
        console.error("Sign-in incomplete:", result);
        toast({
          title: "Sign-in incomplete",
          description: "Please check your credentials and try again.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      console.error("Sign-in error:", err);
      toast({
        title: "Sign-in failed",
        description: err.errors?.[0]?.message || "Invalid email or password.",
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-800 border-slate-700">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-white">
            Sign In to Poker Club
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Custom Email/Password Form */}
          <form onSubmit={handleEmailSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-slate-700 border-slate-600 text-white"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 bg-slate-700 border-slate-600 text-white"
                  placeholder="Enter your password"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          {/* Clerk's pre-built SignIn component as fallback */}
          <div className="border-t border-slate-700 pt-6">
            <p className="text-slate-400 text-sm text-center mb-4">
              Or use advanced sign-in options:
            </p>
            <SignIn
              appearance={{
                baseTheme: "dark",
                elements: {
                  formButtonPrimary: "bg-emerald-600 hover:bg-emerald-700",
                  card: "bg-slate-800 border-slate-700",
                  headerTitle: "text-white",
                  headerSubtitle: "text-slate-400",
                },
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}