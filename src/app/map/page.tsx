"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/context/AuthContext";
import { GoogleMap, useJsApiLoader, TrafficLayer, DirectionsService, DirectionsRenderer, Marker } from "@react-google-maps/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, Navigation, Info, Save, Layers, ArrowLeft, AlertCircle, Car } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const containerStyle = {
    width: '100%',
    height: '70vh'
};

const center = {
    lat: 39.9334, // Ankara center
    lng: 32.8597
};

const libraries: ("places" | "drawing" | "geometry" | "visualization")[] = ["places", "geometry"];

// Car Icon Path (SVG path for Google Maps Marker)
const CAR_ICON_PATH = "M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z";

export default function MapPage() {
    const { profile } = useAuth();
    const { isLoaded, loadError } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
        libraries: libraries
    });

    if (loadError) {
        return (
            <AppLayout>
                <div className="flex flex-col items-center justify-center h-[70vh] bg-red-50 p-4 rounded-xl text-center">
                    <div className="bg-red-100 p-4 rounded-full mb-4">
                        <AlertCircle size={40} className="text-red-500" />
                    </div>
                    <h3 className="text-xl font-bold text-red-900 mb-2">Harita Yüklenemedi</h3>
                    <p className="text-sm text-red-700 max-w-md">
                        Google Maps API anahtarı hatalı veya gerekli izinlere sahip değil.
                        Lütfen Google Cloud Console üzerinden <strong>Maps JavaScript API</strong> servisinin etkin olduğundan emin olun.
                    </p>
                    <div className="mt-4 p-2 bg-white rounded border border-red-200 text-xs text-gray-500 font-mono">
                        Hata Detayı: {loadError.message}
                    </div>
                </div>
            </AppLayout>
        );
    }

    const [map, setMap] = useState<google.maps.Map | null>(null);
    const [showTraffic, setShowTraffic] = useState(true);
    const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
    const [routeStats, setRouteStats] = useState<{ distance: string, duration: string } | null>(null);

    // Live Location State
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [isCommuting, setIsCommuting] = useState(false);

    // Locations
    const LOCATIONS = {
        ETIMESGUT: "Etimesgut Belediyesi, Etimesgut, Ankara",
        TARIM_KREDI: "Tarım Kredi Kooperatifleri Merkez Birliği, Söğütözü, Çankaya, Ankara"
    };

    // Determine Route Direction based on Time (Switch at 17:30)
    const routeConfig = useMemo(() => {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();

        // Check if it is evening (>= 17:30)
        const isEvening = currentHour > 17 || (currentHour === 17 && currentMinute >= 30);

        if (isEvening) {
            return {
                mode: "evening",
                label: "Akşam Dönüş Rotası",
                desc: "Söğütözü'nden (Tarım Kredi) Etimesgut'a dönüş rotası. İyi yolculuklar!",
                origin: LOCATIONS.TARIM_KREDI,
                destination: LOCATIONS.ETIMESGUT,
                departureTime: now // Live traffic for now
            };
        } else {
            return {
                mode: "morning",
                label: "Sabah Gidiş Rotası",
                desc: "Etimesgut'tan Söğütözü'ne (Tarım Kredi GM) işe gidiş rotası. En hızlı güzergah.",
                origin: LOCATIONS.ETIMESGUT,
                destination: LOCATIONS.TARIM_KREDI,
                departureTime: now // Live traffic for now
            };
        }
    }, []);

    // Check Commute Time & Geolocation
    useEffect(() => {
        // 1. Check Time
        const checkTime = () => {
            const now = new Date();
            const mins = now.getHours() * 60 + now.getMinutes();
            // 08:30-09:00 -> 510-540
            // 17:30-18:30 -> 1050-1110
            const isMorningCommute = mins >= 510 && mins <= 540;
            const isEveningCommute = mins >= 1050 && mins <= 1110;
            setIsCommuting(isMorningCommute || isEveningCommute);
        };

        checkTime();
        const timeInterval = setInterval(checkTime, 60000); // Check every minute

        // 2. Track Location
        let watchId: number;
        if (navigator.geolocation) {
            watchId = navigator.geolocation.watchPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    setUserLocation({ lat: latitude, lng: longitude });

                    // Optional: Pan map to user if during commute and not manually moved?
                    // keeping it simple for now, just update marker.
                },
                (error) => {
                    console.error("Geolocation error:", error);
                },
                { enableHighAccuracy: true }
            );
        }

        return () => {
            clearInterval(timeInterval);
            if (watchId) navigator.geolocation.clearWatch(watchId);
        };
    }, []);


    const onLoad = useCallback(function callback(map: google.maps.Map) {
        setMap(map);
    }, []);

    const onUnmount = useCallback(function callback(map: google.maps.Map) {
        setMap(null);
    }, []);

    const saveRoute = () => {
        console.log("Saving route...");
    };

    return (
        <AppLayout>
            <div className="space-y-4">
                <header className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/">
                            <Button variant="ghost" size="icon" className="rounded-full">
                                <ArrowLeft size={20} />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Güzergâh & Trafik</h1>
                            <p className="text-gray-500">
                                {routeConfig.mode === "morning" ? "Sabah trafiği ve rota durumu." : "Akşam trafiği ve dönüş rotası."}
                            </p>
                        </div>
                    </div>
                    <Button
                        size="sm"
                        variant={showTraffic ? "default" : "outline"}
                        className={showTraffic ? "bg-[#1F5E8C]" : ""}
                        onClick={() => setShowTraffic(!showTraffic)}
                    >
                        <Layers size={18} className="mr-2" />
                        Trafik
                    </Button>
                </header>

                <Card className="border-none shadow-md overflow-hidden relative">
                    {isLoaded ? (
                        <GoogleMap
                            mapContainerStyle={containerStyle}
                            center={center}
                            zoom={12}
                            onLoad={onLoad}
                            onUnmount={onUnmount}
                            options={{
                                disableDefaultUI: true,
                                zoomControl: true,
                                styles: [
                                    {
                                        featureType: "all",
                                        elementType: "geometry.fill",
                                        stylers: [{ weight: "2.00" }]
                                    },
                                    {
                                        featureType: "all",
                                        elementType: "geometry.stroke",
                                        stylers: [{ color: "#9c9c9c" }]
                                    },
                                    {
                                        featureType: "all",
                                        elementType: "labels.text",
                                        stylers: [{ visibility: "on" }]
                                    }
                                ]
                            }}
                        >
                            {showTraffic && <TrafficLayer />}

                            <DirectionsService
                                options={{
                                    destination: routeConfig.destination,
                                    origin: routeConfig.origin,
                                    waypoints: [
                                        { location: "Sabancı Blv., Ankara", stopover: false },
                                        { location: "Ankara Blv., Ankara", stopover: false }
                                    ],
                                    travelMode: google.maps.TravelMode.DRIVING,
                                    provideRouteAlternatives: true,
                                    drivingOptions: {
                                        departureTime: routeConfig.departureTime,
                                        trafficModel: google.maps.TrafficModel.BEST_GUESS
                                    }
                                }}
                                callback={(result, status) => {
                                    if (result !== null && status === 'OK') {
                                        if (!directions) {
                                            setDirections(result);
                                            const route = result.routes[0].legs[0];
                                            if (route && route.distance && route.duration) {
                                                setRouteStats({
                                                    distance: route.distance.text,
                                                    duration: route.duration.text
                                                });
                                            }
                                        }
                                    }
                                }}
                            />

                            {directions && (
                                <DirectionsRenderer
                                    directions={directions}
                                    options={{
                                        polylineOptions: {
                                            strokeColor: routeConfig.mode === "morning" ? "#1E3A8A" : "#DC2626", // Blue for morning, Red for evening
                                            strokeWeight: 6,
                                            strokeOpacity: 0.8
                                        },
                                        markerOptions: {
                                            visible: true
                                        }
                                    }}
                                />
                            )}

                            {/* USER CAR MARKER */}
                            {userLocation && (
                                <Marker
                                    position={userLocation}
                                    title="Konumunuz"
                                    icon={{
                                        path: CAR_ICON_PATH,
                                        fillColor: "#F59E0B", // Amber car
                                        fillOpacity: 1,
                                        strokeWeight: 1,
                                        strokeColor: "#ffffff",
                                        scale: 1.2,
                                        anchor: new google.maps.Point(12, 12),
                                    }}
                                />
                            )}
                        </GoogleMap>
                    ) : (
                        <div className="flex items-center justify-center h-[70vh] bg-gray-100">
                            <div className="flex flex-col items-center gap-2">
                                <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#143A5A] border-t-transparent"></div>
                                <p className="text-sm text-gray-500 font-medium">Harita yükleniyor...</p>
                            </div>
                        </div>
                    )}
                </Card>

                {/* Legend / Info */}
                <section className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-start gap-3">
                    <div className={cn("p-2 rounded-lg shrink-0", routeConfig.mode === "morning" ? "bg-blue-50 text-blue-600" : "bg-red-50 text-red-600")}>
                        {routeConfig.mode === "morning" ? <Info size={20} /> : <Navigation size={20} />}
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-gray-900">{routeConfig.label} ({format(new Date(), "HH:mm")})</h4>
                        <p className="text-xs text-gray-500 leading-tight mb-2">
                            {routeConfig.desc}
                        </p>
                        {userLocation && (
                            <div className="flex items-center gap-2 mt-1 mb-2">
                                <Car size={14} className="text-amber-600" />
                                <span className="text-xs font-bold text-amber-700">Canlı Konum Aktif</span>
                            </div>
                        )}
                        {routeStats && (
                            <div className="flex items-center gap-4 mt-2">
                                <div className="bg-green-50 px-3 py-1 rounded-lg border border-green-100">
                                    <span className="text-[10px] uppercase font-bold text-green-600 block">Mesafe</span>
                                    <span className="text-sm font-black text-green-900">{routeStats.distance}</span>
                                </div>
                                <div className="bg-amber-50 px-3 py-1 rounded-lg border border-amber-100">
                                    <span className="text-[10px] uppercase font-bold text-amber-600 block">Süre (Tahmini)</span>
                                    <span className="text-sm font-black text-amber-900">{routeStats.duration}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </AppLayout>
    );
}
