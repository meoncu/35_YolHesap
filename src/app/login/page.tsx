"use client";

import React, { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Chrome, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

export default function LoginPage() {
    const { user, profile, signInWithGoogle, loading } = useAuth();
    const router = useRouter();
    const [isLoggingIn, setIsLoggingIn] = React.useState(false);

    useEffect(() => {
        if (user && !loading && profile) {
            if (profile.isApproved === false) {
                router.push("/pending-approval");
            } else {
                router.push("/");
            }
        }
    }, [user, loading, profile, router]);

    const handleLogin = async () => {
        setIsLoggingIn(true);
        try {
            await signInWithGoogle();
            toast.success("Giriş başarılı! Yönlendiriliyorsunuz...");
        } catch (error: any) {
            if (error.code !== 'auth/popup-closed-by-user') {
                toast.error("Giriş başarısız oldu. Lütfen tekrar deneyin.");
            }
            setIsLoggingIn(false);
        }
    };

    if (loading) return null;

    return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md"
            >
                <div className="mb-8 text-center">
                    <h1 className="text-4xl font-extrabold tracking-tight text-foreground mb-2">YolPay</h1>
                    <p className="text-muted-foreground">Arkadaş grubunla yolunu ve masrafını paylaş.</p>
                </div>

                <Card className="border-border shadow-2xl overflow-hidden bg-card">
                    <div className="h-2 bg-primary" />
                    <CardHeader className="space-y-1">
                        <CardTitle className="text-2xl text-center text-foreground">Hoş Geldiniz</CardTitle>
                        <CardDescription className="text-center text-muted-foreground">
                            Devam etmek için Google hesabınızla giriş yapın.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <Button
                            onClick={handleLogin}
                            variant="outline"
                            disabled={isLoggingIn}
                            className="w-full h-12 text-lg border-2 border-border hover:bg-muted transition-all flex items-center justify-center gap-3 bg-card text-foreground"
                        >
                            {isLoggingIn ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <Chrome className="w-5 h-5 text-primary" />
                            )}
                            Google ile Giriş Yap
                        </Button>

                        <div className="mt-4 text-center text-sm text-muted-foreground">
                            Giriş yaparak kullanım koşullarını kabul etmiş olursunuz.
                        </div>
                    </CardContent>
                </Card>

                <div className="mt-8 flex justify-center gap-4 text-muted-foreground/50 text-xs">
                    <span>Modern</span>
                    <span>•</span>
                    <span>Güvenli</span>
                    <span>•</span>
                    <span>Adil</span>
                </div>
            </motion.div>
        </div>
    );
}
