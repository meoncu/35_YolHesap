"use client";

import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/context/AuthContext";
import { getUsers, updateUserProfile, deleteUserProfile, getAppSettings, updateAppSettings, AppSettings, saveLocation } from "@/lib/db-service";
import { UserProfile, UserRole } from "@/types";
import { toast } from "sonner";
import {
    Shield,
    Trash2,
    Edit,
    Check,
    X,
    Search,
    User,
    Loader2,
    MoreVertical,
    CheckCircle2,
    AlertCircle,
    Info,
    Calculator,
    ArrowLeft,
    Activity
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion, AnimatePresence } from "framer-motion";
import { GoogleMap, Polyline, useJsApiLoader, Marker } from '@react-google-maps/api';
import { getRoute } from "@/lib/db-service"; // Ensure getRoute is imported
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const mapContainerStyle = {
    width: '100%',
    height: '500px',
    borderRadius: '1.5rem'
};

const defaultCenter = {
    lat: 39.9334, // Ankara default
    lng: 32.8597
};

export default function AdminPage() {
    const { user: currentUser } = useAuth();
    const [activeTab, setActiveTab] = useState<"users" | "routes" | "logs" | "settings">("users");


    // Route Tracking State
    const [routeDate, setRouteDate] = useState(new Date());
    const [selectedDriver, setSelectedDriver] = useState<string>("");
    const [routePath, setRoutePath] = useState<any[]>([]);
    const [mapLoading, setMapLoading] = useState(false);
    const [isTestingGps, setIsTestingGps] = useState(false);

    // Settings State
    const [settings, setSettings] = useState<AppSettings>({ dailyFee: 100 });
    const [isSavingSettings, setIsSavingSettings] = useState(false);

    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
        libraries: ["places", "geometry"]
    });

    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    // Edit State
    const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editForm, setEditForm] = useState<{
        name: string;
        photoURL: string;
        role: UserRole;
        vehicle: {
            plate: string;
            model: string;
            fuelType: 'benzin' | 'motorin' | 'lpg' | 'elektrik';
            consumption: number;
        };
    }>({
        name: "",
        photoURL: "",
        role: "user",
        vehicle: { plate: "", model: "", fuelType: "benzin", consumption: 7.0 }
    });

    useEffect(() => {
        fetchUsers();
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        const data = await getAppSettings();
        setSettings(data);
    };

    const handleSaveSettings = async () => {
        setIsSavingSettings(true);
        try {
            await updateAppSettings(settings);
            toast.success("Ayarlar kaydedildi.");
        } catch (error) {
            toast.error("Ayarlar kaydedilirken hata oluştu.");
        } finally {
            setIsSavingSettings(false);
        }
    };

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const data = await getUsers();
            setUsers(data);
        } catch (error) {
            console.error("Error fetching users:", error);
            toast.error("Kullanıcılar yüklenirken hata oluştu.");
        } finally {
            setLoading(false);
        }
    };

    const handleApproveToggle = async (user: UserProfile) => {
        try {
            const newStatus = !user.isApproved;
            await updateUserProfile(user.uid, { isApproved: newStatus });

            setUsers(users.map(u => u.uid === user.uid ? { ...u, isApproved: newStatus } : u));
            toast.success(newStatus ? "Kullanıcı onaylandı." : "Kullanıcı onayı kaldırıldı.");
        } catch (error) {
            toast.error("Güncelleme başarısız.");
        }
    };

    const handleDelete = async (uid: string) => {
        if (!confirm("Bu kullanıcıyı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.")) return;

        try {
            await deleteUserProfile(uid);
            setUsers(users.filter(u => u.uid !== uid));
            toast.success("Kullanıcı silindi.");
        } catch (error) {
            toast.error("Silme işlemi başarısız.");
        }
    };

    const openEditDialog = (user: UserProfile) => {
        setEditingUser(user);
        setEditForm({
            name: user.name || "",
            photoURL: user.photoURL || "",
            role: user.role || "user",
            vehicle: {
                plate: user.vehicle?.plate || "",
                model: user.vehicle?.model || "",
                fuelType: user.vehicle?.fuelType || "benzin",
                consumption: user.vehicle?.consumption || 7.0
            }
        });
        setIsEditDialogOpen(true);
    };

    const handleSaveEdit = async () => {
        if (!editingUser) return;
        try {
            await updateUserProfile(editingUser.uid, {
                name: editForm.name,
                photoURL: editForm.photoURL,
                role: editForm.role as any,
                vehicle: editForm.vehicle
            });

            setUsers(users.map(u => u.uid === editingUser.uid ? { ...u, ...editForm, role: editForm.role as UserRole } : u));
            toast.success("Kullanıcı güncellendi.");
            setIsEditDialogOpen(false);
        } catch (error) {
            toast.error("Güncelleme başarısız.");
        }
    };

    const handleFetchRoute = async () => {
        if (!selectedDriver) {
            toast.error("Lütfen bir sürücü seçin.");
            return;
        }
        setMapLoading(true);
        try {
            const dateStr = format(routeDate, "yyyy-MM-dd");
            const points = await getRoute(dateStr, selectedDriver);
            // Convert to Google Maps format { lat, lng }
            const path = points.map((p: any) => ({ lat: p.latitude, lng: p.longitude }));
            setRoutePath(path);

            if (path.length === 0) {
                toast.info("Bu tarih ve kullanıcı için kayıtlı rota bulunamadı.");
            } else {
                toast.success(`${path.length} konum noktası yüklendi.`);
            }
        } catch (error) {
            console.error("Error fetching route:", error);
            toast.error("Rota yüklenirken hata oluştu.");
        } finally {
            setMapLoading(false);
        }
    };

    const handleTestGpsWrite = async () => {
        setIsTestingGps(true);
        if (!navigator.geolocation) {
            toast.error("Tarayıcınız konum servisini desteklemiyor.");
            setIsTestingGps(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(async (position) => {
            try {
                const { latitude, longitude } = position.coords;
                // Save a test location for the current user
                // Use a standard function that is used in GpsTracker
                if (!currentUser) {
                    toast.error("Kullanıcı oturumu bulunamadı.");
                    return;
                }

                await saveLocation(currentUser.uid, latitude, longitude);

                toast.success(`GPS Test Başarılı! Konum: ${latitude.toFixed(4)}, ${longitude.toFixed(4)} veritabanına kaydedildi.`);
            } catch (error) {
                console.error("GPS Test Error:", error);
                toast.error("GPS verisi veritabanına yazılamadı.");
            } finally {
                setIsTestingGps(false);
            }
        }, (error) => {
            console.error("Geolocation error:", error);
            toast.error(`Konum alınamadı: ${error.message}`);
            setIsTestingGps(false);
        }, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        });
    };

    const filteredUsers = users.filter(u =>
        u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <AppLayout>
            <div className="space-y-6 pb-24">
                <div className="flex items-center gap-4">
                    <Link href="/">
                        <Button variant="ghost" size="icon" className="rounded-full">
                            <ArrowLeft size={20} />
                        </Button>
                    </Link>
                    <div className="flex flex-col gap-1">
                        <h1 className="text-3xl font-black text-foreground tracking-tight">Yönetim Paneli</h1>
                        <p className="text-muted-foreground font-medium">Sistem yönetimi ve takip işlemleri.</p>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex p-1 bg-muted/50 rounded-xl w-fit border border-border">
                    <button
                        onClick={() => setActiveTab("users")}
                        className={cn("px-4 py-2 rounded-lg text-sm font-bold transition-all", activeTab === "users" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}
                    >
                        Kullanıcılar
                    </button>
                    <button
                        onClick={() => setActiveTab("routes")}
                        className={cn("px-4 py-2 rounded-lg text-sm font-bold transition-all", activeTab === "routes" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}
                    >
                        Güzergah Takibi
                    </button>
                    <button
                        onClick={() => setActiveTab("logs")}
                        className={cn("px-4 py-2 rounded-lg text-sm font-bold transition-all", activeTab === "logs" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}
                    >
                        Kayıtlar
                    </button>
                    <button
                        onClick={() => setActiveTab("settings")}
                        className={cn("px-4 py-2 rounded-lg text-sm font-bold transition-all", activeTab === "settings" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}
                    >
                        Sistem Ayarları
                    </button>
                </div>

                {activeTab === "users" ? (
                    <>
                        {/* Search Bar */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                            <Input
                                placeholder="İsim veya e-posta ile ara..."
                                className="pl-10 h-12 bg-card border-border rounded-xl shadow-sm text-base text-foreground"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* Users List */}
                        <div className="grid grid-cols-1 gap-4">
                            <AnimatePresence>
                                {loading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <Loader2 className="animate-spin text-blue-500" size={32} />
                                    </div>
                                ) : (
                                    filteredUsers.map((user) => (
                                        <motion.div
                                            key={user.uid}
                                            layout
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            className="bg-card p-4 rounded-2xl shadow-sm border border-border flex items-center justify-between group"
                                        >
                                            <div className="flex items-center gap-4 overflow-hidden">
                                                <div className="relative">
                                                    <Avatar className="h-12 w-12 border-2 border-card shadow-sm">
                                                        <AvatarImage src={user.photoURL} />
                                                        <AvatarFallback className="bg-primary/10 text-primary font-bold">
                                                            {user.name?.charAt(0) || "U"}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    {user.isApproved && (
                                                        <div className="absolute -bottom-1 -right-1 bg-green-500 text-white p-0.5 rounded-full border-2 border-card">
                                                            <Check size={10} strokeWidth={4} />
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex flex-col min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-foreground truncate">{user.name || "İsimsiz"}</span>
                                                        {user.role === 'admin' && (
                                                            <span className="bg-primary/10 text-primary text-[10px] font-black px-1.5 py-0.5 rounded uppercase">YÖNETİCİ</span>
                                                        )}
                                                    </div>
                                                    <span className="text-sm text-muted-foreground truncate">{user.email}</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className={cn(
                                                        "rounded-xl transition-colors",
                                                        user.isApproved ? "text-green-600 bg-green-50 hover:bg-green-100" : "text-gray-400 hover:bg-gray-100"
                                                    )}
                                                    onClick={() => handleApproveToggle(user)}
                                                    title={user.isApproved ? "Onayı Kaldır" : "Onayla"}
                                                >
                                                    <CheckCircle2 size={18} />
                                                </Button>

                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button size="icon" variant="ghost" className="rounded-xl text-gray-400 hover:text-gray-900">
                                                            <MoreVertical size={18} />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="rounded-xl">
                                                        <DropdownMenuItem onClick={() => openEditDialog(user)} className="gap-2 font-medium">
                                                            <Edit size={16} /> Düzenle
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() => handleDelete(user.uid)}
                                                            className="gap-2 text-red-600 focus:text-red-600 focus:bg-red-50 font-medium"
                                                        >
                                                            <Trash2 size={16} /> Kullanıcıyı Sil
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </motion.div>
                                    ))
                                )}
                            </AnimatePresence>
                            {!loading && filteredUsers.length === 0 && (
                                <div className="text-center py-12 text-gray-400">
                                    <User size={48} className="mx-auto mb-4 opacity-20" />
                                    <p>Kullanıcı bulunamadı.</p>
                                </div>
                            )}
                        </div>
                    </>
                ) : activeTab === "routes" ? (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-card p-6 rounded-3xl border border-border shadow-sm space-y-6">
                            <div className="flex flex-col md:flex-row gap-4">
                                <div className="space-y-2 flex-1">
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Tarih Seç</label>
                                    <Input
                                        type="date"
                                        value={format(routeDate, "yyyy-MM-dd")}
                                        onChange={(e) => setRouteDate(new Date(e.target.value))}
                                        className="h-12 rounded-xl border-border bg-muted text-foreground"
                                    />
                                </div>
                                <div className="space-y-2 flex-1">
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Sürücü Seç</label>
                                    <select
                                        className="flex h-12 w-full items-center justify-between rounded-xl border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        value={selectedDriver}
                                        onChange={(e) => setSelectedDriver(e.target.value)}
                                    >
                                        <option value="" className="bg-card">Sürücü Seçiniz...</option>
                                        {users.map(u => (
                                            <option key={u.uid} value={u.uid} className="bg-card">{u.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex items-end">
                                    <Button onClick={handleFetchRoute} className="h-12 px-8 rounded-xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground w-full md:w-auto">
                                        {mapLoading ? <Loader2 className="animate-spin mr-2" /> : "Rotayı Getir"}
                                    </Button>
                                </div>
                            </div>

                            {/* Map Container */}
                            <div className="relative w-full h-[500px] bg-muted rounded-3xl overflow-hidden border border-border">
                                {isLoaded ? (
                                    <GoogleMap
                                        mapContainerStyle={mapContainerStyle}
                                        center={routePath.length > 0 ? routePath[0] : defaultCenter} // Center on start of route or default
                                        zoom={routePath.length > 0 ? 12 : 10}
                                        options={{
                                            streetViewControl: false,
                                            mapTypeControl: false,
                                            fullscreenControl: true,
                                            zoomControl: true,
                                            styles: [ // Optional: Custom map styles can be added here
                                                { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] }
                                            ]
                                        }}
                                    >
                                        {routePath.length > 0 && (
                                            <>
                                                <Polyline
                                                    path={routePath}
                                                    options={{
                                                        strokeColor: "#2563EB",
                                                        strokeOpacity: 0.8,
                                                        strokeWeight: 5,
                                                    }}
                                                />
                                                <Marker position={routePath[0]} label="B" />
                                                <Marker position={routePath[routePath.length - 1]} label="F" />
                                            </>
                                        )}
                                    </GoogleMap>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-gray-400 font-medium">
                                        Harita yükleniyor...
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2 text-xs text-muted-foreground font-medium px-2">
                                <Info size={14} />
                                <span>GPS verileri anlık olarak sürücünün cihazından alınır. Kesintisiz takip için sürücünün GPS izni vermiş olması ve uygulamanın açık olması gerekir.</span>
                            </div>
                        </div>
                    </div>
                ) : activeTab === "logs" ? (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-card p-12 rounded-[3rem] border border-border shadow-xl shadow-blue-900/5 text-center space-y-6">
                            <div className="bg-primary/10 w-24 h-24 rounded-full flex items-center justify-center mx-auto text-primary">
                                <Activity size={48} />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-2xl font-black text-foreground">Detaylı Güzergâh Kayıtları</h3>
                                <p className="text-muted-foreground max-w-md mx-auto">
                                    Sabah ve akşam yolculuklarınızın dakika bazlı konum, hız ve cadde bilgilerini içeren detaylı kayıtlarına buradan ulaşabilirsiniz.
                                </p>
                            </div>
                            <Link href="/admin/tracks" className="block">
                                <Button className="h-16 px-10 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest text-sm shadow-xl shadow-primary/20">
                                    Kayıtları Görüntüle
                                </Button>
                            </Link>
                        </div>
                    </div>

                ) : (

                    // SETTINGS TAB CONTENT
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl">
                        <div className="bg-card p-8 rounded-[2.5rem] border border-border shadow-xl shadow-blue-900/5 space-y-8">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                                    <Shield size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-foreground">Genel Sistem Ayarları</h3>
                                    <p className="text-sm text-muted-foreground font-medium leading-none mt-1">Uygulama genelindeki hesaplamaları etkiler.</p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-black text-foreground uppercase tracking-widest flex items-center gap-2">
                                            <Calculator size={14} className="text-primary" />
                                            Günlük Sabit Ücret (₺)
                                        </label>
                                        <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded">VARSAYILAN: 100 ₺</span>
                                    </div>
                                    <div className="relative group">
                                        <Input
                                            type="number"
                                            value={settings.dailyFee}
                                            onChange={(e) => setSettings({ ...settings, dailyFee: parseFloat(e.target.value) || 0 })}
                                            className="h-16 rounded-2xl border-border bg-muted/50 text-2xl font-black px-6 focus:bg-card transition-all focus:ring-4 focus:ring-primary/10 placeholder:text-muted-foreground/30 text-foreground"
                                            placeholder="100"
                                        />
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/30 font-black text-xl italic group-focus-within:text-primary">TL</div>
                                    </div>
                                    <p className="text-xs text-muted-foreground font-medium pl-1 leading-relaxed">
                                        Hesap makinelerinde ve ana sayfadaki borç/alacak tablolarında kullanılan temel birim fiyattır. Yarım gidişler bu değerin yarısı olarak hesaplanır.
                                    </p>
                                </div>

                                <div className="pt-4">
                                    <Button
                                        onClick={handleSaveSettings}
                                        disabled={isSavingSettings}
                                        className="w-full h-16 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest text-sm shadow-xl shadow-primary/20 disabled:opacity-50 group"
                                    >
                                        {isSavingSettings ? (
                                            <Loader2 className="animate-spin" />
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <Check size={20} strokeWidth={3} />
                                                AYARLARI KAYDET
                                            </div>
                                        )}
                                    </Button>
                                    <p className="text-[10px] text-center text-muted-foreground mt-4 font-bold uppercase tracking-widest italic leading-none">
                                        * DEĞİŞİKLİKLER TÜM KULLANICILAR İÇİN ANINDA GEÇERLİ OLUR.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Edit User Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Kullanıcı Bilgilerini Düzenle</DialogTitle>
                        <DialogDescription>
                            Kullanıcının site genelinde görünen ismini buradan değiştirebilirsiniz.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto px-1">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Site İçi Görünen İsim</label>
                            <Input
                                value={editForm.name}
                                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                placeholder="Ad Soyad"
                            />
                            <p className="text-[10px] text-gray-500">Bu isim, ana sayfa ve araç planında görünecektir.</p>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Profil Fotoğrafı URL</label>
                            <Input
                                value={editForm.photoURL}
                                onChange={(e) => setEditForm({ ...editForm, photoURL: e.target.value })}
                                placeholder="https://..."
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Rol</label>
                            <select
                                className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                value={editForm.role}
                                onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })}
                            >
                                <option value="user">Kullanıcı</option>
                                <option value="admin">Yönetici</option>
                            </select>
                        </div>

                        <div className="border-t pt-4 mt-4 space-y-4">
                            <h4 className="font-bold text-gray-900 text-sm uppercase tracking-wider flex items-center gap-2">
                                <span className="w-1 h-4 bg-blue-500 rounded-full" /> Araç Bilgileri
                            </h4>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-500">Plaka</label>
                                    <Input
                                        value={editForm.vehicle.plate}
                                        onChange={(e) => setEditForm({
                                            ...editForm,
                                            vehicle: { ...editForm.vehicle, plate: e.target.value.toUpperCase() }
                                        })}
                                        placeholder="06 ABC 123"
                                        className="uppercase"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-500">Marka / Model</label>
                                    <Input
                                        value={editForm.vehicle.model}
                                        onChange={(e) => setEditForm({
                                            ...editForm,
                                            vehicle: { ...editForm.vehicle, model: e.target.value }
                                        })}
                                        placeholder="Fiat Egea"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-500">Yakıt Tipi</label>
                                    <select
                                        className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        value={editForm.vehicle.fuelType}
                                        onChange={(e) => setEditForm({
                                            ...editForm,
                                            vehicle: { ...editForm.vehicle, fuelType: e.target.value as any }
                                        })}
                                    >
                                        <option value="benzin">Benzin</option>
                                        <option value="motorin">Motorin (Dizel)</option>
                                        <option value="lpg">LPG</option>
                                        <option value="elektrik">Elektrik</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-500">Tüketim (L/100km)</label>
                                    <Input
                                        type="number"
                                        step="0.1"
                                        value={editForm.vehicle.consumption}
                                        onChange={(e) => setEditForm({
                                            ...editForm,
                                            vehicle: { ...editForm.vehicle, consumption: parseFloat(e.target.value) || 0 }
                                        })}
                                        placeholder="7.5"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="rounded-xl">İptal</Button>
                        <Button onClick={handleSaveEdit} className="bg-blue-600 hover:bg-blue-700 rounded-xl">Kaydet</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
