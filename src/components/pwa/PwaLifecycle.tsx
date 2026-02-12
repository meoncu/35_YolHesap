"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Download, X, Share, Smartphone, Monitor, ArrowDown, Navigation, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

// Session storage key to avoid showing on every page load
const DISMISS_KEY = "pwa-install-dismissed";
const DISMISS_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export function PwaLifecycle() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [showInstallBanner, setShowInstallBanner] = useState(false);
    const [showIOSGuide, setShowIOSGuide] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);
    const [platform, setPlatform] = useState<'android' | 'ios' | 'desktop'>('desktop');

    useEffect(() => {
        // Register Service Worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').then(
                (registration) => {
                    console.log('[PWA] SW registered:', registration.scope);
                },
                (err) => {
                    console.error('[PWA] SW registration failed:', err);
                }
            );
        }

        // Check if already installed (standalone mode)
        const standalone = window.matchMedia('(display-mode: standalone)').matches
            || (window.navigator as any).standalone === true;
        setIsStandalone(standalone);

        if (standalone) {
            console.log('[PWA] Running in standalone mode');
            return;
        }

        // Detect platform
        const ua = navigator.userAgent;
        const isIos = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
        const isAndroid = /Android/i.test(ua);
        setPlatform(isIos ? 'ios' : isAndroid ? 'android' : 'desktop');

        // Check if user dismissed recently
        const dismissedAt = localStorage.getItem(DISMISS_KEY);
        if (dismissedAt && (Date.now() - parseInt(dismissedAt)) < DISMISS_DURATION) {
            return;
        }

        // Listen for beforeinstallprompt (Chrome, Edge, Opera, Samsung Internet)
        const handleBeforeInstallPrompt = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
            // Show our custom install banner after a short delay
            setTimeout(() => {
                setShowInstallBanner(true);
            }, 2000); // Show after 2 seconds for better UX
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // For iOS - show custom guide after delay
        if (isIos) {
            setTimeout(() => {
                setShowIOSGuide(true);
            }, 3000);
        }

        // For Android browsers that don't fire beforeinstallprompt (some Opera versions)
        // Show a hint after 5 seconds if no prompt received
        if (isAndroid) {
            const fallbackTimer = setTimeout(() => {
                if (!deferredPrompt) {
                    setShowInstallBanner(true);
                }
            }, 5000);

            return () => {
                clearTimeout(fallbackTimer);
                window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            };
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = useCallback(async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log('[PWA] Install outcome:', outcome);

            if (outcome === 'accepted') {
                toast.success("Uygulama yükleniyor! 🎉", {
                    description: "YolTakip ana ekranınıza ekleniyor."
                });
            }
            setDeferredPrompt(null);
            setShowInstallBanner(false);
        } else {
            // Fallback for browsers that don't support the prompt API
            // Show manual instructions
            if (platform === 'android') {
                toast.info("Uygulamayı yüklemek için:", {
                    description: "Tarayıcı menüsü (⋮) → 'Ana ekrana ekle' veya 'Uygulamayı yükle' seçeneğine dokunun.",
                    duration: 10000
                });
            }
        }
    }, [deferredPrompt, platform]);

    const handleDismiss = useCallback(() => {
        setShowInstallBanner(false);
        setShowIOSGuide(false);
        localStorage.setItem(DISMISS_KEY, Date.now().toString());
    }, []);

    // Don't show anything if already installed
    if (isStandalone) return null;

    // iOS Guide
    if (showIOSGuide) {
        return (
            <div className="fixed inset-0 z-[200] flex items-end justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-500">
                <div className="w-full max-w-md bg-card rounded-3xl shadow-2xl border border-border overflow-hidden animate-in slide-in-from-bottom-8 duration-500">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                        <div className="relative">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="bg-white/20 p-2 rounded-xl">
                                    <Navigation size={24} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black">YolTakip'i Yükle</h3>
                                    <p className="text-xs opacity-80 font-medium">iPhone'unuza ekleyin</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Steps */}
                    <div className="p-5 space-y-4">
                        <div className="flex items-start gap-3">
                            <div className="bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-black text-sm">1</div>
                            <div>
                                <p className="text-sm font-bold text-foreground">Paylaş butonuna dokunun</p>
                                <p className="text-xs text-muted-foreground">Alt menüdeki <Share size={12} className="inline" /> simgesine dokunun</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-black text-sm">2</div>
                            <div>
                                <p className="text-sm font-bold text-foreground">"Ana Ekrana Ekle" seçin</p>
                                <p className="text-xs text-muted-foreground">Listeyi aşağı kaydırıp bulun</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-black text-sm">3</div>
                            <div>
                                <p className="text-sm font-bold text-foreground">"Ekle" butonuna dokunun</p>
                                <p className="text-xs text-muted-foreground">Uygulama ana ekranınıza eklenecek!</p>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-5 pb-5">
                        <Button
                            variant="ghost"
                            className="w-full h-12 rounded-xl text-sm font-bold text-muted-foreground"
                            onClick={handleDismiss}
                        >
                            Anladım, Sonra Yaparım
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // Android / Desktop install banner
    if (showInstallBanner) {
        return (
            <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-500">
                <div className="w-full max-w-md bg-card rounded-3xl shadow-2xl border border-border overflow-hidden animate-in slide-in-from-bottom-8 duration-500">
                    {/* Gradient Header */}
                    <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-6 text-white relative overflow-hidden">
                        {/* Decorative circles */}
                        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

                        <div className="relative">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="bg-white/20 backdrop-blur-sm p-3 rounded-2xl shadow-lg">
                                    <Navigation size={28} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black tracking-tight">YolTakip</h3>
                                    <p className="text-xs opacity-80 font-medium">Yolculuk ve Ödeme Takibi</p>
                                </div>
                            </div>

                            <p className="text-sm opacity-90 leading-relaxed">
                                Uygulamayı telefonunuza yükleyin! Daha hızlı erişim, tam ekran deneyim ve GPS takibi için ideal.
                            </p>
                        </div>
                    </div>

                    {/* Features */}
                    <div className="p-5 space-y-3">
                        <div className="grid grid-cols-3 gap-2">
                            <div className="bg-muted/50 rounded-2xl p-3 text-center">
                                <Smartphone size={20} className="mx-auto text-blue-500 mb-1" />
                                <p className="text-[9px] font-bold text-muted-foreground uppercase">Tam Ekran</p>
                            </div>
                            <div className="bg-muted/50 rounded-2xl p-3 text-center">
                                <MapPin size={20} className="mx-auto text-emerald-500 mb-1" />
                                <p className="text-[9px] font-bold text-muted-foreground uppercase">GPS Takip</p>
                            </div>
                            <div className="bg-muted/50 rounded-2xl p-3 text-center">
                                <Download size={20} className="mx-auto text-purple-500 mb-1" />
                                <p className="text-[9px] font-bold text-muted-foreground uppercase">Hızlı Erişim</p>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="px-5 pb-5 space-y-2">
                        <Button
                            onClick={handleInstallClick}
                            className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-600/30 transition-all active:scale-[0.98]"
                        >
                            <Download size={18} className="mr-2" />
                            {deferredPrompt ? "UYGULAMAYI YÜKLE" : "NASIL YÜKLENİR?"}
                        </Button>
                        <Button
                            variant="ghost"
                            className="w-full h-10 rounded-xl text-xs font-bold text-muted-foreground"
                            onClick={handleDismiss}
                        >
                            Şimdi Değil
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return null;
}
