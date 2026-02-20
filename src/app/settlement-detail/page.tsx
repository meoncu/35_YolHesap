"use client";

import React, { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
    getApprovedUsers,
    getTripsByMonth,
    getAppSettings
} from "@/lib/db-service";
import { UserProfile, Trip } from "@/types";
import {
    ChevronLeft,
    ChevronRight,
    Calendar as CalendarIcon,
    Calculator,
    ArrowLeft,
    User,
    Clock,
    Car,
    Users as UsersIcon,
    Receipt
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

export default function SettlementDetailPage() {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [trips, setTrips] = useState<Trip[]>([]);
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [settings, setSettings] = useState<any>({ dailyFee: 100 });
    const [loading, setLoading] = useState(true);
    const [activeUser, setActiveUser] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const monthStr = format(selectedDate, "yyyy-MM");
                const [fetchedUsers, fetchedTrips, settings] = await Promise.all([
                    getApprovedUsers(),
                    getTripsByMonth(monthStr),
                    getAppSettings()
                ]);
                setUsers(fetchedUsers);
                setTrips(fetchedTrips);
                setSettings(settings);

                if (fetchedUsers.length > 0 && !activeUser) {
                    setActiveUser(fetchedUsers[0].uid);
                }
            } catch (error) {
                console.error("Error fetching detail data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [selectedDate]);

    const monthDays = useMemo(() => {
        return eachDayOfInterval({
            start: startOfMonth(selectedDate),
            end: endOfMonth(selectedDate)
        }).filter(day => day.getDay() !== 0 && day.getDay() !== 6); // Exclude weekends if you want, but better keep all for flexibility
    }, [selectedDate]);

    const userStats = useMemo(() => {
        if (!activeUser) return null;
        const user = users.find(u => u.uid === activeUser);
        if (!user) return null;

        const details = monthDays.map(day => {
            const dateStr = format(day, "yyyy-MM-dd");
            const trip = trips.find(t => t.date === dateStr);

            let role: 'driver' | 'passenger' | 'none' = 'none';
            let amount = 0;
            let description = "";

            if (trip) {
                // Dynamic fee check
                let activeFee = settings.dailyFee;
                if (settings.feeEffectiveDate && dateStr < settings.feeEffectiveDate) {
                    activeFee = settings.previousDailyFee || settings.dailyFee;
                }

                if (trip.driverUid === activeUser) {
                    role = 'driver';
                    const othersCount = (trip.participants || []).filter(pid => pid !== activeUser).length;
                    amount = othersCount * activeFee;
                    description = `${othersCount} Yolcu x ₺${activeFee}`;
                } else if (trip.participants?.includes(activeUser)) {
                    role = 'passenger';
                    amount = -activeFee;
                    description = `Yolcu Ücreti (₺${activeFee})`;
                }
            }

            return {
                date: day,
                role,
                amount,
                description
            };
        }).filter(d => d.role !== 'none');

        const totalCredit = details.filter(d => d.amount > 0).reduce((sum, d) => sum + d.amount, 0);
        const totalDebt = Math.abs(details.filter(d => d.amount < 0).reduce((sum, d) => sum + d.amount, 0));
        const net = totalCredit - totalDebt;

        return {
            user,
            details,
            totalCredit,
            totalDebt,
            net
        };
    }, [activeUser, users, trips, monthDays, settings]);

    const handlePrevMonth = () => {
        setSelectedDate(prev => {
            const d = new Date(prev);
            d.setMonth(d.getMonth() - 1);
            return d;
        });
    };

    const handleNextMonth = () => {
        setSelectedDate(prev => {
            const d = new Date(prev);
            d.setMonth(d.getMonth() + 1);
            return d;
        });
    };

    return (
        <AppLayout>
            <div className="space-y-6 pb-24 max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/">
                            <Button variant="ghost" size="icon" className="rounded-full">
                                <ArrowLeft size={20} />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-black text-foreground tracking-tight">Hesap Detayları</h1>
                            <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest flex items-center gap-1">
                                <Receipt size={12} /> Güncel Ücret: ₺{settings.dailyFee}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-xl border border-border">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={handlePrevMonth}>
                            <ChevronLeft size={16} />
                        </Button>
                        <span className="text-xs font-black uppercase min-w-[100px] text-center">
                            {format(selectedDate, "MMMM yyyy", { locale: tr })}
                        </span>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={handleNextMonth}>
                            <ChevronRight size={16} />
                        </Button>
                    </div>
                </div>

                {/* User Selector */}
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                    {users.map(u => (
                        <button
                            key={u.uid}
                            onClick={() => setActiveUser(u.uid)}
                            className={cn(
                                "flex-shrink-0 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                                activeUser === u.uid
                                    ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
                                    : "bg-card border-border text-muted-foreground hover:border-primary/50"
                            )}
                        >
                            {u.name}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Veriler Yükleniyor...</p>
                    </div>
                ) : userStats ? (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6"
                    >
                        {/* Summary Cards */}
                        <div className="grid grid-cols-3 gap-3">
                            <Card className="p-4 rounded-3xl border-none shadow-sm bg-emerald-500/5 flex flex-col items-center justify-center text-center gap-1">
                                <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">ALACAK</span>
                                <span className="text-xl font-black text-emerald-600">₺{userStats.totalCredit}</span>
                            </Card>
                            <Card className="p-4 rounded-3xl border-none shadow-sm bg-rose-500/5 flex flex-col items-center justify-center text-center gap-1">
                                <span className="text-[8px] font-black text-rose-600 uppercase tracking-widest">BORÇ</span>
                                <span className="text-xl font-black text-rose-600">₺{userStats.totalDebt}</span>
                            </Card>
                            <Card className={cn(
                                "p-4 rounded-3xl border-none shadow-xl flex flex-col items-center justify-center text-center gap-1",
                                userStats.net >= 0 ? "bg-primary text-primary-foreground shadow-primary/20" : "bg-rose-500 text-white shadow-rose-500/20"
                            )}>
                                <span className="text-[8px] font-black uppercase tracking-widest opacity-70">NET DURUM</span>
                                <span className="text-xl font-black">{userStats.net > 0 ? '+' : ''}₺{userStats.net}</span>
                            </Card>
                        </div>

                        {/* Detailed Table */}
                        <Card className="rounded-[2.5rem] border-border shadow-xl shadow-blue-900/5 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-muted/50 border-b border-border">
                                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">TARİH</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">ROL</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">DETAY</th>
                                            <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground">TUTAR</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {userStats.details.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-muted/30 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-black text-foreground">{format(row.date, "d MMMM", { locale: tr })}</span>
                                                        <span className="text-[9px] font-bold text-muted-foreground uppercase">{format(row.date, "EEEE", { locale: tr })}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {row.role === 'driver' ? (
                                                        <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary px-2.5 py-1 rounded-lg">
                                                            <Car size={10} strokeWidth={3} />
                                                            <span className="text-[9px] font-black uppercase tracking-wider">ŞOFÖR</span>
                                                        </div>
                                                    ) : (
                                                        <div className="inline-flex items-center gap-1.5 bg-orange-500/10 text-orange-600 px-2.5 py-1 rounded-lg">
                                                            <UsersIcon size={10} strokeWidth={3} />
                                                            <span className="text-[9px] font-black uppercase tracking-wider">YOLCU</span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-[10px] font-bold text-muted-foreground italic">{row.description}</span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className={cn(
                                                        "text-xs font-black",
                                                        row.amount > 0 ? "text-emerald-600" : "text-rose-600"
                                                    )}>
                                                        {row.amount > 0 ? '+' : ''}₺{row.amount}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                        {userStats.details.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="py-20 text-center">
                                                    <div className="flex flex-col items-center gap-2 opacity-20">
                                                        <Clock size={48} />
                                                        <p className="text-[10px] font-black uppercase tracking-widest">Henüz Kayıt Yok</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>

                        {/* Footer Note */}
                        <div className="p-6 bg-card rounded-3xl border border-dashed border-border flex items-start gap-4">
                            <div className="bg-primary/10 p-2 rounded-xl text-primary flex-shrink-0">
                                <Calculator size={20} />
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-xs font-black uppercase tracking-widest text-foreground">Hesaplama Mantığı</h4>
                                <p className="text-[10px] text-muted-foreground leading-relaxed font-medium">
                                    Şoför olduğunuz günlerde araçtaki diğer her bir yolcu için belirlenen günlük ücret hanenize <strong>artı</strong> olarak eklenir.
                                    Yolcu olduğunuz günlerde ise şoföre ödenmek üzere hanenize <strong>eksi</strong> yazılır.
                                    Ücret değişiklikleri (zamlar), belirlenen başlangıç tarihine göre otomatik hesaplanır.
                                </p>
                            </div>
                        </div>
                    </motion.div>
                ) : null}
            </div>
        </AppLayout>
    );
}
