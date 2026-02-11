"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { saveDrivingTrack, saveLocation } from '@/lib/db-service';
import { calculateRouteDistance } from '@/lib/fuel-service';
import { DrivingTrack, DrivingTrackPoint } from '@/types';
import { format, getDay } from 'date-fns';
import { toast } from 'sonner';
import { reverseGeocode } from '@/lib/location-service';
import { cn } from '@/lib/utils';

/**
 * GpsTracker Component
 * Automatically tracks GPS coordinates during specified time windows:
 * Morning: 07:50 - 08:30
 * Evening: 17:30 - 18:00
 * Weekdays ONLY.
 */
export const GpsTracker: React.FC = () => {
    const { user, profile } = useAuth();
    const [liveDistance, setLiveDistance] = useState(0);
    const [isTracking, setIsTracking] = useState(false);
    const [isManualTest, setIsManualTest] = useState(false);
    const watchIdRef = useRef<number | null>(null);
    const trackingTypeRef = useRef<'morning' | 'evening' | null>(null);
    const pointsRef = useRef<DrivingTrackPoint[]>([]);
    const lastMinuteSavedRef = useRef<number>(0);

    // ... (existing refs) removed as they are now declared above

    const startTracking = (type: 'morning' | 'evening') => {
        if (!("geolocation" in navigator)) {
            console.error("Geolocation is not supported by this browser.");
            return;
        }

        console.log(`Starting ${type} GPS tracking...`);
        setIsTracking(true);
        setLiveDistance(0);
        trackingTypeRef.current = type;
        pointsRef.current = [];
        lastMinuteSavedRef.current = 0;

        watchIdRef.current = navigator.geolocation.watchPosition(
            async (position) => {
                const now = Date.now();
                const speedKmh = position.coords.speed ? (position.coords.speed * 3.6) : 0;

                // Reverse geocoding throttling
                const shouldDoReverseGeocode = (now - lastMinuteSavedRef.current) >= 58000;

                let address = "";
                if (shouldDoReverseGeocode) {
                    address = await reverseGeocode(position.coords.latitude, position.coords.longitude);
                    lastMinuteSavedRef.current = now;
                }

                const newPoint: DrivingTrackPoint = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    timestamp: now,
                    speed: Math.round(speedKmh * 10) / 10,
                    address: address || undefined
                };

                // Calculate incremental distance for UI
                if (pointsRef.current.length > 0) {
                    const lastPoint = pointsRef.current[pointsRef.current.length - 1];
                    const dist = calculateDistance(lastPoint.lat, lastPoint.lng, newPoint.lat, newPoint.lng);
                    setLiveDistance(prev => prev + dist);
                }

                // Add EVERY point
                pointsRef.current.push(newPoint);

                // Real-time update
                saveLocation(user!.uid, newPoint.lat, newPoint.lng).catch(console.error);
            },
            (error) => {
                console.error(`GPS Error: Code ${error.code} - ${error.message}`);
                let errorMessage = "GPS hatası oluştu.";
                if (error.code === 1) { // PERMISSION_DENIED
                    errorMessage = "GPS izni reddedildi.";
                    setIsTracking(false);
                    toast.error(errorMessage);
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 30000,
                maximumAge: 0
            }
        );

        toast.info(`${type === 'morning' ? 'Sabah' : 'Akşam'} yolculuğu takibi başladı.`, {
            description: "Güzergâhınız kaydediliyor.",
            duration: 5000
        });
    };

    const stopTracking = async () => {
        console.log("Stopping GPS tracking...");

        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }

        setIsTracking(false);
        const type = trackingTypeRef.current;
        trackingTypeRef.current = null;

        const capturedPoints = [...pointsRef.current];
        pointsRef.current = [];

        if (capturedPoints.length < 2 || !user || !type) {
            console.warn("Not enough points to save track.");
            return;
        }

        // Calculate stats
        const pointsForDistance = capturedPoints.map(p => ({ latitude: p.lat, longitude: p.lng }));
        const distanceKm = calculateRouteDistance(pointsForDistance);

        const startTime = capturedPoints[0].timestamp;
        const endTime = capturedPoints[capturedPoints.length - 1].timestamp;
        const durationHours = (endTime - startTime) / (1000 * 60 * 60);
        const avgSpeed = durationHours > 0 ? distanceKm / durationHours : 0;

        const track: DrivingTrack = {
            userId: user.uid,
            date: format(new Date(), "yyyy-MM-dd"),
            startTime: format(new Date(startTime), "HH:mm"),
            endTime: format(new Date(endTime), "HH:mm"),
            distanceKm,
            avgSpeed,
            points: capturedPoints,
            type
        };

        try {
            await saveDrivingTrack(track);

            // Update trip distance if this user is the driver for the day
            try {
                const { doc, updateDoc, collection, query, where, getDocs } = await import('firebase/firestore');
                const { db } = await import('@/lib/firebase');

                const tripsRef = collection(db, "trips");
                const q = query(
                    tripsRef,
                    where("date", "==", track.date),
                    where("driverUid", "==", user.uid)
                );

                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    const tripDoc = querySnapshot.docs[0];
                    await updateDoc(tripDoc.ref, {
                        distanceKm: distanceKm
                    });
                    console.log(`Updated trip ${tripDoc.id} distance to ${distanceKm} km`);
                }
            } catch (e) {
                console.error("Failed to update trip distance:", e);
            }

            toast.success(`${type === 'morning' ? 'Sabah' : 'Akşam'} yolculuğu başarıyla kaydedildi.`, {
                description: `${distanceKm.toFixed(2)} km mesafe kaydedildi.`
            });
        } catch (error) {
            console.error("Error saving track:", error);
            toast.error("Yolculuk verisi kaydedilemedi.");
        }
    };

    useEffect(() => {
        const checkTimeAndTrack = () => {
            if (!user) return;
            // Only for meoncu@gmail.com as requested
            if (user.email !== 'meoncu@gmail.com' && profile?.role !== 'admin') {
                return;
            }

            const now = new Date();
            const dayOfWeek = getDay(now);

            if (dayOfWeek === 0 || dayOfWeek === 6) {
                if (isTracking) stopTracking();
                return;
            }

            const timeStr = format(now, "HH:mm");
            const isMorning = timeStr >= "07:50" && timeStr <= "08:30";
            const isEvening = timeStr >= "17:30" && timeStr <= "18:00";

            if ((isMorning || isEvening) && !isTracking) {
                if (!isManualTest) startTracking(isMorning ? 'morning' : 'evening');
            } else if (!(isMorning || isEvening) && isTracking) {
                if (!isManualTest) stopTracking();
            }
        };

        const timer = setInterval(checkTimeAndTrack, 20000);
        checkTimeAndTrack();

        return () => {
            clearInterval(timer);
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
            }
        };
    }, [user, isTracking, profile]);

    // Show in development mode automatically for testing
    const isDev = process.env.NODE_ENV === 'development';
    const isAuthorized = user?.email === 'meoncu@gmail.com' || profile?.role === 'admin';

    if (!isTracking && !isAuthorized && !isDev) return null;

    return (
        <div className="fixed bottom-24 right-4 z-[9999] flex flex-col items-end gap-2 pointer-events-none">
            {isTracking && (
                <div className="animate-pulse bg-primary text-primary-foreground px-4 py-2 rounded-full shadow-lg flex items-center gap-2 border-2 border-primary-foreground/20 pointer-events-auto">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                    <div className="flex flex-col leading-none">
                        <span className="text-[10px] font-black uppercase tracking-widest">GPS AKTİF</span>
                        <span className="text-[9px] font-mono opacity-80">{liveDistance.toFixed(2)} KM</span>
                    </div>
                </div>
            )}

            {/* Debug Button */}
            {(isAuthorized || isDev) && (
                <button
                    onClick={() => {
                        if (isTracking) {
                            stopTracking();
                            setIsManualTest(false);
                            toast.info("Test modu durduruldu.");
                        } else {
                            setIsManualTest(true);
                            startTracking('evening');
                            toast.success("Test modu başlatıldı (Zaman kısıtlaması yok)");
                        }
                    }}
                    className={cn(
                        "text-[9px] font-bold px-3 py-1.5 rounded-full shadow-lg transition-all pointer-events-auto",
                        isTracking && isManualTest
                            ? "bg-red-500 text-white hover:bg-red-600"
                            : "bg-gray-800 text-white hover:bg-black opacity-50 hover:opacity-100"
                    )}
                >
                    {isTracking && isManualTest ? "TESTİ DURDUR" : "GPS TEST BAŞLAT"}
                </button>
            )}
        </div>
    );
};

// Helper for live distance
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

