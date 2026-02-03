"use client";

import React from "react";
import { Header } from "./Header";
import { ShieldAlert } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { GpsTracker } from "@/components/dashboard/GpsTracker";

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { loading, profile } = useAuth();

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            </div>
        );
    }

    // Check for Approval
    const isApproved = profile?.isApproved === true || profile?.role === 'admin';

    return (
        <div className="flex min-h-screen flex-col bg-background text-foreground transition-colors duration-300">
            <GpsTracker />
            {/* <Header /> Removed for dashboard layout optimization */}
            <main className="flex-1 pb-20 md:pb-0 pt-4">
                <AuthGuard>
                    {!isApproved ? (
                        <div className="container mx-auto max-w-xl h-[80vh] flex flex-center items-center px-4">
                            <div className="bg-card p-8 rounded-[2.5rem] border border-border shadow-xl shadow-blue-900/5 text-center space-y-6 w-full animate-in zoom-in-95 duration-500">
                                <div className="w-20 h-20 bg-amber-50 dark:bg-amber-900/20 rounded-3xl flex items-center justify-center text-amber-500 mx-auto">
                                    <div className="animate-pulse">
                                        <ShieldAlert size={40} strokeWidth={2.5} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <h2 className="text-2xl font-black text-foreground italic tracking-tighter transform -skew-x-6 uppercase">HESABINIZ ONAY BEKLİYOR</h2>
                                    <p className="text-sm text-muted-foreground font-medium leading-relaxed">
                                        Siteye ve yolculuklara dahil olabilmek için yöneticinin sizi onaylaması gerekmektedir. Lütfen daha sonra tekrar deneyin veya yöneticiyle iletişime geçin.
                                    </p>
                                </div>
                                <div className="pt-4 flex flex-col gap-2">
                                    <button
                                        onClick={() => window.location.reload()}
                                        className="w-full h-12 bg-secondary hover:bg-muted text-secondary-foreground font-black rounded-xl border border-border uppercase tracking-widest text-xs transition-all"
                                    >
                                        DURUMU KONTROL ET
                                    </button>
                                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest italic">
                                        Onaylandığınızda tüm özellikler açılacaktır.
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="container mx-auto max-w-4xl p-4">
                            {children}
                        </div>
                    )}
                </AuthGuard>
            </main>
        </div>
    );
};
