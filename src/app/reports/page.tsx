"use client";

import React, { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAllTrips, getUsers } from "@/lib/db-service";
import { getFuelPrices, FuelPriceData } from "@/lib/fuel-service";
import { Trip, UserProfile } from "@/types";
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import {
    Fuel,
    Gauge,
    TrendingUp,
    CalendarDays,
    Car,
    ArrowRight,
    Droplets,
    Wallet
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function ReportsPage() {
    const { user } = useAuth();
    // Start with current month
    const [selectedMonth, setSelectedMonth] = useState(new Date());

    const [trips, setTrips] = useState<Trip[]>([]);
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [fuelPrices, setFuelPrices] = useState<FuelPriceData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [allTrips, allUsers, prices] = await Promise.all([
                    getAllTrips(),
                    getUsers(),
                    getFuelPrices()
                ]);
                setTrips(allTrips);
                setUsers(allUsers);
                setFuelPrices(prices);
            } catch (error) {
                console.error("Error fetching report data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

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
    const stats = useMemo(() => {
        if (!fuelPrices) return [];

        const dailyStats = filteredTrips.map(trip => {
            const driver = getDriverInfo(trip.driverUid);
            const vehicle = driver?.vehicle;

            // Default distance if missing (mock logic: round trip estimate 50km or random for demo if 0)
            // Ideally this comes from DB "distanceKm"
            const distance = trip.distanceKm || 50;

            const consumptionRate = vehicle?.consumption || 7.0; // Default 7L/100km
            const fuelType = vehicle?.fuelType || 'benzin';

            // Get price based on fuel type
            let pricePerLiter = 0;
            if (fuelType === 'benzin') pricePerLiter = fuelPrices.benzin;
            else if (fuelType === 'motorin') pricePerLiter = fuelPrices.motorin;
            else if (fuelType === 'lpg') pricePerLiter = fuelPrices.lpg;
            else pricePerLiter = 0; // electric logic todo

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
    }, [filteredTrips, fuelPrices, users]);

    const totalMonthCost = stats.daily?.reduce((acc, curr) => acc + curr.cost, 0) || 0;
    const totalMonthKm = stats.daily?.reduce((acc, curr) => acc + curr.distance, 0) || 0;

    return (
        <AppLayout>
            <div className="space-y-8 pb-24">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Yakıt Raporu</h1>
                        <p className="text-gray-500 font-medium">Ankara akaryakıt verilerine göre hesaplanan maliyetler.</p>
                    </div>

                    {/* Fuel Prices Widget */}
                    {fuelPrices && (
                        <div className="flex items-center gap-2 bg-gradient-to-r from-slate-900 to-slate-800 p-3 rounded-2xl text-white shadow-lg overflow-x-auto">
                            <div className="flex flex-col px-3 border-r border-slate-700/50">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ANKARA</span>
                                <span className="text-xs font-medium opacity-60">Ortalama</span>
                            </div>
                            <div className="flex items-center gap-4 px-2">
                                <div className="flex flex-col items-center">
                                    <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">Benzin</span>
                                    <span className="text-lg font-black tracking-tighter">{fuelPrices.benzin.toFixed(2)}₺</span>
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wider">Motorin</span>
                                    <span className="text-lg font-black tracking-tighter">{fuelPrices.motorin.toFixed(2)}₺</span>
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-[9px] font-bold text-blue-400 uppercase tracking-wider">LPG</span>
                                    <span className="text-lg font-black tracking-tighter">{fuelPrices.lpg.toFixed(2)}₺</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="border-none shadow-sm bg-blue-50">
                        <CardContent className="p-6 flex items-center gap-4">
                            <div className="bg-blue-100 p-3 rounded-2xl text-blue-600">
                                <CalendarDays size={24} strokeWidth={2.5} />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-blue-900/60 uppercase tracking-wider">Toplam Sefer</p>
                                <h3 className="text-2xl font-black text-blue-900">{filteredTrips.length}</h3>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-none shadow-sm bg-emerald-50">
                        <CardContent className="p-6 flex items-center gap-4">
                            <div className="bg-emerald-100 p-3 rounded-2xl text-emerald-600">
                                <Gauge size={24} strokeWidth={2.5} />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-emerald-900/60 uppercase tracking-wider">Toplam Mesafe</p>
                                <h3 className="text-2xl font-black text-emerald-900">{totalMonthKm.toFixed(0)} <span className="text-sm font-bold opacity-60">KM</span></h3>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-none shadow-sm bg-indigo-50">
                        <CardContent className="p-6 flex items-center gap-4">
                            <div className="bg-indigo-100 p-3 rounded-2xl text-indigo-600">
                                <Wallet size={24} strokeWidth={2.5} />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-indigo-900/60 uppercase tracking-wider">Tahmini Maliyet</p>
                                <h3 className="text-2xl font-black text-indigo-900">{totalMonthCost.toFixed(2)} <span className="text-sm font-bold opacity-60">TL</span></h3>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Monthly Driver Breakdown */}
                <div className="space-y-4">
                    <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                        <Car size={20} className="text-blue-600" />
                        Araç Bazlı Aylık Tüketim
                    </h2>
                    <div className="grid gap-4 md:grid-cols-2">
                        {stats.byDriver?.map((driverData, idx) => (
                            <div key={idx} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="h-12 w-12 rounded-2xl bg-gray-50 flex items-center justify-center text-xl font-bold text-gray-400">
                                        {driverData.name.charAt(0)}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900">{driverData.name}</h4>
                                        <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                            <span>{driverData.plate}</span>
                                            <span className="w-1 h-1 rounded-full bg-gray-300" />
                                            <span>{driverData.totalTrips} Gün</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-lg font-black text-gray-900">{driverData.totalCost.toFixed(0)}₺</div>
                                    <div className="text-xs font-bold text-gray-500">{driverData.totalKm.toFixed(0)} KM</div>
                                </div>
                            </div>
                        ))}
                        {stats.byDriver?.length === 0 && (
                            <div className="col-span-2 text-center py-8 text-gray-400 font-medium bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                                Bu ay veri bulunamadı.
                            </div>
                        )}
                    </div>
                </div>

                {/* Daily Detailed List */}
                <div className="space-y-4">
                    <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                        <TrendingUp size={20} className="text-blue-600" />
                        Günlük Tüketim Detayları
                    </h2>
                    <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50/50 border-b border-gray-100">
                                    <tr>
                                        <th className="px-6 py-4 font-black text-gray-400 uppercase tracking-wider text-[10px]">Tarih</th>
                                        <th className="px-6 py-4 font-black text-gray-400 uppercase tracking-wider text-[10px]">Sürücü / Plaka</th>
                                        <th className="px-6 py-4 font-black text-gray-400 uppercase tracking-wider text-[10px] text-right">Mesafe</th>
                                        <th className="px-6 py-4 font-black text-gray-400 uppercase tracking-wider text-[10px] text-right">Tüketim</th>
                                        <th className="px-6 py-4 font-black text-gray-400 uppercase tracking-wider text-[10px] text-right">Maliyet</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {stats.daily?.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50/50 transition-colors group">
                                            <td className="px-6 py-4 font-bold text-gray-500">
                                                {format(parseISO(row.date), "d MMM, EEE", { locale: tr })}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-gray-900">{row.driverName}</span>
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{row.plate} • {row.fuelType}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="font-bold text-gray-700">{row.distance.toFixed(1)} km</div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="font-bold text-gray-500">{row.litersConsumed.toFixed(1)} lt</div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="font-black text-[#1E293B] bg-blue-50/50 px-3 py-1 rounded-lg inline-block group-hover:bg-blue-100 transition-colors">
                                                    {row.cost.toFixed(2)} ₺
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
