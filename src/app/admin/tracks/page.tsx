"use client";

import React, { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/context/AuthContext";
import { GoogleMap, useJsApiLoader, Polyline, Marker } from "@react-google-maps/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getDrivingTracks } from "@/lib/db-service";
import { DrivingTrack, DrivingTrackPoint } from "@/types";
import { format, parseISO, startOfMonth } from "date-fns";
import { tr } from "date-fns/locale";
import { MapPin, Navigation, Clock, Gauge, Calendar, ChevronRight, Activity, Map as MapIcon, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

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

export default function TracksPage() {
    const { user, profile } = useAuth();
    const [tracks, setTracks] = useState<DrivingTrack[]>([]);
    const [selectedTrack, setSelectedTrack] = useState<DrivingTrack | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));

    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
        libraries: libraries
    });

    useEffect(() => {
        const fetchTracks = async () => {
            if (!user) return;
            // Only allowed for manager/admin
            if (user.email !== 'meoncu@gmail.com' && profile?.role !== 'admin') {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const data = await getDrivingTracks(user.uid, selectedMonth);
                setTracks(data);
                if (data.length > 0 && !selectedTrack) {
                    setSelectedTrack(data[0]);
                }
            } catch (error) {
                console.error("Error fetching tracks:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchTracks();
    }, [user, profile, selectedMonth]);

    const polylinePath = useMemo(() => {
        if (!selectedTrack) return [];
        return selectedTrack.points.map(p => ({ lat: p.lat, lng: p.lng }));
    }, [selectedTrack]);

    const detailedPoints = useMemo(() => {
        if (!selectedTrack) return [];
        // Filter points that have an address or meaningful speed/time change
        // User asked for "her dakika" (every minute)
        // We'll filter for points that actually have an address (recorded every minute in GpsTracker)
        return selectedTrack.points.filter(p => p.address);
    }, [selectedTrack]);

    const mapCenter = useMemo(() => {
        if (polylinePath.length > 0) return polylinePath[0];
        return center;
    }, [polylinePath]);

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
            <div className="space-y-6 pb-20">
                <header className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <div className="bg-primary/10 p-2 rounded-xl text-primary">
                            <Navigation size={24} strokeWidth={2.5} />
                        </div>
                        <h1 className="text-2xl font-black tracking-tight">Güzergâh Geçmişi</h1>
                    </div>
                    <p className="text-muted-foreground text-sm">
                        Sabah ve akşam yolculuklarınızın otomatik kayıtları.
                    </p>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left Side: List of Tracks */}
                    <div className="lg:col-span-4 space-y-4">
                        <Card className="border-border shadow-sm">
                            <CardHeader className="p-4 pb-2">
                                <CardTitle className="text-sm font-bold flex items-center gap-2 text-muted-foreground uppercase tracking-wider">
                                    <Calendar size={16} />
                                    Yolculuk Listesi
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-2 pt-0 max-h-[600px] overflow-y-auto">
                                {loading ? (
                                    <div className="flex flex-col items-center justify-center py-10 gap-3">
                                        <Loader2 className="animate-spin text-primary" size={32} />
                                        <p className="text-xs font-medium text-muted-foreground">Veriler yükleniyor...</p>
                                    </div>
                                ) : tracks.length === 0 ? (
                                    <div className="py-10 text-center text-muted-foreground text-sm italic">
                                        Bu ay için kayıtlı yolculuk bulunamadı.
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {tracks.map((track) => (
                                            <button
                                                key={track.id}
                                                onClick={() => setSelectedTrack(track)}
                                                className={cn(
                                                    "w-full text-left p-3 rounded-2xl transition-all border",
                                                    selectedTrack?.id === track.id
                                                        ? "bg-primary border-primary shadow-md shadow-primary/20 scale-[1.02]"
                                                        : "bg-card border-border hover:border-primary/50"
                                                )}
                                            >
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className={cn("text-[10px] font-black uppercase tracking-widest", selectedTrack?.id === track.id ? "text-primary-foreground/70" : "text-muted-foreground")}>
                                                        {format(parseISO(track.date), "dd MMMM EEEE", { locale: tr })}
                                                    </span>
                                                    <div className={cn(
                                                        "px-2 py-0.5 rounded-full text-[8px] font-black uppercase",
                                                        track.type === 'morning'
                                                            ? (selectedTrack?.id === track.id ? "bg-blue-400 text-white" : "bg-blue-100 text-blue-600")
                                                            : (selectedTrack?.id === track.id ? "bg-orange-400 text-white" : "bg-orange-100 text-orange-600")
                                                    )}>
                                                        {track.type === 'morning' ? 'Sabah' : 'Akşam'}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className={cn("flex flex-col", selectedTrack?.id === track.id ? "text-primary-foreground" : "text-foreground")}>
                                                        <span className="text-sm font-black">{track.startTime} - {track.endTime}</span>
                                                        <span className="text-[10px] font-bold opacity-80">{track.distanceKm.toFixed(2)} km • {Math.round(track.avgSpeed)} km/h ort.</span>
                                                    </div>
                                                    <ChevronRight className={cn("ml-auto", selectedTrack?.id === track.id ? "text-primary-foreground" : "text-muted-foreground")} size={16} />
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Side: Map and Details */}
                    <div className="lg:col-span-8 space-y-6">
                        {selectedTrack ? (
                            <>
                                <Card className="border-border shadow-md overflow-hidden bg-card">
                                    <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
                                        <div className="flex items-center gap-2">
                                            <MapIcon size={18} className="text-primary" />
                                            <h2 className="text-sm font-black uppercase tracking-tight">Rota Görünümü</h2>
                                        </div>
                                        <span className="text-xs font-bold text-muted-foreground italic">
                                            {format(parseISO(selectedTrack.date), "d MMMM", { locale: tr })} • {selectedTrack.type === 'morning' ? 'Sabah' : 'Akşam'}
                                        </span>
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
                                </Card>

                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 px-1">
                                        <Activity size={18} className="text-primary" strokeWidth={2.5} />
                                        <h2 className="text-base font-black tracking-tight">Yol Detayları (Dakika Bazlı)</h2>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-3">
                                        {detailedPoints.length === 0 ? (
                                            <div className="p-8 text-center bg-muted/30 rounded-3xl text-sm italic text-muted-foreground border border-dashed">
                                                Detaylı nokta verisi bulunamadı.
                                            </div>
                                        ) : (
                                            detailedPoints.map((point, idx) => (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: idx * 0.05 }}
                                                    key={point.timestamp}
                                                    className="bg-card border border-border p-4 rounded-3xl flex items-center gap-4 hover:shadow-md transition-shadow"
                                                >
                                                    <div className="bg-primary/5 p-3 rounded-2xl text-primary">
                                                        <Clock size={16} />
                                                        <span className="text-[10px] font-black mt-1 block">
                                                            {format(new Date(point.timestamp), "HH:mm")}
                                                        </span>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-1 text-muted-foreground mb-1">
                                                            <MapPin size={12} />
                                                            <span className="text-[10px] font-bold uppercase tracking-widest leading-none">KONUM</span>
                                                        </div>
                                                        <p className="text-sm font-bold text-foreground truncate">
                                                            {point.address || "Bilinmeyen Sokak"}
                                                        </p>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <div className="flex items-center gap-1 text-muted-foreground justify-end mb-1">
                                                            <Gauge size={12} />
                                                            <span className="text-[10px] font-bold uppercase tracking-widest leading-none">HIZ</span>
                                                        </div>
                                                        <p className="text-sm font-black text-foreground">
                                                            {Math.round(point.speed || 0)} <span className="text-[10px] font-medium opacity-60">km/h</span>
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
                                    Detayları ve rotayı görüntülemek için sol listeden bir yolculuk seçin.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
