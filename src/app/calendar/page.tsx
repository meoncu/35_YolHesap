"use client";

import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/context/AuthContext";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Car, Users, Calendar as CalendarIcon, Info, Save, Loader2, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { tr } from "date-fns/locale";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { Trip, UserProfile } from "@/types";
import { getApprovedUsers, getAllTrips, saveTrip, getAppSettings } from "@/lib/db-service";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SeatingPlan } from "@/components/dashboard/SeatingPlan";

export default function CalendarPage() {
    const { profile } = useAuth();
    const [date, setDate] = useState<Date | undefined>(new Date());
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saveLoading, setSaveLoading] = useState(false);
    const [members, setMembers] = useState<UserProfile[]>([]);
    const [currentTrip, setCurrentTrip] = useState<Trip | null>(null);
    const [allTrips, setAllTrips] = useState<Trip[]>([]);

    // Form states
    const [driver, setDriver] = useState<string>("");
    const [participants, setParticipants] = useState<string[]>([]);
    const [dailyFee, setDailyFee] = useState(100);
    const [tripType, setTripType] = useState<'morning' | 'evening' | 'full'>('full');

    // Initial fetch for members and settings
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [fetchedUsers, trips, settings] = await Promise.all([
                    getApprovedUsers(),
                    getAllTrips(),
                    getAppSettings()
                ]);
                setMembers(fetchedUsers);
                setAllTrips(trips);
                setDailyFee(settings.dailyFee);
            } catch (error) {
                console.error("Error fetching data:", error);
                toast.error("Veriler yüklenirken hata oluştu.");
            }
        };
        fetchData();
    }, []);

    // Fetch trip data when date changes
    useEffect(() => {
        const fetchTripData = async () => {
            if (!date) return;
            setLoading(true);
            try {
                const dateStr = format(date, "yyyy-MM-dd");
                const tripRef = doc(db, "trips", `${dateStr}_main-group`); // Assuming 'main-group' as default
                const tripDoc = await getDoc(tripRef);

                if (tripDoc.exists()) {
                    const data = tripDoc.data() as Trip;
                    setCurrentTrip(data);
                    setDriver(data.driverUid || "");
                    setParticipants(data.participants || []);
                    setTripType(data.type || 'full'); // Set tripType from fetched data
                } else {
                    // Inherit from the most recent past trip
                    const pastTrips = [...allTrips]
                        .filter(t => t.date < dateStr)
                        .sort((a, b) => b.date.localeCompare(a.date));

                    if (pastTrips.length > 0) {
                        const lastTrip = pastTrips[0];
                        setDriver(lastTrip.driverUid || "");
                        setParticipants(lastTrip.participants || []);
                        setTripType(lastTrip.type || 'full');
                    } else {
                        setDriver("");
                        setParticipants([]);
                        setTripType('full');
                    }
                    setCurrentTrip(null);
                }
            } catch (error) {
                console.error("Error fetching trip:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchTripData();
    }, [date]);

    const handleDateSelect = (newDate: Date | undefined) => {
        setDate(newDate);
    };

    const toggleParticipant = (uid: string) => {
        setParticipants(prev =>
            prev.includes(uid)
                ? prev.filter(id => id !== uid)
                : [...prev, uid]
        );
    };

    const handleSaveTrip = async () => {
        if (!date || !driver) {
            toast.error("Lütfen bir şoför seçin.");
            return;
        }

        setSaveLoading(true);
        try {
            const dateStr = format(date, "yyyy-MM-dd");
            const tripData: Trip = {
                date: dateStr,
                groupId: "main-group",
                driverUid: driver,
                participants: participants,
                totalCollected: participants.length * dailyFee,
                type: tripType
            };

            await saveTrip(tripData);
            setCurrentTrip(tripData);
            toast.success("Yolculuk kaydedildi.");
            setIsDialogOpen(false);
        } catch (error) {
            console.error("Error saving trip:", error);
            toast.error("Kaydetme sırasında bir hata oluştu.");
        } finally {
            setSaveLoading(false);
        }
    };

    return (
        <AppLayout>
            <div className="space-y-6">
                <header className="flex items-center gap-4">
                    <Link href="/">
                        <Button variant="ghost" size="icon" className="rounded-full">
                            <ArrowLeft size={20} />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">Yolculuk Takvimi</h1>
                        <p className="text-muted-foreground">Günlük katılımı ve şoförü yönetin.</p>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
                    <div className="flex flex-col gap-3">
                        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest pl-1">Takvim</h3>
                        <Card className="border-border shadow-md p-6 bg-card flex-1 flex flex-col items-center justify-center min-h-[580px] rounded-[3rem]">
                            <Calendar
                                mode="single"
                                selected={date}
                                onSelect={setDate}
                                className="scale-125 md:scale-150 origin-center"
                                locale={tr}
                            />
                        </Card>
                    </div>

                    <div className="flex flex-col gap-3">
                        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest pl-1">Seçili Gün Özeti</h3>
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={date?.toString()}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="flex-1"
                            >
                                <Card className="border-border shadow-md overflow-hidden bg-card flex-1 flex flex-col h-full min-h-[580px] rounded-[3rem]">
                                    <CardHeader className="bg-muted/50 border-b border-border flex flex-row items-center justify-between space-y-0 py-5 px-8 shrink-0">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black text-primary uppercase tracking-tighter">İNCELENEN GÜN</span>
                                            <span className="text-lg font-bold text-foreground">{date ? format(date, "d MMMM yyyy, EEEE", { locale: tr }) : "Gün seçiniz"}</span>
                                        </div>
                                        <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                                            <CalendarIcon size={24} strokeWidth={2.5} />
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-6 flex-1 flex flex-col">
                                        {loading ? (
                                            <div className="flex-1 flex flex-col items-center justify-center py-12">
                                                <Loader2 className="h-10 w-10 animate-spin text-primary opacity-50" />
                                                <p className="mt-4 text-[10px] font-black text-muted-foreground tracking-widest uppercase">Yükleniyor...</p>
                                            </div>
                                        ) : (currentTrip || driver) ? (
                                            <div className="flex-1 flex flex-col gap-6">
                                                <div className="flex-1 min-h-[280px]">
                                                    <SeatingPlan
                                                        driver={members.find(m => m.uid === (currentTrip?.driverUid || driver))}
                                                        participants={members.filter(m => (currentTrip?.participants || participants).includes(m.uid))}
                                                        className="h-full py-8 bg-muted/20 border border-border/50"
                                                    />
                                                </div>

                                                <div className="space-y-3">
                                                    <div className="flex gap-2">
                                                        {!currentTrip && (
                                                            <button
                                                                onClick={handleSaveTrip}
                                                                disabled={saveLoading}
                                                                className="flex-1 rounded-2xl bg-primary text-primary-foreground font-black uppercase text-[10px] tracking-widest h-14 hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                                                            >
                                                                {saveLoading ? <Loader2 className="animate-spin mx-auto" size={20} /> : "GÜNÜ ONAYLA"}
                                                            </button>
                                                        )}
                                                        {profile?.role === 'admin' && (
                                                            <Button
                                                                onClick={() => setIsDialogOpen(true)}
                                                                variant="outline"
                                                                className={cn("rounded-2xl border-border font-black uppercase text-[10px] tracking-widest h-14 hover:bg-muted transition-all", !currentTrip ? "w-1/3" : "w-full")}
                                                            >
                                                                DÜZENLE
                                                            </Button>
                                                        )}
                                                    </div>
                                                    {!currentTrip && (
                                                        <div className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-500/10 rounded-xl border border-amber-500/20">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                                            <p className="text-[9px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">
                                                                Önceki günden devralındı
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                                                <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center text-muted-foreground/20">
                                                    <Info size={48} />
                                                </div>
                                                <div>
                                                    <p className="text-foreground font-black text-sm uppercase tracking-tight">Kayıt Bulunamadı</p>
                                                    <p className="text-muted-foreground text-[10px] font-bold mt-1">Bu tarih için henüz bir yolculuk planlanmamış.</p>
                                                </div>
                                                {profile?.role === 'admin' && (
                                                    <Button
                                                        onClick={() => setIsDialogOpen(true)}
                                                        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-2xl h-12 px-8 text-[11px] uppercase font-black tracking-widest shadow-lg shadow-primary/20"
                                                    >
                                                        Yolculuk Ekle
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>

                {/* Monthly Trip List (Moved from Dashboard) */}
                <section className="space-y-3 pt-4 border-t border-border">
                    <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest pl-1">Yolculuk Günlüğü ({date ? format(date, "MMMM", { locale: tr }) : "Seçili Ay"})</h3>
                    <div className="bg-card border border-border rounded-[2.5rem] shadow-xl shadow-primary/5 overflow-hidden">
                        <div className="max-h-[500px] overflow-y-auto custom-scrollbar p-4 space-y-3">
                            {date && eachDayOfInterval({
                                start: startOfMonth(date),
                                end: endOfMonth(date)
                            }).map((day) => {
                                const dayStr = format(day, "yyyy-MM-dd");
                                const trip = allTrips.find(t => t.date === dayStr);
                                const tripDriver = members.find(m => m.uid === trip?.driverUid);
                                const tripParticipants = members.filter(m => trip?.participants?.includes(m.uid));
                                const isToday = isSameDay(day, new Date());
                                const isSelected = isSameDay(day, date);

                                return (
                                    <div
                                        key={dayStr}
                                        onClick={() => setDate(day)}
                                        className={cn(
                                            "flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-3xl transition-all border cursor-pointer",
                                            isSelected ? "bg-primary/10 border-primary shadow-md ring-1 ring-primary/20" :
                                                isToday ? "bg-green-500/10 border-green-500/50" : "bg-muted/50 border-border hover:border-primary/30"
                                        )}
                                    >
                                        {/* Date Part */}
                                        <div className="flex items-center gap-3 min-w-[140px]">
                                            <div className={cn(
                                                "w-12 h-12 rounded-2xl flex flex-col items-center justify-center font-black",
                                                isSelected ? "bg-primary text-primary-foreground" : isToday ? "bg-green-500 text-white" : "bg-card text-muted-foreground shadow-sm"
                                            )}>
                                                <span className="text-[10px] uppercase opacity-60 leading-none mb-0.5">{format(day, "EEE", { locale: tr })}</span>
                                                <span className="text-base leading-none">{format(day, "d")}</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">{format(day, "MMMM", { locale: tr })}</span>
                                                <span className="text-xs font-black text-foreground leading-none">{isToday ? "BUGÜN" : format(day, "EEEE", { locale: tr })}</span>
                                            </div>
                                        </div>

                                        {/* Trip Data Part */}
                                        <div className="flex-1 flex flex-col md:flex-row md:items-center gap-4">
                                            {trip ? (
                                                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {/* Driver & Participants */}
                                                    <div className="flex items-center gap-3">
                                                        <div className="bg-amber-500/10 p-2 rounded-xl text-amber-500"><Car size={16} /></div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[9px] font-black text-amber-500/50 uppercase tracking-widest">SÜRÜCÜ</span>
                                                            <span className="text-xs font-black text-amber-600 dark:text-amber-500 tracking-tight leading-none">{tripDriver?.name || "Bilinmiyor"}</span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-3">
                                                        <div className="bg-primary/10 p-2 rounded-xl text-primary"><Users size={16} /></div>
                                                        <div className="flex flex-col overflow-hidden">
                                                            <span className="text-[9px] font-black text-primary/50 uppercase tracking-widest">KATILIMCILAR</span>
                                                            <span className="text-xs font-bold text-foreground truncate tracking-tight leading-none">
                                                                {tripParticipants.map(p => p.name).join(", ")}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                (() => {
                                                    const inheritedTrip = allTrips
                                                        .filter(t => t.date < dayStr)
                                                        .sort((a, b) => b.date.localeCompare(a.date))[0];

                                                    if (inheritedTrip) {
                                                        const iDriver = members.find(m => m.uid === inheritedTrip.driverUid);
                                                        const iParticipants = members.filter(m => inheritedTrip.participants.includes(m.uid));
                                                        return (
                                                            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 opacity-50">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="bg-muted p-2 rounded-xl text-muted-foreground"><Car size={16} /></div>
                                                                    <div className="flex flex-col">
                                                                        <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                                                                            ÖNERİ <div className="w-1 h-1 rounded-full bg-amber-500 animate-pulse" />
                                                                        </span>
                                                                        <span className="text-xs font-black text-muted-foreground tracking-tight leading-none">{iDriver?.name || "Bilinmiyor"}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-3">
                                                                    <div className="bg-muted p-2 rounded-xl text-muted-foreground"><Users size={16} /></div>
                                                                    <div className="flex flex-col overflow-hidden">
                                                                        <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">KATILIMCILAR</span>
                                                                        <span className="text-xs font-bold text-muted-foreground truncate tracking-tight leading-none">
                                                                            {iParticipants.map(p => p.name).join(", ")}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    }

                                                    return (
                                                        <div className="flex-1 flex items-center gap-2 opacity-30 italic">
                                                            <div className="h-1 w-1 rounded-full bg-muted-foreground" />
                                                            <span className="text-xs font-bold text-muted-foreground">Yolculuk kaydı yok.</span>
                                                        </div>
                                                    );
                                                })()
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>

                {/* Dialog for Admin to edit trip */}
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Yolculuk Detayları</DialogTitle>
                            <DialogDescription>
                                {date ? format(date, "d MMMM yyyy", { locale: tr }) : ""} tarihi için şoför ve katılımcıları seçin.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-6 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-muted-foreground uppercase">Yolculuk Tipi</label>
                                    <Select value={tripType} onValueChange={(v: any) => setTripType(v)}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Seçiniz" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="morning">Sabah</SelectItem>
                                            <SelectItem value="evening">Akşam</SelectItem>
                                            <SelectItem value="full">Tam Gün</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-muted-foreground uppercase">Günün Şoförü</label>
                                    <Select value={driver} onValueChange={setDriver}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Şoför seçin" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {members.map(member => (
                                                <SelectItem key={member.uid} value={member.uid}>
                                                    {member.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-sm font-bold text-muted-foreground uppercase">Katılan Üyeler</label>
                                <div className="grid grid-cols-1 gap-2 border border-border rounded-lg p-3 bg-muted/50 max-h-48 overflow-y-auto">
                                    {members.map(member => (
                                        <div key={member.uid} className="flex items-center space-x-3 p-1">
                                            <Checkbox
                                                id={`member-${member.uid}`}
                                                checked={participants.includes(member.uid)}
                                                onCheckedChange={() => toggleParticipant(member.uid)}
                                            />
                                            <label
                                                htmlFor={`member-${member.uid}`}
                                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                            >
                                                {member.name}
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="p-3 bg-primary/5 border border-primary/10 rounded-lg flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-primary font-bold uppercase">Tahmini Kazanç (Şoför)</p>
                                    <p className="text-lg font-bold text-foreground">₺{participants.length * dailyFee}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-primary font-bold uppercase">Kişi Başı</p>
                                    <p className="text-lg font-bold text-foreground">₺{dailyFee}</p>
                                </div>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>İptal</Button>
                            <Button
                                className="gradient-primary flex items-center gap-2"
                                onClick={handleSaveTrip}
                                disabled={saveLoading}
                            >
                                {saveLoading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                Kaydet
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </AppLayout>
    );
}
