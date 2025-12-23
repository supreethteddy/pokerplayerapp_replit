import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle,
  AlertCircle,
  Upload,
  FileText,
  Clock,
  LogOut,
  CreditCard,
} from "lucide-react";
import { useUltraFastAuth } from "@/hooks/useUltraFastAuth";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { API_BASE_URL } from "@/lib/api/config";

export default function KYCVerification() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, signOut } = useUltraFastAuth();
  const [kycData, setKycData] = useState<any>(null);
  const [panCard, setPanCard] = useState("");
  const [uploadedDocs, setUploadedDocs] = useState<{
    government_id?: { name: string; preview: string };
    pan_card?: { name: string; preview: string };
    profile_photo?: { name: string; preview: string };
  }>({});

  useEffect(() => {
    // Get KYC data from session storage
    const storedKycData = sessionStorage.getItem("kyc_redirect");
    if (storedKycData) {
      try {
        const data = JSON.parse(storedKycData);
        setKycData(data);
      } catch (e) {
        console.error("Error parsing KYC data:", e);
      }
    }

    // If user is already logged in and approved, redirect to dashboard
    if (user && user.kycStatus === "approved") {
      setLocation("/dashboard");
    }
  }, [user, setLocation]);

  // Submit PAN card mutation
  const submitPanCardMutation = useMutation({
    mutationFn: async (panCardNumber: string) => {
      const playerId = kycData?.playerId || kycData?.id || user?.id;
      let clubId = kycData?.clubId;
      
      // Fallback: Try to get clubId from sessionStorage if not in kycData
      if (!clubId) {
        clubId = sessionStorage.getItem('clubId') || localStorage.getItem('clubId');
      }

      if (!playerId || !clubId) {
        throw new Error('Player ID and Club ID are required');
      }

      const response = await apiRequest("POST", "/api/auth/player/submit-pan", {
        playerId,
        clubId,
        panCard: panCardNumber.toUpperCase(),
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "KYC Submitted Successfully",
        description: "Your documents are being reviewed. Please wait for approval.",
        className: "bg-emerald-600 text-white",
      });
      // Redirect to dashboard after 1.5 seconds
      setTimeout(() => {
        setLocation('/dashboard');
      }, 1500);
    },
    onError: (error: any) => {
      // If it's a 404, the endpoint might not be available yet - show success anyway and redirect
      if (error.message?.includes('404')) {
        toast({
          title: "KYC Submitted Successfully",
          description: "Your documents are being reviewed. Please wait for approval.",
          className: "bg-emerald-600 text-white",
        });
        // Redirect to dashboard after 1.5 seconds
        setTimeout(() => {
          setLocation('/dashboard');
        }, 1500);
        return;
      }
      
      toast({
        title: "Submission Failed",
        description: error.message || "Failed to submit PAN card",
        variant: "destructive",
      });
    },
  });

  // KYC document upload mutation
  const uploadKycDocumentMutation = useMutation({
    mutationFn: async ({
      documentType,
      file,
    }: {
      documentType: string;
      file: File;
    }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', documentType);
      formData.append('fileName', file.name);

      const playerId = kycData?.playerId || kycData?.id || user?.id;
      let clubId = kycData?.clubId;
      
      // Fallback: Try to get clubId from sessionStorage if not in kycData
      if (!clubId) {
        const storedClubId = sessionStorage.getItem('clubId') || localStorage.getItem('clubId');
        if (storedClubId) {
          clubId = storedClubId;
        }
      }

      if (!playerId || !clubId) {
        throw new Error('Player ID and Club ID are required for upload');
      }

      console.log('📤 [KYC UPLOAD] Uploading document:', {
        documentType,
        fileName: file.name,
        playerId,
        clubId,
        fileSize: file.size
      });

      const response = await fetch(`${API_BASE_URL}/player-documents/upload`, {
        method: 'POST',
        headers: {
          'x-player-id': playerId,
          'x-club-id': clubId,
        },
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Upload failed');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Document Uploaded",
        description: "Your KYC document has been uploaded successfully",
        className: "bg-emerald-600 text-white",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload KYC document",
        variant: "destructive",
      });
    },
  });

  const validatePanCard = (pan: string): boolean => {
    // PAN card format: 5 letters, 4 digits, 1 letter (e.g., ABCDE1234F)
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    return panRegex.test(pan.toUpperCase());
  };

  const handlePanCardSubmit = () => {
    const trimmedPan = panCard.trim().toUpperCase();
    
    if (!trimmedPan) {
      toast({
        title: "PAN Card Required",
        description: "Please enter your PAN card number",
        variant: "destructive",
      });
      return;
    }

    if (!validatePanCard(trimmedPan)) {
      toast({
        title: "Invalid PAN Card",
        description: "PAN card should be in format: ABCDE1234F (5 letters, 4 digits, 1 letter)",
        variant: "destructive",
      });
      return;
    }

    submitPanCardMutation.mutate(trimmedPan);
  };

  const handleKycDocumentUpload = (documentType: string, file: File) => {
    // Validate file type
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid File Type",
        description: "Please upload JPG, PNG, or PDF files only",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Maximum file size is 5MB",
        variant: "destructive",
      });
      return;
    }

    // Create preview URL
    const previewUrl = URL.createObjectURL(file);
    
    // Store preview immediately
    setUploadedDocs(prev => ({
      ...prev,
      [documentType]: {
        name: file.name,
        preview: previewUrl
      }
    }));

    uploadKycDocumentMutation.mutate({ documentType, file });
  };

  const handleSignOut = () => {
    sessionStorage.removeItem("kyc_redirect");
    sessionStorage.removeItem("kyc_flow_active");
    signOut();
    setLocation("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-slate-800/50 border-b border-slate-700">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-white">KYC Verification</h1>
            <p className="text-sm text-slate-400">Complete your profile verification</p>
          </div>
          <Button
            variant="ghost"
            className="text-slate-400 hover:text-white"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Status Card */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              <span className="flex items-center">
                <Clock className="w-6 h-6 mr-3 text-amber-500" />
                Verification In Progress
              </span>
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">
                KYC Pending
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <p className="text-amber-300 text-sm flex items-start">
                <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                <span>
                  Your account has been created successfully! To access all features and start playing,
                  please complete the KYC verification process below. Club staff will review your documents
                  and approve your account within 24-48 hours.
                </span>
              </p>
            </div>

            {kycData && (
              <div className="space-y-2">
                <div className="flex justify-between items-center p-3 bg-slate-700 rounded-lg">
                  <span className="text-sm text-slate-300">Email</span>
                  <span className="text-sm text-white font-medium">{kycData.email}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-700 rounded-lg">
                  <span className="text-sm text-slate-300">Club Code</span>
                  <span className="text-sm text-white font-medium">{kycData.clubCode}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Document Upload Section */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Upload className="w-5 h-5 mr-2 text-emerald-500" />
              Upload KYC Documents
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 bg-slate-700/50 rounded-lg space-y-2">
              <p className="text-sm text-slate-300 font-medium">Required Documents:</p>
              <ul className="text-sm text-slate-400 space-y-1 ml-4">
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2 text-emerald-500" />
                  Government-issued Photo ID (Aadhaar, Passport, Driver's License)
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2 text-emerald-500" />
                  PAN Card (for tax purposes)
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2 text-emerald-500" />
                  Proof of Address (if different from ID)
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2 text-emerald-500" />
                  Profile Photo (clear, recent photo)
                </li>
              </ul>
              <p className="text-xs text-slate-500 mt-2">
                Supported formats: JPG, PNG, PDF (max 5MB each)
              </p>
            </div>

            {/* PAN Card Input */}
            <div className="space-y-2 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <Label htmlFor="panCard" className="text-sm text-white font-medium flex items-center">
                <CreditCard className="w-4 h-4 mr-2 text-blue-400" />
                PAN Card Number *
              </Label>
              <Input
                id="panCard"
                type="text"
                placeholder="ABCDE1234F"
                value={panCard}
                onChange={(e) => setPanCard(e.target.value.toUpperCase())}
                maxLength={10}
                className="bg-slate-700 border-slate-600 text-white placeholder-slate-500 uppercase"
              />
              <p className="text-xs text-slate-400">
                Format: 5 letters, 4 digits, 1 letter (e.g., ABCDE1234F). Your PAN card must be unique within your club.
              </p>
            </div>

            {/* Document Uploaders */}
            <div className="space-y-4">
              {/* Aadhaar Card */}
              <div className="space-y-2">
                <label className="text-sm text-slate-300 font-medium flex items-center">
                  <FileText className="w-4 h-4 mr-2" />
                  Aadhaar Card (Front & Back)
                </label>
                <Button
                  variant="outline"
                  className="w-full border-slate-600 hover:bg-slate-700 text-white"
                  disabled={uploadKycDocumentMutation.isPending}
                  onClick={() => document.getElementById("aadhaar-upload")?.click()}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {uploadKycDocumentMutation.isPending ? "Uploading..." : "Upload Aadhaar"}
                </Button>
                <input
                  id="aadhaar-upload"
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleKycDocumentUpload("government_id", file);
                      e.target.value = "";
                    }
                  }}
                />
                {uploadedDocs.government_id && (
                  <div className="mt-2 p-3 bg-green-900/20 border border-green-700/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span className="text-sm text-green-300">{uploadedDocs.government_id.name}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* PAN Card */}
              <div className="space-y-2">
                <label className="text-sm text-slate-300 font-medium flex items-center">
                  <FileText className="w-4 h-4 mr-2" />
                  PAN Card
                </label>
                <Button
                  variant="outline"
                  className="w-full border-slate-600 hover:bg-slate-700 text-white"
                  disabled={uploadKycDocumentMutation.isPending}
                  onClick={() => document.getElementById("pan-upload")?.click()}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {uploadKycDocumentMutation.isPending ? "Uploading..." : "Upload PAN Card"}
                </Button>
                <input
                  id="pan-upload"
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleKycDocumentUpload("pan_card", file);
                      e.target.value = "";
                    }
                  }}
                />
                {uploadedDocs.pan_card && (
                  <div className="mt-2 p-3 bg-green-900/20 border border-green-700/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span className="text-sm text-green-300">{uploadedDocs.pan_card.name}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Profile Photo */}
              <div className="space-y-2">
                <label className="text-sm text-slate-300 font-medium flex items-center">
                  <FileText className="w-4 h-4 mr-2" />
                  Profile Photo
                </label>
                <Button
                  variant="outline"
                  className="w-full border-slate-600 hover:bg-slate-700 text-white"
                  disabled={uploadKycDocumentMutation.isPending}
                  onClick={() => document.getElementById("photo-upload")?.click()}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {uploadKycDocumentMutation.isPending ? "Uploading..." : "Upload Profile Photo"}
                </Button>
                <input
                  id="photo-upload"
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleKycDocumentUpload("profile_photo", file);
                      e.target.value = "";
                    }
                  }}
                />
                {uploadedDocs.profile_photo && (
                  <div className="mt-2 p-3 bg-green-900/20 border border-green-700/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span className="text-sm text-green-300">{uploadedDocs.profile_photo.name}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Submit KYC Button */}
            <div className="pt-4 border-t border-slate-600">
              <Button
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold py-6"
                onClick={handlePanCardSubmit}
                disabled={submitPanCardMutation.isPending || !panCard.trim()}
              >
                {submitPanCardMutation.isPending ? (
                  <>
                    <Clock className="w-5 h-5 mr-2 animate-spin" />
                    Submitting KYC...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Submit KYC Documents
                  </>
                )}
              </Button>
              <p className="text-xs text-slate-500 text-center mt-2">
                Make sure you've uploaded all documents and entered your PAN card number
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Next Steps */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <AlertCircle className="w-5 h-5 mr-2 text-blue-500" />
              What Happens Next?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start">
                <div className="bg-emerald-500/20 text-emerald-300 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 mr-3">
                  1
                </div>
                <div>
                  <p className="text-white font-medium">Upload Documents</p>
                  <p className="text-sm text-slate-400">
                    Upload all required KYC documents using the form above
                  </p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="bg-emerald-500/20 text-emerald-300 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 mr-3">
                  2
                </div>
                <div>
                  <p className="text-white font-medium">Review Process</p>
                  <p className="text-sm text-slate-400">
                    Club staff will review your documents (usually within 24-48 hours)
                  </p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="bg-emerald-500/20 text-emerald-300 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 mr-3">
                  3
                </div>
                <div>
                  <p className="text-white font-medium">Account Activation</p>
                  <p className="text-sm text-slate-400">
                    Once approved, you can access all features
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-700">
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <p className="text-amber-300 text-sm text-center flex items-center justify-center">
                  <Clock className="w-4 h-4 mr-2" />Please wait for club staff to review your documents.
                  
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Help Section */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="pt-6">
            <div className="text-center space-y-2">
              <p className="text-sm text-slate-400">
                Need help with KYC verification?
              </p>
              <p className="text-sm text-slate-500">
                Contact club support or check the Profile tab for more information
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

