"use client";

import React, { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";

export const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (!loading && !user && pathname !== "/login") {
            router.push("/login");
        }
    }, [user, loading, router, pathname]);

    if (loading) return null;
    if (!user && pathname !== "/login") return null;

    return <>{children}</>;
};
