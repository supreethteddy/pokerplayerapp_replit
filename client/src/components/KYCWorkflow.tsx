import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Upload, FileText, Camera, CreditCard } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface KYCWorkflowProps {
  playerData: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    kycStatus: string;
  };
  onComplete: () => void;
}

export default function KYCWorkflow({ playerData, onComplete }: KYCWorkflowProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState({
    governmentId: false,
    utilityBill: false,
    profilePhoto: false
  });
  const { toast } = useToast();

  useEffect(() => {
    // Check existing KYC documents
    const checkExistingDocs = async () => {
      try {
        const response = await fetch(`/api/documents/player/${playerData.id}`);
        if (response.ok) {
          const docs = await response.json();
          setUploadedDocs({
            governmentId: docs.some((doc: any) => doc.document_type === 'government_id'),
            utilityBill: docs.some((doc: any) => doc.document_type === 'utility_bill'),
            profilePhoto: docs.some((doc: any) => doc.document_type === 'profile_photo')
          });
        }
      } catch (error) {
        console.error('Error checking existing documents:', error);
      }
    };

    checkExistingDocs();
  }, [playerData.id]);

  const handleFileUpload = async (documentType: string, file: File) => {
    if (!file) return;

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUrl = event.target?.result as string;
        
        const response = await apiRequest('POST', '/api/documents/upload', {
          playerId: playerData.id,
          documentType,
          fileName: file.name,
          fileData: dataUrl,
          fileSize: file.size,
          mimeType: file.type
        });

        if (response.ok) {
          setUploadedDocs(prev => ({
            ...prev,
            [documentType === 'government_id' ? 'governmentId' : 
             documentType === 'utility_bill' ? 'utilityBill' : 'profilePhoto']: true
          }));

          toast({
            title: "Document Uploaded",
            description: `${documentType.replace('_', ' ')} uploaded successfully!`,
          });

          // Auto-progress to next step if this step is complete
          if (currentStep === 1 && documentType === 'government_id') {
            setTimeout(() => setCurrentStep(2), 1000);
          } else if (currentStep === 2 && documentType === 'utility_bill') {
            setTimeout(() => setCurrentStep(3), 1000);
          } else if (currentStep === 3 && documentType === 'profile_photo') {
            setTimeout(() => setCurrentStep(4), 1000);
          }
        }
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload document",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const submitKYC = async () => {
    try {
      setUploading(true);
      
      // Send KYC submission notification to admin
      const response = await apiRequest('POST', '/api/kyc/submit', {
        playerId: playerData.id,
        email: playerData.email,
        firstName: playerData.firstName,
        lastName: playerData.lastName
      });

      if (response.ok) {
        toast({
          title: "KYC Submitted!",
          description: "Your documents have been submitted for review.",
        });
        
        // Send confirmation email with KYC submission notice
        await fetch('/api/auth/send-welcome-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: playerData.email,
            firstName: playerData.firstName
          })
        });
        
        // Log KYC submission activity
        await fetch('/api/auth/log-activity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'kyc_submission',
            email: playerData.email,
            userId: playerData.id,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent
          })
        });

        setCurrentStep(5); // Move to thank you page
        setTimeout(() => {
          onComplete();
        }, 3000);
      }
    } catch (error: any) {
      toast({
        title: "Submission Failed",
        description: error.message || "Failed to submit KYC documents",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const getProgressPercentage = () => {
    const completed = Object.values(uploadedDocs).filter(Boolean).length;
    return (completed / 3) * 100;
  };

  if (currentStep === 5) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-gray-900 border-gray-700 text-center">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <CheckCircle className="w-16 h-16 text-green-500" />
            </div>
            <CardTitle className="text-white text-xl">
              Thank You for Registering!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-300">
              Your KYC documents have been submitted successfully.
            </p>
            <p className="text-gray-400 text-sm">
              You will receive an email notification once your account is approved by our team.
            </p>
            <div className="animate-pulse">
              <p className="text-blue-400 text-sm">
                Redirecting to login...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl bg-gray-900 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white text-xl flex items-center">
            <FileText className="w-6 h-6 mr-2 text-blue-500" />
            KYC Document Upload
          </CardTitle>
          <div className="space-y-2">
            <Progress value={getProgressPercentage()} className="w-full" />
            <p className="text-sm text-gray-400">
              Step {currentStep} of 4 - Please upload all required documents
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Government ID Upload */}
          <div className={`p-4 rounded-lg border ${uploadedDocs.governmentId ? 'border-green-500 bg-green-900/20' : 'border-gray-600 bg-gray-800'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center">
                <CreditCard className="w-5 h-5 mr-2 text-blue-500" />
                <Label className="text-white font-medium">Government ID</Label>
              </div>
              {uploadedDocs.governmentId && <CheckCircle className="w-5 h-5 text-green-500" />}
            </div>
            <p className="text-sm text-gray-400 mb-3">
              Upload your Aadhaar Card, PAN Card, or Passport
            </p>
            <Input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload('government_id', file);
              }}
              disabled={uploading || uploadedDocs.governmentId}
              className="bg-gray-700 border-gray-600 text-white"
            />
          </div>

          {/* Utility Bill Upload */}
          <div className={`p-4 rounded-lg border ${uploadedDocs.utilityBill ? 'border-green-500 bg-green-900/20' : 'border-gray-600 bg-gray-800'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center">
                <FileText className="w-5 h-5 mr-2 text-blue-500" />
                <Label className="text-white font-medium">Address Proof</Label>
              </div>
              {uploadedDocs.utilityBill && <CheckCircle className="w-5 h-5 text-green-500" />}
            </div>
            <p className="text-sm text-gray-400 mb-3">
              Upload utility bill, bank statement, or rental agreement
            </p>
            <Input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload('utility_bill', file);
              }}
              disabled={uploading || uploadedDocs.utilityBill}
              className="bg-gray-700 border-gray-600 text-white"
            />
          </div>

          {/* Profile Photo Upload */}
          <div className={`p-4 rounded-lg border ${uploadedDocs.profilePhoto ? 'border-green-500 bg-green-900/20' : 'border-gray-600 bg-gray-800'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center">
                <Camera className="w-5 h-5 mr-2 text-blue-500" />
                <Label className="text-white font-medium">Profile Photo</Label>
              </div>
              {uploadedDocs.profilePhoto && <CheckCircle className="w-5 h-5 text-green-500" />}
            </div>
            <p className="text-sm text-gray-400 mb-3">
              Upload a clear photo of yourself
            </p>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload('profile_photo', file);
              }}
              disabled={uploading || uploadedDocs.profilePhoto}
              className="bg-gray-700 border-gray-600 text-white"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-4">
            <Button
              onClick={submitKYC}
              disabled={!Object.values(uploadedDocs).every(Boolean) || uploading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12"
            >
              {uploading ? (
                <>
                  <Upload className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Submit KYC Documents
                </>
              )}
            </Button>
          </div>

          <p className="text-xs text-gray-500 text-center">
            All documents are encrypted and stored securely. You'll receive an email once approved.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}