"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { LogOut, User, Settings, Bell, Moon } from "lucide-react";
import Link from "next/link";

export const Header: React.FC = () => {
    const { user, profile, logout } = useAuth();

    return (
        <header className="sticky top-0 z-50 w-full bg-transparent">
            <div className="container flex h-14 items-center justify-between px-6">
                <div>
                    {/* Left side empty */}
                </div>

                <div className="flex items-center space-x-3">
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full bg-white shadow-sm border border-gray-100 text-gray-400 hover:text-gray-900 transition-all">
                        <Moon size={18} fill="currentColor" className="opacity-20" />
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
                                <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive rounded-xl">
                                    <LogOut className="mr-2 h-4 w-4" />
                                    <span>Çıkış Yap</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            </div>
        </header>
    );
};

const DateTimeDisplay = () => {
    const [time, setTime] = React.useState(new Date());

    React.useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    return (
        <span>{time.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
    );
};
