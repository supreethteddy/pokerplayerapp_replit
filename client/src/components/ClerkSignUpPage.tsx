import { SignUp } from '@clerk/clerk-react';

export default function ClerkSignUpPage() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Join LOCAL POKER CLUB</h1>
          <p className="text-slate-400">Create your secure account</p>
        </div>
        
        <SignUp 
          path="/sign-up"
          routing="path"
          signInUrl="/sign-in"
          afterSignUpUrl="/"
          appearance={{
            elements: {
              rootBox: 'w-full',
              card: 'bg-slate-800 border border-slate-700 text-white shadow-2xl',
              headerTitle: 'text-white text-xl',
              headerSubtitle: 'text-slate-400',
              socialButtonsBlockButton: 'bg-slate-700 hover:bg-slate-600 border-slate-600 text-white',
              formButtonPrimary: 'bg-emerald-600 hover:bg-emerald-700 text-white',
              formFieldInput: 'bg-slate-700 border-slate-600 text-white placeholder:text-slate-400',
              footerActionLink: 'text-emerald-400 hover:text-emerald-300',
              dividerLine: 'bg-slate-600',
              dividerText: 'text-slate-400',
              formFieldLabel: 'text-slate-300',
              identityPreviewText: 'text-slate-300',
              formResendCodeLink: 'text-emerald-400 hover:text-emerald-300'
            }
          }}
        />
      </div>
    </div>
  );
}