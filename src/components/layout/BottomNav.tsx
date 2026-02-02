"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Plus, Bell, User } from "lucide-react";
import { cn } from "@/lib/utils";

export const BottomNav: React.FC = () => {
    const pathname = usePathname();

    const navItems = [
        { name: "Ana Sayfa", href: "/", icon: Home },
        { name: "Ara", href: "/search", icon: Search },
        { name: "Ekle", href: "/add", icon: Plus, isAction: true },
        { name: "Bildirimler", href: "/notifications", icon: Bell },
        { name: "Profil", href: "/profile", icon: User },
    ];

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-[400px] px-4">
            <nav className="bg-[#1E293B] border border-white/5 backdrop-blur-xl rounded-[2rem] shadow-2xl overflow-visible">
                <div className="flex h-20 items-center justify-around px-2 relative">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;

                        if (item.isAction) {
                            return (
                                <button
                                    key={item.name}
                                    className="relative -top-1 w-14 h-14 rounded-full bg-[#4ADE80] flex items-center justify-center text-[#1E293B] shadow-[0_8px_20px_rgba(74,222,128,0.3)] hover:scale-105 transition-all"
                                >
                                    <Plus size={32} strokeWidth={3} />
                                </button>
                            );
                        }

                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={cn(
                                    "flex flex-col items-center justify-center transition-all px-2",
                                    isActive ? "text-white" : "text-gray-400 hover:text-white"
                                )}
                            >
                                <item.icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                            </Link>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
};
