import React, { useState } from 'react';
import InfoPageLayout from '@/components/InfoPageLayout';
import { Mail, Phone, MapPin, Send, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

const ContactUs: React.FC = () => {
    const { toast } = useToast();
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        // Simulate API call
        setTimeout(() => {
            setSubmitting(false);
            toast({
                title: "Message Sent! 📩",
                description: "Thank you for reaching out. We'll get back to you soon.",
                className: "bg-emerald-600 text-white border-none"
            });
            (e.target as HTMLFormElement).reset();
        }, 1500);
    };

    return (
        <InfoPageLayout title="Contact Us">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                {/* Contact Info */}
                <div className="space-y-8">
                    <div>
                        <h2 className="text-xl font-bold text-white mb-4">Get in Touch</h2>
                        <p className="text-slate-400 text-sm leading-relaxed">
                            Have questions or feedback? We'd love to hear from you. Use the contact information below or fill out the form to send us a direct message.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-start gap-4 p-4 bg-slate-700/30 rounded-xl border border-slate-700/50">
                            <div className="p-2 bg-blue-600/20 rounded-lg">
                                <Mail className="w-5 h-5 text-blue-400" />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Email Support</p>
                                <p className="text-sm text-white font-medium">support@pokerplayer.app</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4 p-4 bg-slate-700/30 rounded-xl border border-slate-700/50">
                            <div className="p-2 bg-emerald-600/20 rounded-lg">
                                <MessageSquare className="w-5 h-5 text-emerald-400" />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">WhatsApp Support</p>
                                <p className="text-sm text-white font-medium">+91 98765 43210</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4 p-4 bg-slate-700/30 rounded-xl border border-slate-700/50">
                            <div className="p-2 bg-purple-600/20 rounded-lg">
                                <MapPin className="w-5 h-5 text-purple-400" />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Club Location</p>
                                <p className="text-sm text-white font-medium">Prestige Tower, Residency Road, Bangalore</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Contact Form */}
                <div className="bg-slate-700/20 p-6 rounded-2xl border border-slate-700/50">
                    <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                        <Send className="w-4 h-4 text-blue-400" />
                        Send a Message
                    </h3>
                    <form className="space-y-4" onSubmit={handleSubmit}>
                        <div className="space-y-1.5">
                            <label className="text-xs text-slate-400 ml-1">Subject</label>
                            <Input
                                placeholder="What can we help you with?"
                                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 focus:ring-blue-500"
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs text-slate-400 ml-1">Message</label>
                            <Textarea
                                placeholder="Type your message here..."
                                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 focus:ring-blue-500 min-h-[120px]"
                                required
                            />
                        </div>
                        <Button
                            type="submit"
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white h-11 font-bold"
                            disabled={submitting}
                        >
                            {submitting ? "Sending..." : "Send Message"}
                        </Button>
                    </form>
                </div>
            </div>
        </InfoPageLayout>
    );
};

export default ContactUs;
