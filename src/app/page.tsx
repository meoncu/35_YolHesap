"use client";

import React, { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Smartphone,
  Shield,
  CheckCircle2,
  Loader2 as LoaderIcon,
  Wallet,
  Info,
  Settings,
  UserPlus,
  Check,
  Users,
  Calendar as CalendarIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  getApprovedUsers,
  getAllTrips,
  saveTrip,
  deleteTrip,
  getAppSettings,
  AppSettings,
  createManualUser
} from "@/lib/db-service";
import { UserProfile, Trip } from "@/types";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  parseISO,
  addMonths,
  subMonths,
  isToday,
  startOfWeek,
  endOfWeek
} from "date-fns";
import { tr } from "date-fns/locale";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";

// Helper for person-based colors
const getPersonColor = (uid: string) => {
  const colors = [
    "bg-blue-600", "bg-emerald-600", "bg-amber-600", "bg-rose-600",
    "bg-indigo-600", "bg-violet-600", "bg-orange-600", "bg-cyan-600",
    "bg-pink-600", "bg-lime-600", "bg-teal-600", "bg-fuchsia-600"
  ];
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = uid.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

export default function Home() {
  const { profile, user, signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [allTrips, setAllTrips] = useState<Trip[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ dailyFee: 100 });
  const [isDriverDialogOpen, setIsDriverDialogOpen] = useState(false);
  const [activeDay, setActiveDay] = useState<Date | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Manual user creation state
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // PWA Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      toast.success("Uygulama yükleniyor...");
    }
  };

  // Data fetching
  const fetchData = async () => {
    setLoading(true);
    try {
      const [users, trips, appSettings] = await Promise.all([
        getApprovedUsers(),
        getAllTrips(),
        getAppSettings()
      ]);
      setMembers(users);
      setAllTrips(trips);
      setSettings(appSettings);
    } catch (error) {
      console.error("Error fetching data:", error);
      // Don't toast if it's just a permission error for non-logged in users?
      // Firebase rules might block getAllTrips if not logged in.
      // Let's assume trips should be public for viewing.
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const isAdmin = profile?.role === 'admin';

  // Calendar logic
  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const calendarDays = eachDayOfInterval({
    start: startOfWeek(monthStart, { weekStartsOn: 1 }),
    end: endOfWeek(monthEnd, { weekStartsOn: 1 })
  });

  const monthTrips = useMemo(() => {
    const monthStr = format(selectedDate, "yyyy-MM");
    return allTrips.filter(t => t.date.startsWith(monthStr));
  }, [allTrips, selectedDate]);

  // Debt calculation logic (mini version)
  const stats = useMemo(() => {
    if (members.length === 0) return [];

    const dailyFee = settings.dailyFee;
    const results = members.map(member => {
      let driverDays = 0;
      let passengerDays = 0;
      let debt = 0;
      let credit = 0;

      monthTrips.forEach(trip => {
        const isDriver = trip.driverUid === member.uid;
        const isParticipant = trip.participants?.includes(member.uid);

        if (isDriver) {
          driverDays++;
          // Credit calculation: everyone else pays this member
          const othersCount = trip.participants.filter(pid => pid !== member.uid).length;
          credit += othersCount * dailyFee;
        } else if (isParticipant) {
          passengerDays++;
          // Debt: this member pays the driver
          debt += dailyFee;
        }
      });

      return {
        name: member.name,
        uid: member.uid,
        driverDays,
        passengerDays,
        net: credit - debt
      };
    }).filter(r => r.net !== 0 || r.driverDays > 0 || r.passengerDays > 0).sort((a, b) => b.net - a.net);

    return results;
  }, [members, monthTrips, settings.dailyFee]);

  const handleCellClick = (day: Date) => {
    if (!isAdmin) return;
    setActiveDay(day);
    setIsDriverDialogOpen(true);
  };

  const handleUpdateTripData = async (uid: string, type: 'driver' | 'participant') => {
    if (!activeDay || !isAdmin) return;
    setIsUpdating(true);
    try {
      const dateStr = format(activeDay, "yyyy-MM-dd");
      const existingTrip = allTrips.find(t => t.date === dateStr);

      if (type === 'driver' && uid === "") {
        await deleteTrip(dateStr);
        setAllTrips(prev => prev.filter(t => t.date !== dateStr));
        toast.success("Gün temizlendi.");
        return;
      }

      let driverUid = existingTrip?.driverUid || "";
      let participants = existingTrip?.participants || members.map(m => m.uid);

      if (type === 'driver') {
        driverUid = uid;
        // If becomes driver, must be a participant too
        if (!participants.includes(uid)) {
          participants.push(uid);
        }
      } else {
        if (participants.includes(uid)) {
          // Only allowed to remove if NOT the driver
          if (driverUid !== uid) {
            participants = participants.filter(id => id !== uid);
          } else {
            toast.error("Şoför yolcu listesinden çıkarılamaz.");
            setIsUpdating(false);
            return;
          }
        } else {
          participants.push(uid);
        }
      }

      const newTrip: Trip = {
        date: dateStr,
        groupId: "main-group",
        driverUid: driverUid,
        participants: participants,
        totalCollected: 0,
        type: 'full'
      };

      await saveTrip(newTrip);
      setAllTrips(prev => {
        const index = prev.findIndex(t => t.date === dateStr);
        if (index > -1) {
          const next = [...prev];
          next[index] = newTrip;
          return next;
        } else {
          return [...prev, newTrip];
        }
      });
      // Keep dialog open if we want to toggle more participants?
      // The user said "detayda arka tarafa tüm araba yla giden kişile listesi olacak"
    } catch (error) {
      console.error("Error updating trip:", error);
      toast.error("Hata oluştu");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCreateUser = async () => {
    if (!newUserName.trim() || !isAdmin) return;
    setIsCreatingUser(true);
    try {
      await createManualUser(newUserName.trim());
      toast.success("Yeni yolcu eklendi.");
      setNewUserName("");
      setIsAddUserOpen(false);
      fetchData();
    } catch (error) {
      toast.error("Kullanıcı eklenemedi.");
    } finally {
      setIsCreatingUser(false);
    }
  };

  const nextMonth = () => setSelectedDate(addMonths(selectedDate, 1));
  const prevMonth = () => setSelectedDate(subMonths(selectedDate, 1));

  const activeTripData = useMemo(() => {
    if (!activeDay) return null;
    return allTrips.find(t => t.date === format(activeDay, "yyyy-MM-dd"));
  }, [activeDay, allTrips]);

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 px-2 pb-24 max-w-md mx-auto min-h-screen">

        {/* Header */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex flex-col">
            <h1 className="text-xl font-black italic tracking-tighter text-foreground transform -skew-x-6">
              YOL<span className="text-primary">TAKİP</span>
            </h1>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">
              ARAÇ PAYLAŞIM SİSTEMİ
            </p>
          </div>

          <div className="flex items-center gap-2">
            {deferredPrompt && (
              <Button
                onClick={handleInstallApp}
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full bg-primary/10 text-primary border border-primary/20 animate-bounce"
              >
                <Smartphone size={16} />
              </Button>
            )}
            {user ? (
              <div className="flex gap-1">
                {isAdmin && (
                  <Button onClick={() => setIsAddUserOpen(true)} variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-emerald-100/50 text-emerald-600">
                    <UserPlus size={16} />
                  </Button>
                )}
                <Link href="/admin">
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-muted">
                    <Settings size={16} />
                  </Button>
                </Link>
              </div>
            ) : (
              <Button onClick={signInWithGoogle} variant="ghost" className="h-8 px-3 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase">
                <Shield size={12} className="mr-1" /> GİRİŞ
              </Button>
            )}
          </div>
        </div>

        {/* Date Controls */}
        <div className="flex items-center justify-between bg-card p-1 rounded-2xl border border-border shadow-sm">
          <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10" onClick={prevMonth}>
            <ChevronLeft size={20} />
          </Button>
          <div className="text-sm font-black uppercase tracking-tight">
            {format(selectedDate, "MMMM yyyy", { locale: tr })}
          </div>
          <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10" onClick={nextMonth}>
            <ChevronRight size={20} />
          </Button>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1.5">
          {["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"].map(d => (
            <div key={d} className="text-[10px] font-black text-center text-muted-foreground pb-1 uppercase">{d}</div>
          ))}
          {calendarDays.map((day, i) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const trip = allTrips.find(t => t.date === dateStr);
            const driver = trip ? members.find(m => m.uid === trip.driverUid) : null;
            const isCurrentMonth = day.getMonth() === selectedDate.getMonth();
            const isTodayDay = isToday(day);
            const participantsNames = trip?.participants
              ? members.filter(m => trip.participants.includes(m.uid)).map(m => m.name).join(", ")
              : "";

            return (
              <motion.div
                key={i}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleCellClick(day)}
                className={cn(
                  "relative aspect-square rounded-xl border flex flex-col items-center justify-center cursor-pointer transition-all group",
                  !isCurrentMonth ? "opacity-20 bg-muted/20 border-transparent" : "bg-card border-border shadow-sm",
                  isTodayDay && "ring-2 ring-primary ring-offset-2 ring-offset-background z-10",
                  driver && getPersonColor(driver.uid) + " border-transparent"
                )}
              >
                {/* Tooltip */}
                {participantsNames && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-black/80 backdrop-blur-md text-white text-[9px] font-bold rounded-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-xl border border-white/10">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[7px] text-white/50 uppercase tracking-widest mb-1">YOLCU LİSTESİ</span>
                      {participantsNames.split(", ").map((name, idx) => (
                        <div key={idx} className="flex items-center gap-1.5">
                          <div className="w-1 h-1 rounded-full bg-primary" />
                          <span>{name}</span>
                        </div>
                      ))}
                    </div>
                    {/* Arrow */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-black/80" />
                  </div>
                )}

                <span className={cn(
                  "text-xs font-black",
                  driver ? "text-white" : "text-foreground"
                )}>
                  {format(day, "d")}
                </span>
                {driver && (
                  <span className="text-[7px] font-black text-white/90 uppercase truncate w-[90%] text-center leading-none mt-0.5">
                    {driver.name.split(' ')[0]}
                  </span>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Mini Debt List */}
        <div className="space-y-3 mt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 px-1">
              <div className="bg-amber-100 p-1.5 rounded-lg text-amber-600"><Wallet size={14} strokeWidth={3} /></div>
              <h2 className="text-sm font-black tracking-tight text-foreground uppercase">HESAP ÖZETİ</h2>
              <span className="text-[9px] font-black text-muted-foreground uppercase ml-1 opacity-50">{format(selectedDate, "MMMM", { locale: tr })}</span>
            </div>
            <Link href="/settlement-detail">
              <Button className="text-[9px] font-black bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground px-4 h-9 rounded-2xl uppercase tracking-widest shadow-sm transition-all flex items-center gap-1.5 active:scale-95">
                DETAYLAR <ChevronRight size={14} strokeWidth={3} />
              </Button>
            </Link>
          </div>

          <Card className="border-none shadow-xl shadow-blue-900/5 rounded-[2rem] overflow-hidden bg-card p-4">
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <LoaderIcon className="animate-spin text-primary" size={24} />
              </div>
            ) : stats.length > 0 ? (
              <div className="space-y-2">
                {stats.map((stat) => (
                  <div key={stat.uid} className="flex items-center justify-between p-3 rounded-2xl bg-muted/30 border border-transparent hover:border-border transition-all">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-2 h-2 rounded-full", stat.net > 0 ? "bg-emerald-500" : stat.net < 0 ? "bg-rose-500" : "bg-muted-foreground/30")} />
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-foreground uppercase">{stat.name}</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[8px] font-bold text-primary px-1 bg-primary/5 rounded uppercase">{stat.driverDays} Şoför</span>
                          <span className="text-[8px] font-bold text-orange-500 px-1 bg-orange-500/5 rounded uppercase">{stat.passengerDays} Yolcu</span>
                        </div>
                      </div>
                    </div>
                    <div className={cn(
                      "text-xs font-black px-3 py-1.5 rounded-xl shadow-sm min-w-[60px] text-center",
                      stat.net > 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"
                    )}>
                      {stat.net > 0 ? `+₺${stat.net}` : `₺${stat.net}`}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center flex flex-col items-center gap-3">
                <div className="p-4 rounded-full bg-muted/50">
                  <Info size={32} className="text-muted-foreground opacity-20" />
                </div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase leading-tight tracking-widest max-w-[200px]">Bu ay için henüz ödeme kaydı bulunamadı.</p>
              </div>
            )}
          </Card>
        </div>

        {/* Footer Info */}
        <div className="flex flex-col gap-1 items-center opacity-40 mt-4">
          <p className="text-[9px] text-center text-muted-foreground font-black uppercase tracking-widest">
            YOLTAKİP v2.0
          </p>
          {!isAdmin && (
            <p className="text-[8px] text-center text-muted-foreground font-bold uppercase tracking-[0.2em]">
              Düzenleme Yapmak İçin Giriş Yapın
            </p>
          )}
        </div>

        {/* Passenger Management Dialog (Admin Only) */}
        <Dialog open={isDriverDialogOpen} onOpenChange={setIsDriverDialogOpen}>
          <DialogContent className="sm:max-w-[400px] rounded-[2.5rem] p-0 overflow-hidden border-border shadow-2xl bg-card">
            <div className="bg-primary p-6 text-primary-foreground">
              <DialogHeader>
                <DialogTitle className="text-xl font-black flex items-center gap-2">
                  <CalendarIcon size={20} />
                  {activeDay && format(activeDay, "d MMMM", { locale: tr })}
                </DialogTitle>
              </DialogHeader>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">ŞOFÖR SEÇİN</h3>
                  {activeTripData && <span className="text-[9px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded uppercase">AKTİF</span>}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div
                    onClick={() => handleUpdateTripData("", 'driver')}
                    className={cn(
                      "flex flex-col items-center justify-center p-3 rounded-2xl border border-dashed transition-all cursor-pointer opacity-80 hover:opacity-100",
                      (!activeTripData || activeTripData?.driverUid === "")
                        ? "bg-rose-500/10 border-rose-500/20 text-rose-500"
                        : "bg-muted/50 border-transparent"
                    )}
                  >
                    <div className="h-10 w-10 flex items-center justify-center rounded-full bg-muted mb-2">
                      <Users size={16} />
                    </div>
                    <span className="text-[9px] font-black uppercase">TEMİZLE</span>
                  </div>
                  {members.map(m => (
                    <div
                      key={m.uid}
                      onClick={() => handleUpdateTripData(m.uid, 'driver')}
                      className={cn(
                        "flex flex-col items-center p-3 rounded-2xl border transition-all cursor-pointer",
                        activeTripData?.driverUid === m.uid
                          ? "bg-primary text-primary-foreground border-primary shadow-lg ring-2 ring-primary/20"
                          : "bg-muted/50 border-transparent hover:bg-muted"
                      )}
                    >
                      <Avatar className="h-10 w-10 border-2 border-background mb-2">
                        <AvatarImage src={m.photoURL} />
                        <AvatarFallback className="text-[10px]">{m.name?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="text-[9px] font-black truncate w-full text-center uppercase">{m.name.split(' ')[0]}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                    <Users size={12} /> YOLCULAR
                  </h3>
                  <span className="text-[9px] font-black text-muted-foreground uppercase">
                    {activeTripData?.participants?.length || 0} KİŞİ
                  </span>
                </div>
                <div className="grid gap-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                  {members.map(m => (
                    <div
                      key={m.uid}
                      onClick={() => handleUpdateTripData(m.uid, 'participant')}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-2xl border transition-colors cursor-pointer",
                        activeTripData?.participants?.includes(m.uid)
                          ? "bg-emerald-500/10 border-emerald-500/20"
                          : "bg-muted/30 border-transparent opacity-60"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 border border-background">
                          <AvatarFallback className="text-[9px]">{m.name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-bold text-foreground">{m.name}</span>
                      </div>
                      {activeTripData?.participants?.includes(m.uid) && (
                        <CheckCircle2 size={16} className="text-emerald-500" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <Button onClick={() => setIsDriverDialogOpen(false)} className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 font-black text-primary-foreground shadow-lg shadow-primary/20 uppercase tracking-widest">KAPAT</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add User Dialog */}
        <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
          <DialogContent className="sm:max-w-[400px] rounded-[2.5rem] p-6 border-border shadow-2xl bg-card">
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase tracking-tighter">YENİ YOLCU EKLE</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 pt-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">İSİM SOYİSİM</label>
                <Input
                  placeholder="Örn: Ahmet Yılmaz"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="h-14 rounded-2xl bg-muted border-transparent font-bold text-foreground px-6 focus:ring-primary/20"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setIsAddUserOpen(false)} variant="ghost" className="flex-1 h-14 rounded-2xl font-black text-muted-foreground uppercase tracking-widest text-xs">İPTAL</Button>
                <Button
                  onClick={handleCreateUser}
                  disabled={isCreatingUser || !newUserName.trim()}
                  className="flex-1 h-14 rounded-2xl bg-primary hover:bg-primary/90 font-black text-primary-foreground shadow-lg shadow-primary/20 uppercase tracking-widest"
                >
                  {isCreatingUser ? <LoaderIcon className="animate-spin" size={18} /> : "KAYDET"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Loading overlay for updates */}
        {isUpdating && (
          <div className="fixed inset-0 bg-background/50 backdrop-blur-sm z-50 flex items-center justify-center">
            <LoaderIcon className="animate-spin text-primary" size={48} />
          </div>
        )}

      </div>
    </AppLayout>
  );
}
