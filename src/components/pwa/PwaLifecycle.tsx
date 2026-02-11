"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

export function PwaLifecycle() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [showInstallPrompt, setShowInstallPrompt] = useState(false);
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        // Register Service Worker
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', function () {
                navigator.serviceWorker.register('/sw.js').then(
                    function (registration) {
                        console.log('Service Worker registration successful with scope: ', registration.scope);
                    },
                    function (err) {
                        console.log('Service Worker registration failed: ', err);
                    }
                );
            });
        }

        // Detect Install Prompt availability
        const handleBeforeInstallPrompt = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);

            // Only show prompt on mobile devices
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

            // Check if user has already dismissed it recently? usually browser handles this.
            // But verify if it's not already installed AND is mobile
            if (!window.matchMedia('(display-mode: standalone)').matches && isMobile) {
                setShowInstallPrompt(true);
            }
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // Detect iOS for manual instructions as iOS doesn't support beforeinstallprompt
        const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

        if (isIosDevice && !isStandalone) {
            // Maybe show a specific iOS instruction toast once per session?
            // For now, let's keep it simple or user might get annoyed.
            setIsIOS(true);
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            setDeferredPrompt(null);
            setShowInstallPrompt(false);
        }
    };

    if (!showInstallPrompt && !isIOS) return null;

    // We can render a custom prompt here.
    // For iOS, perhaps a small persistent banner or just rely on manual "Add to Home Screen"
    // Let's implement a nice looking bottom sheet or toast for Android/Desktop install.

    if (showInstallPrompt) {
        return (
            <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-primary text-primary-foreground p-4 rounded-2xl shadow-2xl z-[100] border-2 border-white/20 animate-in slide-in-from-bottom-5 fade-in duration-300">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                        <h3 className="font-bold text-lg mb-1">Uygulamayı Yükle</h3>
                        <p className="text-sm opacity-90 mb-3">Daha hızlı erişim ve çevdışı kullanım için uygulamayı ana ekranına ekle.</p>
                        <div className="flex gap-2">
                            <Button
                                variant="secondary"
                                size="sm"
                                className="font-bold gap-2 text-xs h-8"
                                onClick={handleInstallClick}
                            >
                                <Download size={14} />
                                YÜKLE
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="font-bold text-xs h-8 hover:bg-white/10 text-white"
                                onClick={() => setShowInstallPrompt(false)}
                            >
                                ŞİMDİ DEĞİL
                            </Button>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowInstallPrompt(false)}
                        className="text-white/70 hover:text-white transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>
        );
    }

    return null;
}
