"use client";

import React, { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAllTrips, getUsers, getApprovedUsers } from "@/lib/db-service";
import { getFuelPrices, getMonthFuelHistory, FuelPriceData } from "@/lib/fuel-service";
import { Trip, UserProfile } from "@/types";
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import Link from "next/link";
import {
    Fuel,
    Gauge,
    TrendingUp,
    CalendarDays,
    Car,
    ChevronLeft,
    ChevronRight,
    Wallet,
    ArrowLeft
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

    const [trips, setTrips] = useState<Trip[]>([]);
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [fuelPrices, setFuelPrices] = useState<FuelPriceData | null>(null);
    const [fuelHistory, setFuelHistory] = useState<Record<string, FuelPriceData>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const monthStr = format(selectedMonth, "yyyy-MM");
                const [allTrips, allUsers, prices, history] = await Promise.all([
                    getAllTrips(),
                    getApprovedUsers(),
                    getFuelPrices(),
                    getMonthFuelHistory(monthStr)
                ]);
                setTrips(allTrips);
                setUsers(allUsers);
                setFuelPrices(prices);
                setFuelHistory(history);
            } catch (error) {
                console.error("Error fetching report data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [selectedMonth]);

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
                            <h1 className="text-3xl font-black text-foreground tracking-tight">Yakıt Raporu</h1>
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
        </AppLayout>
    );
}

