import React from 'react';
import { UserProfile } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface SeatingPlanProps {
    driver: UserProfile | undefined;
    participants: UserProfile[];
    className?: string;
}

export const SeatingPlan: React.FC<SeatingPlanProps> = ({ driver, participants, className }) => {
    // Exclude driver from participants list to avoid duplication if they are in both
    const passengers = participants.filter(p => p.uid !== driver?.uid);

    // Assign seats
    // Seat 0: Front Passenger (1)
    // Seat 1: Rear Left (2)
    // Seat 2: Rear Center (3)
    // Seat 3: Rear Right (4)
    const frontPassenger = passengers[0];
    const rearPassengers = passengers.slice(1, 4);

    const Seat = ({ user, isDriver = false, label }: { user?: UserProfile, isDriver?: boolean, label?: string }) => (
        <div className={cn(
            "relative w-24 h-28 rounded-2xl flex flex-col items-center justify-center border-2 transition-all p-2",
            user ? (isDriver ? "bg-amber-100 dark:bg-amber-900/30 border-amber-500 shadow-md" : "bg-blue-50 dark:bg-blue-900/30 border-blue-400 dark:border-blue-500/50 shadow-sm")
                : "bg-muted/50 border-dashed border-border"
        )}>
            {/* Seat Headrest Visual */}
            <div className="absolute -top-3 w-16 h-3 bg-current opacity-20 rounded-full" />

            {user ? (
                <>
                    <Avatar className={cn("w-14 h-14 border-2 shadow-sm mb-1", isDriver ? "border-amber-200 dark:border-amber-500/50" : "border-card")}>
                        <AvatarImage src={user.photoURL} />
                        <AvatarFallback className={isDriver ? "bg-amber-200 dark:bg-amber-700 text-amber-800 dark:text-amber-100" : "bg-blue-200 dark:bg-blue-700 text-blue-800 dark:text-blue-100"}>
                            {user.name?.charAt(0)}
                        </AvatarFallback>
                    </Avatar>
                    <span className="text-[10px] font-black text-center leading-tight line-clamp-2 w-full px-1 text-foreground">
                        {user.name?.split(' ')[0]}
                    </span>
                    {isDriver && (
                        <span className="absolute -top-2 -right-2 bg-amber-500 text-white text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider shadow-sm">
                            ŞOFÖR
                        </span>
                    )}
                </>
            ) : (
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest text-center mt-2 opacity-50">
                    {label || "Boş"}
                </span>
            )}
        </div>
    );

    return (
        <div className={cn("relative p-6 bg-muted rounded-[3rem] shadow-inner select-none overflow-hidden", className)}>

            {/* Car Shape Outline */}
            <div className="absolute inset-0 border-8 border-background rounded-[3rem] pointer-events-none opacity-50" />

            {/* Dashboard / Steering Wheel Area */}
            <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-foreground/10 to-transparent rounded-t-[3rem] pointer-events-none" />

            <div className="relative flex flex-col gap-6 items-center">

                {/* Front Row */}
                <div className="flex justify-between w-full max-w-[280px] gap-8">
                    <div className="flex flex-col items-center gap-1">
                        <Seat user={driver} isDriver label="Şoför" />
                        {/* Steering Wheel Visual */}
                        <div className="w-16 h-1 mt-1 bg-muted-foreground/30 rounded-full" />
                    </div>

                    <div className="flex flex-col items-center gap-1">
                        <Seat user={frontPassenger} label="Yolcu" />
                        <div className="w-16 h-1 mt-1 bg-transparent" />
                    </div>
                </div>

                {/* Center Console Visual */}
                <div className="w-16 h-12 bg-muted-foreground/10 rounded-xl my-[-10px] z-0" />

                {/* Rear Row */}
                <div className="flex justify-center w-full gap-2">
                    <Seat user={rearPassengers[0]} label="Arka Sol" />
                    <Seat user={rearPassengers[1]} label="Orta" />
                    <Seat user={rearPassengers[2]} label="Arka Sağ" />
                </div>
            </div>

            {/* Car Label */}
            <div className="absolute bottom-3 inset-x-0 text-center">
                <span className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-[0.3em]">Oturma Planı</span>
            </div>
        </div>
    );
};
