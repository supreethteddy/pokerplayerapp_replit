import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Upload, Download, Eye, Mail, CheckCircle, Users, Trophy, Star } from 'lucide-react';

interface BrandingOptions {
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  companyName: string;
  thankYouMessage: string;
  subMessage: string;
  backgroundColor: string;
  textColor: string;
}

interface ThankYouPageProps {
  playerEmail?: string;
  playerName?: string;
  onClose?: () => void;
}

export function InteractiveThankYouPage({ 
  playerEmail = "player@example.com", 
  playerName = "Player",
  onClose 
}: ThankYouPageProps) {
  const [branding, setBranding] = useState<BrandingOptions>({
    logoUrl: '',
    primaryColor: '#10b981',
    secondaryColor: '#059669',
    companyName: 'Poker Club',
    thankYouMessage: 'Thank You for Joining Us!',
    subMessage: 'Your KYC documents have been submitted successfully. Please wait for staff approval.',
    backgroundColor: '#0f172a',
    textColor: '#f8fafc',
  });

  const [showCustomization, setShowCustomization] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setLogoPreview(result);
        setBranding(prev => ({ ...prev, logoUrl: result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleInputChange = (field: keyof BrandingOptions, value: string) => {
    setBranding(prev => ({ ...prev, [field]: value }));
  };

  const exportBranding = () => {
    const config = {
      ...branding,
      exportedAt: new Date().toISOString(),
      playerEmail,
      playerName
    };
    
    const blob = new Blob([JSON.stringify(config, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `poker-club-branding-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importBranding = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/json') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const config = JSON.parse(e.target?.result as string);
          setBranding(config);
          if (config.logoUrl) {
            setLogoPreview(config.logoUrl);
          }
        } catch (error) {
          console.error('Failed to import branding:', error);
        }
      };
      reader.readAsText(file);
    }
  };

  const thankYouPageStyle = {
    background: `linear-gradient(135deg, ${branding.backgroundColor}ee 0%, ${branding.primaryColor}22 100%)`,
    color: branding.textColor,
    minHeight: '100vh'
  };

  return (
    <div className="min-h-screen">
      {/* Live Preview */}
      <div style={thankYouPageStyle} className="relative overflow-hidden">
        {/* Background Decoration */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-72 h-72 rounded-full opacity-10" 
               style={{ backgroundColor: branding.primaryColor }}></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full opacity-5" 
               style={{ backgroundColor: branding.secondaryColor }}></div>
        </div>

        <div className="relative z-10 flex items-center justify-center min-h-screen p-8">
          <Card className="w-full max-w-2xl border-0 shadow-2xl backdrop-blur-sm" 
                style={{ backgroundColor: `${branding.backgroundColor}f0` }}>
            <CardHeader className="text-center pb-8">
              {/* Logo Section */}
              {branding.logoUrl && (
                <div className="mb-6 flex justify-center">
                  <img 
                    src={branding.logoUrl} 
                    alt={`${branding.companyName} Logo`}
                    className="h-20 w-auto max-w-xs object-contain rounded-lg shadow-lg"
                    style={{ filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3))' }}
                  />
                </div>
              )}

              {/* Main Thank You Message */}
              <CardTitle className="text-4xl font-bold mb-4" style={{ color: branding.textColor }}>
                {branding.thankYouMessage}
              </CardTitle>

              {/* Company Name */}
              <div className="text-2xl font-semibold mb-2" style={{ color: branding.primaryColor }}>
                {branding.companyName}
              </div>
            </CardHeader>

            <CardContent className="text-center space-y-6">
              {/* Welcome Message */}
              <div className="text-lg" style={{ color: branding.textColor }}>
                Welcome, <span style={{ color: branding.primaryColor }} className="font-semibold">
                  {playerName}
                </span>!
              </div>

              {/* Sub Message */}
              <p className="text-lg leading-relaxed" style={{ color: branding.textColor }}>
                {branding.subMessage}
              </p>

              {/* Feature Highlights */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-8">
                <div className="text-center p-4 rounded-lg" 
                     style={{ backgroundColor: `${branding.primaryColor}20` }}>
                  <CheckCircle className="w-8 h-8 mx-auto mb-2" style={{ color: branding.primaryColor }} />
                  <p className="text-sm font-medium" style={{ color: branding.textColor }}>
                    KYC Submitted
                  </p>
                </div>
                
                <div className="text-center p-4 rounded-lg" 
                     style={{ backgroundColor: `${branding.primaryColor}20` }}>
                  <Users className="w-8 h-8 mx-auto mb-2" style={{ color: branding.primaryColor }} />
                  <p className="text-sm font-medium" style={{ color: branding.textColor }}>
                    Staff Review
                  </p>
                </div>
                
                <div className="text-center p-4 rounded-lg" 
                     style={{ backgroundColor: `${branding.primaryColor}20` }}>
                  <Trophy className="w-8 h-8 mx-auto mb-2" style={{ color: branding.primaryColor }} />
                  <p className="text-sm font-medium" style={{ color: branding.textColor }}>
                    Ready to Play
                  </p>
                </div>
              </div>

              {/* Contact Information */}
              <div className="text-sm" style={{ color: branding.textColor }}>
                <Mail className="inline w-4 h-4 mr-2" />
                Confirmation sent to: <span style={{ color: branding.primaryColor }}>
                  {playerEmail}
                </span>
              </div>

              {/* Call to Action */}
              <div className="pt-4">
                <Button 
                  onClick={onClose}
                  className="px-8 py-3 text-lg font-semibold rounded-lg shadow-lg transform transition-all duration-200 hover:scale-105"
                  style={{ 
                    backgroundColor: branding.primaryColor,
                    color: branding.textColor,
                    border: `2px solid ${branding.primaryColor}`
                  }}
                >
                  <Star className="w-5 h-5 mr-2" />
                  Continue to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Customization Panel */}
      {showCustomization && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md max-h-[80vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Customize Thank You Page</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Logo Upload */}
              <div>
                <Label>Company Logo</Label>
                <div className="mt-2 space-y-2">
                  <Button 
                    variant="outline" 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Logo
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  {logoPreview && (
                    <img src={logoPreview} alt="Logo preview" className="w-20 h-20 object-contain border rounded" />
                  )}
                </div>
              </div>

              {/* Company Name */}
              <div>
                <Label>Company Name</Label>
                <Input
                  value={branding.companyName}
                  onChange={(e) => handleInputChange('companyName', e.target.value)}
                  placeholder="Your Company Name"
                />
              </div>

              {/* Thank You Message */}
              <div>
                <Label>Thank You Message</Label>
                <Input
                  value={branding.thankYouMessage}
                  onChange={(e) => handleInputChange('thankYouMessage', e.target.value)}
                  placeholder="Thank You Message"
                />
              </div>

              {/* Sub Message */}
              <div>
                <Label>Sub Message</Label>
                <Textarea
                  value={branding.subMessage}
                  onChange={(e) => handleInputChange('subMessage', e.target.value)}
                  placeholder="Detailed message"
                  rows={3}
                />
              </div>

              {/* Colors */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Primary Color</Label>
                  <Input
                    type="color"
                    value={branding.primaryColor}
                    onChange={(e) => handleInputChange('primaryColor', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Secondary Color</Label>
                  <Input
                    type="color"
                    value={branding.secondaryColor}
                    onChange={(e) => handleInputChange('secondaryColor', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Background</Label>
                  <Input
                    type="color"
                    value={branding.backgroundColor}
                    onChange={(e) => handleInputChange('backgroundColor', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Text Color</Label>
                  <Input
                    type="color"
                    value={branding.textColor}
                    onChange={(e) => handleInputChange('textColor', e.target.value)}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={exportBranding} className="flex-1">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
                <Button variant="outline" onClick={() => document.getElementById('import-input')?.click()} className="flex-1">
                  <Upload className="w-4 h-4 mr-2" />
                  Import
                </Button>
                <input
                  id="import-input"
                  type="file"
                  accept=".json"
                  onChange={importBranding}
                  className="hidden"
                />
              </div>

              <Button 
                onClick={() => setShowCustomization(false)} 
                className="w-full"
              >
                Save & Close
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Floating Customization Button */}
      <Button
        onClick={() => setShowCustomization(true)}
        className="fixed bottom-6 right-6 rounded-full w-12 h-12 shadow-lg"
        style={{ backgroundColor: branding.primaryColor }}
      >
        <Eye className="w-5 h-5" />
      </Button>
    </div>
  );
}

export default InteractiveThankYouPage;