"use client";

import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/context/AuthContext";
import { getUsers, updateUserProfile, deleteUserProfile } from "@/lib/db-service";
import { UserProfile } from "@/types";
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
    Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
    const [activeTab, setActiveTab] = useState<"users" | "routes">("users");

    // Route Tracking State
    const [routeDate, setRouteDate] = useState(new Date());
    const [selectedDriver, setSelectedDriver] = useState<string>("");
    const [routePath, setRoutePath] = useState<any[]>([]);
    const [mapLoading, setMapLoading] = useState(false);

    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""
    });

    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    // Edit State
    const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editForm, setEditForm] = useState({ name: "", photoURL: "", role: "user" });

    useEffect(() => {
        fetchUsers();
    }, []);

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
            role: user.role || "user"
        });
        setIsEditDialogOpen(true);
    };

    const handleSaveEdit = async () => {
        if (!editingUser) return;
        try {
            await updateUserProfile(editingUser.uid, {
                name: editForm.name,
                photoURL: editForm.photoURL,
                role: editForm.role as any
            });

            setUsers(users.map(u => u.uid === editingUser.uid ? { ...u, ...editForm } : u));
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

    const filteredUsers = users.filter(u =>
        u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <AppLayout>
            <div className="space-y-6 pb-24">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight">Yönetim Paneli</h1>
                    <p className="text-gray-500 font-medium">Sistem yönetimi ve takip işlemleri.</p>
                </div>

                {/* Tab Navigation */}
                <div className="flex p-1 bg-gray-100/50 rounded-xl w-fit">
                    <button
                        onClick={() => setActiveTab("users")}
                        className={cn("px-4 py-2 rounded-lg text-sm font-bold transition-all", activeTab === "users" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700")}
                    >
                        Kullanıcılar
                    </button>
                    <button
                        onClick={() => setActiveTab("routes")}
                        className={cn("px-4 py-2 rounded-lg text-sm font-bold transition-all", activeTab === "routes" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700")}
                    >
                        Güzergah Takibi
                    </button>
                </div>

                {activeTab === "users" ? (
                    <>
                        {/* Search Bar */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <Input
                                placeholder="İsim veya e-posta ile ara..."
                                className="pl-10 h-12 bg-white border-gray-200 rounded-xl shadow-sm text-base"
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
                                            className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between group"
                                        >
                                            <div className="flex items-center gap-4 overflow-hidden">
                                                <div className="relative">
                                                    <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
                                                        <AvatarImage src={user.photoURL} />
                                                        <AvatarFallback className="bg-blue-50 text-blue-600 font-bold">
                                                            {user.name?.charAt(0) || "U"}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    {user.isApproved && (
                                                        <div className="absolute -bottom-1 -right-1 bg-green-500 text-white p-0.5 rounded-full border-2 border-white">
                                                            <Check size={10} strokeWidth={4} />
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex flex-col min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-gray-900 truncate">{user.name || "İsimsiz"}</span>
                                                        {user.role === 'admin' && (
                                                            <span className="bg-indigo-100 text-indigo-700 text-[10px] font-black px-1.5 py-0.5 rounded uppercase">YÖNETİCİ</span>
                                                        )}
                                                    </div>
                                                    <span className="text-sm text-gray-500 truncate">{user.email}</span>
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
                ) : (
                    // ROUTES TAB CONTENT
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-6">
                            <div className="flex flex-col md:flex-row gap-4">
                                <div className="space-y-2 flex-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Tarih Seç</label>
                                    <Input
                                        type="date"
                                        value={format(routeDate, "yyyy-MM-dd")}
                                        onChange={(e) => setRouteDate(new Date(e.target.value))}
                                        className="h-12 rounded-xl border-gray-200"
                                    />
                                </div>
                                <div className="space-y-2 flex-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Sürücü Seç</label>
                                    <select
                                        className="flex h-12 w-full items-center justify-between rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 border-gray-200"
                                        value={selectedDriver}
                                        onChange={(e) => setSelectedDriver(e.target.value)}
                                    >
                                        <option value="">Sürücü Seçiniz...</option>
                                        {users.map(u => (
                                            <option key={u.uid} value={u.uid}>{u.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex items-end">
                                    <Button onClick={handleFetchRoute} className="h-12 px-8 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white w-full md:w-auto">
                                        {mapLoading ? <Loader2 className="animate-spin mr-2" /> : "Rotayı Getir"}
                                    </Button>
                                </div>
                            </div>

                            {/* Map Container */}
                            <div className="relative w-full h-[500px] bg-gray-50 rounded-3xl overflow-hidden border border-gray-200">
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

                            <div className="flex gap-2 text-xs text-gray-500 font-medium px-2">
                                <Info size={14} />
                                <span>GPS verileri anlık olarak sürücünün cihazından alınır. Kesintisiz takip için sürücünün GPS izni vermiş olması ve uygulamanın açık olması gerekir.</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Edit User Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Kullanıcıyı Düzenle</DialogTitle>
                        <DialogDescription>
                            Kullanıcı bilgilerini güncelleyin.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">İsim Soyisim</label>
                            <Input
                                value={editForm.name}
                                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                placeholder="Ad Soyad"
                            />
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
                                className="w-full flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={editForm.role}
                                onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                            >
                                <option value="user">Kullanıcı</option>
                                <option value="admin">Yönetici</option>
                            </select>
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
