"use client";

import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, User, Camera, Save, ArrowLeft, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { updateUserProfile } from "@/lib/db-service";
import { toast } from "sonner";
import Link from "next/link";
import { cn } from "@/lib/utils";

const AVATARS = [
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Buddy",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Caleb",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Dusty",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Eden",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Faith",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Gracie",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Harley",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Irina",
];

export default function ProfilePage() {
    const { profile, user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        phone: "",
        photoURL: ""
    });

    useEffect(() => {
        if (profile) {
            setFormData({
                name: profile.name || "",
                phone: profile.phone || "",
                photoURL: profile.photoURL || ""
            });
        }
    }, [profile]);

    const handleSave = async () => {
        if (!user) return;
        setLoading(true);
        try {
            await updateUserProfile(user.uid, formData);
            toast.success("Profil başarıyla güncellendi.");
            // In a real app, you'd want to refresh the local context profile as well
            // For now, we rely on the next page refresh or context update logic
            window.location.reload(); // Quick way to sync context with DB
        } catch (error) {
            console.error("Error updating profile:", error);
            toast.error("Profil güncellenirken bir hata oluştu.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <AppLayout>
            <div className="max-w-2xl mx-auto space-y-6">
                <header className="flex items-center gap-4">
                    <Link href="/">
                        <Button variant="ghost" size="icon" className="rounded-full">
                            <ArrowLeft size={20} />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Profil Ayarları</h1>
                        <p className="text-gray-500">Kişisel bilgilerinizi ve avatarınızı yönetin.</p>
                    </div>
                </header>

                <Card className="border-none shadow-md overflow-hidden bg-white">
                    <CardHeader className="bg-gray-50/50 border-b pb-8">
                        <div className="flex flex-col items-center space-y-4">
                            <div className="relative">
                                <Avatar className="h-28 w-28 border-4 border-white shadow-xl">
                                    <AvatarImage src={formData.photoURL} alt={formData.name} />
                                    <AvatarFallback className="text-3xl font-bold bg-blue-50 text-[#143A5A]">
                                        {formData.name?.charAt(0) || "U"}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="absolute bottom-0 right-0 p-1.5 bg-[#143A5A] rounded-full text-white border-2 border-white shadow-lg">
                                    <Camera size={16} />
                                </div>
                            </div>
                            <div className="text-center">
                                <CardTitle className="text-xl">{formData.name}</CardTitle>
                                <CardDescription>{profile?.email}</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-8 space-y-8">
                        {/* Avatar Selection */}
                        <div className="space-y-4">
                            <Label className="text-sm font-bold text-gray-600 uppercase tracking-wider">Avatar Seçin</Label>
                            <div className="grid grid-cols-5 gap-3">
                                {AVATARS.map((url) => (
                                    <button
                                        key={url}
                                        onClick={() => setFormData(prev => ({ ...prev, photoURL: url }))}
                                        className={cn(
                                            "relative rounded-xl overflow-hidden border-2 transition-all hover:scale-105 active:scale-95 shadow-sm",
                                            formData.photoURL === url ? "border-[#143A5A] ring-2 ring-[#143A5A]/20" : "border-transparent bg-gray-50"
                                        )}
                                    >
                                        <img src={url} alt="Avatar Option" className="w-full h-full object-cover" />
                                        {formData.photoURL === url && (
                                            <div className="absolute inset-0 bg-[#143A5A]/10 flex items-center justify-center">
                                                <div className="bg-[#143A5A] p-0.5 rounded-full text-white">
                                                    <Check size={12} />
                                                </div>
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="name">Ad Soyad</Label>
                                <Input
                                    id="name"
                                    value={formData.name}
                                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Adınız ve soyadınız"
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="phone">Telefon Numarası</Label>
                                <Input
                                    id="phone"
                                    value={formData.phone}
                                    onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                    placeholder="0532 ..."
                                />
                            </div>
                        </div>

                        <Button
                            className="w-full gradient-primary h-12 text-lg shadow-lg flex items-center gap-2"
                            onClick={handleSave}
                            disabled={loading}
                        >
                            {loading ? (
                                <Loader2 className="animate-spin" size={20} />
                            ) : (
                                <Save size={20} />
                            )}
                            Değişiklikleri Kaydet
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
