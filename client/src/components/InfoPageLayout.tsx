import React, { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { useLocation } from "wouter";
import { fetchClubBranding, type ClubBranding, getGradientStyle } from "@/lib/clubBranding";

interface InfoPageLayoutProps {
    title: string;
    children: React.ReactNode;
}

const InfoPageLayout: React.FC<InfoPageLayoutProps> = ({ title, children }) => {
    const [, setLocation] = useLocation();
    const [branding, setBranding] = useState<ClubBranding | null>(null);

    useEffect(() => {
        const loadBranding = async () => {
            try {
                const data = await fetchClubBranding();
                setBranding(data);
            } catch (error) {
                console.error('Error loading branding for info page:', error);
            }
        };
        loadBranding();
    }, []);

    return (
        <div className="min-h-screen bg-slate-900 text-white pb-10">
            {/* Header */}
            <div
                className="sticky top-0 z-50 px-4 py-4 flex items-center gap-4 bg-slate-900/80 backdrop-blur-md border-b border-slate-800"
                style={getGradientStyle(branding, 'secondary')}
            >
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setLocation('/dashboard')}
                    className="text-white hover:bg-white/10"
                >
                    <ChevronLeft className="w-6 h-6" />
                </Button>
                <h1 className="text-xl font-bold tracking-tight">{title}</h1>
            </div>

            {/* Content */}
            <div className="max-w-4xl mx-auto px-4 mt-8">
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 md:p-8 shadow-xl">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default InfoPageLayout;
