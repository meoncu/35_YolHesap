"use client";

import React from "react";
import { Header } from "./Header";

import { useAuth } from "@/context/AuthContext";
import { AuthGuard } from "@/components/auth/AuthGuard";

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { loading } = useAuth();

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#F8FAFB]">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#143A5A] border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col bg-[#F8FAFB]">
            {/* <Header /> Removed for dashboard layout optimization */}
            <main className="flex-1 pb-20 md:pb-0 pt-4">
                <AuthGuard>
                    <div className="container mx-auto max-w-4xl p-4">
                        {children}
                    </div>
                </AuthGuard>
            </main>

        </div>
    );
};
