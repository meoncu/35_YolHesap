"use client";

import React, { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAllTrips, getUsers, getApprovedUsers, getDrivingTracks } from "@/lib/db-service";
import { getFuelPrices, getMonthFuelHistory, FuelPriceData } from "@/lib/fuel-service";
import { Trip, UserProfile, DrivingTrack } from "@/types";
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import Link from "next/link";
import { GoogleMap, useJsApiLoader, Polyline, Marker } from "@react-google-maps/api";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Fuel,
    Gauge,
    TrendingUp,
    CalendarDays,
    Car,
    ChevronLeft,
    ChevronRight,
    Wallet,
    ArrowLeft,
    Navigation,
    Activity,
    Clock,
    ArrowUpRight,
    MapPin,
    Eye
} from "lucide-react";
import { cn } from "@/lib/utils";
import { addMonths, subMonths } from "date-fns";

interface ReportStats {
    daily: any[];
    byDriver: any[];
}

export default function ReportsPage() {
    const { user } = useAuth();
    // Start with current month
    const [selectedMonth, setSelectedMonth] = useState(new Date());
    const [selectedTrack, setSelectedTrack] = useState<DrivingTrack | null>(null);
    const [isMapModalOpen, setIsMapModalOpen] = useState(false);

    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
        libraries: ["places", "geometry"]
    });

    const [trips, setTrips] = useState<Trip[]>([]);
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [fuelPrices, setFuelPrices] = useState<FuelPriceData | null>(null);
    const [fuelHistory, setFuelHistory] = useState<Record<string, FuelPriceData>>({});
    const [drivingTracks, setDrivingTracks] = useState<DrivingTrack[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'fuel' | 'gps'>('fuel');

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const monthStr = format(selectedMonth, "yyyy-MM");
                const [allTrips, allUsers, prices, history, tracks] = await Promise.all([
                    getAllTrips(),
                    getApprovedUsers(),
                    getFuelPrices(),
                    getMonthFuelHistory(monthStr),
                    user ? getDrivingTracks(user.uid, monthStr) : Promise.resolve([])
                ]);
                setTrips(allTrips);
                setUsers(allUsers);
                setFuelPrices(prices);
                setFuelHistory(history);
                setDrivingTracks(tracks);
            } catch (error) {
                console.error("Error fetching report data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [selectedMonth, user]);

    // Helper: Get Driver Info
    const getDriverInfo = (uid: string) => users.find(u => u.uid === uid);

    // Filter Trips by Month
    const filteredTrips = useMemo(() => {
        const start = startOfMonth(selectedMonth);
        const end = endOfMonth(selectedMonth);
        return trips.filter(trip => {
            const tripDate = parseISO(trip.date);
            return isWithinInterval(tripDate, { start, end });
        }).sort((a, b) => b.date.localeCompare(a.date));
    }, [trips, selectedMonth]);

    // Calculate Stats
    const stats: ReportStats = useMemo(() => {
        if (!fuelPrices || !filteredTrips.length) return { daily: [], byDriver: [] };

        const dailyStats = filteredTrips.map(trip => {
            const driver = getDriverInfo(trip.driverUid);
            const vehicle = driver?.vehicle;

            // Default distance if missing
            const distance = trip.distanceKm || 50;

            const consumptionRate = vehicle?.consumption || 7.0; // Default 7L/100km
            const fuelType = vehicle?.fuelType || 'benzin';

            // Get price based on fuel type for this SPECIFIC DATE
            const dailyPrice = fuelHistory[trip.date] || fuelPrices;

            let pricePerLiter = 0;
            if (fuelType === 'benzin') pricePerLiter = dailyPrice.benzin;
            else if (fuelType === 'motorin') pricePerLiter = dailyPrice.motorin;
            else if (fuelType === 'lpg') pricePerLiter = dailyPrice.lpg;
            else pricePerLiter = dailyPrice.benzin; // default

            const litersConsumed = (distance / 100) * consumptionRate;
            const cost = litersConsumed * pricePerLiter;

            return {
                ...trip,
                driverName: driver?.name || "Bilinmiyor",
                plate: vehicle?.plate || "PLAKA YOK",
                fuelType,
                distance,
                litersConsumed,
                cost
            };
        });

        // Group by Driver for Monthly Totals
        const driverStats: Record<string, any> = {};
        dailyStats.forEach(stat => {
            if (!driverStats[stat.driverUid]) {
                driverStats[stat.driverUid] = {
                    name: stat.driverName,
                    plate: stat.plate,
                    totalKm: 0,
                    totalCost: 0,
                    totalLiters: 0,
                    totalTrips: 0
                };
            }
            driverStats[stat.driverUid].totalKm += stat.distance;
            driverStats[stat.driverUid].totalCost += stat.cost;
            driverStats[stat.driverUid].totalLiters += stat.litersConsumed;
            driverStats[stat.driverUid].totalTrips += 1;
        });

        return { daily: dailyStats, byDriver: Object.values(driverStats) };
    }, [filteredTrips, fuelPrices, fuelHistory, users]);

    const totalMonthCost = stats.daily.reduce((acc: number, curr: any) => acc + (curr.cost || 0), 0);
    const totalMonthKm = stats.daily.reduce((acc: number, curr: any) => acc + (curr.distance || 0), 0);

    const nextMonth = () => setSelectedMonth(addMonths(selectedMonth, 1));
    const prevMonth = () => setSelectedMonth(subMonths(selectedMonth, 1));

    return (
        <AppLayout>
            <div className="space-y-8 pb-24">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Link href="/">
                            <Button variant="ghost" size="icon" className="rounded-full">
                                <ArrowLeft size={20} />
                            </Button>
                        </Link>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-3xl font-black text-foreground tracking-tight">Raporlar</h1>
                                <div className="flex bg-muted p-1 rounded-xl gap-1">
                                    <button
                                        onClick={() => setActiveTab('fuel')}
                                        className={cn("px-4 py-1.5 rounded-lg text-xs font-black uppercase transition-all", activeTab === 'fuel' ? "bg-card shadow-sm text-primary" : "text-muted-foreground hover:text-foreground")}
                                    >Yakıt</button>
                                    <button
                                        onClick={() => setActiveTab('gps')}
                                        className={cn("px-4 py-1.5 rounded-lg text-xs font-black uppercase transition-all", activeTab === 'gps' ? "bg-card shadow-sm text-primary" : "text-muted-foreground hover:text-foreground")}
                                    >GPS Takip</button>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                <button onClick={prevMonth} className="p-1 hover:bg-muted rounded-lg transition-colors">
                                    <ChevronLeft size={20} className="text-muted-foreground" />
                                </button>
                                <span className="text-lg font-bold text-primary min-w-[140px] text-center">
                                    {format(selectedMonth, "MMMM yyyy", { locale: tr })}
                                </span>
                                <button onClick={nextMonth} className="p-1 hover:bg-muted rounded-lg transition-colors">
                                    <ChevronRight size={20} className="text-muted-foreground" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Fuel Prices Widget */}
                    {fuelPrices && (
                        <div className="flex items-center gap-2 bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900 p-3 rounded-2xl text-white shadow-lg overflow-x-auto">
                            <div className="flex flex-col px-3 border-r border-slate-700/50">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ANKARA</span>
                                <span className="text-xs font-medium opacity-60">Fiyatlar (₺)</span>
                            </div>
                            <div className="flex items-center gap-4 px-2">
                                <div className="flex flex-col items-center">
                                    <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">Benzin</span>
                                    <span className="text-lg font-black tracking-tighter">{fuelPrices.benzin.toFixed(2)}</span>
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wider">Motorin</span>
                                    <span className="text-lg font-black tracking-tighter">{fuelPrices.motorin.toFixed(2)}</span>
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-[9px] font-bold text-blue-400 uppercase tracking-wider">LPG</span>
                                    <span className="text-lg font-black tracking-tighter">{fuelPrices.lpg.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {activeTab === 'fuel' ? (
                    <>
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Card className="border-border shadow-sm bg-primary/5">
                                <CardContent className="p-6 flex items-center gap-4">
                                    <div className="bg-primary/10 p-3 rounded-2xl text-primary">
                                        <CalendarDays size={24} strokeWidth={2.5} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-primary/60 uppercase tracking-wider">Toplam Sefer</p>
                                        <h3 className="text-2xl font-black text-foreground">{filteredTrips.length}</h3>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="border-border shadow-sm bg-emerald-500/5">
                                <CardContent className="p-6 flex items-center gap-4">
                                    <div className="bg-emerald-500/10 p-3 rounded-2xl text-emerald-500">
                                        <Gauge size={24} strokeWidth={2.5} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-emerald-500/60 uppercase tracking-wider">Toplam Mesafe</p>
                                        <h3 className="text-2xl font-black text-foreground">{totalMonthKm.toFixed(0)} <span className="text-sm font-bold opacity-60">KM</span></h3>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="border-border shadow-sm bg-indigo-500/5">
                                <CardContent className="p-6 flex items-center gap-4">
                                    <div className="bg-indigo-500/10 p-3 rounded-2xl text-indigo-500">
                                        <Wallet size={24} strokeWidth={2.5} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-indigo-500/60 uppercase tracking-wider">Tahmini Maliyet</p>
                                        <h3 className="text-2xl font-black text-foreground">{totalMonthCost.toFixed(2)} <span className="text-sm font-bold opacity-60">TL</span></h3>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Monthly Driver Breakdown */}
                        <div className="space-y-4">
                            <h2 className="text-lg font-black text-foreground flex items-center gap-2 px-1">
                                <Car size={20} className="text-primary" />
                                Araç Bazlı {format(selectedMonth, "MMMM", { locale: tr })} Özeti
                            </h2>
                            <div className="grid gap-4 md:grid-cols-2">
                                {stats.byDriver.map((driverData: any, idx: number) => (
                                    <div key={idx} className="bg-card p-5 rounded-3xl border border-border shadow-sm flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <Avatar className="h-12 w-12 rounded-2xl">
                                                <AvatarFallback className="bg-muted text-muted-foreground font-bold text-lg">
                                                    {driverData.name.charAt(0)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <h4 className="font-bold text-foreground">{driverData.name}</h4>
                                                <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                                    <span>{driverData.plate}</span>
                                                    <span className="w-1 h-1 rounded-full bg-border" />
                                                    <span>{driverData.totalTrips} Gün</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-lg font-black text-foreground">{driverData.totalCost.toFixed(0)}₺</div>
                                            <div className="text-xs font-bold text-muted-foreground">{driverData.totalKm.toFixed(0)} KM</div>
                                        </div>
                                    </div>
                                ))}
                                {stats.byDriver.length === 0 && (
                                    <div className="col-span-2 text-center py-8 text-muted-foreground font-medium bg-muted/50 rounded-3xl border border-dashed border-border">
                                        Bu döneme ait veri bulunamadı.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Daily Detailed List */}
                        <div className="space-y-4">
                            <h2 className="text-lg font-black text-foreground flex items-center gap-2 px-1">
                                <TrendingUp size={20} className="text-primary" />
                                Günlük Detaylı Döküm
                            </h2>
                            <div className="bg-card rounded-[2rem] border border-border shadow-sm overflow-hidden">
                                {stats.daily.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-muted/50 border-b border-border">
                                                <tr>
                                                    <th className="px-6 py-4 font-black text-muted-foreground uppercase tracking-wider text-[10px]">Tarih</th>
                                                    <th className="px-6 py-4 font-black text-muted-foreground uppercase tracking-wider text-[10px]">Sürücü / Araç</th>
                                                    <th className="px-6 py-4 font-black text-muted-foreground uppercase tracking-wider text-[10px] text-right">Mesafe</th>
                                                    <th className="px-6 py-4 font-black text-muted-foreground uppercase tracking-wider text-[10px] text-right">Tüketim</th>
                                                    <th className="px-6 py-4 font-black text-muted-foreground uppercase tracking-wider text-[10px] text-right">Maliyet</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border">
                                                {stats.daily.map((row: any, idx: number) => (
                                                    <tr key={idx} className="hover:bg-muted/50 transition-colors group">
                                                        <td className="px-6 py-4 font-bold text-muted-foreground whitespace-nowrap">
                                                            {format(parseISO(row.date), "d MMM, EEE", { locale: tr })}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-foreground">{row.driverName}</span>
                                                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{row.plate} • {row.fuelType}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="font-bold text-muted-foreground">{row.distance.toFixed(1)} km</div>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="font-bold text-muted-foreground">{row.litersConsumed.toFixed(1)} lt</div>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="font-black text-foreground bg-primary/5 px-3 py-1 rounded-lg inline-block group-hover:bg-primary/10 transition-colors">
                                                                {row.cost.toFixed(2)} ₺
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="py-20 text-center text-muted-foreground font-medium">
                                        Hiç sefer kaydı bulunamadı.
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-4">
                                <h2 className="text-lg font-black text-foreground flex items-center gap-2 px-1">
                                    <Activity size={20} className="text-primary" />
                                    Otomatik Rota Geçmişi
                                </h2>
                                <div className="grid gap-3">
                                    {drivingTracks.length > 0 ? (
                                        drivingTracks.map((track, idx) => (
                                            <Card key={idx} className="border-border shadow-sm bg-card hover:shadow-md transition-all overflow-hidden group">
                                                <div className="p-4 flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className={cn("p-3 rounded-2xl", track.type === 'morning' ? "bg-amber-100 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400" : "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400")}>
                                                            {track.type === 'morning' ? <Navigation size={22} /> : <Car size={22} />}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-black text-foreground">{format(parseISO(track.date), "d MMMM, EEE", { locale: tr })}</span>
                                                                <span className="px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground text-[8px] font-black uppercase">
                                                                    {track.type === 'morning' ? "GİDİŞ" : "DÖNÜŞ"}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-3 text-xs font-bold text-muted-foreground">
                                                                <span className="flex items-center gap-1"><Clock size={12} /> {track.startTime} - {track.endTime}</span>
                                                                <span className="flex items-center gap-1"><TrendingUp size={12} /> {track.avgSpeed.toFixed(0)} km/h</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <div className="text-right">
                                                            <div className="text-lg font-black text-primary">{track.distanceKm.toFixed(1)} <span className="text-[10px]">KM</span></div>
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="rounded-full hover:bg-muted group-hover:text-primary transition-all"
                                                            onClick={() => {
                                                                setSelectedTrack(track);
                                                                setIsMapModalOpen(true);
                                                            }}
                                                        >
                                                            <Eye size={18} />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </Card>
                                        ))
                                    ) : (
                                        <div className="py-20 text-center text-muted-foreground font-medium bg-muted/50 rounded-3xl border border-dashed border-border">
                                            Bu döneme ait otomatik sürüş kaydı bulunamadı.
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h2 className="text-lg font-black text-foreground flex items-center gap-2 px-1">
                                    <MapPin size={20} className="text-primary" />
                                    Güzergâh Özeti
                                </h2>
                                <Card className="border-border shadow-sm bg-card p-6 rounded-[2.5rem]">
                                    <div className="space-y-6">
                                        <div className="flex items-start gap-4 p-4 rounded-2xl bg-primary/5 border border-primary/10">
                                            <div className="p-2 rounded-xl bg-primary text-primary-foreground"><Activity size={18} /></div>
                                            <div>
                                                <p className="text-[10px] font-black text-primary uppercase mb-1">AYLIK TOPLAM MESAFE</p>
                                                <h4 className="text-2xl font-black text-foreground">
                                                    {drivingTracks.reduce((acc, t) => acc + t.distanceKm, 0).toFixed(1)} KM
                                                </h4>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-4 rounded-2xl bg-muted/50 border border-border">
                                                <p className="text-[9px] font-black text-muted-foreground uppercase mb-1">ORTALAMA HIZ</p>
                                                <h4 className="text-xl font-black text-foreground">
                                                    {drivingTracks.length > 0 ? (drivingTracks.reduce((acc, t) => acc + t.avgSpeed, 0) / drivingTracks.length).toFixed(0) : 0} <span className="text-xs">km/h</span>
                                                </h4>
                                            </div>
                                            <div className="p-4 rounded-2xl bg-muted/50 border border-border">
                                                <p className="text-[9px] font-black text-muted-foreground uppercase mb-1">TOPLAM KAYIT</p>
                                                <h4 className="text-xl font-black text-foreground">
                                                    {drivingTracks.length} <span className="text-xs">sürüş</span>
                                                </h4>
                                            </div>
                                        </div>
                                        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                                            <p className="text-xs text-amber-700 dark:text-amber-400 font-bold mb-2">💡 İpucu</p>
                                            <p className="text-xs text-muted-foreground leading-relaxed">
                                                Otomatik takip sadece <b>07:50-08:30</b> ve <b>17:30-18:00</b> saatleri arasında uygulama açıkken çalışır.
                                            </p>
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        </div>
                    </div>
                )}


                {/* Yearly/Monthly Overview */}
                <div className="space-y-4">
                    <h2 className="text-lg font-black text-foreground flex items-center gap-2 px-1">
                        <CalendarDays size={20} className="text-primary" />
                        Yıllık-Aylık Özet ({format(selectedMonth, "yyyy")})
                    </h2>
                    <div className="bg-card rounded-[2rem] border border-border shadow-sm overflow-hidden p-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {Array.from({ length: 12 }).map((_, i) => {
                                const monthDate = new Date(selectedMonth.getFullYear(), i, 1);
                                const monthTrips = trips.filter(t => {
                                    const d = parseISO(t.date);
                                    return d.getFullYear() === monthDate.getFullYear() && d.getMonth() === monthDate.getMonth();
                                });

                                const monthKm = monthTrips.reduce((acc, t) => acc + (t.distanceKm || 50), 0);
                                const isCurrent = i === selectedMonth.getMonth();

                                return (
                                    <button
                                        key={i}
                                        onClick={() => setSelectedMonth(monthDate)}
                                        className={cn(
                                            "p-4 rounded-2xl border transition-all text-center group",
                                            isCurrent
                                                ? "bg-primary border-primary text-primary-foreground shadow-lg"
                                                : "bg-muted/50 border-border hover:border-primary/50 text-muted-foreground"
                                        )}
                                    >
                                        <div className={cn("text-[10px] font-bold uppercase tracking-widest mb-1", isCurrent ? "text-primary-foreground/70" : "text-muted-foreground/60 group-hover:text-primary")}>
                                            {format(monthDate, "MMMM", { locale: tr })}
                                        </div>
                                        <div className="text-lg font-black tracking-tight">{monthKm} <span className="text-[10px] font-bold">KM</span></div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Map Modal */}
            <Dialog open={isMapModalOpen} onOpenChange={setIsMapModalOpen}>
                <DialogContent className="sm:max-w-[800px] w-full p-0 overflow-hidden rounded-[2.5rem] bg-card border-border shadow-2xl">
                    <DialogHeader className="p-6 pb-2">
                        <DialogTitle className="text-xl font-black flex items-center gap-3">
                            <Navigation size={24} className="text-primary" />
                            Yolculuk Rotası ({selectedTrack?.startTime} - {selectedTrack?.endTime})
                        </DialogTitle>
                    </DialogHeader>
                    {isLoaded && selectedTrack && selectedTrack.points.length > 0 ? (
                        <div className="relative w-full h-[60vh]">
                            <GoogleMap
                                mapContainerStyle={{ width: '100%', height: '100%' }}
                                center={{ lat: selectedTrack.points[0].lat, lng: selectedTrack.points[0].lng }}
                                zoom={14}
                                options={{
                                    styles: [
                                        {
                                            "elementType": "geometry",
                                            "stylers": [{ "color": "#242f3e" }]
                                        },
                                        {
                                            "elementType": "labels.text.fill",
                                            "stylers": [{ "color": "#746855" }]
                                        },
                                        {
                                            "elementType": "labels.text.stroke",
                                            "stylers": [{ "color": "#242f3e" }]
                                        }
                                        // Add more dark mode styles if needed or follow project theme
                                    ],
                                    disableDefaultUI: true,
                                    zoomControl: true
                                }}
                            >
                                <Polyline
                                    path={selectedTrack.points.map(p => ({ lat: p.lat, lng: p.lng }))}
                                    options={{
                                        strokeColor: "#3b82f6",
                                        strokeOpacity: 1,
                                        strokeWeight: 5,
                                    }}
                                />
                                <Marker
                                    position={{ lat: selectedTrack.points[0].lat, lng: selectedTrack.points[0].lng }}
                                    label="BAŞLANGIÇ"
                                />
                                <Marker
                                    position={{ lat: selectedTrack.points[selectedTrack.points.length - 1].lat, lng: selectedTrack.points[selectedTrack.points.length - 1].lng }}
                                    label="BİTİŞ"
                                />
                            </GoogleMap>
                            <div className="absolute bottom-6 left-6 right-6">
                                <div className="bg-card/90 backdrop-blur-md border border-border p-4 rounded-2xl shadow-xl flex justify-between items-center text-foreground">
                                    <div className="flex gap-6">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black uppercase text-muted-foreground">MESAFE</span>
                                            <span className="text-lg font-black">{selectedTrack.distanceKm.toFixed(2)} KM</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black uppercase text-muted-foreground">HIZ</span>
                                            <span className="text-lg font-black">{selectedTrack.avgSpeed.toFixed(1)} km/h</span>
                                        </div>
                                    </div>
                                    <Button onClick={() => setIsMapModalOpen(false)} className="rounded-xl font-bold uppercase text-xs tracking-widest px-6">KAPAT</Button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-[60vh] flex items-center justify-center bg-muted/20">
                            <p className="text-muted-foreground font-black">Harita Yükleniyor...</p>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}

