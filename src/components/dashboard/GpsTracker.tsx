"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
 * - Automatically tracks GPS coordinates during specified time windows (weekdays only):
 *   Morning: 07:50 - 08:30
 *   Evening: 17:30 - 18:30
 * - Manual test mode: allows GPS recording at ANY time with full controls.
 * - Works on mobile browsers including Opera on Android.
 */
export const GpsTracker: React.FC = () => {
    const { user, profile } = useAuth();
    const [liveDistance, setLiveDistance] = useState(0);
    const [isTracking, setIsTracking] = useState(false);
    const [isManualTest, setIsManualTest] = useState(false);
    const [pointCount, setPointCount] = useState(0);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [testType, setTestType] = useState<'morning' | 'evening'>('morning');
    const [showPanel, setShowPanel] = useState(false);
    const [gpsStatus, setGpsStatus] = useState<'idle' | 'acquiring' | 'active' | 'error'>('idle');
    const [lastCoord, setLastCoord] = useState<{ lat: number; lng: number } | null>(null);

    const watchIdRef = useRef<number | null>(null);
    const trackingTypeRef = useRef<'morning' | 'evening' | null>(null);
    const pointsRef = useRef<DrivingTrackPoint[]>([]);
    const lastMinuteSavedRef = useRef<number>(0);
    const isManualTestRef = useRef(false);
    const startTimeRef = useRef<number>(0);
    const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Keep ref in sync with state for use in callbacks
    isManualTestRef.current = isManualTest;

    const isAuthorized = user?.email === 'meoncu@gmail.com' || profile?.role === 'admin';

    const startTracking = useCallback((type: 'morning' | 'evening') => {
        if (!("geolocation" in navigator)) {
            toast.error("Bu tarayıcı GPS/Konum servisini desteklemiyor.", {
                description: "Lütfen tarayıcı ayarlarından konum iznini kontrol edin."
            });
            return;
        }

        // Check for existing watch
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }

        console.log(`[GPS] Starting ${type} tracking...`);
        setIsTracking(true);
        setLiveDistance(0);
        setPointCount(0);
        setElapsedSeconds(0);
        setGpsStatus('acquiring');
        trackingTypeRef.current = type;
        pointsRef.current = [];
        lastMinuteSavedRef.current = 0;
        startTimeRef.current = Date.now();

        // Start elapsed timer
        if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
        elapsedTimerRef.current = setInterval(() => {
            setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }, 1000);

        watchIdRef.current = navigator.geolocation.watchPosition(
            async (position) => {
                const now = Date.now();
                const speedKmh = position.coords.speed ? (position.coords.speed * 3.6) : 0;
                const accuracy = position.coords.accuracy;

                setGpsStatus('active');
                setLastCoord({ lat: position.coords.latitude, lng: position.coords.longitude });

                // Skip very inaccurate readings (>100m)
                if (accuracy > 100) {
                    console.log(`[GPS] Skipping inaccurate point (accuracy: ${accuracy}m)`);
                    return;
                }

                // Reverse geocoding throttling (every ~58 seconds)
                const shouldDoReverseGeocode = (now - lastMinuteSavedRef.current) >= 58000;

                let address = "";
                if (shouldDoReverseGeocode) {
                    try {
                        address = await reverseGeocode(position.coords.latitude, position.coords.longitude);
                    } catch (e) {
                        console.error("[GPS] Reverse geocode failed:", e);
                    }
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
                    // Only add distance if the movement seems real (>5m)
                    if (dist > 0.005) {
                        setLiveDistance(prev => prev + dist);
                    }
                }

                // Add point
                pointsRef.current.push(newPoint);
                setPointCount(pointsRef.current.length);

                // Real-time location save to Firestore
                if (user) {
                    saveLocation(user.uid, newPoint.lat, newPoint.lng).catch(err => {
                        console.error("[GPS] Failed to save location:", err);
                    });
                }
            },
            (error) => {
                console.error(`[GPS] Error: Code ${error.code} - ${error.message}`);
                if (error.code === 1) { // PERMISSION_DENIED
                    setGpsStatus('error');
                    setIsTracking(false);
                    setIsManualTest(false);
                    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
                    toast.error("GPS İzni Reddedildi!", {
                        description: "Tarayıcı ayarlarından konum iznini 'İzin Ver' olarak değiştirin ve sayfayı yenileyin.",
                        duration: 10000
                    });
                } else if (error.code === 2) { // POSITION_UNAVAILABLE
                    setGpsStatus('error');
                    toast.error("GPS sinyali alınamıyor.", {
                        description: "Açık alana çıkın veya GPS'i açın."
                    });
                } else if (error.code === 3) { // TIMEOUT
                    // Timeout can happen, don't stop tracking
                    console.warn("[GPS] Timeout, will retry...");
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 30000,
                maximumAge: 0
            }
        );

        const label = type === 'morning' ? 'Sabah' : 'Akşam';
        toast.info(`${label} yolculuğu takibi başladı.`, {
            description: "Güzergâhınız kaydediliyor. Tarayıcıyı kapatmayın.",
            duration: 5000
        });
    }, [user]);

    const stopTracking = useCallback(async () => {
        console.log("[GPS] Stopping tracking...");

        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }

        if (elapsedTimerRef.current) {
            clearInterval(elapsedTimerRef.current);
            elapsedTimerRef.current = null;
        }

        setIsTracking(false);
        setGpsStatus('idle');
        const wasManualTest = isManualTestRef.current;
        setIsManualTest(false);

        const type = trackingTypeRef.current;
        trackingTypeRef.current = null;

        const capturedPoints = [...pointsRef.current];
        pointsRef.current = [];

        if (capturedPoints.length < 2 || !user || !type) {
            const reason = capturedPoints.length < 2
                ? `Yetersiz nokta sayısı (${capturedPoints.length})`
                : !user ? "Kullanıcı bulunamadı" : "Tip belirlenemedi";
            console.warn(`[GPS] Cannot save track: ${reason}`);
            toast.warning("Yolculuk kaydedilemedi.", {
                description: `${reason}. En az 2 GPS noktası gerekli.`
            });
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
            date: format(new Date(startTime), "yyyy-MM-dd"),
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
                    console.log(`[GPS] Updated trip ${tripDoc.id} distance to ${distanceKm} km`);
                }
            } catch (e) {
                console.error("[GPS] Failed to update trip distance:", e);
            }

            const label = type === 'morning' ? 'Sabah' : 'Akşam';
            toast.success(`${label} yolculuğu başarıyla kaydedildi! ✅`, {
                description: `📍 ${distanceKm.toFixed(2)} km • ${capturedPoints.length} nokta • ${track.startTime}-${track.endTime}`,
                duration: 8000
            });
        } catch (error) {
            console.error("[GPS] Error saving track:", error);
            toast.error("Yolculuk verisi kaydedilemedi.", {
                description: "İnternet bağlantınızı kontrol edin."
            });
        }
    }, [user]);

    // Automatic time-based tracking
    useEffect(() => {
        const checkTimeAndTrack = () => {
            if (!user) return;
            if (user.email !== 'meoncu@gmail.com' && profile?.role !== 'admin') return;

            // Skip if manual test is active
            if (isManualTestRef.current) return;

            const now = new Date();
            const dayOfWeek = getDay(now);

            // Weekends off
            if (dayOfWeek === 0 || dayOfWeek === 6) {
                if (isTracking && !isManualTestRef.current) stopTracking();
                return;
            }

            const timeStr = format(now, "HH:mm");
            const isMorning = timeStr >= "07:50" && timeStr <= "08:30";
            const isEvening = timeStr >= "17:30" && timeStr <= "18:30";

            if ((isMorning || isEvening) && !isTracking) {
                startTracking(isMorning ? 'morning' : 'evening');
            } else if (!(isMorning || isEvening) && isTracking && !isManualTestRef.current) {
                stopTracking();
            }
        };

        const timer = setInterval(checkTimeAndTrack, 20000);
        checkTimeAndTrack();

        return () => {
            clearInterval(timer);
        };
    }, [user, isTracking, profile, startTracking, stopTracking]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
            }
            if (elapsedTimerRef.current) {
                clearInterval(elapsedTimerRef.current);
            }
        };
    }, []);

    // Format elapsed time
    const formatElapsed = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    if (!isAuthorized) return null;

    return (
        <div className="fixed bottom-24 right-4 z-[9999] flex flex-col items-end gap-2">
            {/* Live Tracking Info Panel */}
            {isTracking && (
                <div className="bg-card border-2 border-primary shadow-2xl shadow-primary/20 rounded-2xl p-3 min-w-[200px] animate-in fade-in slide-in-from-right-4 duration-500 pointer-events-auto">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="relative">
                            <div className="w-2.5 h-2.5 bg-red-500 rounded-full" />
                            <div className="w-2.5 h-2.5 bg-red-500 rounded-full absolute inset-0 animate-ping" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                            {isManualTest ? 'TEST MODU' : 'GPS AKTİF'}
                        </span>
                        <span className={cn(
                            "text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full ml-auto",
                            trackingTypeRef.current === 'morning'
                                ? "bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400"
                                : "bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400"
                        )}>
                            {trackingTypeRef.current === 'morning' ? '☀ Sabah' : '🌙 Akşam'}
                        </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                            <p className="text-[8px] font-bold text-muted-foreground uppercase">Mesafe</p>
                            <p className="text-sm font-black text-foreground">{liveDistance.toFixed(2)}</p>
                            <p className="text-[8px] text-muted-foreground">km</p>
                        </div>
                        <div>
                            <p className="text-[8px] font-bold text-muted-foreground uppercase">Nokta</p>
                            <p className="text-sm font-black text-foreground">{pointCount}</p>
                            <p className="text-[8px] text-muted-foreground">adet</p>
                        </div>
                        <div>
                            <p className="text-[8px] font-bold text-muted-foreground uppercase">Süre</p>
                            <p className="text-sm font-black text-foreground font-mono">{formatElapsed(elapsedSeconds)}</p>
                            <p className="text-[8px] text-muted-foreground">dk:sn</p>
                        </div>
                    </div>

                    {lastCoord && (
                        <div className="mt-2 px-1">
                            <p className="text-[8px] font-bold text-muted-foreground truncate">
                                📍 {lastCoord.lat.toFixed(5)}, {lastCoord.lng.toFixed(5)}
                            </p>
                        </div>
                    )}

                    {/* GPS Status indicator */}
                    <div className="mt-2 flex items-center gap-1.5">
                        <div className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            gpsStatus === 'active' ? "bg-emerald-500" :
                                gpsStatus === 'acquiring' ? "bg-yellow-500 animate-pulse" :
                                    gpsStatus === 'error' ? "bg-red-500" : "bg-gray-400"
                        )} />
                        <span className="text-[8px] font-bold text-muted-foreground">
                            {gpsStatus === 'active' ? 'Sinyal Alınıyor' :
                                gpsStatus === 'acquiring' ? 'GPS Bağlanıyor...' :
                                    gpsStatus === 'error' ? 'GPS Hatası!' : 'Beklemede'}
                        </span>
                    </div>

                    {/* Stop button while tracking */}
                    {isManualTest && (
                        <button
                            onClick={() => stopTracking()}
                            className="w-full mt-3 bg-red-500 hover:bg-red-600 text-white text-xs font-black py-2.5 rounded-xl shadow-lg shadow-red-500/30 transition-all active:scale-95 uppercase tracking-wider"
                        >
                            ⏹ TESTİ DURDUR VE KAYDET
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

// Haversine formula for live distance calculation
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
