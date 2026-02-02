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
  Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { getUsers, getAllTrips, saveTrip, saveLocation } from "@/lib/db-service";
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

  // ... (rest of the state from original file)

  return (
    <AppLayout>
      <div className={cn(
        "relative space-y-8 px-2 pb-32 transition-all duration-1000 min-h-screen",
        isDarkMode ? "bg-slate-900 text-white" : "bg-transparent", // Main Dark Mode styles
        isEvening ? "bg-gradient-to-b from-indigo-900/50 to-slate-900" : ""
      )}>
        {/* ... (Header Sections remain same) ... */}

        {/* Header Section with Weather and Profile */}
        <section className="flex flex-col gap-6 pt-0">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              {/* YOLTAKİP Logo - Fast Style */}
              <div className="flex items-center gap-3 mb-2 group cursor-default">
                <div className="relative">
                  <div className={cn("absolute inset-0 bg-blue-500 blur-lg opacity-20 group-hover:opacity-40 transition-opacity rounded-full", isDarkMode ? "bg-blue-400" : "")} />
                  <div className={cn("relative p-2 rounded-2xl border transition-all duration-300 group-hover:scale-110", isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-gray-100 shadow-sm")}>
                    <Gauge size={24} className={cn("transform transition-transform duration-1000 group-hover:rotate-180", isDarkMode ? "text-blue-400" : "text-blue-600")} strokeWidth={2.5} />
                    <div className="absolute -bottom-1 -right-1">
                      <Zap size={12} className="text-yellow-400 fill-yellow-400 animate-pulse" />
                    </div>
                  </div>
                </div>
                <div className="flex flex-col">
                  <h1 className={cn("text-3xl font-black italic tracking-tighter leading-none transform -skew-x-6 flex items-center gap-1", isDarkMode ? "text-white" : "text-slate-900")}>
                    YOL<span className="text-blue-600">TAKİP</span>
                    <motion.div
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: 0.5, type: "spring" }}
                    >
                      <Car size={24} className={cn("transform -scale-x-100 ml-1 mb-1", isDarkMode ? "text-blue-400" : "text-blue-600")} strokeWidth={2.5} />
                    </motion.div>
                  </h1>
                  <div className="flex items-center gap-1.5 opacity-60">
                    <div className={cn("h-1 w-8 rounded-full", isDarkMode ? "bg-blue-500" : "bg-blue-600")} />
                    <div className={cn("h-1 w-2 rounded-full", isDarkMode ? "bg-blue-500" : "bg-blue-600")} />
                    <span className={cn("text-[8px] font-bold uppercase tracking-[0.2em]", isDarkMode ? "text-slate-400" : "text-slate-500")}>Hızlı & Güvenli</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400 font-bold uppercase tracking-widest opacity-60">
                  {format(currentTime, "EEEE, d MMMM", { locale: tr })}
                </span>
                <div className="h-1 w-1 rounded-full bg-gray-300" />
                <span className="text-sm text-blue-600 font-black tracking-tighter">
                  {format(currentTime, "HH:mm:ss")}
                </span>
              </div>
            </div>

            {/* Prayer Times Widget - Header Position */}
            <div className={cn("hidden xl:flex flex-1 mx-6 items-center justify-center p-2 rounded-2xl border backdrop-blur-md overflow-x-auto no-scrollbar h-[72px]", isDarkMode ? "bg-slate-800/80 border-slate-700" : "bg-white/60 border-white/50 shadow-sm")}>
              <div className="flex items-center gap-6 min-w-max">
                <div className="flex items-center gap-2 pr-4 border-r border-gray-100 opacity-80">
                  <div className="bg-emerald-50 p-1.5 rounded-lg text-emerald-600">
                    <Moon size={14} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold uppercase tracking-wider opacity-60">Namaz</span>
                    <span className="text-[10px] font-black leading-none">Ankara</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {[
                    { name: 'İmsak', time: '06:28' },
                    { name: 'Güneş', time: '07:53' },
                    { name: 'Öğle', time: '13:08' },
                    { name: 'İkindi', time: '15:53' },
                    { name: 'Akşam', time: '18:12' },
                    { name: 'Yatsı', time: '19:32' }
                  ].map((vakit, idx) => (
                    <div key={idx} className={cn(
                      "flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-lg transition-all",
                      idx === 4 ? "bg-emerald-50 ring-1 ring-emerald-100" : "hover:bg-gray-50/50"
                    )}>
                      <span className="text-[8px] font-bold uppercase opacity-50">{vakit.name}</span>
                      <span className={cn("text-[10px] font-black", idx === 4 ? "text-emerald-700" : isDarkMode ? "text-slate-200" : "text-gray-700")}>{vakit.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={toggleDarkMode} variant="ghost" size="icon" className={cn("h-9 w-9 rounded-full shadow-sm border transition-all", isDarkMode ? "bg-slate-800 border-slate-700 text-yellow-400" : "bg-white border-gray-100 text-gray-400")}>
                <Moon size={18} fill="currentColor" className={cn("transition-opacity", isDarkMode ? "opacity-100" : "opacity-20")} />
              </Button>
              {user && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0 border-2 border-white shadow-sm overflow-hidden">
                      <Avatar className="h-full w-full">
                        <AvatarImage src={user.photoURL || ""} alt={user.displayName || ""} />
                        <AvatarFallback>{user.displayName?.charAt(0) || "U"}</AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56 rounded-2xl" align="end" forceMount>
                    <DropdownMenuItem asChild>
                      <Link href="/admin" className="cursor-pointer w-full flex items-center rounded-xl p-2">
                        <Shield className="mr-2 h-4 w-4" />
                        <span>Yönetici Paneli</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive rounded-xl">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Çıkış Yap</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          {/* 5-Day Weather Widget */}
          <div className={cn("w-full backdrop-blur-md rounded-2xl border shadow-sm p-3 overflow-x-auto no-scrollbar", isDarkMode ? "bg-slate-800/80 border-slate-700" : "bg-white/60 border-white/50")}>
            <div className="flex items-center justify-between min-w-max gap-4">
              <div className="flex items-center gap-2 pr-4 border-r border-gray-100">
                <div className="bg-blue-50 p-2 rounded-xl text-blue-500">
                  <MapIcon size={16} />
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider opacity-60">Güzergah</div>
                  <div className={cn("text-xs font-black", isDarkMode ? "text-slate-200" : "text-gray-700")}>Etimesgut → Söğütözü</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {weatherForecast.map((day, idx) => (
                  <div key={idx} className={cn(
                    "flex flex-col items-center justify-center gap-1 min-w-[50px] p-2 rounded-xl transition-all",
                    idx === 0 ? "bg-blue-50/80 ring-1 ring-blue-100" : "hover:bg-gray-50"
                  )}>
                    <span className="text-[9px] font-bold text-gray-400 uppercase">
                      {idx === 0 ? "Bugün" : format(day.date, "EEE", { locale: tr })}
                    </span>
                    {getWeatherIcon(day.type)}
                    <div className="flex items-center gap-0.5">
                      <span className="text-[10px] font-black text-gray-700">{day.tempDay}°</span>
                      <span className="text-[8px] font-bold text-gray-400 hidden sm:inline">/{day.tempNight}°</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Morning Rush Background Visuals */}
        {isMorningRush && (
          <div className="absolute inset-x-0 top-0 h-64 overflow-hidden pointer-events-none opacity-20 z-0">
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ x: -100, y: Math.random() * 200 }}
                animate={{ x: 800 }}
                transition={{ duration: 10 + Math.random() * 10, repeat: Infinity, delay: i * 2 }}
                className="absolute text-blue-400"
              >
                <Car size={40} opacity={0.1} />
              </motion.div>
            ))}
          </div>
        )}



        {/* Today's Trip Summary Card */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <div className="bg-blue-100 p-1.5 rounded-lg text-blue-600"><TrendingUp size={16} strokeWidth={3} /></div>
            <h2 className={cn("text-base font-black tracking-tight", isDarkMode ? "text-white" : "text-[#1E293B]")}>Bugünün Yolculuğu</h2>
          </div>

          <div className="bg-white border border-gray-100 rounded-[2.5rem] shadow-xl shadow-blue-900/5 p-2">
            {todayTrip ? (
              <div className="flex flex-col md:flex-row md:items-center gap-4 p-4">
                {/* Date Part */}
                <div className="flex items-center gap-3 min-w-[140px]">
                  <div className="w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-black bg-blue-600 text-white shadow-md shadow-blue-200">
                    <span className="text-[10px] uppercase opacity-80 leading-none mb-0.5">{format(new Date(), "EEE", { locale: tr })}</span>
                    <span className="text-xl leading-none">{format(new Date(), "d")}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">{format(new Date(), "MMMM", { locale: tr })}</span>
                    <span className="text-xs font-black text-[#1E293B] leading-none">BUGÜN</span>
                  </div>
                </div>

                {/* Trip Data Part */}
                <div className="flex-1 flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Driver */}
                    <div className="flex items-center gap-3 bg-amber-50 p-3 rounded-2xl border border-amber-100/50">
                      <div className="bg-amber-100 p-2 rounded-xl text-amber-600"><Car size={18} /></div>
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-amber-700/50 uppercase tracking-widest">SÜRÜCÜ</span>
                        <span className="text-sm font-black text-amber-900 tracking-tight leading-none">
                          {members.find(m => m.uid === todayTrip.driverUid)?.name || "Bilinmiyor"}
                        </span>
                      </div>
                    </div>

                    {/* Participants */}
                    <div className="flex items-center gap-3 bg-blue-50 p-3 rounded-2xl border border-blue-100/50">
                      <div className="bg-blue-100 p-2 rounded-xl text-blue-600"><Users size={18} /></div>
                      <div className="flex flex-col overflow-hidden">
                        <span className="text-[9px] font-black text-blue-700/50 uppercase tracking-widest">KATILIMCILAR</span>
                        <span className="text-sm font-bold text-blue-900 truncate tracking-tight leading-none">
                          {todayTrip.participants?.map((p: string) => members.find(m => m.uid === p)?.name).filter(Boolean).join(", ")}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setIsSeatingPlanOpen(true)} className="h-10 w-10 md:w-auto p-0 md:px-6 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-600 border border-orange-100">
                      <span className="hidden md:inline font-black text-[10px] uppercase tracking-widest">Oturma Planı</span>
                      <span className="md:hidden"><Car size={18} /></span>
                    </Button>

                    <Button variant="ghost" size="sm" onClick={() => setIsDriverDialogOpen(true)} className="h-10 w-10 md:w-auto p-0 md:px-6 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-100">
                      <span className="hidden md:inline font-black text-[10px] uppercase tracking-widest">Düzenle</span>
                      <span className="md:hidden"><ChevronRight size={18} /></span>
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 gap-3 opacity-60">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
                  <Info size={24} />
                </div>
                <p className="text-sm font-bold text-gray-500">Bugün için planlanmış yolculuk yok.</p>
                <Button onClick={() => setIsDriverDialogOpen(true)} variant="outline" size="sm" className="mt-2">Planla</Button>
              </div>
            )}
          </div>
        </div>



        {/* Two Column Layout for Actions and Analysis */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Quick Actions column */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="bg-indigo-100 p-1.5 rounded-lg text-indigo-600"><Plus size={16} strokeWidth={3} /></div>
              <h2 className={cn("text-base font-black tracking-tight", isDarkMode ? "text-white" : "text-[#1E293B]")}>Hızlı İşlemler</h2>
            </div>
            <div className="space-y-3">
              {[
                { title: "Takvim", icon: CalendarIcon, color: "text-blue-500", bg: "bg-blue-50", desc: "Haftalık yolculuk planını düzenle.", href: "/calendar" },
                { title: "Grup", icon: Users, color: "text-indigo-500", bg: "bg-indigo-50", desc: "Yol arkadaşlarınla iletişime geç.", href: "/group" },
                { title: "Hesapla", icon: Calculator, color: "text-amber-500", bg: "bg-amber-50", desc: "Yakıt ve masraf dağılımını gör.", href: "/settlement" }
              ].map((item, i) => (
                <Link key={i} href={item.href} className="block">
                  <motion.div
                    whileTap={{ scale: 0.98 }}
                    className="bg-white py-3 px-4 rounded-3xl border border-gray-50 flex items-center justify-between shadow-sm hover:shadow-md transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn("p-3 rounded-2xl", item.bg, item.color)}><item.icon size={22} strokeWidth={2.5} /></div>
                      <div>
                        <h4 className="text-sm font-black text-[#1E293B]">{item.title}</h4>
                        <p className="text-[10px] text-gray-400 font-bold opacity-60 leading-none mt-1">{item.desc}</p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-gray-200 group-hover:text-blue-500 transition-colors" />
                  </motion.div>
                </Link>
              ))}
            </div>
          </div>

          {/* Analysis column */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-green-100 p-1.5 rounded-lg text-green-600"><TrendingUp size={16} strokeWidth={3} /></div>
              <h2 className={cn("text-base font-black tracking-tight", isDarkMode ? "text-white" : "text-[#1E293B]")}>Analiz & Trafik</h2>
            </div>
            <div className="bg-[#0B1C2D] rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl h-full flex flex-col justify-between">
              {/* Decorative background curves */}
              <div className="absolute inset-0 opacity-10">
                <svg viewBox="0 0 400 300" className="w-full h-full">
                  <path d="M-50,200 Q100,100 250,250 T500,100" stroke="white" strokeWidth="2" fill="none" />
                  <path d="M-50,250 Q150,150 300,300 T550,150" stroke="white" strokeWidth="1" fill="none" />
                </svg>
              </div>

              <div className="relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center mb-6 border border-white/10">
                  <MapIcon size={24} className="text-blue-400" />
                </div>
                <h3 className="text-2xl font-black mb-3">Güzergâh & Trafik</h3>
                <p className="text-xs text-blue-100/60 font-bold leading-relaxed max-w-[250px]">En hızlı rotayı keşfet ve canlı trafik verilerini incele.</p>
              </div>

              <div className="space-y-3 relative z-10 mt-8">
                <Link href="/map" className="block w-full">
                  <Button className="bg-white text-[#0B1C2D] hover:bg-blue-50 rounded-2xl p-6 font-black text-[13px] uppercase tracking-wider w-full shadow-lg group">
                    Rotayı Gör <ChevronRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>

                <Button
                  onClick={() => {
                    const now = new Date();
                    const currentHour = now.getHours();
                    const currentMinute = now.getMinutes();
                    // Check if it is evening (>= 17:30)
                    const isEvening = currentHour > 17 || (currentHour === 17 && currentMinute >= 30);

                    let destLat, destLng;
                    if (isEvening) {
                      // To Etimesgut (Precise)
                      destLat = 39.9475578;
                      destLng = 32.6642409;
                    } else {
                      // To Tarım Kredi (Precise)
                      destLat = 39.9168615;
                      destLng = 32.7900571;
                    }

                    // Open Google Maps Navigation
                    window.open(`https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&travelmode=driving`, '_blank');
                  }}
                  className="bg-green-600 text-white hover:bg-green-700 rounded-2xl p-6 font-black text-[13px] uppercase tracking-wider w-full shadow-lg group border border-green-500"
                >
                  <Navigation size={18} className="mr-2" />
                  Navigasyon Başlat
                </Button>
              </div>
            </div>
          </div>
        </div>


      </div>

      <Dialog open={isSeatingPlanOpen} onOpenChange={setIsSeatingPlanOpen}>
        <DialogContent className="sm:max-w-[800px] w-full max-h-[90vh] overflow-y-auto rounded-[2.5rem] p-0 border-none shadow-2xl bg-transparent">
          <div className="bg-white p-2 rounded-[2.5rem]">
            <SeatingPlan
              driver={members.find(m => m.uid === todayTrip?.driverUid)}
              participants={todayTrip?.participants?.map((id: string) => members.find(m => m.uid === id)).filter(Boolean) as UserProfile[] || []}
              className="bg-slate-100"
            />
            <div className="p-4 flex justify-center">
              <Button onClick={() => setIsSeatingPlanOpen(false)} variant="ghost" className="rounded-xl">Kapat</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDriverDialogOpen} onOpenChange={setIsDriverDialogOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-[#1E293B] p-6 text-white">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">Günün Planlaması</DialogTitle>
              <DialogDescription className="text-blue-100/60 font-medium">Şoför ve yolcuları düzenle</DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-6 space-y-6 bg-white">
            {/* Driver Section */}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Günün Şoförü</label>
              <Select onValueChange={(uid) => handleUpdateTrip({ driverUid: uid })} value={todayTrip?.driverUid || ""}>
                <SelectTrigger className="w-full h-14 rounded-2xl border-gray-100 bg-gray-50 font-bold px-4">
                  <SelectValue placeholder="Şoför Seç..." />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-gray-100 p-2">
                  {members.map((member) => (
                    <SelectItem key={member.uid} value={member.uid} className="rounded-xl py-3 font-bold">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={member.photoURL} />
                          <AvatarFallback>{member.name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        {member.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Participants Section */}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Yolcular</label>
              <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {members.map((member) => (
                  <div
                    key={member.uid}
                    onClick={() => toggleParticipant(member.uid)}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer",
                      todayTrip?.participants?.includes(member.uid)
                        ? "bg-blue-50 border-blue-100"
                        : "bg-gray-50 border-transparent opacity-60 grayscale hover:grayscale-0 hover:opacity-100"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 border-2 border-white shadow-sm">
                        <AvatarImage src={member.photoURL} />
                        <AvatarFallback>{member.name?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-bold text-[#1E293B]">{member.name}</span>
                    </div>
                    {todayTrip?.participants?.includes(member.uid) && (
                      <div className="bg-blue-500 text-white p-1 rounded-full"><CheckCircle2 size={14} /></div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <Button onClick={() => setIsDriverDialogOpen(false)} className="w-full h-14 rounded-2xl bg-[#1E293B] hover:bg-black font-black uppercase tracking-widest text-[11px] shadow-lg shadow-blue-900/20">
              KAYDET VE KAPAT
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
