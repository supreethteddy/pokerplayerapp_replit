import { SignIn, SignedIn, SignedOut } from '@clerk/clerk-react';
import { Card, CardContent } from '@/components/ui/card';
import { Spade } from 'lucide-react';

export default function ClerkSignInPage() {
  return (
    <>
      <SignedOut>
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
          <div className="w-full max-w-md space-y-8">
            {/* Header */}
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center">
                  <Spade className="w-8 h-8 text-white" />
                </div>
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">Welcome Back</h1>
              <p className="text-slate-400">Sign in to your account</p>
            </div>

            {/* Clerk SignIn Component */}
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-6">
                <SignIn 
                  appearance={{
                    elements: {
                      rootBox: "w-full",
                      card: "bg-transparent shadow-none",
                      headerTitle: "text-white",
                      headerSubtitle: "text-slate-400",
                      socialButtonsBlockButton: "bg-slate-700 border-slate-600 text-white hover:bg-slate-600",
                      socialButtonsBlockButtonText: "text-white",
                      formFieldInput: "bg-slate-700 border-slate-600 text-white",
                      formFieldLabel: "text-slate-300",
                      formButtonPrimary: "bg-emerald-600 hover:bg-emerald-700",
                      footerActionLink: "text-emerald-400 hover:text-emerald-300",
                      dividerLine: "bg-slate-600",
                      dividerText: "text-slate-400"
                    }
                  }}
                  redirectUrl="/dashboard"
                  signUpUrl="/sign-up"
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </SignedOut>
      <SignedIn>
        {/* User is signed in, redirect will handle this */}
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
          <div className="text-white">Redirecting to dashboard...</div>
        </div>
      </SignedIn>
    </>
  );
}