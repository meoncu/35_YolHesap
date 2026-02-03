"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { ShieldAlert, LogOut, Clock } from "lucide-react";
import { motion } from "framer-motion";

export default function PendingApprovalPage() {
    const { profile, logout } = useAuth();

    return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-md text-center"
            >
                <div className="mb-8 flex justify-center">
                    <div className="relative">
                        <div className="w-24 h-24 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600">
                            <Clock size={48} />
                        </div>
                        <div className="absolute -bottom-2 -right-2 bg-background p-1.5 rounded-full border-4 border-background shadow-lg text-amber-500">
                            <ShieldAlert size={24} fill="currentColor" className="text-white" />
                        </div>
                    </div>
                </div>

                <h1 className="text-3xl font-black text-foreground mb-4 uppercase tracking-tight italic transform -skew-x-6">
                    ONAY BEKLENİYOR
                </h1>

                <div className="bg-card border border-border p-6 rounded-[2.5rem] shadow-xl mb-8">
                    <p className="text-muted-foreground font-medium mb-6">
                        Sayın <span className="text-foreground font-black">{profile?.name || "Kullanıcı"}</span>, <br />
                        Hesabınız henüz bir yönetici tarafından onaylanmamıştır. Erişim yetkisi için lütfen grup yöneticisi ile iletişime geçin.
                    </p>

                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-center gap-2 py-3 px-4 bg-muted rounded-2xl text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                            DURUM: ONAY SIRASINDA
                        </div>
                        <Button
                            onClick={() => logout()}
                            variant="outline"
                            className="rounded-2xl h-14 font-black uppercase tracking-widest border-2 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all gap-2"
                        >
                            <LogOut size={18} /> ÇIKIŞ YAP
                        </Button>
                    </div>
                </div>

                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                    YOLPAY • GÜVENLİ ERİŞİM SİSTEMİ
                </p>
            </motion.div>
        </div>
    );
}
