"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/context/AuthContext";
import { GoogleMap, useJsApiLoader, Polyline, Marker } from "@react-google-maps/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getAllDrivingTracks, getUsers, getTracksByDateRange } from "@/lib/db-service";
import { DrivingTrack, DrivingTrackPoint, UserProfile } from "@/types";
import { format, parseISO, startOfMonth, endOfMonth, subMonths, addMonths, eachDayOfInterval, isSameMonth } from "date-fns";
import { tr } from "date-fns/locale";
import {
    MapPin, Navigation, Clock, Gauge, Calendar, ChevronRight, Activity,
    Map as MapIcon, Loader2, AlertCircle, ChevronDown, ChevronUp,
    Route, TrendingUp, Car, Timer, ArrowLeft, ChevronLeft, Users,
    Sunrise, Sunset, BarChart3
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

const containerStyle = {
    width: '100%',
    height: '400px',
    borderRadius: '1rem'
};

const center = {
    lat: 39.9334,
    lng: 32.8597
};

const libraries: ("places" | "drawing" | "geometry" | "visualization")[] = ["places", "geometry"];

// Group tracks by date
interface DayGroup {
    date: string;
    dateFormatted: string;
    dayName: string;
    tracks: DrivingTrack[];
    totalKm: number;
    morningKm: number;
    eveningKm: number;
}

export default function TracksPage() {
    const { user, profile } = useAuth();
    const [allTracks, setAllTracks] = useState<DrivingTrack[]>([]);
    const [selectedTrack, setSelectedTrack] = useState<DrivingTrack | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [expandedDate, setExpandedDate] = useState<string | null>(null);
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<string>("");

    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
        libraries: libraries
    });

    // Fetch users for filter
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const data = await getUsers();
                // Filter only admin/manager users
                const adminUsers = data.filter(u => u.role === 'admin' || u.email === 'meoncu@gmail.com');
                setUsers(adminUsers);
                // Default to current user if admin
                if (user && (user.email === 'meoncu@gmail.com' || profile?.role === 'admin')) {
                    setSelectedUserId(user.uid);
                } else if (adminUsers.length > 0) {
                    setSelectedUserId(adminUsers[0].uid);
                }
            } catch (error) {
                console.error("Error fetching users:", error);
            }
        };
        fetchUsers();
    }, [user, profile]);

    // Fetch tracks
    useEffect(() => {
        const fetchTracks = async () => {
            if (!user || !selectedUserId) return;
            if (user.email !== 'meoncu@gmail.com' && profile?.role !== 'admin') {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const monthStr = format(currentMonth, "yyyy-MM");
                const startDate = format(startOfMonth(currentMonth), "yyyy-MM-dd");
                const endDate = format(endOfMonth(currentMonth), "yyyy-MM-dd");
                const data = await getTracksByDateRange(startDate, endDate, selectedUserId);
                setAllTracks(data);
                setSelectedTrack(null);
                setExpandedDate(null);
            } catch (error) {
                console.error("Error fetching tracks:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchTracks();
    }, [user, profile, currentMonth, selectedUserId]);

    // Group tracks by date
    const dayGroups = useMemo((): DayGroup[] => {
        const grouped: Record<string, DrivingTrack[]> = {};
        allTracks.forEach(track => {
            if (!grouped[track.date]) grouped[track.date] = [];
            grouped[track.date].push(track);
        });

        return Object.entries(grouped)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([date, tracks]) => {
                const morningTracks = tracks.filter(t => t.type === 'morning');
                const eveningTracks = tracks.filter(t => t.type === 'evening');
                return {
                    date,
                    dateFormatted: format(parseISO(date), "dd MMMM yyyy", { locale: tr }),
                    dayName: format(parseISO(date), "EEEE", { locale: tr }),
                    tracks,
                    totalKm: tracks.reduce((sum, t) => sum + t.distanceKm, 0),
                    morningKm: morningTracks.reduce((sum, t) => sum + t.distanceKm, 0),
                    eveningKm: eveningTracks.reduce((sum, t) => sum + t.distanceKm, 0),
                };
            });
    }, [allTracks]);

    // Monthly statistics
    const monthStats = useMemo(() => {
        const totalKm = allTracks.reduce((sum, t) => sum + t.distanceKm, 0);
        const totalTrips = allTracks.length;
        const uniqueDays = new Set(allTracks.map(t => t.date)).size;
        const avgDailyKm = uniqueDays > 0 ? totalKm / uniqueDays : 0;
        const longestTrip = allTracks.length > 0
            ? Math.max(...allTracks.map(t => t.distanceKm))
            : 0;
        const avgSpeed = allTracks.length > 0
            ? allTracks.reduce((sum, t) => sum + t.avgSpeed, 0) / allTracks.length
            : 0;
        const morningTrips = allTracks.filter(t => t.type === 'morning').length;
        const eveningTrips = allTracks.filter(t => t.type === 'evening').length;

        return { totalKm, totalTrips, uniqueDays, avgDailyKm, longestTrip, avgSpeed, morningTrips, eveningTrips };
    }, [allTracks]);

    const polylinePath = useMemo(() => {
        if (!selectedTrack) return [];
        return selectedTrack.points.map(p => ({ lat: p.lat, lng: p.lng }));
    }, [selectedTrack]);

    const detailedPoints = useMemo(() => {
        if (!selectedTrack) return [];
        return selectedTrack.points.filter(p => p.address);
    }, [selectedTrack]);

    const mapCenter = useMemo(() => {
        if (polylinePath.length > 0) return polylinePath[0];
        return center;
    }, [polylinePath]);

    const navigateMonth = useCallback((direction: 'prev' | 'next') => {
        setCurrentMonth(prev => direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1));
    }, []);

    if (user?.email !== 'meoncu@gmail.com' && profile?.role !== 'admin') {
        return (
            <AppLayout>
                <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6">
                    <AlertCircle size={48} className="text-muted-foreground mb-4" />
                    <h2 className="text-xl font-bold">Yetkiniz Yok</h2>
                    <p className="text-muted-foreground">Bu sayfayı yalnızca yönetici görüntüleyebilir.</p>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <div className="space-y-6 pb-24">
                {/* Header */}
                <header className="flex items-center gap-4">
                    <Link href="/admin">
                        <Button variant="ghost" size="icon" className="rounded-full">
                            <ArrowLeft size={20} />
                        </Button>
                    </Link>
                    <div>
                        <div className="flex items-center gap-2">
                            <div className="bg-primary/10 p-2 rounded-xl text-primary">
                                <Navigation size={24} strokeWidth={2.5} />
                            </div>
                            <h1 className="text-2xl font-black tracking-tight">Güzergâh Arşivi</h1>
                        </div>
                        <p className="text-muted-foreground text-sm mt-1">
                            Sabah ve akşam yolculuklarının gün-gün arşivi ve istatistikleri.
                        </p>
                    </div>
                </header>

                {/* Month Navigator & User Filter */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 bg-card border border-border rounded-2xl px-2 py-1 shadow-sm">
                        <Button
                            variant="ghost" size="icon"
                            className="rounded-xl h-10 w-10"
                            onClick={() => navigateMonth('prev')}
                        >
                            <ChevronLeft size={18} />
                        </Button>
                        <div className="text-center min-w-[160px]">
                            <span className="text-lg font-black text-foreground capitalize">
                                {format(currentMonth, "MMMM yyyy", { locale: tr })}
                            </span>
                        </div>
                        <Button
                            variant="ghost" size="icon"
                            className="rounded-xl h-10 w-10"
                            onClick={() => navigateMonth('next')}
                            disabled={isSameMonth(currentMonth, new Date())}
                        >
                            <ChevronRight size={18} />
                        </Button>
                    </div>

                    {/* User Filter */}
                    {users.length > 1 && (
                        <div className="flex items-center gap-2">
                            <Users size={16} className="text-muted-foreground" />
                            <select
                                className="h-10 rounded-xl border border-border bg-card px-3 text-sm font-bold text-foreground focus:ring-2 focus:ring-primary"
                                value={selectedUserId}
                                onChange={(e) => setSelectedUserId(e.target.value)}
                            >
                                {users.map(u => (
                                    <option key={u.uid} value={u.uid}>{u.name || u.email}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                {/* Monthly Stats Dashboard */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card className="border-border shadow-sm bg-gradient-to-br from-blue-500/10 to-blue-600/5 overflow-hidden">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="bg-blue-500/10 p-1.5 rounded-lg text-blue-500">
                                    <Route size={14} />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Toplam KM</span>
                            </div>
                            <p className="text-2xl font-black text-foreground">{monthStats.totalKm.toFixed(1)}</p>
                            <p className="text-[10px] font-bold text-muted-foreground mt-1">{monthStats.uniqueDays} gün aktif</p>
                        </CardContent>
                    </Card>

                    <Card className="border-border shadow-sm bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 overflow-hidden">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="bg-emerald-500/10 p-1.5 rounded-lg text-emerald-500">
                                    <Car size={14} />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Toplam Sefer</span>
                            </div>
                            <p className="text-2xl font-black text-foreground">{monthStats.totalTrips}</p>
                            <div className="flex gap-2 mt-1">
                                <span className="text-[9px] font-bold text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded">
                                    {monthStats.morningTrips} Sabah
                                </span>
                                <span className="text-[9px] font-bold text-orange-500 bg-orange-500/10 px-1.5 py-0.5 rounded">
                                    {monthStats.eveningTrips} Akşam
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border shadow-sm bg-gradient-to-br from-purple-500/10 to-purple-600/5 overflow-hidden">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="bg-purple-500/10 p-1.5 rounded-lg text-purple-500">
                                    <TrendingUp size={14} />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Günlük Ort.</span>
                            </div>
                            <p className="text-2xl font-black text-foreground">{monthStats.avgDailyKm.toFixed(1)}</p>
                            <p className="text-[10px] font-bold text-muted-foreground mt-1">km / gün</p>
                        </CardContent>
                    </Card>

                    <Card className="border-border shadow-sm bg-gradient-to-br from-amber-500/10 to-amber-600/5 overflow-hidden">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="bg-amber-500/10 p-1.5 rounded-lg text-amber-500">
                                    <Gauge size={14} />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ort. Hız</span>
                            </div>
                            <p className="text-2xl font-black text-foreground">{Math.round(monthStats.avgSpeed)}</p>
                            <p className="text-[10px] font-bold text-muted-foreground mt-1">km/h ortalama</p>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left Side: Day-by-Day Archive */}
                    <div className="lg:col-span-5 space-y-3">
                        <div className="flex items-center gap-2 px-1">
                            <BarChart3 size={16} className="text-primary" />
                            <h2 className="text-sm font-black uppercase tracking-wider text-muted-foreground">Gün Bazlı Arşiv</h2>
                        </div>

                        <div className="space-y-2 max-h-[700px] overflow-y-auto pr-1">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-16 gap-3">
                                    <Loader2 className="animate-spin text-primary" size={32} />
                                    <p className="text-xs font-medium text-muted-foreground">Veriler yükleniyor...</p>
                                </div>
                            ) : dayGroups.length === 0 ? (
                                <div className="py-16 text-center text-muted-foreground text-sm italic bg-card rounded-3xl border border-dashed border-border">
                                    <Navigation className="mx-auto mb-3 opacity-20" size={40} />
                                    <p className="font-bold">Bu ay için kayıtlı yolculuk yok.</p>
                                    <p className="text-xs mt-1">GPS takibi aktif olduğunda yolculuklar otomatik kaydedilir.</p>
                                </div>
                            ) : (
                                dayGroups.map((group) => (
                                    <div key={group.date} className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                                        {/* Day Header (clickable) */}
                                        <button
                                            onClick={() => setExpandedDate(expandedDate === group.date ? null : group.date)}
                                            className="w-full text-left p-4 hover:bg-muted/30 transition-colors"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-primary/10 w-10 h-10 rounded-xl flex items-center justify-center text-primary">
                                                        <Calendar size={18} />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-black text-foreground">{group.dateFormatted}</p>
                                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{group.dayName}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="text-right">
                                                        <p className="text-sm font-black text-foreground">{group.totalKm.toFixed(1)} km</p>
                                                        <div className="flex gap-1.5 justify-end">
                                                            {group.morningKm > 0 && (
                                                                <span className="text-[8px] font-black bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded">
                                                                    ☀ {group.morningKm.toFixed(1)}
                                                                </span>
                                                            )}
                                                            {group.eveningKm > 0 && (
                                                                <span className="text-[8px] font-black bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 px-1.5 py-0.5 rounded">
                                                                    🌙 {group.eveningKm.toFixed(1)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <motion.div
                                                        animate={{ rotate: expandedDate === group.date ? 180 : 0 }}
                                                        transition={{ duration: 0.2 }}
                                                    >
                                                        <ChevronDown size={16} className="text-muted-foreground" />
                                                    </motion.div>
                                                </div>
                                            </div>
                                        </button>

                                        {/* Expanded track list */}
                                        <AnimatePresence>
                                            {expandedDate === group.date && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.3, ease: "easeInOut" }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="px-4 pb-4 pt-1 space-y-2 border-t border-border">
                                                        {group.tracks.map((track) => (
                                                            <button
                                                                key={track.id}
                                                                onClick={() => setSelectedTrack(track)}
                                                                className={cn(
                                                                    "w-full text-left p-3 rounded-xl transition-all border flex items-center gap-3",
                                                                    selectedTrack?.id === track.id
                                                                        ? "bg-primary border-primary shadow-md shadow-primary/20"
                                                                        : "bg-muted/30 border-transparent hover:border-primary/30"
                                                                )}
                                                            >
                                                                <div className={cn(
                                                                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                                                                    track.type === 'morning'
                                                                        ? (selectedTrack?.id === track.id ? "bg-blue-400 text-white" : "bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400")
                                                                        : (selectedTrack?.id === track.id ? "bg-orange-400 text-white" : "bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400")
                                                                )}>
                                                                    {track.type === 'morning' ? <Sunrise size={14} /> : <Sunset size={14} />}
                                                                </div>
                                                                <div className={cn("flex-1", selectedTrack?.id === track.id ? "text-primary-foreground" : "")}>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-xs font-black">
                                                                            {track.type === 'morning' ? 'Sabah' : 'Akşam'}
                                                                        </span>
                                                                        <span className="text-[10px] font-bold opacity-70">
                                                                            {track.startTime} → {track.endTime}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-3 mt-0.5">
                                                                        <span className="text-[10px] font-bold opacity-80">
                                                                            📍 {track.distanceKm.toFixed(2)} km
                                                                        </span>
                                                                        <span className="text-[10px] font-bold opacity-60">
                                                                            ⚡ {Math.round(track.avgSpeed)} km/h
                                                                        </span>
                                                                        <span className="text-[10px] font-bold opacity-60">
                                                                            📊 {track.points?.length || 0} nokta
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <ChevronRight className={cn("shrink-0", selectedTrack?.id === track.id ? "text-primary-foreground" : "text-muted-foreground")} size={14} />
                                                            </button>
                                                        ))}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Right Side: Map and Details */}
                    <div className="lg:col-span-7 space-y-6">
                        {selectedTrack ? (
                            <>
                                {/* Map Card */}
                                <Card className="border-border shadow-md overflow-hidden bg-card">
                                    <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
                                        <div className="flex items-center gap-2">
                                            <MapIcon size={18} className="text-primary" />
                                            <h2 className="text-sm font-black uppercase tracking-tight">Rota Görünümü</h2>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={cn(
                                                "text-[8px] font-black uppercase px-2 py-1 rounded-full",
                                                selectedTrack.type === 'morning' ? "bg-blue-100 text-blue-600" : "bg-orange-100 text-orange-600"
                                            )}>
                                                {selectedTrack.type === 'morning' ? '☀ Sabah' : '🌙 Akşam'}
                                            </span>
                                            <span className="text-xs font-bold text-muted-foreground italic">
                                                {format(parseISO(selectedTrack.date), "d MMMM", { locale: tr })}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="p-2">
                                        {isLoaded ? (
                                            <GoogleMap
                                                mapContainerStyle={containerStyle}
                                                center={mapCenter}
                                                zoom={13}
                                                options={{
                                                    disableDefaultUI: false,
                                                    zoomControl: true,
                                                    scrollwheel: true,
                                                    mapTypeControl: false,
                                                    streetViewControl: false,
                                                    fullscreenControl: true
                                                }}
                                            >
                                                <Polyline
                                                    path={polylinePath}
                                                    options={{
                                                        strokeColor: selectedTrack.type === 'morning' ? "#3B82F6" : "#F97316",
                                                        strokeOpacity: 0.8,
                                                        strokeWeight: 5,
                                                    }}
                                                />
                                                {polylinePath.length > 0 && (
                                                    <>
                                                        <Marker
                                                            position={polylinePath[0]}
                                                            label={{ text: "A", color: "white", fontWeight: "bold" }}
                                                            title="Başlangıç"
                                                        />
                                                        <Marker
                                                            position={polylinePath[polylinePath.length - 1]}
                                                            label={{ text: "B", color: "white", fontWeight: "bold" }}
                                                            title="Varış"
                                                        />
                                                    </>
                                                )}
                                            </GoogleMap>
                                        ) : (
                                            <div className="flex items-center justify-center h-[400px] bg-muted/50 rounded-2xl">
                                                <Loader2 className="animate-spin text-primary" size={32} />
                                            </div>
                                        )}
                                    </div>

                                    {/* Trip Summary Bar */}
                                    <div className="px-4 pb-4">
                                        <div className="grid grid-cols-4 gap-2 bg-muted/30 rounded-2xl p-3">
                                            <div className="text-center">
                                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-wider">Mesafe</p>
                                                <p className="text-sm font-black text-foreground">{selectedTrack.distanceKm.toFixed(2)} km</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-wider">Ort. Hız</p>
                                                <p className="text-sm font-black text-foreground">{Math.round(selectedTrack.avgSpeed)} km/h</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-wider">Başlangıç</p>
                                                <p className="text-sm font-black text-foreground">{selectedTrack.startTime}</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-wider">Bitiş</p>
                                                <p className="text-sm font-black text-foreground">{selectedTrack.endTime}</p>
                                            </div>
                                        </div>
                                    </div>
                                </Card>

                                {/* Minute-by-minute details */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 px-1">
                                        <Activity size={16} className="text-primary" strokeWidth={2.5} />
                                        <h2 className="text-sm font-black tracking-tight uppercase text-muted-foreground">
                                            Dakika Bazlı Güzergah ({detailedPoints.length} kayıt)
                                        </h2>
                                    </div>

                                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                                        {detailedPoints.length === 0 ? (
                                            <div className="p-8 text-center bg-muted/30 rounded-3xl text-sm italic text-muted-foreground border border-dashed">
                                                Detaylı nokta verisi bulunamadı.
                                            </div>
                                        ) : (
                                            detailedPoints.map((point, idx) => (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: Math.min(idx * 0.03, 0.5) }}
                                                    key={point.timestamp}
                                                    className="bg-card border border-border p-3 rounded-2xl flex items-center gap-3 hover:shadow-md transition-shadow"
                                                >
                                                    {/* Time */}
                                                    <div className="bg-primary/5 p-2 rounded-xl text-primary text-center min-w-[50px]">
                                                        <Clock size={12} className="mx-auto" />
                                                        <span className="text-[10px] font-black mt-0.5 block">
                                                            {format(new Date(point.timestamp), "HH:mm")}
                                                        </span>
                                                    </div>

                                                    {/* Timeline line */}
                                                    <div className="w-px h-8 bg-border shrink-0" />

                                                    {/* Address */}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                                            <MapPin size={10} /> KONUM
                                                        </p>
                                                        <p className="text-xs font-bold text-foreground truncate">
                                                            {point.address || "Bilinmeyen Sokak"}
                                                        </p>
                                                    </div>

                                                    {/* Speed */}
                                                    <div className="text-right shrink-0">
                                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1 justify-end">
                                                            <Gauge size={10} /> HIZ
                                                        </p>
                                                        <p className="text-xs font-black text-foreground">
                                                            {Math.round(point.speed || 0)} <span className="text-[9px] font-medium opacity-60">km/h</span>
                                                        </p>
                                                    </div>
                                                </motion.div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-[500px] bg-muted/20 border-2 border-dashed border-border rounded-[3rem] text-center p-8">
                                <div className="bg-background p-6 rounded-full shadow-xl mb-6">
                                    <Navigation size={48} className="text-primary/40 animate-pulse" />
                                </div>
                                <h3 className="text-xl font-bold text-foreground">Yolculuk Seçin</h3>
                                <p className="text-muted-foreground text-sm max-w-xs mt-2">
                                    Güzergah detaylarını görmek için sol taraftan bir gün açıp yolculuk seçin.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
