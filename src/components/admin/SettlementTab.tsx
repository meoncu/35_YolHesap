"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAllTrips, getAppSettings, getApprovedUsers } from "@/lib/db-service";
import { UserProfile, Trip } from "@/types";
import { Save, Calculator, Trash2, Receipt, RefreshCcw, Calendar, AlertCircle, Loader2 as LoaderIcon, Users } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, deleteDoc, doc } from "firebase/firestore";
import { format, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface SettlementResult {
    userId: string;
    userName: string;
    driverDays: number;
    passengerDays: number;
    activeDays: number; // Actual days present in any capacity
    debt: number;
    credit: number;
    grossCredit: number;
    net: number;
}

interface SettlementRecord {
    id?: string;
    type: 'manual' | 'auto';
    title: string;
    date: any;
    dailyFee: number;
    totalDays: number;
    results: SettlementResult[];
}

export const SettlementTab: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'auto' | 'manual'>('auto');
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);

    // Joint State
    const [dailyFee, setDailyFee] = useState(100);
    const [savedSettlements, setSavedSettlements] = useState<SettlementRecord[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    // Manual State
    const [manualTitle, setManualTitle] = useState(`${format(new Date(), "MMMM yyyy", { locale: tr })} Hesabı`);
    const [manualTotalDays, setManualTotalDays] = useState(22);
    const [driverDaysMap, setDriverDaysMap] = useState<{ [key: string]: number }>({});
    const [activeDaysMap, setActiveDaysMap] = useState<{ [key: string]: number }>({});

    // Auto State
    const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
    const [autoTrips, setAutoTrips] = useState<Trip[]>([]);
    const [accruedStats, setAccruedStats] = useState<SettlementResult[]>([]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [fetchedUsers, appSettings] = await Promise.all([
                getApprovedUsers(),
                getAppSettings()
            ]);
            setUsers(fetchedUsers);
            setDailyFee(appSettings.dailyFee);

            // Initialize activeDaysMap with manualTotalDays for all users by default
            const initialActive: any = {};
            fetchedUsers.forEach(u => initialActive[u.uid] = manualTotalDays);
            setActiveDaysMap(initialActive);

            const legacyQ = query(collection(db, "manual_settlements"), orderBy("date", "desc"));
            const legacySnap = await getDocs(legacyQ);
            const legacySettlements = legacySnap.docs.map(doc => ({
                id: doc.id,
                type: 'manual',
                ...doc.data()
            })) as SettlementRecord[];

            const newQ = query(collection(db, "settlements"), orderBy("date", "desc"));
            const newSnap = await getDocs(newQ);
            const newSettlements = newSnap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as SettlementRecord[];

            setSavedSettlements([...newSettlements, ...legacySettlements].sort((a, b) => b.date - a.date));
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Sync activeDaysMap when totalDays changes
    useEffect(() => {
        setActiveDaysMap(prev => {
            const next = { ...prev };
            users.forEach(u => {
                if (next[u.uid] === undefined || next[u.uid] > manualTotalDays) {
                    next[u.uid] = manualTotalDays;
                }
            });
            return next;
        });
    }, [manualTotalDays, users]);

    useEffect(() => {
        if (activeTab === 'auto') {
            const fetchAutoTrips = async () => {
                const trips = await getAllTrips();
                const filtered = trips.filter(t => t.date.startsWith(selectedMonth));
                setAutoTrips(filtered);
            };
            fetchAutoTrips();
        }
    }, [activeTab, selectedMonth]);

    useEffect(() => {
        if (activeTab === 'auto' && users.length > 0) {
            const stats = users.map(user => {
                let driverDays = 0;
                let passengerDays = 0;
                let activeDaysCount = 0;
                let credit = 0;
                let debt = 0;

                autoTrips.forEach(trip => {
                    const isDriver = trip.driverUid === user.uid;
                    const isPassenger = trip.participants && trip.participants.includes(user.uid);

                    if (isDriver || isPassenger) {
                        activeDaysCount++;
                    }

                    if (isDriver) {
                        driverDays++;
                        const otherPassengerCount = trip.participants
                            ? trip.participants.filter(pid => pid !== user.uid).length
                            : 0;
                        credit += otherPassengerCount * dailyFee;
                    } else if (isPassenger) {
                        passengerDays++;
                        debt += dailyFee;
                    }
                });

                return {
                    userId: user.uid,
                    userName: user.name,
                    driverDays,
                    passengerDays,
                    activeDays: activeDaysCount,
                    debt,
                    grossCredit: (driverDays * users.length * dailyFee),
                    credit,
                    net: credit - debt
                };
            });
            setAccruedStats(stats);
        }
    }, [autoTrips, dailyFee, users, activeTab]);

    const calculateManualResults = (): SettlementResult[] => {
        return users.map(user => {
            const activeDays = activeDaysMap[user.uid] ?? manualTotalDays;
            const driverDays = driverDaysMap[user.uid] || 0;

            // Critical fix: Passenger days is NOT (total - driver) but (active - driver)
            // If someone is active 19 days and drives 19 days, they are passenger for 0 days.
            const passengerDays = Math.max(0, activeDays - driverDays);

            const passengerDebt = passengerDays * dailyFee;
            const netCredit = driverDays * (users.length - 1) * dailyFee;

            return {
                userId: user.uid,
                userName: user.name,
                driverDays,
                passengerDays,
                activeDays,
                debt: passengerDebt,
                grossCredit: driverDays * users.length * dailyFee,
                credit: netCredit,
                net: netCredit - passengerDebt
            };
        });
    };

    const handleSave = async () => {
        const isAuto = activeTab === 'auto';
        const title = isAuto
            ? `${format(parseISO(selectedMonth + "-01"), "MMMM yyyy", { locale: tr })} Otomatik Hesap`
            : manualTitle;

        if (!title.trim()) {
            toast.error("Lütfen bir başlık girin.");
            return;
        }

        setIsSaving(true);
        try {
            const settlementData: any = {
                type: isAuto ? 'auto' : 'manual',
                title,
                date: serverTimestamp(),
                dailyFee,
                totalDays: isAuto ? autoTrips.length : manualTotalDays,
                results: isAuto ? accruedStats : calculateManualResults()
            };

            const docRef = await addDoc(collection(db, "settlements"), settlementData);
            setSavedSettlements([{ id: docRef.id, ...settlementData, date: new Date() }, ...savedSettlements]);
            toast.success("Hesaplama kaydedildi.");
        } catch (error) {
            console.error("Error saving settlement:", error);
            toast.error("Kaydedilemedi.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Emin misiniz?")) return;
        try {
            await deleteDoc(doc(db, "settlements", id)).catch(() => deleteDoc(doc(db, "manual_settlements", id)));
            setSavedSettlements(savedSettlements.filter(s => s.id !== id));
            toast.success("Silindi.");
        } catch (error) {
            toast.error("Silinemedi.");
        }
    };

    const results = activeTab === 'auto' ? accruedStats : calculateManualResults();

    // Summary values
    const totalDriverDays = Object.values(driverDaysMap).reduce((a, b) => a + b, 0);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex bg-muted p-1 rounded-xl w-fit">
                    <button
                        onClick={() => setActiveTab('auto')}
                        className={cn("px-4 py-2 rounded-lg text-xs font-black uppercase transition-all flex items-center gap-2", activeTab === 'auto' ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}
                    >
                        <RefreshCcw size={14} /> Otomatik
                    </button>
                    <button
                        onClick={() => setActiveTab('manual')}
                        className={cn("px-4 py-2 rounded-lg text-xs font-black uppercase transition-all flex items-center gap-2", activeTab === 'manual' ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}
                    >
                        <Calculator size={14} /> Manuel
                    </button>
                </div>

                <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="rounded-2xl h-12 px-6 font-black uppercase tracking-widest bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                >
                    {isSaving ? <LoaderIcon className="animate-spin" /> : <><Save size={18} className="mr-2" /> HESABI KAYDET</>}
                </Button>
            </div>

            <div className="grid md:grid-cols-12 gap-6">
                <div className="md:col-span-4 space-y-6">
                    <Card className="rounded-[2rem] border-border shadow-sm">
                        <CardHeader className="pb-3 px-6 pt-6">
                            <CardTitle className="text-xs font-black text-muted-foreground uppercase tracking-widest">Genel Ayarlar</CardTitle>
                        </CardHeader>
                        <CardContent className="px-6 pb-6 space-y-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Günlük Kişi Başı Ücret</Label>
                                <div className="relative">
                                    <Input
                                        type="number"
                                        value={dailyFee}
                                        onChange={e => setDailyFee(Number(e.target.value))}
                                        className="h-12 pl-8 rounded-xl bg-muted border-transparent font-black"
                                    />
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-black">₺</span>
                                </div>
                            </div>

                            {activeTab === 'auto' ? (
                                <div className="space-y-3 pt-2 border-t border-border">
                                    <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Dönem Seçimi</Label>
                                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                        <SelectTrigger className="h-12 rounded-xl bg-primary/10 border-transparent text-primary font-black">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Array.from({ length: 12 }).map((_, i) => {
                                                const d = new Date();
                                                d.setMonth(d.getMonth() - i);
                                                const val = format(d, "yyyy-MM");
                                                const label = format(d, "MMMM yyyy", { locale: tr });
                                                return <SelectItem key={val} value={val} className="font-bold">{label}</SelectItem>
                                            })}
                                        </SelectContent>
                                    </Select>
                                    <div className="bg-primary/5 p-3 rounded-xl border border-primary/10">
                                        <p className="text-[10px] font-bold text-primary leading-tight">Takvimdeki gerçek günlük girişleri (şoför ve yolcular) baz alarak hesaplama yapar.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4 pt-2 border-t border-border">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Hesap Başlığı</Label>
                                        <Input
                                            value={manualTitle}
                                            onChange={(e) => setManualTitle(e.target.value)}
                                            className="h-12 rounded-xl bg-muted border-transparent font-black"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Ay içi toplam mesai günü</Label>
                                        <Input
                                            type="number"
                                            value={manualTotalDays}
                                            onChange={(e) => setManualTotalDays(Number(e.target.value))}
                                            className="h-12 rounded-xl bg-muted border-transparent font-black"
                                        />
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {activeTab === 'manual' && (
                        <Card className="rounded-[2rem] border-border shadow-sm">
                            <CardHeader className="px-6 pt-6 pb-2">
                                <CardTitle className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center justify-between">
                                    <span>Kullanıcı Detayları</span>
                                    <span className="text-[9px] lowercase font-medium opacity-50 italic">şoför / aktif gün</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="px-6 pb-6 space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                                {users.map(u => (
                                    <div key={u.uid} className="space-y-2 p-3 rounded-2xl bg-muted/20 border border-border/50">
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary uppercase">{u.name.charAt(0)}</div>
                                            <span className="text-xs font-black uppercase truncate">{u.name}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="space-y-1">
                                                <Label className="text-[8px] font-black uppercase text-muted-foreground ml-1">Şoförlük Günü</Label>
                                                <Input
                                                    type="number"
                                                    value={driverDaysMap[u.uid] || 0}
                                                    onChange={e => setDriverDaysMap({ ...driverDaysMap, [u.uid]: parseInt(e.target.value) || 0 })}
                                                    className="h-9 text-center rounded-lg bg-card border-transparent font-black text-xs"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[8px] font-black uppercase text-muted-foreground ml-1">Katıldığı Gün</Label>
                                                <Input
                                                    type="number"
                                                    value={activeDaysMap[u.uid] ?? manualTotalDays}
                                                    onChange={e => setActiveDaysMap({ ...activeDaysMap, [u.uid]: parseInt(e.target.value) || 0 })}
                                                    className="h-9 text-center rounded-lg bg-card border-transparent font-black text-xs"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}
                </div>

                <div className="md:col-span-8 space-y-6">
                    <Card className="rounded-[2rem] border-border shadow-xl shadow-blue-900/5 overflow-hidden bg-card">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-muted/50 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                        <th className="px-6 py-4 text-left font-black">İSİM</th>
                                        <th className="px-6 py-4 text-center font-black">ŞOFÖR / YOLCU / KATILIM</th>
                                        <th className="px-6 py-4 text-right font-black">BORÇ</th>
                                        <th className="px-6 py-4 text-right font-black">ALACAK</th>
                                        <th className="px-6 py-4 text-right font-black">NET</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {results.map(res => (
                                        <tr key={res.userId} className="hover:bg-muted/20 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className={cn("w-1.5 h-1.5 rounded-full", res.net > 0 ? "bg-emerald-500" : res.net < 0 ? "bg-rose-500" : "bg-muted-foreground/30")} />
                                                    <span className="text-xs font-black uppercase">{res.userName}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center text-[10px] font-bold text-muted-foreground">
                                                <span className="text-primary font-black">{res.driverDays}Ş</span> / <span className="text-orange-500 font-black">{res.passengerDays}Y</span> / <span className="text-foreground font-black">{res.activeDays} GÜN</span>
                                            </td>
                                            <td className="px-6 py-4 text-right text-xs font-bold text-rose-500">₺{res.debt}</td>
                                            <td className="px-6 py-4 text-right text-xs font-bold text-emerald-500">₺{res.credit}</td>
                                            <td className="px-6 py-4 text-right">
                                                <span className={cn(
                                                    "px-3 py-1.5 rounded-xl text-[10px] font-black shadow-sm inline-block min-w-[70px] text-center",
                                                    res.net > 0 ? "bg-emerald-500/10 text-emerald-600" : res.net < 0 ? "bg-rose-500/10 text-rose-600" : "bg-muted text-muted-foreground"
                                                )}>
                                                    {res.net > 0 ? '+' : ''}{res.net}₺
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {results.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="py-20 text-center text-muted-foreground text-[10px] font-black uppercase tracking-widest opacity-30">Seçilen ay için kayıtlı sefer bulunamadı.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                <Calendar size={14} /> Geçmiş Hesaplamalar
                            </h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {savedSettlements.slice(0, 4).map(s => (
                                <Card key={s.id} className="p-4 rounded-[1.5rem] border-border shadow-sm hover:shadow-md transition-all flex items-center justify-between bg-card group">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-black uppercase text-foreground truncate max-w-[150px]">{s.title}</span>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={cn("text-[8px] font-black px-1.5 py-0.5 rounded uppercase", s.type === 'auto' ? "bg-primary/10 text-primary" : "bg-orange-500/10 text-orange-600")}>{s.type === 'auto' ? 'Otomatik' : 'Manuel'}</span>
                                            <span className="text-[9px] font-bold text-muted-foreground">₺{s.dailyFee} / GÜN</span>
                                        </div>
                                    </div>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-9 w-9 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                        onClick={() => s.id && handleDelete(s.id)}
                                    >
                                        <Trash2 size={16} />
                                    </Button>
                                </Card>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
