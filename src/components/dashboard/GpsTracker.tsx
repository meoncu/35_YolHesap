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
    const [isTracking, setIsTracking] = useState(false);
    const [isManualTest, setIsManualTest] = useState(false);
    const watchIdRef = useRef<number | null>(null);
    const trackingTypeRef = useRef<'morning' | 'evening' | null>(null);
    const pointsRef = useRef<DrivingTrackPoint[]>([]);
    const lastMinuteSavedRef = useRef<number>(0);

    useEffect(() => {
        const checkTimeAndTrack = () => {
            if (!user) return;

            // Only for meoncu@gmail.com as requested
            if (user.email !== 'meoncu@gmail.com' && profile?.role !== 'admin') {
                console.log(`GPS Tracking skipped: User ${user.email} not authorized or not admin.`);
                return;
            }

            const now = new Date();
            const dayOfWeek = getDay(now); // 0 = Sunday, 6 = Saturday

            // Weekends excluded (0=Sun, 6=Sat)
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
            } else if (!isTracking && !isManualTest) {
                // Debug log for why it's not tracking (only every minute or so to avoid spam? 
                // actually checkTimeAndTrack runs every 20s. Let's log if it's NOT tracking)
                console.log(`GPS Tracking skipped: Time ${timeStr} is outside windows (07:50-08:30, 17:30-18:00)`);
            }
        };

        const timer = setInterval(checkTimeAndTrack, 20000); // Check every 20s
        checkTimeAndTrack(); // Initial check

        return () => clearInterval(timer);
    }, [user, isTracking, profile]);

    const startTracking = (type: 'morning' | 'evening') => {
        if (!("geolocation" in navigator)) {
            console.error("Geolocation is not supported by this browser.");
            return;
        }

        console.log(`Starting ${type} GPS tracking...`);
        setIsTracking(true);
        trackingTypeRef.current = type;
        pointsRef.current = [];
        lastMinuteSavedRef.current = 0;

        watchIdRef.current = navigator.geolocation.watchPosition(
            async (position) => {
                const now = Date.now();
                const speedKmh = position.coords.speed ? (position.coords.speed * 3.6) : 0;

                // We want to record a point for the polyline frequently (good for the map)
                // But we only do reverse geocoding every ~60 seconds to avoid API limits and clutter
                const shouldDoReverseGeocode = (now - lastMinuteSavedRef.current) >= 58000; // ~1 minute

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

                pointsRef.current.push(newPoint);

                // Also save incremental location for real-time map features
                saveLocation(user!.uid, newPoint.lat, newPoint.lng).catch(console.error);
            },
            (error) => {
                console.error("GPS Tracking Error:", error);
                if (error.code === error.PERMISSION_DENIED) {
                    toast.error("GPS izni reddedildi. Otomatik takip yapılamıyor.");
                    setIsTracking(false);
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0
            }
        );

        toast.info(`${type === 'morning' ? 'Sabah' : 'Akşam'} yolculuğu takibi başladı.`, {
            description: "Güzergâhınız otomatik olarak kaydediliyor.",
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

            // Update main group trip distance automatically
            const tripId = `${track.date}_main-group`;
            try {
                const { doc, updateDoc } = await import('firebase/firestore');
                const { db } = await import('@/lib/firebase');
                const tripRef = doc(db, "trips", tripId);
                await updateDoc(tripRef, {
                    distanceKm: distanceKm
                });
            } catch (e) {
                // Trip might not exist yet
            }

            toast.success(`${type === 'morning' ? 'Sabah' : 'Akşam'} yolculuğu başarıyla kaydedildi.`, {
                description: `${distanceKm.toFixed(2)} km mesafe kaydedildi.`
            });
        } catch (error) {
            console.error("Error saving track:", error);
            toast.error("Yolculuk verisi kaydedilemedi.");
        }
    };

    // If not tracking and not authorized for debug, don't render anything
    // Show in development mode automatically for testing
    const isDev = process.env.NODE_ENV === 'development';
    const isAuthorized = user?.email === 'meoncu@gmail.com' || profile?.role === 'admin';

    if (!isTracking && !isAuthorized && !isDev) return null;

    return (
        <div className="fixed bottom-24 right-4 z-[9999] flex flex-col items-end gap-2">
            {isTracking && (
                <div className="animate-pulse bg-primary text-primary-foreground px-4 py-2 rounded-full shadow-lg flex items-center gap-2 border-2 border-primary-foreground/20">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                    <span className="text-[10px] font-black uppercase tracking-widest">GPS AKTİF</span>
                </div>
            )}

            {/* Debug Button for Admin/Meoncu/Dev */}
            {(isAuthorized || isDev) && (
                <button
                    onClick={() => {
                        if (isTracking) {
                            stopTracking();
                            setIsManualTest(false);
                            toast.info("Test modu durduruldu.");
                        } else {
                            setIsManualTest(true);
                            startTracking('evening'); // Default to evening type for test
                            toast.success("Test modu başlatıldı (Zaman kısıtlaması yok)");
                        }
                    }}
                    className={cn(
                        "text-[9px] font-bold px-3 py-1.5 rounded-full shadow-lg transition-all",
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

