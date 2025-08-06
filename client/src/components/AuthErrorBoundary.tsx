import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, Shield } from 'lucide-react';
import AuthLayout from './AuthLayout';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class AuthErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Check if this is a Clerk key error
    if (error.message.includes('publishableKey') || error.message.includes('Clerk')) {
      return { hasError: true, error };
    }
    return { hasError: false };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Auth Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-slate-800 border-slate-700">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <AlertTriangle className="w-12 h-12 text-amber-500" />
              </div>
              <CardTitle className="text-white">Authentication System</CardTitle>
              <p className="text-slate-400 text-sm">
                Clerk key mismatch detected - Expected: pk_test_c3RhYmxlLWJ1bm55... but found old key
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-slate-700 p-4 rounded-lg border border-slate-600">
                <div className="flex items-center gap-3 mb-3">
                  <Shield className="w-5 h-5 text-emerald-500" />
                  <span className="text-white font-medium">Available Options</span>
                </div>
                <ul className="text-slate-300 text-sm space-y-2">
                  <li>• Email & Password Authentication</li>
                  <li>• Secure KYC Document Upload</li>
                  <li>• Real-time Chat System</li>
                  <li>• Player Dashboard & Waitlist</li>
                </ul>
              </div>
              
              <Button 
                onClick={() => {
                  this.setState({ hasError: false });
                  // Redirect to use legacy auth directly
                  window.location.href = window.location.pathname + '?use_legacy=true';
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-700 flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Continue with Legacy Auth
              </Button>
              
              <p className="text-xs text-slate-500 text-center">
                Current key: {import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.substring(0, 20)}...<br/>
                Expected: pk_test_c3RhYmxlLWJ1bm55...<br/>
                Update VITE_CLERK_PUBLISHABLE_KEY to enable Clerk features.
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// Wrapper component that falls back to legacy auth on Clerk errors
export default function SafeAuthWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AuthErrorBoundary>
      {children}
    </AuthErrorBoundary>
  );
}