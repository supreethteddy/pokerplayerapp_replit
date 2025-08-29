import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Upload, FileText, CreditCard, Clock, User, FileCheck } from 'lucide-react';
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
    phone?: string; // Added phone to interface for clarity
  };
  onComplete: () => void;
}

export default function KYCWorkflow({ playerData, onComplete }: KYCWorkflowProps) {
  console.log('🔍 [KYC DEBUG] PlayerData received:', playerData);
  console.log('🔍 [KYC DEBUG] PlayerData ID:', playerData?.id);
  const [currentStep, setCurrentStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [userDetails, setUserDetails] = useState({
    firstName: playerData.firstName || '',
    lastName: playerData.lastName || '',
    email: playerData.email || '',
    phone: playerData.phone || ''
  });
  const [uploadedDocs, setUploadedDocs] = useState({
    governmentId: null as string | null,
    utilityBill: null as string | null,
    panCard: null as string | null
  });
  const [panCardNumber, setPanCardNumber] = useState('');
  const { toast } = useToast();
  const [documents, setDocuments] = useState([]); // State to store fetched documents

  // Function to refresh documents
  const refreshDocuments = async () => {
    try {
      const playerId = playerData?.id;
      if (playerId) {
        const docsResponse = await fetch(`/api/documents/player/${playerId}`);
        if (docsResponse.ok) {
          const docs = await docsResponse.json();
          setDocuments(docs);
          const docStatus = {
            governmentId: docs.find((doc: any) => doc.document_type === 'government_id')?.file_url || null,
            utilityBill: docs.find((doc: any) => doc.document_type === 'utility_bill')?.file_url || null,
            panCard: docs.find((doc: any) => doc.document_type === 'pan_card')?.file_url || null
          };
          setUploadedDocs(docStatus);
          return docStatus;
        }
      }
    } catch (error) {
      console.error('Error refreshing documents:', error);
    }
    return { governmentId: null, utilityBill: null, panCard: null };
  };

  useEffect(() => {
    // Determine the correct step based on KYC status and existing data
    const initializeStep = async () => {
      try {
        // Use dynamic player ID from props
        const playerId = playerData?.id;

        // Initialize user details with existing playerData first
        setUserDetails(prev => ({
          firstName: playerData.firstName || prev.firstName,
          lastName: playerData.lastName || prev.lastName,
          email: playerData.email || prev.email,
          phone: playerData.phone || prev.phone
        }));

        const playerResponse = await fetch(`/api/players/${playerId}`);
        if (playerResponse.ok) {
          const player = await playerResponse.json();

          // Update with complete player data from database
          setUserDetails(prev => ({
            firstName: player.firstName || playerData.firstName || prev.firstName,
            lastName: player.lastName || playerData.lastName || prev.lastName,
            email: player.email || playerData.email || prev.email,
            phone: player.phone || playerData.phone || prev.phone
          }));

          setPanCardNumber(player.pan_card || '');

          // Check document uploads
          const docStatus = await refreshDocuments(); // Use refreshDocuments to set state

          // FIXED: Check if this is from a fresh signup (KYC flow active)
          const kycFlowActive = sessionStorage.getItem('kyc_flow_active');

          if (kycFlowActive === 'true') {
            // Fresh signup - always start from step 1 to allow confirmation
            console.log('🎯 [KYC] Fresh signup detected - starting from step 1 for confirmation');
            setCurrentStep(1);
          } else {
            // Returning user - determine step based on status
            if (playerData.kycStatus === 'approved') {
              setCurrentStep(4); // Already approved
            } else if (playerData.kycStatus === 'submitted') {
              setCurrentStep(4); // Waiting for approval
            } else if (docStatus.governmentId && docStatus.utilityBill && docStatus.panCard) {
              setCurrentStep(3); // Ready to submit
            } else if (player.phone || playerData.phone) {
              setCurrentStep(2); // Ready for document upload
            } else {
              setCurrentStep(1); // Need user details
            }
          }
        } else if (playerResponse.status === 404) {
          // Player not found - redirect to login page
          console.error('❌ [KYC] Player not found in database - redirecting to login');

          toast({
            title: "Account Not Found",
            description: "Your account was not found. Please sign in again.",
            variant: "destructive"
          });

          // Clear all stored data
          sessionStorage.removeItem('kyc_redirect');
          sessionStorage.removeItem('kyc_flow_active');
          sessionStorage.removeItem('authenticated_user');
          localStorage.removeItem('player_auth');

          // Redirect to login after a short delay
          setTimeout(() => {
            window.location.href = '/';
          }, 2000);

          return;
        } else {
          console.warn('Failed to fetch player details, using initial playerData');
        }
      } catch (error) {
        console.error('Error initializing KYC step:', error);

        toast({
          title: "Connection Error",
          description: "Unable to verify your account. Please try logging in again.",
          variant: "destructive"
        });

        // Clear stored data and redirect to login on error
        setTimeout(() => {
          sessionStorage.removeItem('kyc_redirect');
          sessionStorage.removeItem('kyc_flow_active');
          sessionStorage.removeItem('authenticated_user');
          localStorage.removeItem('player_auth');
          window.location.href = '/';
        }, 2000);
      }
    };

    initializeStep();
  }, [playerData.id, playerData.kycStatus, playerData.firstName, playerData.lastName, playerData.email, playerData.phone]);

  // Step 1: Save user details
  const saveUserDetails = async () => {
    try {
      setUploading(true);

      // Use dynamic player ID from props
      const playerId = playerData?.id;
      const response = await apiRequest('PUT', `/api/players/${playerId}`, {
        firstName: userDetails.firstName,
        lastName: userDetails.lastName,
        phone: userDetails.phone
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

        // Use dynamic player ID from props
        const playerId = playerData?.id;
        console.log('🔍 [DEBUG] PlayerData object:', playerData);
        console.log('🔍 [DEBUG] PlayerData.id:', playerData?.id);
        console.log('🔍 [DEBUG] Using player ID for upload:', playerId);

        if (!playerId) {
          throw new Error('Player ID not found. Please refresh and try again.');
        }

        const response = await apiRequest('POST', '/api/documents/upload', {
          playerId: playerId,
          documentType,
          fileName: file.name,
          fileData: dataUrl,
          fileSize: file.size,
          mimeType: file.type
        });

        if (response.ok) {
          const docKey = documentType === 'government_id' ? 'governmentId' : 
                        documentType === 'utility_bill' ? 'utilityBill' : 'panCard';

          setUploadedDocs(prev => ({
            ...prev,
            [docKey]: 'uploaded'
          }));

          toast({
            title: "Document Uploaded",
            description: `${documentType.replace('_', ' ')} uploaded successfully!`,
          });

          // Check if all required documents are now uploaded and advance to step 3
          const updatedDocs = { ...uploadedDocs, [docKey]: 'uploaded' };
          if (updatedDocs.governmentId && updatedDocs.utilityBill && updatedDocs.panCard && isValidPAN(panCardNumber)) {
            console.log('🎯 [KYC] All documents uploaded and PAN valid - advancing to step 3');
            setCurrentStep(3);
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

      // Use dynamic player ID from props
      const playerId = playerData?.id;
      console.log('🔍 [DEBUG] PlayerData object:', playerData);
      console.log('🔍 [DEBUG] PlayerData.id:', playerData?.id);
      console.log('🔍 [DEBUG] Using player ID for KYC submit:', playerId);

      if (!playerId) {
        throw new Error('Player ID not found. Please refresh and try again.');
      }

      // Update player KYC status to submitted
      const response = await apiRequest('POST', '/api/kyc/submit', {
        playerId: playerId,
        email: userDetails.email,
        firstName: userDetails.firstName,
        lastName: userDetails.lastName,
        panCardNumber: panCardNumber
      });

      if (response.ok) {
        toast({
          title: "KYC Submitted Successfully!",
          description: "Your documents have been submitted for review. Check your email for confirmation.",
        });

        // Send Supabase email notification
        await fetch('/api/auth/kyc-submission-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: userDetails.email,
            firstName: userDetails.firstName,
            playerId: playerId
          })
        });

        setCurrentStep(4);

        // Send success notification to parent
        toast({
          title: "Success!",
          description: "Thank you for registering to the Poker Club. Your documents have been submitted for review.",
        });
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
    return userDetails.firstName && userDetails.lastName && userDetails.email && userDetails.phone;
  };

  const isValidPAN = (pan: string): boolean => {
    // Enhanced PAN Card validation with specific entity codes
    // Pattern: ^[A-Z]{3}[PCHABGJLFT][A-Z][0-9]{4}[A-Z]$
    // First 3: Alphabets, 4th: Entity code, 5th: Alphabet, Next 4: Digits, Last: Alphabet
    const panRegex = /^[A-Z]{3}[PCHABGJLFT][A-Z][0-9]{4}[A-Z]$/;

    // Length and case validation
    if (!pan || pan.length !== 10 || pan !== pan.toUpperCase()) {
      return false;
    }

    return panRegex.test(pan);
  };

  const isStep2Complete = () => {
    const panValid = isValidPAN(panCardNumber);
    const allDocsUploaded = uploadedDocs.governmentId && uploadedDocs.utilityBill && uploadedDocs.panCard;
    console.log('🔍 [STEP2] All docs uploaded:', allDocsUploaded, 'PAN valid:', panValid);
    console.log('🔍 [STEP2] Docs status:', uploadedDocs);
    console.log('🔍 [STEP2] PAN number:', panCardNumber);
    return allDocsUploaded && panValid;
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
            {currentStep === 4 && "Step 4: Thank You - Awaiting Approval"}
          </CardTitle>
          <div className="space-y-2">
            <Progress value={getProgressPercentage()} className="w-full [&>div]:bg-green-500" />
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
                    onChange={(e) =>updateUserDetail('firstName', e.target.value)}
                    className="bg-gray-800 border-gray-600 text-white"
                    placeholder="Enter your first name"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white">Last Name *</Label>
                  <Input
                    value={userDetails.lastName}
                    onChange={(e) =>updateUserDetail('lastName', e.target.value)}
                    className="bg-gray-800 border-gray-600 text-white"
                    placeholder="Enter your last name"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-white">Email Address *</Label>
                <Input
                  value={userDetails.email}
                  onChange={(e) =>updateUserDetail('email', e.target.value)}
                  className="bg-gray-800 border-gray-600 text-white"
                  placeholder="Enter your email address"
                  type="email"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white">Phone Number *</Label>
                <Input
                  value={userDetails.phone}
                  onChange={(e) =>updateUserDetail('phone', e.target.value)}
                  className="bg-gray-800 border-gray-600 text-white"
                  placeholder="Enter your phone number"
                />
              </div>

              <Button
                onClick={saveUserDetails} // Changed from setCurrentStep(2) to call saveUserDetails
                disabled={!isStep1Complete()}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12"
              >
                Save Details & Continue
              </Button>
            </div>
          )}

          {/* Step 2: Document Upload */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-white mb-4">Upload Required Documents</h3>

              {/* Government ID Upload */}
              <div className={`p-6 rounded-lg border ${uploadedDocs.governmentId ? 'border-green-500 bg-green-900/20' : 'border-gray-600 bg-gray-800'}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <CreditCard className="w-5 h-5 mr-2 text-blue-500" />
                    <Label className="text-white font-medium">Government ID</Label>
                  </div>
                  {uploadedDocs.governmentId && <CheckCircle className="w-5 h-5 text-green-500" />}
                </div>
                <p className="text-sm text-gray-400 mb-4">
                  Upload your Aadhaar Card, PAN Card, or Passport
                </p>
                {!uploadedDocs.governmentId ? (
                  <div className="w-full">
                    <Input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload('government_id', file);
                      }}
                      disabled={uploading}
                      className="bg-gray-700 border-gray-600 text-white w-full h-12"
                    />
                  </div>
                ) : (
                  <div className="text-green-400 text-sm bg-green-900/20 p-3 rounded">✓ Government ID uploaded successfully</div>
                )}
              </div>

              {/* Utility Bill Upload */}
              <div className={`p-6 rounded-lg border ${uploadedDocs.utilityBill ? 'border-green-500 bg-green-900/20' : 'border-gray-600 bg-gray-800'}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <FileText className="w-5 h-5 mr-2 text-green-500" />
                    <Label className="text-white font-medium">Address Proof</Label>
                  </div>
                  {uploadedDocs.utilityBill && <CheckCircle className="w-5 h-5 text-green-500" />}
                </div>
                <p className="text-sm text-gray-400 mb-4">
                  Upload your Utility Bill, Bank Statement, or Rental Agreement
                </p>
                {!uploadedDocs.utilityBill ? (
                  <div className="w-full">
                    <Input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload('utility_bill', file);
                      }}
                      disabled={uploading}
                      className="bg-gray-700 border-gray-600 text-white w-full h-12"
                    />
                  </div>
                ) : (
                  <div className="text-green-400 text-sm bg-green-900/20 p-3 rounded">✓ Address proof uploaded successfully</div>
                )}
              </div>

              {/* PAN Card Upload */}
              <div className={`p-6 rounded-lg border ${uploadedDocs.panCard ? 'border-green-500 bg-green-900/20' : 'border-gray-600 bg-gray-800'}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <CreditCard className="w-5 h-5 mr-2 text-yellow-500" />
                    <Label className="text-white font-medium">PAN Card</Label>
                  </div>
                  {uploadedDocs.panCard && <CheckCircle className="w-5 h-5 text-green-500" />}
                </div>
                <div className="space-y-5">
                  <div className="space-y-3">
                    <Label className="text-white text-sm font-medium">PAN Card Number *</Label>
                    <Input
                      value={panCardNumber}
                      onChange={(e) => setPanCardNumber(e.target.value.toUpperCase())}
                      className={`bg-gray-700 border-gray-600 text-white h-12 ${
                        panCardNumber && !isValidPAN(panCardNumber) ? 'border-red-500' : ''
                      }`}
                      placeholder="ABCPF1234G"
                      maxLength={10}
                    />
                    {panCardNumber && !isValidPAN(panCardNumber) && (
                      <p className="text-red-400 text-xs mt-2">Invalid PAN format. Format: 3 letters + entity code + 1 letter + 4 digits + 1 letter (e.g. ABCPF1234G)</p>
                    )}
                  </div>
                  <div className="space-y-3">
                    <Label className="text-white text-sm font-medium">Upload PAN Card Document *</Label>
                    {!uploadedDocs.panCard ? (
                      <div className="w-full">
                        <Input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload('pan_card', file);
                          }}
                          disabled={uploading}
                          className="bg-gray-700 border-gray-600 text-white w-full h-12"
                        />
                      </div>
                    ) : (
                      <div className="text-green-400 text-sm bg-green-900/20 p-3 rounded">✓ PAN card uploaded successfully</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-gray-700">
                <Button 
                  onClick={submitKYC}
                  disabled={submitting || !isStep2Complete()} // Disable if not all docs uploaded or PAN invalid
                  className="w-full bg-green-600 hover:bg-green-700 text-white h-14 text-lg font-semibold mb-3"
                >
                  {submitting ? "Submitting..." : "Submit Documents"}
                </Button>
                <p className="text-center text-sm text-green-400">
                  Ready to submit! Click the button above to submit your documents.
                </p>
              </div>
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
                  <div><span className="text-gray-400">PAN:</span> <span className="text-white">{panCardNumber}</span></div>
                </div>
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
                    <span className="text-white">PAN Card Document</span>
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
                onClick={() => {
                  console.log('🎯 [KYC] Complete Registration clicked - cleaning up and redirecting');
                  
                  // Clear all KYC and authentication data
                  sessionStorage.removeItem('kyc_redirect');
                  sessionStorage.removeItem('kyc_flow_active');
                  sessionStorage.removeItem('kyc_step_progress');
                  sessionStorage.removeItem('authenticated_user');
                  sessionStorage.removeItem('just_signed_in');
                  localStorage.removeItem('player_auth');
                  
                  // Call the onComplete callback
                  onComplete();
                  
                  // Force redirect to login page
                  setTimeout(() => {
                    console.log('🔄 [KYC] Redirecting to login page');
                    window.location.href = '/';
                  }, 500);
                }}
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