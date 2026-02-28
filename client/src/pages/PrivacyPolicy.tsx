import React from 'react';
import InfoPageLayout from '@/components/InfoPageLayout';

const PrivacyPolicy: React.FC = () => {
    return (
        <InfoPageLayout title="Privacy Policy">
            <div className="prose prose-invert max-w-none">
                <section className="mb-8">
                    <h2 className="text-xl font-semibold text-emerald-400 mb-4">1. Data Collection</h2>
                    <p className="text-slate-300 leading-relaxed">
                        We collect information that you provide directly to us when you create an account, verify your identity (KYC), and use our gaming services. This includes your name, email address, phone number, and PAN details for legal compliance.
                    </p>
                </section>

                <section className="mb-8">
                    <h2 className="text-xl font-semibold text-emerald-400 mb-4">2. Use of Information</h2>
                    <p className="text-slate-300 leading-relaxed">
                        Your information is used to facilitate smooth gaming operations, ensure fair play, process transactions, and comply with regulatory requirements. We do not sell your personal data to third parties.
                    </p>
                </section>

                <section className="mb-8">
                    <h2 className="text-xl font-semibold text-emerald-400 mb-4">3. Security</h2>
                    <p className="text-slate-300 leading-relaxed">
                        We implement high-level encryption and security protocols to protect your sensitive data. Access to your personal information is strictly restricted to authorized personnel for service fulfillment and compliance purposes.
                    </p>
                </section>

                <section className="mb-8">
                    <h2 className="text-xl font-semibold text-emerald-400 mb-4">4. Cookies</h2>
                    <p className="text-slate-300 leading-relaxed">
                        We use essential cookies to maintain your login session and provide a personalized experience. Non-essential tracking is minimized to protect your privacy.
                    </p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold text-emerald-400 mb-4">5. Updates</h2>
                    <p className="text-slate-300 leading-relaxed">
                        This policy may be updated periodically to reflect changes in our practices or regulatory requirements. We will notify you of any significant changes via the app dashboard.
                    </p>
                </section>
            </div>
        </InfoPageLayout>
    );
};

export default PrivacyPolicy;
