import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Upload, FileText, Camera, CreditCard, Clock, User, FileCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
// Removed ObjectUploader - using existing Supabase document upload system

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
  const [submitting, setSubmitting] = useState(false);
  const [userDetails, setUserDetails] = useState({
    firstName: playerData.firstName || '',
    lastName: playerData.lastName || '',
    email: playerData.email || '',
    phone: '',
    panCard: '',
    address: ''
  });
  const [uploadedDocs, setUploadedDocs] = useState({
    governmentId: null as string | null,
    utilityBill: null as string | null,
    profilePhoto: null as string | null
  });
  const { toast } = useToast();

  useEffect(() => {
    // Determine the correct step based on KYC status and existing data
    const initializeStep = async () => {
      try {
        // Check player details completion
        const playerResponse = await fetch(`/api/players/${playerData.id}`);
        if (playerResponse.ok) {
          const player = await playerResponse.json();
          if (player.pan_card && player.phone && player.address) {
            setUserDetails(prev => ({
              ...prev,
              phone: player.phone || '',
              panCard: player.pan_card || '',
              address: player.address || ''
            }));
            
            // Check document uploads
            const docsResponse = await fetch(`/api/documents/player/${playerData.id}`);
            if (docsResponse.ok) {
              const docs = await docsResponse.json();
              const docStatus = {
                governmentId: docs.find((doc: any) => doc.document_type === 'government_id')?.file_url || null,
                utilityBill: docs.find((doc: any) => doc.document_type === 'utility_bill')?.file_url || null,
                profilePhoto: docs.find((doc: any) => doc.document_type === 'profile_photo')?.file_url || null
              };
              setUploadedDocs(docStatus);
              
              // Determine step based on status
              if (playerData.kycStatus === 'approved') {
                setCurrentStep(4); // Already approved
              } else if (playerData.kycStatus === 'submitted' || playerData.kycStatus === 'pending') {
                setCurrentStep(4); // Waiting for approval
              } else if (docStatus.governmentId && docStatus.utilityBill && docStatus.profilePhoto) {
                setCurrentStep(3); // Ready to submit
              } else if (player.pan_card && player.phone && player.address) {
                setCurrentStep(2); // Ready for document upload
              } else {
                setCurrentStep(1); // Need user details
              }
            }
          }
        }
      } catch (error) {
        console.error('Error initializing KYC step:', error);
        setCurrentStep(1);
      }
    };

    initializeStep();
  }, [playerData.id, playerData.kycStatus]);

  // Step 1: Save user details
  const saveUserDetails = async () => {
    try {
      setUploading(true);
      
      const response = await apiRequest('PUT', `/api/players/${playerData.id}`, {
        firstName: userDetails.firstName,
        lastName: userDetails.lastName,
        phone: userDetails.phone,
        panCard: userDetails.panCard,
        address: userDetails.address
      });

      if (response.ok) {
        toast({
          title: "Details Saved",
          description: "Your personal details have been saved successfully!",
        });
        setCurrentStep(2);
      } else {
        throw new Error('Failed to save details');
      }
    } catch (error: any) {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save user details",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  // Step 2: Handle document uploads using existing Supabase system
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
          const docKey = documentType === 'government_id' ? 'governmentId' : 
                        documentType === 'utility_bill' ? 'utilityBill' : 'profilePhoto';
          
          setUploadedDocs(prev => ({
            ...prev,
            [docKey]: 'uploaded'
          }));

          toast({
            title: "Document Uploaded",
            description: `${documentType.replace('_', ' ')} uploaded successfully!`,
          });

          // Check if all documents are uploaded
          const allDocsUploaded = Object.values({
            ...uploadedDocs,
            [docKey]: 'uploaded'
          }).every(doc => doc !== null);
          
          if (allDocsUploaded) {
            setTimeout(() => setCurrentStep(3), 1000);
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

  // Step 3: Submit KYC for review
  const submitKYC = async () => {
    try {
      setSubmitting(true);
      
      // Update player KYC status to submitted
      const response = await apiRequest('POST', '/api/kyc/submit', {
        playerId: playerData.id,
        email: userDetails.email,
        firstName: userDetails.firstName,
        lastName: userDetails.lastName
      });

      if (response.ok) {
        toast({
          title: "KYC Submitted Successfully!",
          description: "Your documents have been submitted for review. You'll receive an email confirmation.",
        });
        
        // Send Supabase email notification
        await fetch('/api/auth/kyc-submission-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: userDetails.email,
            firstName: userDetails.firstName,
            playerId: playerData.id
          })
        });
        
        setCurrentStep(4);
      }
    } catch (error: any) {
      toast({
        title: "Submission Failed",
        description: error.message || "Failed to submit KYC documents",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const updateUserDetail = (field: string, value: string) => {
    setUserDetails(prev => ({ ...prev, [field]: value }));
  };

  const getProgressPercentage = () => {
    return (currentStep / 4) * 100;
  };

  const isStep1Complete = () => {
    return userDetails.firstName && userDetails.lastName && userDetails.email && 
           userDetails.phone && userDetails.panCard && userDetails.address;
  };

  const isStep2Complete = () => {
    return uploadedDocs.governmentId && uploadedDocs.utilityBill && uploadedDocs.profilePhoto;
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl bg-gray-900 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white text-xl flex items-center">
            {currentStep === 1 && <User className="w-6 h-6 mr-2 text-blue-500" />}
            {currentStep === 2 && <Upload className="w-6 h-6 mr-2 text-green-500" />}
            {currentStep === 3 && <FileCheck className="w-6 h-6 mr-2 text-yellow-500" />}
            {currentStep === 4 && <Clock className="w-6 h-6 mr-2 text-purple-500" />}
            {currentStep === 1 && "Step 1: Personal Details"}
            {currentStep === 2 && "Step 2: Document Upload"}
            {currentStep === 3 && "Step 3: Submit KYC"}
            {currentStep === 4 && "Step 4: Awaiting Approval"}
          </CardTitle>
          <div className="space-y-2">
            <Progress value={getProgressPercentage()} className="w-full" />
            <p className="text-sm text-gray-400">
              Step {currentStep} of 4 - Complete KYC verification process
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Step 1: Personal Details */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white mb-4">Complete Your Personal Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-white">First Name *</Label>
                  <Input
                    value={userDetails.firstName}
                    onChange={(e) => updateUserDetail('firstName', e.target.value)}
                    className="bg-gray-800 border-gray-600 text-white"
                    placeholder="Enter your first name"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white">Last Name *</Label>
                  <Input
                    value={userDetails.lastName}
                    onChange={(e) => updateUserDetail('lastName', e.target.value)}
                    className="bg-gray-800 border-gray-600 text-white"
                    placeholder="Enter your last name"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-white">Email Address *</Label>
                <Input
                  value={userDetails.email}
                  onChange={(e) => updateUserDetail('email', e.target.value)}
                  className="bg-gray-800 border-gray-600 text-white"
                  placeholder="Enter your email address"
                  type="email"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white">Phone Number *</Label>
                <Input
                  value={userDetails.phone}
                  onChange={(e) => updateUserDetail('phone', e.target.value)}
                  className="bg-gray-800 border-gray-600 text-white"
                  placeholder="Enter your phone number"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white">PAN Card Number *</Label>
                <Input
                  value={userDetails.panCard}
                  onChange={(e) => updateUserDetail('panCard', e.target.value.toUpperCase())}
                  className="bg-gray-800 border-gray-600 text-white"
                  placeholder="Enter your PAN card number"
                  maxLength={10}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white">Address *</Label>
                <Input
                  value={userDetails.address}
                  onChange={(e) => updateUserDetail('address', e.target.value)}
                  className="bg-gray-800 border-gray-600 text-white"
                  placeholder="Enter your complete address"
                />
              </div>

              <Button 
                onClick={saveUserDetails}
                disabled={!isStep1Complete() || uploading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {uploading ? "Saving..." : "Save Details & Continue"}
              </Button>
            </div>
          )}

          {/* Step 2: Document Upload */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-white mb-4">Upload Required Documents</h3>
              
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
                {!uploadedDocs.governmentId ? (
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload('government_id', file);
                    }}
                    disabled={uploading}
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                ) : (
                  <div className="text-green-400 text-sm">✓ Government ID uploaded successfully</div>
                )}
              </div>

              {/* Utility Bill Upload */}
              <div className={`p-4 rounded-lg border ${uploadedDocs.utilityBill ? 'border-green-500 bg-green-900/20' : 'border-gray-600 bg-gray-800'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <FileText className="w-5 h-5 mr-2 text-green-500" />
                    <Label className="text-white font-medium">Address Proof</Label>
                  </div>
                  {uploadedDocs.utilityBill && <CheckCircle className="w-5 h-5 text-green-500" />}
                </div>
                <p className="text-sm text-gray-400 mb-3">
                  Upload your Utility Bill, Bank Statement, or Rental Agreement
                </p>
                {!uploadedDocs.utilityBill ? (
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload('utility_bill', file);
                    }}
                    disabled={uploading}
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                ) : (
                  <div className="text-green-400 text-sm">✓ Address proof uploaded successfully</div>
                )}
              </div>

              {/* Profile Photo Upload */}
              <div className={`p-4 rounded-lg border ${uploadedDocs.profilePhoto ? 'border-green-500 bg-green-900/20' : 'border-gray-600 bg-gray-800'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <Camera className="w-5 h-5 mr-2 text-purple-500" />
                    <Label className="text-white font-medium">Profile Photo</Label>
                  </div>
                  {uploadedDocs.profilePhoto && <CheckCircle className="w-5 h-5 text-green-500" />}
                </div>
                <p className="text-sm text-gray-400 mb-3">
                  Upload a clear photo of yourself
                </p>
                {!uploadedDocs.profilePhoto ? (
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload('profile_photo', file);
                    }}
                    disabled={uploading}
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                ) : (
                  <div className="text-green-400 text-sm">✓ Profile photo uploaded successfully</div>
                )}
              </div>

              {isStep2Complete() && (
                <Button 
                  onClick={() => setCurrentStep(3)}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                >
                  All Documents Uploaded - Continue to Submit
                </Button>
              )}
            </div>
          )}

          {/* Step 3: Submit KYC */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-white mb-4">Review and Submit KYC</h3>
              
              <div className="bg-gray-800 p-6 rounded-lg space-y-4">
                <h4 className="text-white font-medium">Personal Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-gray-400">Name:</span> <span className="text-white">{userDetails.firstName} {userDetails.lastName}</span></div>
                  <div><span className="text-gray-400">Email:</span> <span className="text-white">{userDetails.email}</span></div>
                  <div><span className="text-gray-400">Phone:</span> <span className="text-white">{userDetails.phone}</span></div>
                  <div><span className="text-gray-400">PAN:</span> <span className="text-white">{userDetails.panCard}</span></div>
                </div>
                <div><span className="text-gray-400">Address:</span> <span className="text-white">{userDetails.address}</span></div>
              </div>

              <div className="bg-gray-800 p-6 rounded-lg space-y-4">
                <h4 className="text-white font-medium">Uploaded Documents</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center">
                    <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                    <span className="text-white">Government ID Document</span>
                  </div>
                  <div className="flex items-center">
                    <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                    <span className="text-white">Address Proof Document</span>
                  </div>
                  <div className="flex items-center">
                    <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                    <span className="text-white">Profile Photo</span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-900/20 border border-blue-500 p-4 rounded-lg">
                <p className="text-blue-400 text-sm">
                  By submitting your KYC documents, you confirm that all information provided is accurate and agree to our terms of service.
                </p>
              </div>

              <Button 
                onClick={submitKYC}
                disabled={submitting}
                className="w-full bg-yellow-600 hover:bg-yellow-700 text-white"
              >
                {submitting ? "Submitting KYC..." : "Submit KYC for Review"}
              </Button>
            </div>
          )}

          {/* Step 4: Awaiting Approval */}
          {currentStep === 4 && (
            <div className="space-y-6 text-center">
              <div className="flex justify-center mb-6">
                <Clock className="w-16 h-16 text-purple-500" />
              </div>
              
              <h3 className="text-xl font-semibold text-white">KYC Submitted Successfully!</h3>
              
              <div className="bg-purple-900/20 border border-purple-500 p-6 rounded-lg">
                <p className="text-purple-400 mb-4">
                  Thank you for completing your KYC verification. Your documents are now under review.
                </p>
                <p className="text-gray-300 text-sm">
                  You will receive an email notification once your account is approved by our team.
                  This typically takes 1-2 business days.
                </p>
              </div>

              <div className="bg-gray-800 p-4 rounded-lg">
                <p className="text-white font-medium mb-2">What happens next?</p>
                <ul className="text-gray-300 text-sm space-y-1 text-left">
                  <li>• Our team will review your submitted documents</li>
                  <li>• You'll receive an email confirmation of approval</li>
                  <li>• Once approved, you can access all poker room features</li>
                  <li>• You can start playing and managing your account</li>
                </ul>
              </div>

              <Button 
                onClick={onComplete}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                Complete Registration
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}