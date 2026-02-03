"use client";

import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getUsers, getAllTrips, getAppSettings, getApprovedUsers } from "@/lib/db-service";
import { UserProfile, Trip } from "@/types";
import { ArrowLeft, Save, Calculator, Trash2, Plus, Receipt, RefreshCcw, Calendar, Check, AlertCircle, Loader2 as LoaderIcon, ArrowRight } from "lucide-react";
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
        grossCredit: number;
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
                const [fetchedUsers, appSettings] = await Promise.all([
                    getApprovedUsers(),
                    getAppSettings()
                ]);
                setUsers(fetchedUsers);
                setDailyFee(appSettings.dailyFee);

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
                let grossCredit = 0;
                let credit = 0;
                let debt = 0;

                autoTrips.forEach(trip => {
                    if (trip.driverUid === user.uid) {
                        driverDays++;
                        const passengerCount = trip.participants ? trip.participants.length : 0;
                        // Ne alacak: Kendisi hariç diğer yolcular
                        const otherPassengerCount = trip.participants
                            ? trip.participants.filter(pid => pid !== user.uid).length
                            : 0;

                        grossCredit += passengerCount * dailyFee;
                        credit += otherPassengerCount * dailyFee;
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
                    grossCredit,
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
            // Brüt hakediş: Kendisi dahil herkes öder gibi hesaplanır
            const grossCredit = driverDays * users.length * dailyFee;
            // Gerçek alacak (Ne alacak): Sadece diğerlerinden gelen para
            const netCredit = driverDays * (users.length - 1) * dailyFee;

            return {
                userId: user.uid,
                userName: user.name,
                driverDays,
                passengerDays,
                debt: passengerDebt,
                grossCredit,
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

        // Check if already exists to prevent duplicates
        const alreadyExists = savedSettlements.some(s =>
            s.title === title ||
            (isAuto && s.type === 'auto' && format(new Date(s.date?.seconds * 1000 || s.date), "yyyy-MM") === selectedMonth)
        );

        if (alreadyExists) {
            toast.error("Bu dönem için zaten kaydedilmiş bir hesaplama bulunuyor.");
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
                            <h1 className="text-2xl font-bold tracking-tight text-foreground">Hesap Makinesi</h1>
                            <p className="text-muted-foreground text-sm">Yolculuk masraflarını otomatik veya manuel hesaplayın.</p>
                        </div>
                    </div>

                    {/* Common Action Bar */}
                    <div className="flex items-center gap-2">
                        <div className="flex bg-muted p-1 rounded-xl">
                            <button
                                onClick={() => setActiveTab('auto')}
                                className={cn("px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2", activeTab === 'auto' ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}
                            >
                                <RefreshCcw size={14} /> Otomatik
                            </button>
                            <button
                                onClick={() => setActiveTab('manual')}
                                className={cn("px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2", activeTab === 'manual' ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}
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
                                    ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                                    : "bg-muted text-muted-foreground cursor-not-allowed"
                            )}
                        >
                            {isSaving ? "Kaydediliyor..." : <><Save size={18} /> Kaydet</>}
                        </Button>
                    </div>
                </header>

                <div className="grid md:grid-cols-12 gap-6">
                    {/* LEFT PANEL: CONFIGURATION */}
                    <div className="md:col-span-4 space-y-6">
                        <Card className="border-border shadow-sm bg-card">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-bold uppercase text-muted-foreground">Ayarlar</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-muted-foreground">Günlük Kişi Başı Ücret (₺)</Label>
                                    <div className="relative">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">₺</div>
                                        <Input
                                            type="number"
                                            value={dailyFee}
                                            onChange={e => setDailyFee(Number(e.target.value))}
                                            className="pl-8 bg-muted border-border font-bold text-foreground"
                                        />
                                    </div>
                                </div>

                                {activeTab === 'auto' ? (
                                    // AUTO CONFIG
                                    <div className="space-y-4 pt-2 border-t border-border">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-muted-foreground">Dönem Seçimi</Label>
                                            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                                <SelectTrigger className="w-full bg-primary/10 border-primary/20 text-primary font-bold">
                                                    <Calendar size={16} className="mr-2 text-primary" />
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

                                        <div className="bg-primary/5 rounded-xl p-4 space-y-2 border border-primary/10 text-foreground">
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-muted-foreground font-bold">Bulunan Kayıt</span>
                                                <span className="font-black text-primary">{totalAutoTrips} Sefer</span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-muted-foreground font-bold">Aktif Sürücü</span>
                                                <span className="font-black text-primary">{uniqueDrivers} Kişi</span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm pt-2 border-t border-primary/10">
                                                <span className="text-muted-foreground font-bold">Tahmini Mesafe</span>
                                                <span className="font-black text-primary">{(totalAutoTrips * 52).toLocaleString()} km</span>
                                            </div>
                                            <p className="text-[9px] text-primary/60 text-right font-medium">*Günlük gidiş-dönüş ort. 52km baz alınmıştır.</p>
                                        </div>
                                    </div>
                                ) : (
                                    // MANUAL CONFIG
                                    <div className="space-y-4 pt-2 border-t border-border">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-muted-foreground">Hesap Başlığı</Label>
                                            <Input
                                                value={manualTitle}
                                                onChange={(e) => setManualTitle(e.target.value)}
                                                placeholder="Örn: Ocak 2024"
                                                className="bg-muted border-border text-foreground"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-muted-foreground">Toplam İş Günü</Label>
                                            <Input
                                                type="number"
                                                value={manualTotalDays}
                                                onChange={(e) => setManualTotalDays(Number(e.target.value))}
                                                className="bg-muted border-border text-foreground"
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
                            <Card className="border-border shadow-sm bg-card">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-bold uppercase text-muted-foreground">Sürücü Günleri</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                    {users.map(user => (
                                        <div key={user.uid} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted transition-colors">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                                                    {user.name.charAt(0)}
                                                </div>
                                                <span className="text-xs font-bold text-foreground">{user.name}</span>
                                            </div>
                                            <Input
                                                type="number"
                                                min={0}
                                                max={manualTotalDays}
                                                value={driverDaysMap[user.uid] || 0}
                                                onChange={(e) => setDriverDaysMap({ ...driverDaysMap, [user.uid]: parseInt(e.target.value) || 0 })}
                                                className="w-16 h-8 text-center text-xs font-bold bg-card border-border text-foreground"
                                            />
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* RIGHT PANEL: RESULTS */}
                    <div className="md:col-span-8 space-y-6">
                        <Card className="border-border shadow-lg overflow-hidden h-full bg-card">
                            <CardHeader className={cn("border-b py-4", activeTab === 'auto' ? "bg-primary/5 border-primary/10" : "bg-muted border-border")}>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                                        <Receipt size={18} />
                                        {activeTab === 'auto' ? 'Otomatik Hesap Özeti' : 'Manuel Hesap Özeti'}
                                    </CardTitle>
                                    <div className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">
                                        {format(new Date(), "dd.MM.yyyy")}
                                    </div>
                                </div>
                            </CardHeader>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b text-[10px] uppercase text-muted-foreground bg-card">
                                            <th className="px-4 py-3 text-left font-bold">Kişi</th>
                                            <th className="px-4 py-3 text-center font-bold">Rol (Sü/Yo)</th>
                                            <th className="px-4 py-3 text-right font-bold text-red-400">Borç</th>
                                            <th className="px-4 py-3 text-right font-bold text-amber-500">Hakediş</th>
                                            <th className="px-4 py-3 text-right font-bold text-green-500">Alacak</th>
                                            <th className="px-4 py-3 text-right font-bold text-foreground">NET</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border bg-card">
                                        {results.map((res) => (
                                            <tr key={res.userId} className="hover:bg-muted/50 transition-colors group">
                                                <td className="px-4 py-3 font-bold text-foreground flex items-center gap-2">
                                                    <div className={cn("w-2 h-2 rounded-full", res.net > 0 ? "bg-green-500" : res.net < 0 ? "bg-red-500" : "bg-muted-foreground/30")} />
                                                    {res.userName}
                                                </td>
                                                <td className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">
                                                    <span className="text-foreground font-bold">{res.driverDays}</span> / {res.passengerDays} Gün
                                                </td>
                                                <td className="px-4 py-3 text-right font-bold text-red-500/80">
                                                    ₺{res.debt.toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3 text-right font-bold text-amber-600/80">
                                                    ₺{(res.grossCredit || 0).toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3 text-right font-bold text-green-600/80">
                                                    ₺{res.credit.toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <span className={cn(
                                                        "px-3 py-1.5 rounded-lg font-black text-xs shadow-sm inline-block min-w-[80px]",
                                                        res.net > 0 ? "bg-green-500/10 text-green-500 dark:bg-green-500/20" : res.net < 0 ? "bg-red-500/10 text-red-500 dark:bg-red-500/20" : "bg-muted text-muted-foreground"
                                                    )}>
                                                        {res.net > 0 ? `+₺${res.net.toLocaleString()}` : `₺${res.net.toLocaleString()}`}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                        {results.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="text-center py-12 text-muted-foreground text-xs">
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
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <Save size={20} className="text-[#143A5A]" />
                            Hesap Geçmişi & Taslaklar
                        </h2>
                        <div className="text-[10px] font-bold text-gray-400 uppercase bg-gray-100 px-2 py-1 rounded-md">
                            {savedSettlements.length} Kayıtlı
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <AnimatePresence mode="popLayout">
                            {/* LIVE DRAFT CARD - Sharp check for duplicates */}
                            {(() => {
                                const currentTitle = activeTab === 'auto'
                                    ? `${format(parseISO(selectedMonth + "-01"), "MMMM yyyy", { locale: tr })} Otomatik Hesap`
                                    : manualTitle;

                                const isAlreadySaved = savedSettlements.some(s =>
                                    s.title === currentTitle ||
                                    (s.type === 'auto' && activeTab === 'auto' && format(new Date(s.date?.seconds * 1000 || s.date), "yyyy-MM") === selectedMonth)
                                );

                                if (isAlreadySaved) return null;

                                return (
                                    <motion.div
                                        key="live-draft"
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="relative group h-full"
                                    >
                                        <div className="absolute -top-2 -right-2 z-10">
                                            <span className="bg-primary text-primary-foreground text-[9px] font-black px-2 py-1 rounded-full shadow-lg border-2 border-card uppercase tracking-tighter">
                                                CANLI TASLAK
                                            </span>
                                        </div>
                                        <Card className="border-2 border-dashed border-primary/20 bg-primary/5 shadow-none hover:border-primary/40 transition-all overflow-hidden flex flex-col h-full">
                                            <div className="p-4 flex items-start justify-between flex-1">
                                                <div className="flex gap-3">
                                                    <div className="p-2 rounded-xl bg-primary text-primary-foreground shadow-sm h-fit anim-pulse">
                                                        {activeTab === 'auto' ? <RefreshCcw size={16} /> : <Calculator size={16} />}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-black text-sm text-foreground leading-tight">
                                                            {activeTab === 'auto' ? `${format(parseISO(selectedMonth + "-01"), "MMMM yyyy", { locale: tr })}` : manualTitle}
                                                        </h3>
                                                        <p className="text-[10px] text-primary/60 mt-1 uppercase font-bold">
                                                            {activeTab === 'auto' ? 'Otomatik' : 'Manuel'} • Henüz Kaydedilmedi
                                                        </p>
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={handleSave}
                                                    disabled={isSaving || (activeTab === 'manual' && !isManualValid)}
                                                    className="border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground rounded-xl h-8 px-3 font-bold text-[10px] bg-card"
                                                >
                                                    {isSaving ? <LoaderIcon className="animate-spin" size={14} /> : <><Save size={14} className="mr-1" /> KAYDET</>}
                                                </Button>
                                            </div>
                                            <div className="bg-primary/5 px-4 py-3 border-t border-primary/10 flex gap-2 overflow-x-auto no-scrollbar">
                                                {results.slice(0, 3).map((r, i) => (
                                                    <div key={i} className="flex flex-col min-w-[60px]">
                                                        <span className="text-[9px] font-bold text-primary/60 truncate uppercase">{r.userName.split(' ')[0]}</span>
                                                        <span className={cn("text-[11px] font-black", r.net >= 0 ? "text-green-500" : "text-red-500")}>
                                                            {r.net > 0 ? '+' : ''}{r.net}₺
                                                        </span>
                                                    </div>
                                                ))}
                                                <div className="ml-auto">
                                                    <ArrowRight size={14} className="text-primary/30" />
                                                </div>
                                            </div>
                                        </Card>
                                    </motion.div>
                                );
                            })()}

                            {/* SAVED CARDS */}
                            {savedSettlements.map((s) => (
                                <motion.div
                                    key={s.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                >
                                    <Card className="border-border shadow-sm hover:shadow-md transition-all group overflow-hidden bg-card flex flex-col h-full">
                                        <div className="p-4 bg-card flex items-start justify-between flex-1">
                                            <div className="flex gap-3">
                                                <div className={cn("p-2 rounded-xl h-fit shadow-sm", s.type === 'auto' ? "bg-primary/10 text-primary" : "bg-amber-500/10 text-amber-500")}>
                                                    {s.type === 'auto' ? <RefreshCcw size={16} /> : <Calculator size={16} />}
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-sm text-foreground leading-tight">{s.title}</h3>
                                                    <p className="text-[10px] text-muted-foreground mt-1 uppercase font-bold">
                                                        {s.type === 'auto' ? 'Otomatik' : 'Manuel'} • {new Date(s.date?.seconds * 1000 || s.date).toLocaleDateString('tr-TR')}
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
                                        <div className="bg-muted/50 px-4 py-3 border-t border-border flex gap-2 overflow-x-auto no-scrollbar">
                                            {s.results.slice(0, 3).map((r, i) => (
                                                <div key={i} className="flex flex-col min-w-[60px]">
                                                    <span className="text-[9px] font-bold text-muted-foreground truncate uppercase">{r.userName.split(' ')[0]}</span>
                                                    <span className={cn("text-[10px] font-black", r.net >= 0 ? "text-green-500" : "text-red-500")}>
                                                        {r.net > 0 ? '+' : ''}{r.net}₺
                                                    </span>
                                                </div>
                                            ))}
                                            {s.results.length > 3 && (
                                                <div className="flex items-center text-[10px] font-bold text-muted-foreground pl-2">+{s.results.length - 3}</div>
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


