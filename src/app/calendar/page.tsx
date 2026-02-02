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
import { getUsers, saveTrip, getAllTrips } from "@/lib/db-service";
import { doc, getDoc } from "firebase/firestore";
import { UserProfile, Trip } from "@/types";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

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

    // Initial fetch for members
    useEffect(() => {
        const fetchMembers = async () => {
            try {
                const fetchedUsers = await getUsers();
                setMembers(fetchedUsers);
                const trips = await getAllTrips();
                setAllTrips(trips);
            } catch (error) {
                console.error("Error fetching data:", error);
                toast.error("Veriler yüklenirken hata oluştu.");
            }
        };
        fetchMembers();
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
                    setCurrentTrip(null);
                    setDriver("");
                    setParticipants([]);
                    setTripType('full'); // Reset to default if no trip exists
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
                        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Yolculuk Takvimi</h1>
                        <p className="text-gray-500">Günlük katılımı ve şoförü yönetin.</p>
                    </div>
                </header>

                <div className="flex flex-col md:flex-row gap-6 items-start">
                    <Card className="border-none shadow-md bg-white p-2 w-full md:w-auto shrink-0">
                        <Calendar
                            mode="single"
                            selected={date}
                            onSelect={handleDateSelect}
                            className="rounded-md border-none flex justify-center"
                            locale={tr}
                        />
                    </Card>

                    <section className="space-y-3 flex-1 w-full">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest pl-1">Seçili Gün Özeti</h3>
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={date?.toString()}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                            >
                                <Card className="border-none shadow-sm overflow-hidden h-full">
                                    <CardHeader className="bg-gray-50 flex flex-row items-center justify-between space-y-0 py-3">
                                        <span className="text-sm font-semibold">{date ? format(date, "d MMMM yyyy, EEEE", { locale: tr }) : "Gün seçiniz"}</span>
                                        <CalendarIcon size={16} className="text-[#143A5A]" />
                                    </CardHeader>
                                    <CardContent className="pt-4">
                                        {loading ? (
                                            <div className="flex justify-center py-6">
                                                <Loader2 className="h-6 w-6 animate-spin text-[#143A5A]" />
                                            </div>
                                        ) : currentTrip ? (
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-[#143A5A]">
                                                        <Car size={20} />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500 uppercase font-bold tracking-tighter">Şoför</p>
                                                        <p className="font-semibold text-gray-900">
                                                            {members.find(m => m.uid === currentTrip.driverUid)?.name || "Bilinmiyor"}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                                                        <Users size={20} />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500 uppercase font-bold tracking-tighter">Katılımcılar</p>
                                                        <p className="text-sm text-gray-700">
                                                            {currentTrip.participants.length > 0
                                                                ? currentTrip.participants.map(p => members.find(m => m.uid === p)?.name).filter(Boolean).join(", ")
                                                                : "Kimse katılmadı"}
                                                        </p>
                                                    </div>
                                                </div>
                                                {profile?.role === 'admin' && (
                                                    <Button
                                                        onClick={() => setIsDialogOpen(true)}
                                                        variant="outline"
                                                        className="w-full mt-2"
                                                    >
                                                        Düzenle
                                                    </Button>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="text-center py-6">
                                                <div className="flex justify-center mb-2 text-gray-300">
                                                    <Info size={40} />
                                                </div>
                                                <p className="text-gray-500 text-sm">Bu gün için henüz kayıt girilmemiş.</p>
                                                {profile?.role === 'admin' && (
                                                    <Button
                                                        onClick={() => setIsDialogOpen(true)}
                                                        className="mt-4 bg-[#143A5A]"
                                                    >
                                                        Kayıt Ekle
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </motion.div>
                        </AnimatePresence>
                    </section>
                </div>

                {/* Monthly Trip List (Moved from Dashboard) */}
                <section className="space-y-3 pt-4 border-t border-gray-100">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest pl-1">Yolculuk Günlüğü ({date ? format(date, "MMMM", { locale: tr }) : "Seçili Ay"})</h3>
                    <div className="bg-white border border-gray-100 rounded-[2.5rem] shadow-xl shadow-blue-900/5 overflow-hidden">
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
                                            isSelected ? "bg-blue-50 border-blue-200 shadow-md ring-1 ring-blue-200" :
                                                isToday ? "bg-green-50 border-green-200" : "bg-gray-50/30 border-gray-100 hover:border-blue-100/50"
                                        )}
                                    >
                                        {/* Date Part */}
                                        <div className="flex items-center gap-3 min-w-[140px]">
                                            <div className={cn(
                                                "w-12 h-12 rounded-2xl flex flex-col items-center justify-center font-black",
                                                isSelected ? "bg-blue-600 text-white" : isToday ? "bg-green-600 text-white" : "bg-white text-gray-500 shadow-sm"
                                            )}>
                                                <span className="text-[10px] uppercase opacity-60 leading-none mb-0.5">{format(day, "EEE", { locale: tr })}</span>
                                                <span className="text-base leading-none">{format(day, "d")}</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">{format(day, "MMMM", { locale: tr })}</span>
                                                <span className="text-xs font-black text-[#1E293B] leading-none">{isToday ? "BUGÜN" : format(day, "EEEE", { locale: tr })}</span>
                                            </div>
                                        </div>

                                        {/* Trip Data Part */}
                                        <div className="flex-1 flex flex-col md:flex-row md:items-center gap-4">
                                            {trip ? (
                                                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {/* Driver & Participants */}
                                                    <div className="flex items-center gap-3">
                                                        <div className="bg-amber-100 p-2 rounded-xl text-amber-600"><Car size={16} /></div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[9px] font-black text-amber-700/50 uppercase tracking-widest">SÜRÜCÜ</span>
                                                            <span className="text-xs font-black text-amber-900 tracking-tight leading-none">{tripDriver?.name || "Bilinmiyor"}</span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-3">
                                                        <div className="bg-blue-100 p-2 rounded-xl text-blue-600"><Users size={16} /></div>
                                                        <div className="flex flex-col overflow-hidden">
                                                            <span className="text-[9px] font-black text-blue-700/50 uppercase tracking-widest">KATILIMCILAR</span>
                                                            <span className="text-xs font-bold text-blue-900 truncate tracking-tight leading-none">
                                                                {tripParticipants.map(p => p.name).join(", ")}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex-1 flex items-center gap-2 opacity-30 italic">
                                                    <div className="h-1 w-1 rounded-full bg-gray-400" />
                                                    <span className="text-xs font-bold text-gray-400">Yolculuk kaydı yok.</span>
                                                </div>
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
                                    <label className="text-sm font-bold text-gray-600 uppercase">Yolculuk Tipi</label>
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
                                    <label className="text-sm font-bold text-gray-600 uppercase">Günün Şoförü</label>
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
                                <label className="text-sm font-bold text-gray-600 uppercase">Katılan Üyeler</label>
                                <div className="grid grid-cols-1 gap-2 border rounded-lg p-3 bg-gray-50 max-h-48 overflow-y-auto">
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

                            <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-blue-600 font-bold uppercase">Tahmini Kazanç (Şoför)</p>
                                    <p className="text-lg font-bold text-[#143A5A]">₺{participants.length * dailyFee}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-blue-600 font-bold uppercase">Kişi Başı</p>
                                    <p className="text-lg font-bold text-[#143A5A]">₺{dailyFee}</p>
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
