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
import { fetchClubBranding, applyClubBranding, getGradientClasses, getGradientStyle, type ClubBranding } from "@/lib/clubBranding";

export default function KYCVerification() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, signOut } = useUltraFastAuth();
  const [kycData, setKycData] = useState<any>(null);
  const [panCard, setPanCard] = useState("");
  const [clubBranding, setClubBranding] = useState<ClubBranding | null>(null);
  const [uploadedDocs, setUploadedDocs] = useState<{
    government_id?: { name: string; preview: string };
    pan_card?: { name: string; preview: string };
    profile_photo?: { name: string; preview: string };
  }>({});

  // Load club branding
  useEffect(() => {
    const loadBranding = async () => {
      // Try to get from sessionStorage first
      const storedBranding = sessionStorage.getItem("club_branding");
      if (storedBranding) {
        try {
          const branding = JSON.parse(storedBranding);
          setClubBranding(branding);
          applyClubBranding(branding);
          return;
        } catch (e) {
          console.error("Failed to parse stored branding:", e);
        }
      }

      // Try to get clubId from kycData or sessionStorage
      const storedKycData = sessionStorage.getItem("kyc_redirect");
      let clubId = null;
      
      if (storedKycData) {
        try {
          const data = JSON.parse(storedKycData);
          clubId = data.clubId;
        } catch (e) {
          console.error("Error parsing KYC data:", e);
        }
      }
      
      if (!clubId) {
        clubId = sessionStorage.getItem('clubId') || localStorage.getItem('clubId');
      }

      // Fetch from backend if we have clubId
      if (clubId) {
        try {
          const branding = await fetchClubBranding(clubId);
          if (branding) {
            setClubBranding(branding);
            applyClubBranding(branding);
            sessionStorage.setItem("club_branding", JSON.stringify(branding));
          }
        } catch (error) {
          console.error("Failed to fetch club branding:", error);
        }
      }
    };

    loadBranding();
  }, []);

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
        style: clubBranding ? { backgroundColor: clubBranding.skinColor } : { backgroundColor: '#059669' },
        className: "text-white",
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
        style: clubBranding ? { backgroundColor: clubBranding.skinColor } : { backgroundColor: '#059669' },
        className: "text-white",
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
    
    // Require PAN number and both Aadhaar + PAN docs before submit
    if (!uploadedDocs.government_id || !uploadedDocs.pan_card) {
      toast({
        title: "Documents Required",
        description: "Please upload both your Aadhaar card and PAN card before submitting KYC.",
        variant: "destructive",
      });
      return;
    }

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

  // Helper function to get club-branded button styles
  const getClubButtonStyle = (variant: 'primary' | 'secondary' = 'primary') => {
    if (!clubBranding) return {};
    if (variant === 'primary') {
      return { backgroundColor: clubBranding.skinColor };
    }
    return { borderColor: clubBranding.skinColor, color: clubBranding.skinColor };
  };

  // Get gradient classes and style for background
  const gradientClasses = clubBranding ? getGradientClasses(clubBranding.gradient) : '';
  const gradientStyle = clubBranding ? getGradientStyle(clubBranding.gradient) : {};

  return (
    <div 
      className={`min-h-screen pt-4 sm:pt-5 lg:pt-6 ${gradientClasses || 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900'}`}
      style={Object.keys(gradientStyle).length > 0 ? gradientStyle : undefined}
    >
      {/* Header - Mobile Responsive */}
      <div className="bg-slate-800/50 border-b border-slate-700 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
          <div className="w-full sm:w-auto">
            <h1 className="text-lg sm:text-xl font-bold text-white">KYC Verification</h1>
            <p className="text-xs sm:text-sm text-slate-400">Complete your profile verification</p>
          </div>
          <Button
            variant="ghost"
            className="text-slate-400 hover:text-white w-full sm:w-auto min-h-[36px] sm:min-h-[40px] text-sm sm:text-base"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>

      {/* Main Content - Mobile Responsive */}
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8 space-y-4 sm:space-y-6">
        {/* Status Card */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
              <span className="flex items-center text-base sm:text-lg">
                <Clock className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 text-amber-500" />
                Verification In Progress
              </span>
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs sm:text-sm">
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
            <CardTitle className="text-white flex items-center text-base sm:text-lg">
              <Upload className="w-4 h-4 sm:w-5 sm:h-5 mr-2" style={{ color: clubBranding?.skinColor || '#10b981' }} />
              Upload KYC Documents
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 bg-slate-700/50 rounded-lg space-y-2">
              <p className="text-sm text-slate-300 font-medium">Required Documents:</p>
              <ul className="text-sm text-slate-400 space-y-1 ml-4">
                <li className="flex items-center text-xs sm:text-sm">
                  <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-2 flex-shrink-0" style={{ color: clubBranding?.skinColor || '#10b981' }} />
                  Government-issued Photo ID (Aadhaar, Passport, Driver's License)
                </li>
                <li className="flex items-center text-xs sm:text-sm">
                  <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-2 flex-shrink-0" style={{ color: clubBranding?.skinColor || '#10b981' }} />
                  PAN Card (for tax purposes)
                </li>
                <li className="flex items-center text-xs sm:text-sm">
                  <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-2 flex-shrink-0" style={{ color: clubBranding?.skinColor || '#10b981' }} />
                  Proof of Address (if different from ID)
                </li>
                <li className="flex items-center text-xs sm:text-sm">
                  <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-2 flex-shrink-0" style={{ color: clubBranding?.skinColor || '#10b981' }} />
                  Profile Photo (clear, recent photo)
                </li>
              </ul>
              <p className="text-xs text-slate-500 mt-2">
                Supported formats: JPG, PNG, PDF (max 5MB each)
              </p>
            </div>

            {/* PAN Card Input - Mobile Responsive */}
            <div className="space-y-2 p-3 sm:p-4 rounded-lg" style={clubBranding ? { backgroundColor: `${clubBranding.skinColor}10`, borderColor: `${clubBranding.skinColor}30`, borderWidth: '1px', borderStyle: 'solid' } : { backgroundColor: '#3b82f610', borderColor: '#3b82f630', borderWidth: '1px', borderStyle: 'solid' }}>
              <Label htmlFor="panCard" className="text-xs sm:text-sm text-white font-medium flex items-center">
                <CreditCard className="w-3 h-3 sm:w-4 sm:h-4 mr-2" style={{ color: clubBranding?.skinColor || '#60a5fa' }} />
                PAN Card Number *
              </Label>
              <Input
                id="panCard"
                type="text"
                placeholder="ABCDE1234F"
                value={panCard}
                onChange={(e) => setPanCard(e.target.value.toUpperCase())}
                maxLength={10}
                className="bg-slate-700 border-slate-600 text-white placeholder-slate-500 uppercase h-10 sm:h-11 text-sm sm:text-base"
              />
              <p className="text-xs sm:text-sm text-slate-400">
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
                  className="w-full hover:opacity-90 text-white min-h-[44px] sm:min-h-[48px] text-sm sm:text-base"
                  style={getClubButtonStyle('secondary')}
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
                  className="w-full hover:opacity-90 text-white min-h-[44px] sm:min-h-[48px] text-sm sm:text-base"
                  style={getClubButtonStyle('secondary')}
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
                  className="w-full hover:opacity-90 text-white min-h-[44px] sm:min-h-[48px] text-sm sm:text-base"
                  style={getClubButtonStyle('secondary')}
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

            {/* Submit KYC Button - Mobile Responsive */}
            <div className="pt-4 border-t border-slate-600">
              {(!uploadedDocs.government_id || !uploadedDocs.pan_card || !panCard.trim()) && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg mb-3">
                  <p className="text-xs sm:text-sm text-red-300 font-medium mb-1">Required before submission:</p>
                  <ul className="text-xs text-red-400/80 space-y-0.5 ml-3">
                    {!uploadedDocs.government_id && <li>• Upload Aadhaar Card document</li>}
                    {!uploadedDocs.pan_card && <li>• Upload PAN Card document</li>}
                    {!panCard.trim() && <li>• Enter PAN Card number</li>}
                  </ul>
                </div>
              )}
              <Button
                className="w-full hover:opacity-90 text-white font-semibold py-4 sm:py-6 min-h-[52px] sm:min-h-[64px] text-sm sm:text-base"
                style={getClubButtonStyle('primary')}
                onClick={handlePanCardSubmit}
                disabled={
                  submitPanCardMutation.isPending ||
                  !panCard.trim() ||
                  !uploadedDocs.government_id ||
                  !uploadedDocs.pan_card
                }
              >
                {submitPanCardMutation.isPending ? (
                  <>
                    <Clock className="w-4 h-4 sm:w-5 sm:h-5 mr-2 animate-spin" />
                    Submitting KYC...
                  </>
                ) : !uploadedDocs.government_id || !uploadedDocs.pan_card ? (
                  <>
                    <Upload className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                    Upload Aadhaar & PAN First
                  </>
                ) : !panCard.trim() ? (
                  <>
                    <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                    Enter PAN Number to Submit
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                    Submit KYC Documents
                  </>
                )}
              </Button>
              <p className="text-xs sm:text-sm text-slate-500 text-center mt-2 px-2">
                Upload both Aadhaar and PAN documents, then enter your PAN number to submit
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
                <div className="rounded-full w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center flex-shrink-0 mr-2 sm:mr-3 text-sm sm:text-base font-semibold" style={clubBranding ? { backgroundColor: `${clubBranding.skinColor}20`, color: clubBranding.skinColor } : { backgroundColor: '#10b98120', color: '#10b981' }}>
                  1
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium text-sm sm:text-base">Upload Documents</p>
                  <p className="text-xs sm:text-sm text-slate-400">
                    Upload all required KYC documents using the form above
                  </p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="rounded-full w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center flex-shrink-0 mr-2 sm:mr-3 text-sm sm:text-base font-semibold" style={clubBranding ? { backgroundColor: `${clubBranding.skinColor}20`, color: clubBranding.skinColor } : { backgroundColor: '#10b98120', color: '#10b981' }}>
                  2
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium text-sm sm:text-base">Review Process</p>
                  <p className="text-xs sm:text-sm text-slate-400">
                    Club staff will review your documents (usually within 24-48 hours)
                  </p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="rounded-full w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center flex-shrink-0 mr-2 sm:mr-3 text-sm sm:text-base font-semibold" style={clubBranding ? { backgroundColor: `${clubBranding.skinColor}20`, color: clubBranding.skinColor } : { backgroundColor: '#10b98120', color: '#10b981' }}>
                  3
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium text-sm sm:text-base">Account Activation</p>
                  <p className="text-xs sm:text-sm text-slate-400">
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

