"use client";

import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getUsers, getAllTrips } from "@/lib/db-service";
import { UserProfile, Trip } from "@/types";
import { ArrowLeft, Save, Calculator, Trash2, Plus, Receipt, RefreshCcw, Calendar, Check, AlertCircle } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, deleteDoc, doc, where } from "firebase/firestore";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface SettlementRecord {
    id?: string;
    type: 'manual' | 'auto';
    title: string;
    date: any;
    dailyFee: number;
    totalDays: number;
    results: {
        userId: string;
        userName: string;
        driverDays: number;
        passengerDays: number;
        debt: number;
        credit: number;
        net: number;
    }[];
}

export default function SettlementPage() {
    const { profile } = useAuth();
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

    // Auto State
    const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
    const [autoTrips, setAutoTrips] = useState<Trip[]>([]);
    const [accruedStats, setAccruedStats] = useState<any[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const fetchedUsers = await getUsers();
                setUsers(fetchedUsers);

                // Fetch saved settlements
                const q = query(collection(db, "settlements"), orderBy("date", "desc"));
                const querySnapshot = await getDocs(q);
                // Fallback for old collection if needed, but we'll use 'settlements' now. 
                // Checks 'manual_settlements' too if migration needed, but for now lets start fresh or read 'settlements'
                // If migration is needed, I can read both. Let's assume user wants new start or I can dual read.
                // For simplicity/robustness, let's read the old ones from manual_settlements too if we want to show them?
                // The user said "simdiki gibi manual" so they probably want to keep history.
                // Let's read from 'manual_settlements' and map them to new type 'manual' for display legacy.

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
        fetchData();
    }, []);

    // Fetch trips when month changes in Auto Mode
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

    // Calculate Auto Results whenever trips or fee changes
    useEffect(() => {
        if (activeTab === 'auto' && users.length > 0) {
            const stats = users.map(user => {
                let driverDays = 0;
                let passengerDays = 0;
                let credit = 0;
                let debt = 0;

                autoTrips.forEach(trip => {
                    // Logic: 
                    // If user is driver: 
                    //    Driver Credit = (Number of passengers) * Daily Fee
                    //    driverDays++
                    // If user is in participants:
                    //    Passenger Debt = Daily Fee
                    //    passengerDays++

                    if (trip.driverUid === user.uid) {
                        driverDays++;
                        // Count valid participants (excluding self if bug exists, though participants array usually doesn't include driver)
                        const passengerCount = trip.participants ? trip.participants.length : 0;
                        credit += passengerCount * dailyFee;
                    } else if (trip.participants && trip.participants.includes(user.uid)) {
                        passengerDays++;
                        debt += dailyFee; // Pay the driver
                    }
                });

                return {
                    userId: user.uid,
                    userName: user.name,
                    driverDays,
                    passengerDays,
                    debt,
                    credit,
                    net: credit - debt
                };
            });
            setAccruedStats(stats);
        }
    }, [autoTrips, dailyFee, users, activeTab]);


    const calculateManualResults = () => {
        return users.map(user => {
            const driverDays = driverDaysMap[user.uid] || 0;
            const passengerDays = manualTotalDays - driverDays;

            // Simplified manual formula
            const passengerDebt = passengerDays * dailyFee;
            // Driver credit: Assumes ALL other users were passengers every day - this is the simple manual approximation
            const driverCredit = driverDays * (users.length - 1) * dailyFee;

            return {
                userId: user.uid,
                userName: user.name,
                driverDays,
                passengerDays,
                debt: passengerDebt,
                credit: driverCredit,
                net: driverCredit - passengerDebt
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
                totalDays: isAuto ? autoTrips.length : manualTotalDays, // For auto, total trips in month
                results: isAuto ? accruedStats : calculateManualResults()
            };

            const docRef = await addDoc(collection(db, "settlements"), settlementData);

            // UI Update
            setSavedSettlements([{ id: docRef.id, ...settlementData, date: new Date() }, ...savedSettlements]);
            toast.success("Hesaplama başarıyla kaydedildi.");
        } catch (error) {
            console.error("Error saving settlement:", error);
            toast.error("Kaydedilirken bir hata oluştu.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string, type: string) => {
        if (!confirm("Bu hesaplamayı silmek istediğinize emin misiniz?")) return;
        try {
            // Check based on known ID origin or just try both? 
            // We can infer collection from type now.
            const colName = type === 'manual' && savedSettlements.find(s => s.id === id && s.type === 'manual' && !s.date.seconds /* legacy logic check if needed */)
                ? "manual_settlements"
                : "settlements";

            // Actually simpler: try delete from 'settlements', if fail try 'manual_settlements' 
            // OR strictly follow type. I mapped legacy to 'manual' but new saves are all 'settlements'.
            // For now, let's assume everything new is 'settlements'. Legacy is 'manual_settlements'.

            // HACK: I should have stored the source collection. 
            // Let's try deleting from 'settlements' first.
            await deleteDoc(doc(db, "settlements", id)).catch(err => deleteDoc(doc(db, "manual_settlements", id)));

            setSavedSettlements(savedSettlements.filter(s => s.id !== id));
            toast.success("Hesaplama silindi.");
        } catch (error) {
            toast.error("Silinirken bir hata oluştu.");
        }
    };

    // Render Logic
    const results = activeTab === 'auto' ? accruedStats : calculateManualResults();
    const manualTotalEntered = Object.values(driverDaysMap).reduce((a, b) => a + b, 0);
    const isManualValid = manualTotalEntered === manualTotalDays;

    // Auto stats
    const totalAutoTrips = autoTrips.length;
    const uniqueDrivers = new Set(autoTrips.map(t => t.driverUid)).size;

    return (
        <AppLayout>
            <div className="space-y-6 max-w-5xl mx-auto">
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Link href="/">
                            <Button variant="ghost" size="icon" className="rounded-full">
                                <ArrowLeft size={20} />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Hesap Makinesi</h1>
                            <p className="text-gray-500 text-sm">Yolculuk masraflarını otomatik veya manuel hesaplayın.</p>
                        </div>
                    </div>

                    {/* Common Action Bar */}
                    <div className="flex items-center gap-2">
                        <div className="flex bg-gray-100 p-1 rounded-xl">
                            <button
                                onClick={() => setActiveTab('auto')}
                                className={cn("px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2", activeTab === 'auto' ? "bg-white text-[#143A5A] shadow-sm" : "text-gray-500 hover:text-gray-900")}
                            >
                                <RefreshCcw size={14} /> Otomatik
                            </button>
                            <button
                                onClick={() => setActiveTab('manual')}
                                className={cn("px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2", activeTab === 'manual' ? "bg-white text-[#143A5A] shadow-sm" : "text-gray-500 hover:text-gray-900")}
                            >
                                <Calculator size={14} /> Manuel
                            </button>
                        </div>
                        <Button
                            onClick={handleSave}
                            disabled={isSaving || (activeTab === 'manual' && !isManualValid)}
                            className={cn(
                                "rounded-xl flex items-center gap-2",
                                (activeTab === 'auto' || isManualValid)
                                    ? "bg-[#143A5A] hover:bg-[#1F5E8C] text-white"
                                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                            )}
                        >
                            {isSaving ? "Kaydediliyor..." : <><Save size={18} /> Kaydet</>}
                        </Button>
                    </div>
                </header>

                <div className="grid md:grid-cols-12 gap-6">
                    {/* LEFT PANEL: CONFIGURATION */}
                    <div className="md:col-span-4 space-y-6">
                        <Card className="border-none shadow-sm">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-bold uppercase text-gray-400">Ayarlar</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-gray-500">Günlük Kişi Başı Ücret (₺)</Label>
                                    <div className="relative">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₺</div>
                                        <Input
                                            type="number"
                                            value={dailyFee}
                                            onChange={e => setDailyFee(Number(e.target.value))}
                                            className="pl-8 bg-gray-50 border-gray-100 font-bold text-gray-900"
                                        />
                                    </div>
                                </div>

                                {activeTab === 'auto' ? (
                                    // AUTO CONFIG
                                    <div className="space-y-4 pt-2 border-t border-gray-100">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-gray-500">Dönem Seçimi</Label>
                                            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                                <SelectTrigger className="w-full bg-blue-50/50 border-blue-100 text-blue-900 font-bold">
                                                    <Calendar size={16} className="mr-2 text-blue-500" />
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {Array.from({ length: 12 }).map((_, i) => {
                                                        const d = new Date();
                                                        d.setMonth(d.getMonth() - i);
                                                        const val = format(d, "yyyy-MM");
                                                        const label = format(d, "MMMM yyyy", { locale: tr });
                                                        return <SelectItem key={val} value={val}>{label}</SelectItem>
                                                    })}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="bg-blue-50 rounded-xl p-4 space-y-2">
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-blue-700/60 font-bold">Bulunan Kayıt</span>
                                                <span className="font-black text-blue-900">{totalAutoTrips} Sefer</span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-blue-700/60 font-bold">Aktif Sürücü</span>
                                                <span className="font-black text-blue-900">{uniqueDrivers} Kişi</span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm pt-2 border-t border-blue-100">
                                                <span className="text-blue-700/60 font-bold">Tahmini Mesafe</span>
                                                <span className="font-black text-blue-900">{(totalAutoTrips * 52).toLocaleString()} km</span>
                                            </div>
                                            <p className="text-[9px] text-blue-400 text-right font-medium">*Günlük gidiş-dönüş ort. 52km baz alınmıştır.</p>
                                        </div>
                                    </div>
                                ) : (
                                    // MANUAL CONFIG
                                    <div className="space-y-4 pt-2 border-t border-gray-100">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-gray-500">Hesap Başlığı</Label>
                                            <Input
                                                value={manualTitle}
                                                onChange={(e) => setManualTitle(e.target.value)}
                                                placeholder="Örn: Ocak 2024"
                                                className="bg-gray-50 border-gray-100"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-gray-500">Toplam İş Günü</Label>
                                            <Input
                                                type="number"
                                                value={manualTotalDays}
                                                onChange={(e) => setManualTotalDays(Number(e.target.value))}
                                                className="bg-gray-50 border-gray-100"
                                            />
                                        </div>
                                        {/* Error Alert for Manual */}
                                        {!isManualValid && (
                                            <div className="bg-red-50 border border-red-100 p-3 rounded-xl flex items-start gap-3">
                                                <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                                                <p className="text-xs text-red-600 font-bold leading-tight">
                                                    Gün sayıları tutmuyor!<br />
                                                    <span className="opacity-70">Hedef: {manualTotalDays}, Girilen: {manualTotalEntered}</span>
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Manual Active Driver Inputs */}
                        {activeTab === 'manual' && (
                            <Card className="border-none shadow-sm">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-bold uppercase text-gray-400">Sürücü Günleri</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                    {users.map(user => (
                                        <div key={user.uid} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-600">
                                                    {user.name.charAt(0)}
                                                </div>
                                                <span className="text-xs font-bold text-gray-700">{user.name}</span>
                                            </div>
                                            <Input
                                                type="number"
                                                min={0}
                                                max={manualTotalDays}
                                                value={driverDaysMap[user.uid] || 0}
                                                onChange={(e) => setDriverDaysMap({ ...driverDaysMap, [user.uid]: parseInt(e.target.value) || 0 })}
                                                className="w-16 h-8 text-center text-xs font-bold bg-white border-gray-200"
                                            />
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* RIGHT PANEL: RESULTS */}
                    <div className="md:col-span-8 space-y-6">
                        <Card className="border-none shadow-lg overflow-hidden h-full">
                            <CardHeader className={cn("border-b py-4", activeTab === 'auto' ? "bg-blue-50/30 border-blue-100" : "bg-gray-50 border-gray-100")}>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base font-bold text-[#143A5A] flex items-center gap-2">
                                        <Receipt size={18} />
                                        {activeTab === 'auto' ? 'Otomatik Hesap Özeti' : 'Manuel Hesap Özeti'}
                                    </CardTitle>
                                    <div className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                                        {format(new Date(), "dd.MM.yyyy")}
                                    </div>
                                </div>
                            </CardHeader>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b text-[10px] uppercase text-gray-400 bg-white">
                                            <th className="px-4 py-3 text-left font-bold">Kişi</th>
                                            <th className="px-4 py-3 text-center font-bold">Rol (Sü/Yo)</th>
                                            <th className="px-4 py-3 text-right font-bold text-red-400">Borç</th>
                                            <th className="px-4 py-3 text-right font-bold text-green-500">Alacak</th>
                                            <th className="px-4 py-3 text-right font-bold text-gray-700">NET</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 bg-white">
                                        {results.map((res) => (
                                            <tr key={res.userId} className="hover:bg-gray-50/50 transition-colors group">
                                                <td className="px-4 py-3 font-bold text-gray-700 flex items-center gap-2">
                                                    <div className={cn("w-2 h-2 rounded-full", res.net > 0 ? "bg-green-500" : res.net < 0 ? "bg-red-500" : "bg-gray-300")} />
                                                    {res.userName}
                                                </td>
                                                <td className="px-4 py-3 text-center text-xs font-medium text-gray-500">
                                                    <span className="text-gray-900 font-bold">{res.driverDays}</span> / {res.passengerDays} Gün
                                                </td>
                                                <td className="px-4 py-3 text-right font-bold text-red-500/80">
                                                    ₺{res.debt.toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3 text-right font-bold text-green-600/80">
                                                    ₺{res.credit.toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <span className={cn(
                                                        "px-3 py-1.5 rounded-lg font-black text-xs shadow-sm inline-block min-w-[80px]",
                                                        res.net > 0 ? "bg-green-100 text-green-700" : res.net < 0 ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"
                                                    )}>
                                                        {res.net > 0 ? `+₺${res.net.toLocaleString()}` : `₺${res.net.toLocaleString()}`}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                        {results.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="text-center py-12 text-gray-400 text-xs">
                                                    Hesaplanacak veri bulunamadı.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </div>
                </div>

                {/* SAVED LIST */}
                <div className="mt-8 space-y-4">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Save size={20} className="text-[#143A5A]" />
                        Kayıtlı Hesaplar
                    </h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <AnimatePresence>
                            {savedSettlements.map((s) => (
                                <motion.div
                                    key={s.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                >
                                    <Card className="border-none shadow-sm hover:shadow-md transition-all group overflow-hidden">
                                        <div className="p-4 bg-white flex items-start justify-between">
                                            <div className="flex gap-3">
                                                <div className={cn("p-2 rounded-xl h-fit", s.type === 'auto' ? "bg-blue-100 text-blue-600" : "bg-orange-100 text-orange-600")}>
                                                    {s.type === 'auto' ? <RefreshCcw size={16} /> : <Calculator size={16} />}
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-sm text-gray-900 leading-tight">{s.title}</h3>
                                                    <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold">
                                                        {s.type === 'auto' ? 'Otomatik Hesap' : 'Manuel Hesap'} • {new Date(s.date?.seconds * 1000 || s.date).toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => s.id && handleDelete(s.id, s.type)}
                                                className="text-gray-300 hover:text-red-500 transition-colors p-1"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                        <div className="bg-gray-50 px-4 py-3 flex gap-2 overflow-x-auto no-scrollbar">
                                            {s.results.slice(0, 3).map((r, i) => (
                                                <div key={i} className="flex flex-col min-w-[60px]">
                                                    <span className="text-[9px] font-bold text-gray-400 truncate">{r.userName.split(' ')[0]}</span>
                                                    <span className={cn("text-[10px] font-black", r.net >= 0 ? "text-green-600" : "text-red-500")}>
                                                        {r.net > 0 ? '+' : ''}{r.net}
                                                    </span>
                                                </div>
                                            ))}
                                            {s.results.length > 3 && (
                                                <div className="flex items-center text-[10px] font-bold text-gray-400 pl-2">+{s.results.length - 3}</div>
                                            )}
                                        </div>
                                    </Card>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}


