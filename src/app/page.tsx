"use client";

import React, { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/context/AuthContext";
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
  Fuel
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { getUsers, getAllTrips, saveTrip, saveLocation, getAppSettings, AppSettings, getApprovedUsers } from "@/lib/db-service";
import { getFuelPrices, FuelPriceData } from "@/lib/fuel-service";
import { UserProfile, Trip } from "@/types";
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
  const [isDarkMode, setIsDarkMode] = useState(false); // Dark Mode State

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeStr = format(currentTime, "HH:mm");
  const isMorningRush = timeStr >= "08:00" && timeStr <= "08:30";
  const isEvening = timeStr >= "17:30" && timeStr <= "18:00";
  const isNightTime = timeStr >= "18:00" || timeStr < "06:00";

  useEffect(() => {
    if (isNightTime) setIsDarkMode(true);
    else setIsDarkMode(false);
  }, [isNightTime]);

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

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

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      try {
        const [fetchedUsers, trips, prices, appSettings] = await Promise.all([
          getApprovedUsers(),
          getAllTrips(),
          getFuelPrices(),
          getAppSettings()
        ]);
        setMembers(fetchedUsers);
        setAllTrips(trips);
        setFuelPrices(prices);
        setSettings(appSettings);
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

  useEffect(() => {
    if (!user || !todayTrip?.driverUid || user.uid !== todayTrip.driverUid) return;
    const isMorningWindow = timeStr >= "08:00" && timeStr <= "09:00";
    const isEveningWindow = timeStr >= "17:30" && timeStr <= "18:30";
    if (!isMorningWindow && !isEveningWindow) return;
    let watchId: number;
    if ("geolocation" in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (p) => saveLocation(user.uid, p.coords.latitude, p.coords.longitude).catch(console.error),
        (e) => console.error("GPS Error:", e),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    }
    return () => { if (watchId) navigator.geolocation.clearWatch(watchId); };
  }, [user, todayTrip?.driverUid, timeStr]);

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
      <div className={cn("relative space-y-8 px-2 pb-32 transition-all duration-1000 min-h-screen", isDarkMode ? "bg-slate-900 text-white" : "bg-transparent", isEvening ? "bg-gradient-to-b from-indigo-900/50 to-slate-900" : "")}>

        {/* Header Section */}
        <section className="flex flex-col gap-6 pt-0">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 group">
                <div className="relative p-2 rounded-2xl bg-white border border-gray-100 shadow-sm dark:bg-slate-800 dark:border-slate-700">
                  <Gauge size={24} className="text-blue-600 dark:text-blue-400" strokeWidth={2.5} />
                </div>
                <h1 className={cn("text-2xl font-black italic tracking-tighter transform -skew-x-6", isDarkMode ? "text-white" : "text-slate-900")}>
                  YOL<span className="text-blue-600">TAKİP</span>
                </h1>
              </div>
              <div>
                <h2 className={cn("text-3xl font-black tracking-tight", isDarkMode ? "text-white" : "text-[#1E293B]")}>Merhaba, {profile?.name?.split(' ')[0]} 👋</h2>
                <p className={cn("text-sm font-medium mt-1 uppercase tracking-widest opacity-60", isDarkMode ? "text-slate-400" : "text-slate-500")}>
                  {format(currentTime, "d MMMM yyyy, EEEE", { locale: tr })}
                </p>
              </div>
            </div>

            {/* Middle Section: Clock and Profile Actions */}
            <div className="hidden md:flex flex-col items-center gap-2 mb-1">
              <div className="flex items-center gap-3 p-2 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm rounded-3xl border border-white/50 dark:border-slate-700/50 shadow-sm">
                <div className="flex items-center gap-2 pl-2 pr-1 border-r border-gray-200 dark:border-slate-700">
                  <span className="text-sm font-black text-blue-600 dark:text-blue-400 font-mono tracking-wider">{format(currentTime, "HH:mm:ss")}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button onClick={toggleDarkMode} variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-white dark:hover:bg-slate-700 transition-all">
                    <Moon size={16} className={isDarkMode ? "text-yellow-400" : "text-gray-400"} fill="currentColor" />
                  </Button>
                  {user && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 rounded-full p-0 border-2 border-white dark:border-slate-600 shadow-sm overflow-hidden">
                          <Avatar className="h-full w-full">
                            <AvatarImage src={user.photoURL || ""} />
                            <AvatarFallback>{user.displayName?.charAt(0)}</AvatarFallback>
                          </Avatar>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-56 rounded-2xl" align="center">
                        <DropdownMenuItem asChild><Link href="/admin"><Shield className="mr-2 h-4 w-4" /> Yönetici Paneli</Link></DropdownMenuItem>
                        <DropdownMenuItem onClick={logout} className="text-destructive"><LogOut className="mr-2 h-4 w-4" /> Çıkış Yap</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            </div>

            {fuelPrices && (
              <div className={cn("flex items-center gap-4 p-4 rounded-[2rem] border shadow-lg shadow-blue-900/5", isDarkMode ? "bg-slate-800/80 border-slate-700" : "bg-white border-gray-100")}>
                <div className="flex flex-col pr-4 border-r border-gray-100/10">
                  <span className="text-[10px] font-black text-blue-500 uppercase">Ankara</span>
                  <span className="text-xs font-bold text-gray-500 underline decoration-blue-500/30">Yakıt</span>
                </div>
                <div className="flex items-center gap-6">
                  {[
                    { label: 'Benzin', key: 'benzin' as const, color: 'text-emerald-500' },
                    { label: 'Motorin', key: 'motorin' as const, color: 'text-amber-500' },
                    { label: 'LPG', key: 'lpg' as const, color: 'text-blue-500' }
                  ].map((fuel) => (
                    <div key={fuel.label} className="flex flex-col">
                      <span className={cn("text-[9px] font-black uppercase", fuel.color)}>{fuel.label}</span>
                      <span className="text-base font-black tracking-tighter">
                        ₺{fuelPrices[fuel.key]?.toFixed(2) || "0.00"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Namaz Widget */}
          <div className={cn("hidden xl:flex items-center justify-center p-2 rounded-2xl border backdrop-blur-md h-[72px]", isDarkMode ? "bg-slate-800/80 border-slate-700" : "bg-white/60 border-white/50 shadow-sm")}>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 pr-4 border-r border-gray-100 opacity-80">
                <Moon size={14} className="text-emerald-500" />
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold uppercase opacity-60">Namaz Vakti</span>
                  <span className="text-[10px] font-black">Ankara</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {[{ n: 'İmsak', t: '06:28' }, { n: 'Güneş', t: '07:53' }, { n: 'Öğle', t: '13:08' }, { n: 'İkindi', t: '15:53' }, { n: 'Akşam', t: '18:12' }, { n: 'Yatsı', t: '19:32' }].map((v, i) => (
                  <div key={v.n} className={cn("flex flex-col items-center px-2 py-1 rounded-lg", i === 4 ? "bg-emerald-50 ring-1 ring-emerald-100" : "")}>
                    <span className="text-[8px] font-bold uppercase opacity-50">{v.n}</span>
                    <span className={cn("text-[10px] font-black", i === 4 ? "text-emerald-700" : isDarkMode ? "text-slate-200" : "text-gray-700")}>{v.t}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>



          {/* Weather Forecast */}
          <div className={cn("w-full backdrop-blur-md rounded-2xl border p-3 overflow-x-auto", isDarkMode ? "bg-slate-800/80 border-slate-700" : "bg-white/60 border-white/50 shadow-sm")}>
            <div className="flex justify-between items-center min-w-max gap-2 w-full">
              {weatherForecast.map((day, i) => (
                <div key={i} className={cn("flex flex-col items-center justify-center gap-1 flex-1 p-2 rounded-xl", i === 0 ? "bg-blue-50/80 ring-1 ring-blue-100" : "hover:bg-gray-50/50")}>
                  <span className="text-[9px] font-bold text-gray-400 uppercase">{i === 0 ? "Bugün" : format(day.date, "EEE", { locale: tr })}</span>
                  {getWeatherIcon(day.type)}
                  <span className="text-[10px] font-black text-gray-700">{day.tempDay}°</span>
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
              <div className="bg-blue-100 p-1.5 rounded-lg text-blue-600"><TrendingUp size={16} strokeWidth={3} /></div>
              <h2 className={cn("text-base font-black tracking-tight", isDarkMode ? "text-white" : "text-[#1E293B]")}>Bugünün Yolculuğu</h2>
            </div>
            <Card className="border-none shadow-xl shadow-blue-900/5 rounded-[2.5rem] overflow-hidden">
              {todayTrip ? (
                <div className="p-6 flex flex-col md:flex-row gap-6 items-center">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex flex-col items-center justify-center font-black">
                      <span className="text-[10px] uppercase opacity-70">{format(new Date(), "EEE", { locale: tr })}</span>
                      <span className="text-xl">{format(new Date(), "d")}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">{format(new Date(), "MMMM", { locale: tr })}</span>
                      <h3 className="text-sm font-black text-blue-900">BUGÜN</h3>
                    </div>
                  </div>
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                    <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100/50 flex items-center gap-3">
                      <Car size={20} className="text-amber-600" />
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-amber-700/50 uppercase">ŞÖFÖR</span>
                        <span className="text-sm font-black text-amber-900">{members.find(m => m.uid === todayTrip.driverUid)?.name || "Bilinmiyor"}</span>
                      </div>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100/50 flex items-center gap-3">
                      <Users size={20} className="text-blue-600" />
                      <div className="flex flex-col truncate">
                        <span className="text-[9px] font-black text-blue-700/50 uppercase">YOLCULAR</span>
                        <span className="text-sm font-bold text-blue-900 truncate">
                          {todayTrip.participants?.map((id: string) => members.find(m => m.uid === id)?.name).filter(Boolean).join(", ")}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 w-full md:w-auto">
                    <Button onClick={() => setIsSeatingPlanOpen(true)} className="flex-1 rounded-xl bg-orange-50 text-orange-600 border border-orange-100 hover:bg-orange-100 font-bold uppercase text-[10px] tracking-widest px-4">Oturma Planı</Button>
                    <Button onClick={() => setIsDriverDialogOpen(true)} className="flex-1 rounded-xl bg-gray-50 text-gray-600 border border-gray-100 hover:bg-gray-100 font-bold uppercase text-[10px] tracking-widest px-4">Düzenle</Button>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center flex flex-col items-center gap-4">
                  <Info size={32} className="text-gray-300" />
                  <p className="text-sm font-bold text-gray-500">Henüz yolculuk planlanmamış.</p>
                  <Button onClick={() => setIsDriverDialogOpen(true)} variant="outline" className="rounded-xl">Şimdi Planla</Button>
                </div>
              )}
            </Card>
          </div>

          {/* Quick Actions & Analysis */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="bg-indigo-100 p-1.5 rounded-lg text-indigo-600"><Plus size={16} strokeWidth={3} /></div>
                <h2 className={cn("text-base font-black tracking-tight", isDarkMode ? "text-white" : "text-[#1E293B]")}>Hızlı İşlemler</h2>
              </div>
              <div className="grid gap-3">
                {[
                  { t: "Takvim", i: CalendarIcon, c: "text-blue-600", b: "bg-blue-50", h: "/calendar" },
                  { t: "Grup", i: Users, c: "text-indigo-600", b: "bg-indigo-50", h: "/group" },
                  { t: "Hesapla", i: Calculator, c: "text-amber-600", b: "bg-amber-50", h: "/settlement" }
                ].map(item => (
                  <Link key={item.t} href={item.h}>
                    <div className="bg-white p-4 rounded-3xl border border-gray-50 shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
                      <div className="flex items-center gap-4">
                        <div className={cn("p-3 rounded-2xl", item.b, item.c)}><item.i size={22} strokeWidth={2.5} /></div>
                        <span className="font-black text-slate-900">{item.t}</span>
                      </div>
                      <ChevronRight size={18} className="text-gray-300 group-hover:text-blue-600" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="bg-green-100 p-1.5 rounded-lg text-green-600"><TrendingUp size={16} strokeWidth={3} /></div>
                <h2 className={cn("text-base font-black tracking-tight", isDarkMode ? "text-white" : "text-[#1E293B]")}>Analiz & Trafik</h2>
              </div>
              <div className="bg-[#0B1C2D] rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl h-full flex flex-col justify-between min-h-[300px]">
                <div className="relative z-10">
                  <MapIcon size={24} className="text-blue-400 mb-6" />
                  <h3 className="text-2xl font-black mb-3 italic transform -skew-x-6">TRAFİK & ROTA</h3>
                  <p className="text-xs text-blue-100/60 font-medium">Güncel Ankara trafiğine göre en hızlı güzergâh.</p>
                </div>
                <div className="space-y-3 relative z-10 w-full mt-6">
                  <Link href="/map" className="block w-full">
                    <Button className="bg-white text-[#0B1C2D] hover:bg-blue-50 rounded-2xl p-6 font-black uppercase tracking-wider w-full shadow-lg">ROTA ANALİZİ</Button>
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
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="bg-amber-100 p-1.5 rounded-lg text-amber-600"><Fuel size={16} strokeWidth={3} /></div>
              <h2 className={cn("text-base font-black tracking-tight", isDarkMode ? "text-white" : "text-[#1E293B]")}>Rapor Analizleri</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Link href="/reports" className="block p-6 rounded-[2.5rem] bg-white border border-gray-100 shadow-lg hover:shadow-xl transition-all">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center mb-4 text-amber-600"><Fuel size={24} /></div>
                <h3 className="text-lg font-black text-slate-900 mb-1">Yakıt Raporu</h3>
                <p className="text-xs text-gray-400 font-bold">Maliyet ve tüketim özeti.</p>
              </Link>
              <Link href="/group" className="block p-6 rounded-[2.5rem] bg-white border border-gray-100 shadow-lg hover:shadow-xl transition-all">
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center mb-4 text-indigo-600"><Users size={24} /></div>
                <h3 className="text-lg font-black text-slate-900 mb-1">Üye Listesi</h3>
                <p className="text-xs text-gray-400 font-bold">Takım arkadaşların.</p>
              </Link>
            </div>
          </div>
        </div>

        {/* Dialogs */}
        <Dialog open={isSeatingPlanOpen} onOpenChange={setIsSeatingPlanOpen}>
          <DialogContent className="sm:max-w-[800px] w-full max-h-[90vh] overflow-y-auto rounded-[3rem] p-4 bg-white border-none shadow-2xl">
            <SeatingPlan
              driver={members.find(m => m.uid === todayTrip?.driverUid)}
              participants={todayTrip?.participants?.map((id: string) => members.find(m => m.uid === id)).filter(Boolean) as UserProfile[] || []}
              className="bg-slate-50"
            />
            <div className="pt-6 flex justify-center"><Button onClick={() => setIsSeatingPlanOpen(false)} variant="ghost" className="rounded-xl font-bold">KAPAT</Button></div>
          </DialogContent>
        </Dialog>

        <Dialog open={isDriverDialogOpen} onOpenChange={setIsDriverDialogOpen}>
          <DialogContent className="sm:max-w-[400px] rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl bg-white">
            <div className="bg-[#1E293B] p-6 text-white"><DialogHeader><DialogTitle className="text-xl font-black">Yolculuk Düzenle</DialogTitle></DialogHeader></div>
            <div className="p-6 space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">ŞOFÖR</label>
                <Select onValueChange={(uid) => handleUpdateTrip({ driverUid: uid })} value={todayTrip?.driverUid || ""}>
                  <SelectTrigger className="w-full h-14 rounded-2xl bg-gray-50 border-transparent font-bold"><SelectValue placeholder="Şoför Seç..." /></SelectTrigger>
                  <SelectContent className="rounded-2xl border-gray-100">
                    {members.map(m => (
                      <SelectItem key={m.uid} value={m.uid} className="rounded-xl font-bold py-3">
                        <div className="flex items-center gap-2"><Avatar className="h-6 w-6"><AvatarImage src={m.photoURL} /><AvatarFallback>{m.name?.charAt(0)}</AvatarFallback></Avatar>{m.name}</div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">YOLCULAR</label>
                <div className="grid gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {members.map(m => (
                    <div key={m.uid} onClick={() => toggleParticipant(m.uid)} className={cn("flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer", todayTrip?.participants?.includes(m.uid) ? "bg-blue-50 border-blue-100" : "bg-gray-50 border-transparent opacity-60")}>
                      <div className="flex items-center gap-3"><Avatar className="h-8 w-8"><AvatarImage src={m.photoURL} /></Avatar><span className="text-sm font-bold text-slate-900">{m.name}</span></div>
                      {todayTrip?.participants?.includes(m.uid) && <div className="bg-blue-600 text-white p-1 rounded-full"><CheckCircle2 size={12} /></div>}
                    </div>
                  ))}
                </div>
              </div>
              <Button onClick={() => setIsDriverDialogOpen(false)} className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 font-black text-white shadow-lg shadow-blue-200">KAPAT</Button>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </AppLayout>
  );
}
