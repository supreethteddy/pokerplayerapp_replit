import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Spade, Upload, Shield, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import tiltRoomLogo from "@assets/1_1752926810964.png";

export default function AuthLayout() {
  const { signIn, signUp, signupCooldown } = useAuth();
  const { toast } = useToast();
  const [loginForm, setLoginForm] = useState({ email: "", password: "", loading: false });
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
  const [isSubmittingKyc, setIsSubmittingKyc] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!loginForm.email || !loginForm.password) {
      toast({
        title: "Missing Information",
        description: "Please enter both email and password",
        variant: "destructive",
      });
      return;
    }

    setLoginForm(prev => ({ ...prev, loading: true }));

    try {
      const result = await signIn(loginForm.email, loginForm.password);
      if (result.success) {
        sessionStorage.setItem('just_signed_in', 'true');
        setLoginForm({ email: "", password: "", loading: false });
      }
    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: "Login Error",
        description: "Unable to sign in. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoginForm(prev => ({ ...prev, loading: false }));
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

    try {
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
        setSignupForm({
          email: "",
          password: "",
          firstName: "",
          lastName: "",
          phone: "",
          agreeTerms: false,
        });
        toast({
          title: "Account Created",
          description: "Please complete KYC verification",
        });
      }
    } catch (error) {
      console.error('Signup error:', error);
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

    setIsSubmittingKyc(true);

    try {
      const userResponse = await apiRequest('GET', '/api/user');
      if (!userResponse.ok) {
        throw new Error('Failed to get user data');
      }
      const player = await userResponse.json();

      if (player?.id) {
        const existingDocsResponse = await apiRequest('GET', `/api/kyc-documents/player/${player.id}`);
        const existingDocs = await existingDocsResponse.json();
        if (existingDocs.length > 0) {
          toast({
            title: "Documents Already Submitted",
            description: "Your KYC documents have already been submitted",
          });
          setShowKycModal(false);
          return;
        }
      }
      
      const convertFileToDataUrl = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            resolve(dataUrl);
          };
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(file);
        });
      };

      const [idDataUrl, addressDataUrl, photoDataUrl] = await Promise.all([
        convertFileToDataUrl(id),
        convertFileToDataUrl(address),
        convertFileToDataUrl(photo)
      ]);

      const kycData = [
        { playerId: player.id, documentType: "government_id", fileName: id.name, dataUrl: idDataUrl },
        { playerId: player.id, documentType: "utility_bill", fileName: address.name, dataUrl: addressDataUrl },
        { playerId: player.id, documentType: "profile_photo", fileName: photo.name, dataUrl: photoDataUrl },
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
    } finally {
      setIsSubmittingKyc(false);
    }
  };

  const validateFileType = (file: File): boolean => {
    const allowedTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'application/pdf'
    ];
    
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.pdf'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    return allowedTypes.includes(file.type) && allowedExtensions.includes(fileExtension);
  };

  const validateFileSize = (file: File): boolean => {
    const maxSize = 5 * 1024 * 1024; // 5MB
    return file.size <= maxSize;
  };

  const handleFileUpload = (type: 'id' | 'address' | 'photo') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!validateFileType(file)) {
        toast({
          title: "Invalid File Type",
          description: "Please upload JPG, PNG, or PDF files only",
          variant: "destructive",
        });
        e.target.value = '';
        return;
      }

      if (!validateFileSize(file)) {
        toast({
          title: "File Too Large",
          description: "File size must be less than 5MB",
          variant: "destructive",
        });
        e.target.value = '';
        return;
      }

      setKycFiles(prev => ({ ...prev, [type]: file }));
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Tilt Logo Background Header */}
      <div 
        className="relative w-full h-48 bg-center bg-cover bg-no-repeat"
        style={{
          backgroundImage: `url(${tiltRoomLogo})`,
          backgroundSize: 'contain',
          backgroundPosition: 'center'
        }}
      >
        <div className="absolute inset-0 bg-black bg-opacity-60"></div>

      </div>

      {/* Login Content */}
      <div className="flex-1 flex items-center justify-center p-4 bg-black">
        <div className="max-w-md w-full">
          <Card className="bg-gray-900 border-gray-800 shadow-2xl">
            <CardContent className="pt-6">
              <h2 className="text-xl font-semibold mb-6 text-center text-white">Sign In</h2>
              
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <Label htmlFor="email" className="text-gray-300">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm(prev => ({ ...prev, email: e.target.value }))}
                    className="bg-black border-gray-700 text-white placeholder-gray-500 focus:border-gray-500"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="password" className="text-gray-300">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                    className="bg-black border-gray-700 text-white placeholder-gray-500 focus:border-gray-500"
                    required
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-gray-800 hover:bg-gray-700 text-white border border-gray-600"
                  disabled={loginForm.loading}
                >
                  {loginForm.loading ? "Signing In..." : "Sign In"}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-gray-400">Don't have an account?</p>
                <Button 
                  variant="link" 
                  onClick={() => setShowSignupModal(true)}
                  className="text-gray-300 hover:text-white font-medium mt-1"
                >
                  Create Player Account
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Signup Modal */}
      <Dialog open={showSignupModal} onOpenChange={setShowSignupModal}>
        <DialogContent className="bg-gray-900 border-gray-800">
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
                placeholder="Create a password"
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
                onCheckedChange={(checked) => setSignupForm(prev => ({ ...prev, agreeTerms: !!checked }))}
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
                    <p className="text-xs text-slate-500 mb-1">{description}</p>
                    <p className="text-xs text-slate-400 mb-2">Allowed: JPG, PNG, PDF (max 5MB)</p>
                    <Input
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf"
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

              <Button 
                type="submit" 
                className="w-full bg-emerald-500 hover:bg-emerald-600"
                disabled={isSubmittingKyc}
              >
                {isSubmittingKyc ? "Submitting..." : "Submit Documents"}
              </Button>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}