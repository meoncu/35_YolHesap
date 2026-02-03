"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { saveDrivingTrack, saveLocation } from '@/lib/db-service';
import { calculateRouteDistance } from '@/lib/fuel-service';
import { DrivingTrack } from '@/types';
import { format } from 'date-fns';
import { toast } from 'sonner';

/**
 * GpsTracker Component
 * Automatically tracks GPS coordinates during specified time windows:
 * Morning: 07:50 - 08:30
 * Evening: 17:30 - 18:00
 */
export const GpsTracker: React.FC = () => {
    const { user, profile } = useAuth();
    const [isTracking, setIsTracking] = useState(false);
    const [currentPoints, setCurrentPoints] = useState<{ lat: number, lng: number, timestamp: number }[]>([]);
    const watchIdRef = useRef<number | null>(null);
    const trackingTypeRef = useRef<'morning' | 'evening' | null>(null);
    const pointsRef = useRef<{ lat: number, lng: number, timestamp: number }[]>([]);

    useEffect(() => {
        const checkTimeAndTrack = () => {
            if (!user) return;

            // Link to meoncu@gmail.com specifically as requested, or allow admin to test
            // Note: In production you might want this for all users, but following user request.
            if (user.email !== 'meoncu@gmail.com' && profile?.role !== 'admin') return;

            const now = new Date();
            const timeStr = format(now, "HH:mm");

            const isMorning = timeStr >= "07:50" && timeStr <= "08:30";
            const isEvening = timeStr >= "17:30" && timeStr <= "18:00";

            if ((isMorning || isEvening) && !isTracking) {
                startTracking(isMorning ? 'morning' : 'evening');
            } else if (!(isMorning || isEvening) && isTracking) {
                stopTracking();
            }
        };

        const timer = setInterval(checkTimeAndTrack, 30000); // Check every 30s
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
        setCurrentPoints([]);

        watchIdRef.current = navigator.geolocation.watchPosition(
            (position) => {
                const newPoint = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    timestamp: Date.now()
                };

                pointsRef.current.push(newPoint);
                setCurrentPoints([...pointsRef.current]);

                // Also save incremental location for real-time map features (legacy support)
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
        setCurrentPoints([]);

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

            // AUTOMATICALLY UPDATE TRIP DISTANCE
            // Find today's trip and update its distanceKm
            const tripId = `${track.date}_main-group`; // Following existing logic for main-group
            try {
                const { doc, updateDoc } = await import('firebase/firestore');
                const { db } = await import('@/lib/firebase');
                const tripRef = doc(db, "trips", tripId);
                await updateDoc(tripRef, {
                    distanceKm: distanceKm
                });
                console.log("Trip distance updated automatically.");
            } catch (e) {
                console.warn("Could not update trip distance (trip might not exist yet):", e);
            }

            toast.success(`${type === 'morning' ? 'Sabah' : 'Akşam'} yolculuğu başarıyla kaydedildi.`, {
                description: `${distanceKm.toFixed(2)} km mesafe, ortalama ${avgSpeed.toFixed(1)} km/h hız. Raporlara işlendi.`
            });
        } catch (error) {
            console.error("Error saving track:", error);
            toast.error("Yolculuk verisi kaydedilemedi.");
        }
    };

    // This component doesn't render anything UI-wise, but we could add a small indicator
    if (!isTracking) return null;

    return (
        <div className="fixed bottom-24 right-4 z-50 animate-pulse">
            <div className="bg-primary text-primary-foreground px-4 py-2 rounded-full shadow-lg flex items-center gap-2 border-2 border-primary-foreground/20">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                <span className="text-[10px] font-black uppercase tracking-widest">GPS AKTİF</span>
            </div>
        </div>
    );
};
