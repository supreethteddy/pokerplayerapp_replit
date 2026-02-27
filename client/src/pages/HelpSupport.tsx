import React from 'react';
import InfoPageLayout from '@/components/InfoPageLayout';
import { HelpCircle, Zap, Shield, Wallet } from 'lucide-react';

const HelpSupport: React.FC = () => {
    const faqs = [
        {
            icon: <Wallet className="w-5 h-5 text-emerald-400" />,
            question: "How do I add balance to my account?",
            answer: "All financial operations, including adding balance and cashing out, are handled securely by club cashiers or managers. Please contact your club administrator directly for balance updates."
        },
        {
            icon: <Zap className="w-5 h-5 text-blue-400" />,
            question: "What is 'Ultra-Fast Authentication'?",
            answer: "We use a high-performance session management system that ensures you stay connected without constant re-logins, providing a seamless experience even on unstable mobile networks."
        },
        {
            icon: <Shield className="w-5 h-5 text-purple-400" />,
            question: "Is my KYC data safe?",
            answer: "Yes. Your KYC documents are encrypted and only accessible to authorized verification officers. We adhere to strict data protection standards to ensure your identity remains private."
        },
        {
            icon: <HelpCircle className="w-5 h-5 text-amber-400" />,
            question: "I'm having trouble joining a table.",
            answer: "Ensure you have sufficient balance and that you are not already seated at another table. If the issue persists, try refreshing the dashboard using the refresh button in the header."
        }
    ];

    return (
        <InfoPageLayout title="Help & Support">
            <div className="space-y-8">
                <div>
                    <h2 className="text-xl font-bold text-white mb-6">Frequently Asked Questions</h2>
                    <div className="grid gap-4">
                        {faqs.map((faq, index) => (
                            <div key={index} className="p-4 bg-slate-700/50 rounded-xl border border-slate-600/50">
                                <div className="flex items-center gap-3 mb-2">
                                    {faq.icon}
                                    <h3 className="font-semibold text-white">{faq.question}</h3>
                                </div>
                                <p className="text-sm text-slate-400 pl-8 leading-relaxed">
                                    {faq.answer}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-5 bg-blue-600/10 border border-blue-500/20 rounded-xl">
                    <h3 className="text-blue-400 font-bold mb-2">Still need help?</h3>
                    <p className="text-sm text-slate-300">
                        Our support team is available 24/7 to assist you. You can reach out via the Contact Us page or message your club manager directly.
                    </p>
                </div>
            </div>
        </InfoPageLayout>
    );
};

export default HelpSupport;
