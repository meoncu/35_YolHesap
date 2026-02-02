"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/context/AuthContext";
import { GoogleMap, useJsApiLoader, TrafficLayer, DirectionsService, DirectionsRenderer } from "@react-google-maps/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, Navigation, Info, Save, Layers, ArrowLeft, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

const containerStyle = {
    width: '100%',
    height: '70vh'
};

const center = {
    lat: 39.9334, // Ankara center
    lng: 32.8597
};

const libraries: ("places" | "drawing" | "geometry" | "visualization")[] = ["places", "geometry"];

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
    const [showTraffic, setShowTraffic] = useState(false);
    const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
    const [routeStats, setRouteStats] = useState<{ distance: string, duration: string } | null>(null);

    // Calculate next 08:00 AM to avoid "past time" error
    const nextMorning = useMemo(() => {
        const date = new Date();
        // If it's already past 08:00 today, set for tomorrow
        if (date.getHours() >= 8) {
            date.setDate(date.getDate() + 1);
        }
        date.setHours(8, 0, 0, 0);
        return date;
    }, []);

    // Default route points
    const origin = "Etimesgut Belediyesi, Etimesgut, Ankara";
    const destination = "Tarım Kredi Kooperatifleri Merkez Birliği, Söğütözü, Çankaya, Ankara";

    const onLoad = useCallback(function callback(map: google.maps.Map) {
        setMap(map);
    }, []);

    const onUnmount = useCallback(function callback(map: google.maps.Map) {
        setMap(null);
    }, []);

    const saveRoute = () => {
        // Save route logic
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
                            <p className="text-gray-500">Güncel trafik durumu ve rotalar.</p>
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
                                    destination: destination,
                                    origin: origin,
                                    waypoints: [
                                        { location: "Sabancı Blv., Ankara", stopover: false },
                                        { location: "Ankara Blv., Ankara", stopover: false }
                                    ],
                                    travelMode: google.maps.TravelMode.DRIVING,
                                    provideRouteAlternatives: true,
                                    drivingOptions: {
                                        departureTime: nextMorning,
                                        trafficModel: google.maps.TrafficModel.BEST_GUESS
                                    }
                                }}
                                callback={(result, status) => {
                                    if (result !== null && status === 'OK' && !directions) {
                                        setDirections(result);
                                        const route = result.routes[0].legs[0];
                                        if (route && route.distance && route.duration) {
                                            setRouteStats({
                                                distance: route.distance.text,
                                                duration: route.duration.text
                                            });
                                        }
                                    }
                                }}
                            />

                            {directions && (
                                <DirectionsRenderer
                                    directions={directions}
                                    options={{
                                        polylineOptions: {
                                            strokeColor: "#1E3A8A",
                                            strokeWeight: 6,
                                            strokeOpacity: 0.8
                                        },
                                        markerOptions: {
                                            visible: false // We can customise markers if needed
                                        }
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

                    {/* Admin Controls Overlay */}
                    {profile?.role === 'admin' && (
                        <div className="absolute bottom-4 left-4 right-4 md:left-auto md:w-80">
                            <Card className="glass border-none shadow-xl">
                                <CardContent className="p-4 space-y-3">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold text-[#143A5A] uppercase tracking-wider">Yeni Rota Oluştur</p>
                                        <div className="flex items-center gap-2">
                                            <MapPin size={16} className="text-red-500" />
                                            <Input defaultValue={origin} readOnly className="h-9 text-xs bg-gray-50 font-bold" />
                                        </div>
                                        <div className="flex items-center gap-2 mt-2">
                                            <Navigation size={16} className="text-blue-500" />
                                            <Input defaultValue={destination} readOnly className="h-9 text-xs bg-gray-50 font-bold" />
                                        </div>
                                    </div>
                                    <Button className="w-full h-9 bg-[#143A5A] text-xs" onClick={saveRoute}>
                                        <Save size={16} className="mr-2" />
                                        Rotayı Kaydet
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </Card>

                {/* Legend / Info */}
                <section className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-start gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg text-blue-600 shrink-0">
                        <Info size={20} />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-gray-900">Sabah Rota Planı (08:00)</h4>
                        <p className="text-xs text-gray-500 leading-tight mb-2">
                            Etimesgut'tan Söğütözü'ne (Tarım Kredi GM) alternatifli sabah rotaları. Trafik durumuna göre en hızlı rota mavi ile gösterilmektedir.
                        </p>
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
