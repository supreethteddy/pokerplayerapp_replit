import { SignIn, SignUp, useUser } from '@clerk/clerk-react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spade, Shield, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent } from '@/components/ui/card';

export default function ClerkAuthLayout() {
  const { user: clerkUser } = useUser();
  const [showSignUp, setShowSignUp] = useState(false);
  const [showKycModal, setShowKycModal] = useState(false);
  const [kycForm, setKycForm] = useState({
    phone: '',
    loading: false
  });
  const [kycFiles, setKycFiles] = useState<{
    id: File | null;
    address: File | null;
    photo: File | null;
  }>({ id: null, address: null, photo: null });
  const { toast } = useToast();

  // Check if user needs KYC after Clerk authentication
  useEffect(() => {
    if (clerkUser) {
      checkKycStatus();
    }
  }, [clerkUser]);

  const checkKycStatus = async () => {
    try {
      const response = await fetch(`/api/clerk/kyc-status/${clerkUser?.id}`);
      const data = await response.json();
      if (data.requiresKyc) {
        setShowKycModal(true);
      }
    } catch (error) {
      console.error('Error checking KYC status:', error);
    }
  };

  const handleKycSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!kycForm.phone || !kycFiles.id || !kycFiles.address || !kycFiles.photo) {
      toast({
        title: "Missing Information",
        description: "Please fill all fields and upload all required documents",
        variant: "destructive",
      });
      return;
    }

    setKycForm(prev => ({ ...prev, loading: true }));

    try {
      // Upload KYC documents
      const formData = new FormData();
      formData.append('clerkUserId', clerkUser?.id || '');
      formData.append('phone', kycForm.phone);
      formData.append('id', kycFiles.id);
      formData.append('address', kycFiles.address);
      formData.append('photo', kycFiles.photo);

      const response = await fetch('/api/clerk/kyc-submit', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        toast({
          title: "KYC Submitted",
          description: "Your documents have been submitted for review. You'll be notified once approved.",
        });
        setShowKycModal(false);
      } else {
        throw new Error('KYC submission failed');
      }
    } catch (error) {
      console.error('KYC submission error:', error);
      toast({
        title: "Submission Error",
        description: "Failed to submit KYC documents. Please try again.",
        variant: "destructive",
      });
    } finally {
      setKycForm(prev => ({ ...prev, loading: false }));
    }
  };

  const handleFileChange = (type: 'id' | 'address' | 'photo', file: File | null) => {
    setKycFiles(prev => ({ ...prev, [type]: file }));
  };

  // Show KYC modal if user is authenticated but needs KYC
  if (clerkUser && showKycModal) {
    return (
      <Dialog open={showKycModal} onOpenChange={setShowKycModal}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-500" />
              Complete KYC Verification
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleKycSubmit} className="space-y-4">
            <div>
              <Label htmlFor="phone" className="text-slate-300">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={kycForm.phone}
                onChange={(e) => setKycForm(prev => ({ ...prev, phone: e.target.value }))}
                className="bg-slate-800 border-slate-600 text-white"
                placeholder="Enter your phone number"
                required
              />
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-slate-300">Government ID</Label>
                <Input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => handleFileChange('id', e.target.files?.[0] || null)}
                  className="bg-slate-800 border-slate-600 text-white"
                  required
                />
              </div>

              <div>
                <Label className="text-slate-300">Address Proof</Label>
                <Input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => handleFileChange('address', e.target.files?.[0] || null)}
                  className="bg-slate-800 border-slate-600 text-white"
                  required
                />
              </div>

              <div>
                <Label className="text-slate-300">Profile Photo</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange('photo', e.target.files?.[0] || null)}
                  className="bg-slate-800 border-slate-600 text-white"
                  required
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              disabled={kycForm.loading}
            >
              {kycForm.loading ? 'Submitting...' : 'Submit KYC Documents'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center">
              <Spade className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Welcome to Tilt</h1>
          <p className="text-slate-400">Professional Poker Room Platform</p>
        </div>

        {/* Auth Toggle */}
        <div className="flex bg-slate-800 rounded-lg p-1">
          <Button
            variant={!showSignUp ? "default" : "ghost"}
            className={`flex-1 ${!showSignUp ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
            onClick={() => setShowSignUp(false)}
          >
            Sign In
          </Button>
          <Button
            variant={showSignUp ? "default" : "ghost"}
            className={`flex-1 ${showSignUp ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
            onClick={() => setShowSignUp(true)}
          >
            Sign Up
          </Button>
        </div>

        {/* Clerk Auth Components */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-6">
            {showSignUp ? (
              <SignUp 
                appearance={{
                  elements: {
                    rootBox: "w-full",
                    card: "bg-transparent shadow-none",
                    headerTitle: "text-white",
                    headerSubtitle: "text-slate-400",
                    socialButtonsBlockButton: "bg-slate-700 border-slate-600 text-white hover:bg-slate-600",
                    formFieldInput: "bg-slate-700 border-slate-600 text-white",
                    formButtonPrimary: "bg-emerald-600 hover:bg-emerald-700",
                    footerActionLink: "text-emerald-400 hover:text-emerald-300"
                  }
                }}
                redirectUrl="/dashboard"
              />
            ) : (
              <SignIn 
                appearance={{
                  elements: {
                    rootBox: "w-full",
                    card: "bg-transparent shadow-none",
                    headerTitle: "text-white",
                    headerSubtitle: "text-slate-400",
                    socialButtonsBlockButton: "bg-slate-700 border-slate-600 text-white hover:bg-slate-600",
                    formFieldInput: "bg-slate-700 border-slate-600 text-white",
                    formButtonPrimary: "bg-emerald-600 hover:bg-emerald-700",
                    footerActionLink: "text-emerald-400 hover:text-emerald-300"
                  }
                }}
                redirectUrl="/dashboard"
              />
            )}
          </CardContent>
        </Card>

        {/* Features */}
        <div className="text-center text-slate-400 text-sm space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Shield className="w-4 h-4 text-emerald-500" />
            <span>Secure Authentication with Google Sign-in</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <Clock className="w-4 h-4 text-emerald-500" />
            <span>Quick KYC Verification Process</span>
          </div>
        </div>
      </div>
    </div>
  );
}