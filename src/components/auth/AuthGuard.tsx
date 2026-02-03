"use client";

import React, { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";

export const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, profile, loading, profileLoading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (!loading && !profileLoading) {
            if (!user && pathname !== "/login") {
                router.push("/login");
            } else if (user && pathname !== "/pending-approval") {
                // If user exists, wait for profile to check approval
                if (profile && profile.isApproved === false && pathname !== "/pending-approval") {
                    router.push("/pending-approval");
                }
            } else if (user && profile?.isApproved === true && pathname === "/pending-approval") {
                router.push("/");
            }
        }
    }, [user, loading, profile, profileLoading, router, pathname]);

    if (loading || (user && profileLoading)) return null;

    // Allow login page access
    if (pathname === "/login") return <>{children}</>;

    // If not logged in and not on login page, wait for redirect
    if (!user) return null;

    // If logged in but not approved, only allow /pending-approval
    if (profile?.isApproved === false && pathname !== "/pending-approval") return null;

    // If approved, don't allow /pending-approval
    if (profile?.isApproved === true && pathname === "/pending-approval") return null;

    return <>{children}</>;
};
