import { useState } from "react";
import { SignIn, SignUp, useSignIn, useSignUp, useClerk } from "@clerk/clerk-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function ClerkAuthInterface() {
  const [isSignUp, setIsSignUp] = useState(false);
  const { toast } = useToast();

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-800 border-slate-700">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-2xl">P</span>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-white mb-4">
            POKER ROOM PLAYER PORTAL
          </CardTitle>
          
          {/* Tab Navigation */}
          <div className="flex border-b border-slate-600 mb-6">
            <button
              onClick={() => setIsSignUp(false)}
              className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                !isSignUp
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setIsSignUp(true)}
              className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                isSignUp
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              Sign Up
            </button>
          </div>
        </CardHeader>

        <CardContent className="px-6">
          {isSignUp ? (
            <div className="clerk-sign-up">
              <SignUp 
                appearance={{
                  elements: {
                    rootBox: "w-full",
                    card: "bg-transparent shadow-none",
                    headerTitle: "text-white",
                    headerSubtitle: "text-slate-400",
                    formButtonPrimary: "bg-emerald-600 hover:bg-emerald-700 text-white",
                    formFieldInput: "bg-slate-700 border-slate-600 text-white",
                    formFieldLabel: "text-slate-300",
                    identityPreviewText: "text-slate-400",
                    formButtonReset: "text-emerald-400 hover:text-emerald-300",
                    dividerLine: "bg-slate-600",
                    dividerText: "text-slate-400",
                    socialButtonsBlockButton: "bg-slate-700 border-slate-600 text-white hover:bg-slate-600",
                    footerActionText: "text-slate-400",
                    footerActionLink: "text-emerald-400 hover:text-emerald-300",
                    formFieldSuccessText: "text-emerald-400"
                  }
                }}
                redirectUrl={`${window.location.origin}/dashboard`}
                afterSignUpUrl={`${window.location.origin}/dashboard`}
              />
            </div>
          ) : (
            <div className="clerk-sign-in">
              <SignIn 
                appearance={{
                  elements: {
                    rootBox: "w-full",
                    card: "bg-transparent shadow-none",
                    headerTitle: "text-white",
                    headerSubtitle: "text-slate-400", 
                    formButtonPrimary: "bg-emerald-600 hover:bg-emerald-700 text-white",
                    formFieldInput: "bg-slate-700 border-slate-600 text-white",
                    formFieldLabel: "text-slate-300",
                    identityPreviewText: "text-slate-400",
                    formButtonReset: "text-emerald-400 hover:text-emerald-300",
                    dividerLine: "bg-slate-600",
                    dividerText: "text-slate-400",
                    socialButtonsBlockButton: "bg-slate-700 border-slate-600 text-white hover:bg-slate-600",
                    footerActionText: "text-slate-400",
                    footerActionLink: "text-emerald-400 hover:text-emerald-300"
                  }
                }}
                redirectUrl={`${window.location.origin}/dashboard`}
                afterSignInUrl={`${window.location.origin}/dashboard`}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}