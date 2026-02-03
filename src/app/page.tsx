"use client";

import React, { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Car,
  Users,
  TrendingUp,
  Calendar as CalendarIcon,
  ChevronRight,
  Phone,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Loader2 as LoaderIcon,
  Shield,
  Calculator,
  Plus,
  Moon,
  Info,
  Map as MapIcon,
  Navigation,
  Sun,
  Cloud,
  CloudRain,
  Snowflake,
  Wind,
  Droplets,
  LogOut,
  Gauge,
  Zap,
  MoreVertical,
  Fuel,
  User,
  Download,
  Smartphone,
  Clock,
  ArrowUpRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { getUsers, getAllTrips, saveTrip, saveLocation, getAppSettings, AppSettings, getApprovedUsers, getDrivingTracks } from "@/lib/db-service";
import { getFuelPrices, FuelPriceData } from "@/lib/fuel-service";
import { UserProfile, Trip, DrivingTrack } from "@/types";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO, addDays } from "date-fns";
import { tr } from "date-fns/locale";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SeatingPlan } from "@/components/dashboard/SeatingPlan";

export default function Dashboard() {
  const { profile, user, logout } = useAuth();
  const [stats, setStats] = useState({
    totalTrips: 0,
    monthlyDebt: 0,
    monthlyCredit: 0,
    nextDriver: "Belli Değil"
  });
  const [loading, setLoading] = useState(true);
  const [isParticipating, setIsParticipating] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [todayTrip, setTodayTrip] = useState<any>(null);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [todayParticipants, setTodayParticipants] = useState<{ profile: UserProfile, isDriver: boolean }[]>([]);
  const [isDriverDialogOpen, setIsDriverDialogOpen] = useState(false);
  const [isSeatingPlanOpen, setIsSeatingPlanOpen] = useState(false);
  const [isUpdatingDriver, setIsUpdatingDriver] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [fuelPrices, setFuelPrices] = useState<FuelPriceData | null>(null);

  const [allTrips, setAllTrips] = useState<Trip[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ dailyFee: 100 });
  const [drivingTracks, setDrivingTracks] = useState<DrivingTrack[]>([]);
  const { isDarkMode, toggleDarkMode } = useTheme();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const prayerTimes = useMemo(() => [
    { n: 'İmsak', t: '06:28' },
    { n: 'Güneş', t: '07:53' },
    { n: 'Öğle', t: '13:08' },
    { n: 'İkindi', t: '15:53' },
    { n: 'Akşam', t: '18:12' },
    { n: 'Yatsı', t: '19:32' }
  ], []);

  const { nextPrayerIdx, countdown } = useMemo(() => {
    const now = currentTime;
    const timeStrS = format(now, "HH:mm:ss");

    let nextIdx = prayerTimes.findIndex(p => p.t + ":00" > timeStrS);
    if (nextIdx === -1) nextIdx = 0;

    const next = prayerTimes[nextIdx];
    const [h, m] = next.t.split(':').map(Number);
    const target = new Date(now);
    target.setHours(h, m, 0, 0);

    if (target < now) {
      target.setDate(target.getDate() + 1);
    }

    const diff = target.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return {
      nextPrayerIdx: nextIdx,
      countdown: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    };
  }, [currentTime, prayerTimes]);

  const timeStr = format(currentTime, "HH:mm");
  const isMorningRush = timeStr >= "08:00" && timeStr <= "08:30";
  const isEvening = timeStr >= "17:30" && timeStr <= "18:00";
  const isNightTime = timeStr >= "18:00" || timeStr < "06:00";

  useEffect(() => {
    // Logic for auto switching could be added here if desired.
  }, [isNightTime]);

  const weatherForecast = useMemo(() => {
    const types = ['sunny', 'cloudy', 'rainy', 'snowy'] as const;
    return Array.from({ length: 6 }).map((_, i) => {
      const date = addDays(new Date(), i);
      const hash = date.getDate() + date.getMonth();
      const type = types[hash % 4];
      let tempDay = date.getMonth() <= 2 || date.getMonth() >= 10 ? 5 + (hash % 10) : 20 + (hash % 10);
      let tempNight = date.getMonth() <= 2 || date.getMonth() >= 10 ? -2 + (hash % 5) : 15 + (hash % 5);
      return { date, type, tempDay, tempNight };
    });
  }, []);

  const getWeatherIcon = (type: string) => {
    switch (type) {
      case 'sunny': return <Sun size={16} className="text-amber-500" />;
      case 'cloudy': return <Cloud size={16} className="text-gray-400" />;
      case 'rainy': return <CloudRain size={16} className="text-blue-400" />;
      case 'snowy': return <Snowflake size={16} className="text-cyan-300" />;
      default: return <Sun size={16} className="text-amber-500" />;
    }
  };

  // PWA Installation state
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Register Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => console.error('SW Registration failed:', err));
    }

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

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      try {
        const [fetchedUsers, trips, prices, appSettings, tracks] = await Promise.all([
          getApprovedUsers(),
          getAllTrips(),
          getFuelPrices(),
          getAppSettings(),
          user ? getDrivingTracks(user.uid, format(new Date(), "yyyy-MM")) : Promise.resolve([])
        ]);
        setMembers(fetchedUsers);
        setAllTrips(trips);
        setFuelPrices(prices);
        setSettings(appSettings);
        setDrivingTracks(tracks as DrivingTrack[]);
      } catch (error) {
        console.error("Error fetching initial dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    const calculateDashboardStats = async () => {
      if (!user || allTrips.length === 0 || members.length === 0) return;
      setLoading(true);
      try {
        const todayStr = format(new Date(), "yyyy-MM-dd");
        const selectedMonthStr = format(selectedDate, "yyyy-MM");
        const monthlyTrips = allTrips.filter(t => t.date.startsWith(selectedMonthStr));
        let today = allTrips.find(t => t.date === todayStr);

        if (!today) {
          const pastTrips = allTrips.filter(t => t.date < todayStr).sort((a, b) => b.date.localeCompare(a.date));
          if (pastTrips.length > 0) {
            today = { ...pastTrips[0], date: todayStr, isInherited: true } as any;
            delete (today as any).id;
          }
        }

        const dailyFee = settings.dailyFee;
        const getFee = (type?: string) => type === 'full' || !type ? dailyFee : dailyFee / 2;
        const debt = monthlyTrips.filter(t => t.participants.includes(user.uid) && t.driverUid !== user.uid).reduce((acc, t) => acc + getFee(t.type), 0);
        const credit = monthlyTrips.filter(t => t.driverUid === user.uid).reduce((acc, trip) => acc + (trip.participants.length * getFee(trip.type)), 0);

        let driverName = "Belli Değil";
        let todayDetails: { profile: UserProfile, isDriver: boolean }[] = [];
        if (today) {
          setTodayTrip(today);
          const driver = members.find(u => u.uid === today.driverUid);
          driverName = driver ? driver.name : "Bilinmiyor";
          setHasJoined(today.participants.includes(user.uid));
          const participantProfiles = members.filter(u => today.participants.includes(u.uid));
          todayDetails = participantProfiles.map(p => ({ profile: p, isDriver: p.uid === today.driverUid })).sort((a, b) => (a.isDriver === b.isDriver) ? 0 : a.isDriver ? -1 : 1);
        }

        setTodayParticipants(todayDetails);
        setStats({ totalTrips: monthlyTrips.length, monthlyDebt: debt, monthlyCredit: credit, nextDriver: driverName });
      } catch (error) {
        console.error("Error dashboard stats:", error);
      } finally {
        setLoading(false);
      }
    };
    calculateDashboardStats();
  }, [user, selectedDate, allTrips, members]);



  const handleUpdateTrip = async (updates: { driverUid?: string, participants?: string[] }) => {
    if (!user) return;
    setIsUpdatingDriver(true);
    try {
      const todayStr = format(new Date(), "yyyy-MM-dd");
      const baseTrip = todayTrip || { date: todayStr, groupId: "main-group", driverUid: "", participants: [], totalCollected: 0, type: "full" };
      const updatedTrip = { ...baseTrip, ...updates };
      if ((baseTrip as any).isInherited) delete (updatedTrip as any).isInherited;
      await saveTrip(updatedTrip);
      toast.success("Yolculuk güncellendi.");
      if (updates.driverUid) setIsDriverDialogOpen(false);
      const [updatedTrips, updatedUsers] = await Promise.all([getAllTrips(), getApprovedUsers()]);
      setAllTrips(updatedTrips);
      setMembers(updatedUsers);
    } catch (error) {
      console.error("Error updating trip:", error);
      toast.error("Hata oluştu.");
    } finally {
      setIsUpdatingDriver(false);
    }
  };

  const toggleParticipant = (uid: string) => {
    const currentParticipants = todayTrip?.participants || [];
    const newParticipants = currentParticipants.includes(uid) ? currentParticipants.filter((id: string) => id !== uid) : [...currentParticipants, uid];
    handleUpdateTrip({ participants: newParticipants });
  };

  return (
    <AppLayout>
      <div className={cn("relative space-y-8 px-2 pb-32 transition-all duration-300 min-h-screen", isEvening && !isDarkMode ? "bg-gradient-to-b from-indigo-900/10 to-transparent" : "")}>

        {/* Header Section */}
        <section className="flex flex-col gap-6 pt-0">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 group">
                <div className="relative p-2 rounded-2xl bg-card border border-border shadow-sm">
                  <Gauge size={24} className="text-primary" strokeWidth={2.5} />
                </div>
                <h1 className="text-2xl font-black italic tracking-tighter transform -skew-x-6 text-foreground">
                  YOL<span className="text-primary">TAKİP</span>
                </h1>
              </div>
              <div>
                <h2 className="text-3xl font-black tracking-tight text-foreground">Merhaba, {profile?.name?.split(' ')[0]} 👋</h2>
                <p className="text-sm font-medium mt-1 uppercase tracking-widest text-muted-foreground">
                  {format(currentTime, "d MMMM yyyy, EEEE", { locale: tr })}
                </p>
              </div>
            </div>

            {/* Middle Section: Clock and Profile Actions */}
            <div className="flex flex-col items-center gap-2 mb-1">
              <div className="flex items-center gap-3 p-2 bg-card/50 backdrop-blur-sm rounded-3xl border border-border shadow-sm">
                <div className="flex items-center gap-2 pl-2 pr-1 border-r border-border">
                  <span className="text-sm font-black text-primary font-mono tracking-wider">{format(currentTime, "HH:mm:ss")}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button onClick={toggleDarkMode} variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-muted transition-all">
                    {isDarkMode ? <Sun size={16} className="text-yellow-400" fill="currentColor" /> : <Moon size={16} className="text-gray-400" fill="currentColor" />}
                  </Button>

                  {/* PWA Install Button */}
                  {deferredPrompt && (
                    <Button
                      onClick={handleInstallApp}
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all animate-bounce"
                      title="Ana Ekrana Ekle"
                    >
                      <Smartphone size={16} strokeWidth={2.5} />
                    </Button>
                  )}

                  {user && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 rounded-full p-0 border-2 border-border shadow-sm overflow-hidden relative">
                          <Avatar className="h-full w-full">
                            <AvatarImage src={user.photoURL || ""} />
                            <AvatarFallback>{user.displayName?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          {profile?.role === 'admin' && (
                            <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground p-0.5 rounded-full border border-background scale-75">
                              <Shield size={10} strokeWidth={3} />
                            </div>
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-56 rounded-2xl bg-card border-border" align="center">
                        <DropdownMenuItem asChild><Link href="/admin"><Shield className="mr-2 h-4 w-4" /> Yönetici Paneli</Link></DropdownMenuItem>
                        <DropdownMenuItem asChild><Link href="/profile"><User className="mr-2 h-4 w-4" /> Profil Ayarları</Link></DropdownMenuItem>
                        <DropdownMenuItem onClick={logout} className="text-destructive"><LogOut className="mr-2 h-4 w-4" /> Çıkış Yap</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  {profile?.role === 'admin' && (
                    <Link href="/admin">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all ml-1" title="Hızlı Yönetici Girişi">
                        <Shield size={16} strokeWidth={2.5} />
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {fuelPrices && (
              <div className="flex items-center gap-4 p-4 rounded-[2rem] border shadow-lg shadow-blue-900/5 bg-card border-border">
                <div className="flex flex-col pr-4 border-r border-border">
                  <span className="text-[10px] font-black text-primary uppercase">Ankara</span>
                  <span className="text-xs font-bold text-muted-foreground underline decoration-primary/30">Yakıt</span>
                </div>
                <div className="flex items-center gap-6">
                  {[
                    { label: 'Benzin', key: 'benzin' as const, color: 'text-emerald-500' },
                    { label: 'Motorin', key: 'motorin' as const, color: 'text-amber-500' },
                    { label: 'LPG', key: 'lpg' as const, color: 'text-blue-500' }
                  ].map((fuel) => (
                    <div key={fuel.label} className="flex flex-col">
                      <span className={cn("text-[9px] font-black uppercase", fuel.color)}>{fuel.label}</span>
                      <span className="text-base font-black tracking-tighter text-foreground">
                        ₺{fuelPrices[fuel.key]?.toFixed(2) || "0.00"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Namaz Widget */}
          <div className="hidden xl:flex items-center justify-center p-2 rounded-2xl border backdrop-blur-md h-[72px] bg-card/60 border-border shadow-sm">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-4 pr-4 border-r border-border">
                <Moon size={14} className="text-emerald-500" />
                <div className="flex flex-col">
                  <span className="text-[9px] font-black uppercase text-primary/70 tracking-tighter">İNCELENEN VAKİT</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-foreground">Ankara</span>
                    <div className="bg-primary/10 px-1.5 py-0.5 rounded-md border border-primary/20 flex items-center gap-1">
                      <Clock size={10} className="text-primary animate-pulse" />
                      <span className="text-[10px] font-black text-primary font-mono tabular-nums">{countdown}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {prayerTimes.map((v, i) => {
                  const isNext = i === nextPrayerIdx;
                  return (
                    <div key={v.n} className={cn(
                      "flex flex-col items-center px-3 py-1.5 rounded-2xl transition-all duration-500",
                      isNext
                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105"
                        : "bg-card/40 hover:bg-card/80 border border-transparent hover:border-border"
                    )}>
                      <span className={cn("text-[8px] font-black uppercase tracking-widest", isNext ? "text-primary-foreground/70" : "text-muted-foreground")}>{v.n}</span>
                      <span className={cn("text-[11px] font-black", isNext ? "text-primary-foreground" : "text-foreground")}>{v.t}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Weather Forecast */}
          <div className="w-full backdrop-blur-md rounded-2xl border p-3 overflow-x-auto bg-card/60 border-border shadow-sm">
            <div className="flex justify-between items-center min-w-max gap-2 w-full">
              {weatherForecast.map((day, i) => (
                <div key={i} className={cn("flex flex-col items-center justify-center gap-1 flex-1 p-2 rounded-xl", i === 0 ? "bg-primary/10 ring-1 ring-primary/20" : "hover:bg-muted/50")}>
                  <span className="text-[9px] font-bold text-muted-foreground uppercase">{i === 0 ? "Bugün" : format(day.date, "EEE", { locale: tr })}</span>
                  {getWeatherIcon(day.type)}
                  <span className="text-[10px] font-black text-foreground">{day.tempDay}°</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Home Content */}
        <div className="flex flex-col gap-6">
          {/* Trip Summary */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <div className="bg-primary/10 p-1.5 rounded-lg text-primary"><TrendingUp size={16} strokeWidth={3} /></div>
              <h2 className="text-base font-black tracking-tight text-foreground">Bugünün Yolculuğu</h2>
            </div>
            <Card className="border-none shadow-xl shadow-blue-900/5 rounded-[2.5rem] overflow-hidden bg-card">
              {todayTrip ? (
                <div className="p-6 flex flex-col md:flex-row gap-6 items-center">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-primary text-primary-foreground flex flex-col items-center justify-center font-black">
                      <span className="text-[10px] uppercase opacity-70">{format(new Date(), "EEE", { locale: tr })}</span>
                      <span className="text-xl">{format(new Date(), "d")}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-[0.2em] leading-none mb-1">{format(new Date(), "MMMM", { locale: tr })}</span>
                      <h3 className="text-sm font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">AKTİF YOLCULUK</h3>
                    </div>
                  </div>
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                    <div className="bg-amber-100/40 dark:bg-amber-900/20 p-4 rounded-2xl border border-amber-200/60 dark:border-amber-700/30 flex items-center gap-4 transition-all hover:bg-amber-100/60">
                      <div className="bg-amber-500 dark:bg-amber-600 p-2.5 rounded-xl text-white shadow-sm">
                        <Car size={20} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-[0.15em] mb-0.5">ŞÖFÖR</span>
                        <span className="text-sm font-black text-slate-900 dark:text-slate-50 leading-tight">{members.find(m => m.uid === todayTrip.driverUid)?.name || "Bilinmiyor"}</span>
                      </div>
                    </div>
                    <div className="bg-indigo-100/40 dark:bg-indigo-900/20 p-4 rounded-2xl border border-indigo-200/60 dark:border-indigo-700/30 flex items-center gap-4 transition-all hover:bg-indigo-100/60">
                      <div className="bg-indigo-500 dark:bg-indigo-600 p-2.5 rounded-xl text-white shadow-sm">
                        <Users size={20} />
                      </div>
                      <div className="flex flex-col truncate">
                        <span className="text-[9px] font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-[0.15em] mb-0.5">YOLCULAR</span>
                        <span className="text-sm font-black text-slate-900 dark:text-slate-50 truncate leading-tight">
                          {todayTrip.participants?.map((id: string) => members.find(m => m.uid === id)?.name).filter(Boolean).join(", ")}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                    {todayTrip.isInherited && (
                      <Button
                        onClick={() => handleUpdateTrip({})}
                        className="flex-1 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-black uppercase text-[10px] tracking-widest px-6 shadow-lg shadow-primary/20"
                        disabled={isUpdatingDriver}
                      >
                        {isUpdatingDriver ? <LoaderIcon className="animate-spin" size={14} /> : "Günü Onayla"}
                      </Button>
                    )}
                    <Button onClick={() => setIsSeatingPlanOpen(true)} className="flex-1 rounded-xl bg-secondary text-secondary-foreground border border-border hover:bg-muted font-bold uppercase text-[10px] tracking-widest px-4">Oturma Planı</Button>
                    <Button onClick={() => setIsDriverDialogOpen(true)} className="flex-1 rounded-xl bg-secondary text-secondary-foreground border border-border hover:bg-muted font-bold uppercase text-[10px] tracking-widest px-4">Düzenle</Button>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center flex flex-col items-center gap-4">
                  <Info size={32} className="text-muted-foreground" />
                  <p className="text-sm font-bold text-muted-foreground">Henüz yolculuk planlanmamış.</p>
                  <Button onClick={() => setIsDriverDialogOpen(true)} variant="outline" className="rounded-xl border-border text-foreground hover:bg-muted">Şimdi Planla</Button>
                </div>
              )}
            </Card>
          </div>

          {/* New Driving Tracks Section */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2">
                <div className="bg-indigo-100 dark:bg-indigo-900/20 p-1.5 rounded-lg text-indigo-600"><Clock size={16} strokeWidth={3} /></div>
                <h2 className="text-base font-black tracking-tight text-foreground">Son Sürüşler (GPS)</h2>
              </div>
              <Link href="/reports?tab=gps" className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">TÜMÜ</Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {drivingTracks.length > 0 ? (
                drivingTracks.slice(0, 3).map((track, idx) => (
                  <Link href={`/reports?tab=gps&date=${track.date}`} key={idx}>
                    <Card className="border-border shadow-sm bg-card hover:shadow-md transition-all overflow-hidden group h-full">
                      <div className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn("p-2.5 rounded-xl", track.type === 'morning' ? "bg-amber-100 text-amber-600 dark:bg-amber-900/20" : "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/20")}>
                            {track.type === 'morning' ? <Navigation size={18} /> : <Car size={18} />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-xs text-foreground">{format(parseISO(track.date), "d MMM, EEE", { locale: tr })}</span>
                              <span className="px-1 py-0.5 rounded-md bg-muted text-muted-foreground text-[7px] font-black">
                                {track.type === 'morning' ? "GİDİŞ" : "DÖNÜŞ"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground mt-0.5">
                              <span>{track.startTime} - {track.endTime}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-2">
                          <div className="text-sm font-black text-primary">{track.distanceKm.toFixed(1)} <span className="text-[8px]">KM</span></div>
                          <ArrowUpRight size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                      </div>
                    </Card>
                  </Link>
                ))
              ) : (
                <div className="md:col-span-2 lg:col-span-3 py-10 text-center text-muted-foreground text-xs font-bold bg-muted/30 rounded-[2rem] border border-dashed border-border">
                  Henüz sürüş kaydı bulunmuyor.
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions & Analysis */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="bg-primary/10 p-1.5 rounded-lg text-primary"><Plus size={16} strokeWidth={3} /></div>
                <h2 className="text-base font-black tracking-tight text-foreground">Hızlı İşlemler</h2>
              </div>
              <div className="grid gap-3">
                {[
                  { t: "Takvim", i: CalendarIcon, c: "text-blue-600", b: "bg-blue-50 dark:bg-blue-900/10", h: "/calendar" },
                  { t: "Grup", i: Users, c: "text-indigo-600", b: "bg-indigo-50 dark:bg-indigo-900/10", h: "/group" },
                  { t: "Hesapla", i: Calculator, c: "text-amber-600", b: "bg-amber-50 dark:bg-amber-900/10", h: "/settlement" }
                ].map(item => (
                  <Link key={item.t} href={item.h}>
                    <div className="bg-card p-4 rounded-3xl border border-border shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
                      <div className="flex items-center gap-4">
                        <div className={cn("p-3 rounded-2xl", item.b, item.c)}><item.i size={22} strokeWidth={2.5} /></div>
                        <span className="font-black text-foreground">{item.t}</span>
                      </div>
                      <ChevronRight size={18} className="text-muted-foreground group-hover:text-primary" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="bg-green-100 dark:bg-green-900/20 p-1.5 rounded-lg text-green-600"><TrendingUp size={16} strokeWidth={3} /></div>
                <h2 className="text-base font-black tracking-tight text-foreground">Analiz & Trafik</h2>
              </div>
              <div className="bg-card rounded-[2.5rem] p-8 text-foreground relative overflow-hidden shadow-2xl h-full flex flex-col justify-between min-h-[300px] border border-border">
                <div className="relative z-10">
                  <MapIcon size={24} className="text-primary mb-6" />
                  <h3 className="text-2xl font-black mb-3 italic transform -skew-x-6">TRAFİK & ROTA</h3>
                  <p className="text-xs text-muted-foreground font-medium">Güncel Ankara trafiğine göre en hızlı güzergâh.</p>
                </div>
                <div className="space-y-3 relative z-10 w-full mt-6">
                  <Link href="/map" className="block w-full">
                    <Button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-2xl p-6 font-black uppercase tracking-wider w-full shadow-lg">ROTA ANALİZİ</Button>
                  </Link>
                  <Button
                    onClick={() => {
                      const hour = new Date().getHours();
                      const min = new Date().getMinutes();
                      const isEv = hour > 17 || (hour === 17 && min >= 30);
                      const lat = isEv ? 39.9475578 : 39.9168615;
                      const lng = isEv ? 32.6642409 : 32.7900571;
                      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
                    }}
                    className="bg-green-600 hover:bg-green-700 rounded-2xl p-6 font-black uppercase tracking-wider w-full shadow-lg border border-green-500"
                  >
                    <Navigation size={18} className="mr-2" /> NAVİGASYON
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Reports Section */}
          <div className="space-y-4 pt-8">
            <div className="flex items-center gap-2">
              <div className="bg-amber-100 dark:bg-amber-900/20 p-1.5 rounded-lg text-amber-600"><Fuel size={16} strokeWidth={3} /></div>
              <h2 className="text-base font-black tracking-tight text-foreground">Rapor Analizleri</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Link href="/reports?tab=fuel" className="block p-6 rounded-[2.5rem] bg-card border border-border shadow-lg hover:shadow-xl transition-all">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center mb-4 text-amber-600"><Fuel size={24} /></div>
                <h3 className="text-lg font-black text-foreground mb-1">Yakıt Raporu</h3>
                <p className="text-xs text-muted-foreground font-bold">Maliyet ve tüketim özeti.</p>
              </Link>
              <Link href="/reports?tab=gps" className="block p-6 rounded-[2.5rem] bg-card border border-border shadow-lg hover:shadow-xl transition-all">
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/20 flex items-center justify-center mb-4 text-indigo-600"><Navigation size={24} /></div>
                <h3 className="text-lg font-black text-foreground mb-1">GPS Raporu</h3>
                <p className="text-xs text-muted-foreground font-bold">Gidilen yollar ve KM verisi.</p>
              </Link>
              <Link href="/group" className="block p-6 rounded-[2.5rem] bg-card border border-border shadow-lg hover:shadow-xl transition-all">
                <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center mb-4 text-blue-600"><Users size={24} /></div>
                <h3 className="text-lg font-black text-foreground mb-1">Üye Listesi</h3>
                <p className="text-xs text-muted-foreground font-bold">Takım arkadaşların.</p>
              </Link>
            </div>
          </div>
        </div>

        {/* Dialogs */}
        <Dialog open={isSeatingPlanOpen} onOpenChange={setIsSeatingPlanOpen}>
          <DialogContent className="sm:max-w-[800px] w-full max-h-[90vh] overflow-y-auto rounded-[3rem] p-4 bg-card border-border shadow-2xl">
            <SeatingPlan
              driver={members.find(m => m.uid === todayTrip?.driverUid)}
              participants={todayTrip?.participants?.map((id: string) => members.find(m => m.uid === id)).filter(Boolean) as UserProfile[] || []}
              className="bg-muted/50"
            />
            <div className="pt-6 flex justify-center"><Button onClick={() => setIsSeatingPlanOpen(false)} variant="ghost" className="rounded-xl font-bold text-foreground hover:bg-muted">KAPAT</Button></div>
          </DialogContent>
        </Dialog>

        <Dialog open={isDriverDialogOpen} onOpenChange={setIsDriverDialogOpen}>
          <DialogContent className="sm:max-w-[400px] rounded-[2.5rem] p-0 overflow-hidden border-border shadow-2xl bg-card">
            <div className="bg-primary p-6 text-primary-foreground"><DialogHeader><DialogTitle className="text-xl font-black">Yolculuk Düzenle</DialogTitle></DialogHeader></div>
            <div className="p-6 space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">ŞOFÖR</label>
                <Select onValueChange={(uid) => handleUpdateTrip({ driverUid: uid })} value={todayTrip?.driverUid || ""}>
                  <SelectTrigger className="w-full h-14 rounded-2xl bg-muted border-transparent font-bold text-foreground"><SelectValue placeholder="Şoför Seç..." /></SelectTrigger>
                  <SelectContent className="rounded-2xl border-border bg-card">
                    {members.map(m => (
                      <SelectItem key={m.uid} value={m.uid} className="rounded-xl font-bold py-3 text-foreground focus:bg-muted">
                        <div className="flex items-center gap-2"><Avatar className="h-6 w-6"><AvatarImage src={m.photoURL} /><AvatarFallback>{m.name?.charAt(0)}</AvatarFallback></Avatar>{m.name}</div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">YOLCULAR</label>
                <div className="grid gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {members.map(m => (
                    <div key={m.uid} onClick={() => toggleParticipant(m.uid)} className={cn("flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer", todayTrip?.participants?.includes(m.uid) ? "bg-primary/10 border-primary/20" : "bg-muted/50 border-transparent opacity-60")}>
                      <div className="flex items-center gap-3"><Avatar className="h-8 w-8"><AvatarImage src={m.photoURL} /></Avatar><span className="text-sm font-bold text-foreground">{m.name}</span></div>
                      {todayTrip?.participants?.includes(m.uid) && <div className="bg-primary text-primary-foreground p-1 rounded-full"><CheckCircle2 size={12} /></div>}
                    </div>
                  ))}
                </div>
              </div>
              <Button onClick={() => setIsDriverDialogOpen(false)} className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 font-black text-primary-foreground shadow-lg shadow-primary/20">KAPAT</Button>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </AppLayout>
  );
}
