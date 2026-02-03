import React from 'react';
import { UserProfile } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface SeatingPlanProps {
    driver: UserProfile | undefined;
    participants: UserProfile[];
    className?: string;
    mini?: boolean;
}

export const SeatingPlan: React.FC<SeatingPlanProps> = ({ driver, participants, className, mini = false }) => {
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
            "relative rounded-xl flex flex-col items-center justify-center border-2 transition-all p-1",
            mini ? "w-14 h-16" : "w-32 h-36",
            user ? (isDriver ? "bg-amber-100 dark:bg-amber-900/30 border-amber-500 shadow-md" : "bg-blue-50 dark:bg-blue-900/30 border-blue-400 dark:border-blue-500/50 shadow-sm")
                : "bg-muted/50 border-dashed border-border"
        )}>
            {/* Seat Headrest Visual */}
            <div className={cn("absolute bg-current opacity-20 rounded-full", mini ? "-top-1.5 w-8 h-1.5" : "-top-4 w-20 h-4")} />

            {user ? (
                <>
                    <Avatar className={cn("border-2 shadow-sm mb-1", mini ? "w-8 h-8" : "w-20 h-20", isDriver ? "border-amber-200 dark:border-amber-500/50" : "border-card")}>
                        <AvatarImage src={user.photoURL} />
                        <AvatarFallback className={cn("font-bold", mini ? "text-[8px]" : "text-2xl", isDriver ? "bg-amber-300 dark:bg-amber-700 text-amber-950 dark:text-amber-100" : "bg-blue-300 dark:bg-blue-700 text-blue-950 dark:text-blue-100")}>
                            {user.name?.charAt(0)}
                        </AvatarFallback>
                    </Avatar>
                    <span className={cn("font-black text-center leading-tight line-clamp-1 w-full px-1 text-foreground", mini ? "text-[7px]" : "text-[12px]")}>
                        {user.name?.split(' ')[0]}
                    </span>
                    {isDriver && (
                        <span className={cn("absolute bg-amber-500 text-white px-2 py-1 rounded-full font-bold uppercase tracking-wider shadow-sm", mini ? "-top-1 -right-1 text-[5px]" : "-top-3 -right-3 text-[9px]")}>
                            ŞOFÖR
                        </span>
                    )}
                </>
            ) : (
                <span className={cn("font-bold text-muted-foreground uppercase tracking-widest text-center opacity-50", mini ? "text-[6px] mt-1" : "text-[11px] mt-2")}>
                    {label || "Boş"}
                </span>
            )}
        </div>
    );

    return (
        <div className={cn("relative bg-muted rounded-[2rem] shadow-inner select-none overflow-hidden", mini ? "p-3" : "p-6", className)}>

            {/* Car Shape Outline */}
            <div className="absolute inset-0 border-8 border-background rounded-[3rem] pointer-events-none opacity-50" />

            {/* Dashboard / Steering Wheel Area */}
            <div className={cn("absolute top-0 inset-x-0 bg-gradient-to-b from-foreground/10 to-transparent rounded-t-[3rem] pointer-events-none", mini ? "h-24" : "h-40")} />

            <div className={cn("relative flex flex-col items-center", mini ? "gap-2" : "gap-10")}>

                {/* Front Row */}
                <div className={cn("flex justify-between w-full gap-4", mini ? "max-w-[140px]" : "max-w-[340px]")}>
                    <div className="flex flex-col items-center gap-1">
                        <Seat user={driver} isDriver label="Şoför" />
                        {/* Steering Wheel Visual */}
                        <div className={cn("bg-muted-foreground/30 rounded-full", mini ? "w-10 h-0.5 mt-0.5" : "w-16 h-1 mt-1")} />
                    </div>

                    <div className="flex flex-col items-center gap-1">
                        <Seat user={frontPassenger} label="Yolcu" />
                        <div className={cn("bg-transparent", mini ? "w-10 h-0.5 mt-0.5" : "w-16 h-1 mt-1")} />
                    </div>
                </div>

                {/* Center Console Visual */}
                <div className={cn("bg-muted-foreground/10 rounded-xl z-0", mini ? "w-10 h-8 my-[-6px]" : "w-16 h-12 my-[-10px]")} />

                {/* Rear Row */}
                <div className={cn("flex justify-center w-full", mini ? "gap-1" : "gap-2")}>
                    <Seat user={rearPassengers[0]} label="Arka Sol" />
                    <Seat user={rearPassengers[1]} label="Orta" />
                    <Seat user={rearPassengers[2]} label="Arka Sağ" />
                </div>
            </div>

            {/* Car Label */}
            {!mini && (
                <div className="absolute bottom-3 inset-x-0 text-center">
                    <span className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-[0.3em]">Oturma Planı</span>
                </div>
            )}
        </div>
    );
};
