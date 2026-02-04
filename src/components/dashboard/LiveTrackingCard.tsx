"use client";

import React, { useEffect, useState, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Polyline } from '@react-google-maps/api';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getLatestLocation, getUserByEmail, getRoute } from "@/lib/db-service";
import { UserProfile } from "@/types";
import { Navigation, Radio, Maximize2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import Link from 'next/link';

const mapContainerStyle = {
    width: '100%',
    height: '240px',
    borderRadius: '1.5rem'
};

const defaultCenter = {
    lat: 39.9334,
    lng: 32.8597
};

export const LiveTrackingCard: React.FC = () => {
    const [driver, setDriver] = useState<UserProfile | null>(null);
    const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
    const [path, setPath] = useState<any[]>([]);
    const [isActive, setIsActive] = useState(false);
    const [loading, setLoading] = useState(true);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
        libraries: ["places", "geometry"]
    });

    const fetchLiveData = async () => {
        try {
            // Hardcoded driver for now as requested
            const driverProfile = await getUserByEmail("meoncu@gmail.com");
            if (!driverProfile) return;
            setDriver(driverProfile);

            const latest = await getLatestLocation(driverProfile.uid);

            if (latest) {
                // Check if the location is "fresh" (last 10 minutes)
                const now = Date.now();
                const lastTimestamp = latest.timestamp?.toMillis ? latest.timestamp.toMillis() : (typeof latest.timestamp === 'number' ? latest.timestamp : now);
                const diffMinutes = (now - lastTimestamp) / (1000 * 60);

                if (diffMinutes < 10) {
                    setIsActive(true);
                    setLocation({ lat: latest.latitude, lng: latest.longitude });

                    // Fetch today's route for trail
                    const todayStr = format(new Date(), "yyyy-MM-dd");
                    const routePoints = await getRoute(todayStr, driverProfile.uid);
                    setPath(routePoints.map((p: any) => ({ lat: p.latitude, lng: p.longitude })));
                } else {
                    setIsActive(false);
                }
            } else {
                setIsActive(false);
            }
        } catch (error) {
            console.error("Live tracking error:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLiveData();
        intervalRef.current = setInterval(fetchLiveData, 30000); // 30 seconds refresh
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    if (!isActive && !loading) return null;

    return (
        <Card className="border-none shadow-2xl shadow-blue-900/10 rounded-[2.5rem] overflow-hidden bg-card animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="absolute -inset-1 bg-red-500 rounded-full animate-ping opacity-25" />
                            <div className="relative bg-red-500 p-2 rounded-xl text-white">
                                <Radio size={18} />
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-black text-foreground">Canlı Takip</h3>
                                <Badge variant="destructive" className="animate-pulse text-[8px] font-black tracking-widest px-1.5 py-0">LIVE</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground font-medium">
                                {driver?.name} şu an yolda
                            </p>
                        </div>
                    </div>
                    <Link href="/map">
                        <button className="p-2 hover:bg-muted rounded-xl transition-colors text-muted-foreground">
                            <Maximize2 size={20} />
                        </button>
                    </Link>
                </div>

                <div className="relative w-full h-[240px] bg-muted rounded-3xl overflow-hidden border border-border shadow-inner">
                    {isLoaded && location ? (
                        <GoogleMap
                            mapContainerStyle={mapContainerStyle}
                            center={location}
                            zoom={15}
                            options={{
                                streetViewControl: false,
                                mapTypeControl: false,
                                fullscreenControl: false,
                                zoomControl: false,
                                styles: [
                                    { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] }
                                ]
                            }}
                        >
                            {path.length > 0 && (
                                <Polyline
                                    path={path}
                                    options={{
                                        strokeColor: "#3B82F6",
                                        strokeOpacity: 0.6,
                                        strokeWeight: 4,
                                    }}
                                />
                            )}
                            <Marker
                                position={location}
                                icon={{
                                    path: "M23.5,17L23.5,17c0,4.41-3.59,8-8,8l0,0c-4.41,0-8-3.59-8-8l0,0c0-4.41,3.59-8,8-8l0,0C19.91,9,23.5,12.59,23.5,17z M15.5,11.5 c-3.03,0-5.5,2.47-5.5,5.5s2.47,5.5,5.5,5.5s5.5-2.47,5.5-5.5S18.53,11.5,15.5,11.5z",
                                    fillColor: "#3B82F6",
                                    fillOpacity: 1,
                                    strokeWeight: 2,
                                    strokeColor: "#ffffff",
                                    scale: 1.5,
                                    anchor: new google.maps.Point(15, 15)
                                }}
                            />
                        </GoogleMap>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                            <MapPin className="animate-bounce" />
                            <span className="text-xs font-bold">Harita Yükleniyor...</span>
                        </div>
                    )}

                    {/* Floating Info Overlay */}
                    <div className="absolute bottom-4 left-4 right-4 bg-background/80 backdrop-blur-md p-3 rounded-2xl border border-border shadow-lg flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                <Navigation size={14} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-muted-foreground uppercase leading-none">KONUM</p>
                                <p className="text-xs font-bold text-foreground truncate max-w-[150px]">Anlık Veri Alınıyor...</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-black text-emerald-500 uppercase leading-none">DURUM</p>
                            <p className="text-xs font-black text-emerald-600">HAREKETLİ</p>
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
};
