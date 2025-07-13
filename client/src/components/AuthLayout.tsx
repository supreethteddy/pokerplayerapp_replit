import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Spade, Upload, Shield, Clock, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function AuthLayout() {
  const { signIn, signUp, signupCooldown } = useAuth();
  const { toast } = useToast();
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [signupForm, setSignupForm] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    phone: "",
    agreeTerms: false,
  });
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [showKycModal, setShowKycModal] = useState(false);
  const [kycFiles, setKycFiles] = useState<{
    id: File | null;
    address: File | null;
    photo: File | null;
  }>({ id: null, address: null, photo: null });

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await signIn(loginForm.email, loginForm.password);
    if (result.success) {
      // Redirect will be handled by auth state change
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!signupForm.agreeTerms) {
      toast({
        title: "Terms Required",
        description: "Please agree to the Terms of Service",
        variant: "destructive",
      });
      return;
    }

    const result = await signUp(
      signupForm.email,
      signupForm.password,
      signupForm.firstName,
      signupForm.lastName,
      signupForm.phone
    );

    if (result.success) {
      setShowSignupModal(false);
      setShowKycModal(true);
    } else {
      // Reset form on failure to allow user to try again
      setSignupForm(prev => ({ ...prev, password: "" }));
    }
  };

  const handleKycSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { id, address, photo } = kycFiles;
    if (!id || !address || !photo) {
      toast({
        title: "Missing Documents",
        description: "Please upload all required documents",
        variant: "destructive",
      });
      return;
    }

    try {
      // Get the currently signed up player by email
      const playerResponse = await apiRequest('GET', `/api/players/email/${signupForm.email}`);
      const player = await playerResponse.json();
      
      // In a real implementation, you would upload files to Supabase storage
      // and save the URLs to the database
      const kycData = [
        { playerId: player.id, documentType: "id", fileName: id.name, fileUrl: `/uploads/${id.name}` },
        { playerId: player.id, documentType: "address", fileName: address.name, fileUrl: `/uploads/${address.name}` },
        { playerId: player.id, documentType: "photo", fileName: photo.name, fileUrl: `/uploads/${photo.name}` },
      ];

      for (const doc of kycData) {
        await apiRequest('POST', '/api/kyc-documents', doc);
      }

      toast({
        title: "KYC Submitted",
        description: "Your documents have been submitted for review",
      });

      setShowKycModal(false);
    } catch (error) {
      console.error('KYC submission error:', error);
      toast({
        title: "Submission Failed",
        description: "Failed to submit KYC documents",
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = (type: 'id' | 'address' | 'photo') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setKycFiles(prev => ({ ...prev, [type]: file }));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Spade className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Poker Room</h1>
          <p className="text-slate-400">Player Portal</p>
        </div>

        {/* Login Form */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="pt-6">
            <h2 className="text-xl font-semibold mb-6 text-center">Sign In</h2>
            
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <Label htmlFor="email" className="text-slate-300">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm(prev => ({ ...prev, email: e.target.value }))}
                  className="bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="password" className="text-slate-300">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                  className="bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                  required
                />
              </div>

              <Button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600">
                Sign In
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-slate-400">Don't have an account?</p>
              <Button 
                variant="link" 
                onClick={() => setShowSignupModal(true)}
                className="text-emerald-500 hover:text-emerald-400 font-medium mt-1"
              >
                Create Player Account
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Signup Modal */}
        <Dialog open={showSignupModal} onOpenChange={setShowSignupModal}>
          <DialogContent className="bg-slate-800 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-white">Create Player Account</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName" className="text-slate-300">First Name</Label>
                  <Input
                    id="firstName"
                    type="text"
                    placeholder="John"
                    value={signupForm.firstName}
                    onChange={(e) => setSignupForm(prev => ({ ...prev, firstName: e.target.value }))}
                    className="bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="lastName" className="text-slate-300">Last Name</Label>
                  <Input
                    id="lastName"
                    type="text"
                    placeholder="Doe"
                    value={signupForm.lastName}
                    onChange={(e) => setSignupForm(prev => ({ ...prev, lastName: e.target.value }))}
                    className="bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="signupEmail" className="text-slate-300">Email</Label>
                <Input
                  id="signupEmail"
                  type="email"
                  placeholder="john.doe@example.com"
                  value={signupForm.email}
                  onChange={(e) => setSignupForm(prev => ({ ...prev, email: e.target.value }))}
                  className="bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                  required
                />
              </div>

              <div>
                <Label htmlFor="phone" className="text-slate-300">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={signupForm.phone}
                  onChange={(e) => setSignupForm(prev => ({ ...prev, phone: e.target.value }))}
                  className="bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                  required
                />
              </div>

              <div>
                <Label htmlFor="signupPassword" className="text-slate-300">Password</Label>
                <Input
                  id="signupPassword"
                  type="password"
                  placeholder="Create password"
                  value={signupForm.password}
                  onChange={(e) => setSignupForm(prev => ({ ...prev, password: e.target.value }))}
                  className="bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                  required
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="agreeTerms"
                  checked={signupForm.agreeTerms}
                  onCheckedChange={(checked) => setSignupForm(prev => ({ ...prev, agreeTerms: checked as boolean }))}
                />
                <Label htmlFor="agreeTerms" className="text-sm text-slate-300">
                  I agree to the Terms of Service
                </Label>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-emerald-500 hover:bg-emerald-600"
                disabled={signupCooldown}
              >
                Create Account
              </Button>

              {signupCooldown && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-md">
                  <p className="text-sm text-amber-200 flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    Rate limit: 60 seconds between signup attempts
                  </p>
                </div>
              )}
            </form>
          </DialogContent>
        </Dialog>

        {/* KYC Modal */}
        <Dialog open={showKycModal} onOpenChange={setShowKycModal}>
          <DialogContent className="bg-slate-800 border-slate-700 max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-white">KYC Document Upload</DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-indigo-500" />
                </div>
                <p className="text-slate-300">Please upload the required documents to complete your registration</p>
              </div>

              <form onSubmit={handleKycSubmit} className="space-y-4">
                <div className="space-y-4">
                  {[
                    { type: 'id' as const, label: 'Photo ID', description: "Driver's License, Passport, etc." },
                    { type: 'address' as const, label: 'Proof of Address', description: 'Utility bill, bank statement, etc.' },
                    { type: 'photo' as const, label: 'Profile Photo', description: 'Clear photo of yourself' },
                  ].map(({ type, label, description }) => (
                    <div key={type} className="border-2 border-dashed border-slate-600 rounded-lg p-6 text-center hover:border-emerald-500 transition-colors">
                      <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm text-slate-300 mb-1">{label}</p>
                      <p className="text-xs text-slate-500 mb-2">{description}</p>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload(type)}
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                      {kycFiles[type] && (
                        <p className="text-xs text-emerald-400 mt-1">
                          Selected: {kycFiles[type]?.name}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                <Button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600">
                  Submit Documents
                </Button>
              </form>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
