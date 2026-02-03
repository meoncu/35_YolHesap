"use client";

import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import {
    TrendingUp,
    TrendingDown,
    ArrowRightLeft,
    Download,
    ChevronRight,
    Wallet,
    ArrowUpRight,
    ArrowDownRight,
    ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import Link from "next/link";

// Mock data for finance
const MOCK_SETTLEMENTS = [
    { userId: "1", userName: "Ahmet Yılmaz", totalDebt: 400, totalCredit: 1200, netAmount: 800 },
    { userId: "2", userName: "Mehmet Demir", totalDebt: 1200, totalCredit: 400, netAmount: -800 },
    { userId: "3", userName: "Ayşe Kaya", totalDebt: 800, totalCredit: 400, netAmount: -400 },
    { userId: "4", userName: "Fatma Şahin", totalDebt: 400, totalCredit: 800, netAmount: 400 },
];

export default function FinancePage() {
    const { profile } = useAuth();

    // Logic to find who should pay whom
    const getPayments = () => {
        const debtors = MOCK_SETTLEMENTS.filter(s => s.netAmount < 0).sort((a, b) => a.netAmount - b.netAmount);
        const creditors = MOCK_SETTLEMENTS.filter(s => s.netAmount > 0).sort((a, b) => b.netAmount - a.netAmount);

        // Simple greedy algorithm for demonstration
        const payments = [
            { from: "Mehmet Demir", to: "Ahmet Yılmaz", amount: 800 },
            { from: "Ayşe Kaya", to: "Fatma Şahin", amount: 400 }
        ];

        return payments;
    };

    const mySettlement = MOCK_SETTLEMENTS.find(s => s.userName === profile?.name) || MOCK_SETTLEMENTS[0];

    return (
        <AppLayout>
            <div className="space-y-6">
                <header className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/">
                            <Button variant="ghost" size="icon" className="rounded-full">
                                <ArrowLeft size={20} />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-foreground">Ay Sonu Hesap Özeti</h1>
                            <p className="text-muted-foreground">Ocak 2026 Dönemi</p>
                        </div>
                    </div>
                    <Button size="icon" variant="outline" className="rounded-full">
                        <Download size={20} />
                    </Button>
                </header>

                {/* My Status Overview */}
                <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="border-border shadow-md overflow-hidden bg-card">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Net Durum</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-baseline gap-2">
                                <p className={`text-3xl font-extrabold ${mySettlement.netAmount >= 0 ? "text-green-500" : "text-red-500"}`}>
                                    {mySettlement.netAmount >= 0 ? "+" : ""} ₺{mySettlement.netAmount}
                                </p>
                                <span className="text-xs text-muted-foreground font-medium">Bu Ay</span>
                            </div>
                            <div className="mt-4 flex gap-4">
                                <div className="flex items-center gap-2">
                                    <div className="p-1 bg-red-500/10 text-red-500 rounded">
                                        <ArrowDownRight size={14} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-muted-foreground font-bold uppercase">Borç</p>
                                        <p className="text-sm font-bold text-foreground">₺{mySettlement.totalDebt}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="p-1 bg-green-500/10 text-green-500 rounded">
                                        <ArrowUpRight size={14} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-muted-foreground font-bold uppercase">Alacak</p>
                                        <p className="text-sm font-bold text-foreground">₺{mySettlement.totalCredit}</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </section>

                {/* Net Payments (Kim kime) */}
                <section className="space-y-3">
                    <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest pl-1">Ödeme Planı</h3>
                    <div className="grid gap-3">
                        {getPayments().map((payment, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                            >
                                <Card className="border-border shadow-sm bg-card overflow-hidden">
                                    <CardContent className="p-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="text-left">
                                                    <p className="text-xs text-muted-foreground font-bold uppercase">Ödeyen</p>
                                                    <p className="font-semibold text-foreground">{payment.from}</p>
                                                </div>
                                                <div className="flex flex-col items-center">
                                                    <div className="h-0.5 w-8 bg-muted relative">
                                                        <ChevronRight size={12} className="absolute right-[-4px] top-[-5px] text-muted-foreground" />
                                                    </div>
                                                    <span className="text-[10px] text-primary font-bold mt-1">₺{payment.amount}</span>
                                                </div>
                                                <div className="text-left">
                                                    <p className="text-xs text-muted-foreground font-bold uppercase">Alıcı</p>
                                                    <p className="font-semibold text-foreground">{payment.to}</p>
                                                </div>
                                            </div>
                                            <Button size="sm" variant="ghost" className="text-primary font-bold hover:bg-primary/10">
                                                Bildir
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                </section>

                {/* Detailed Table */}
                <section className="space-y-3">
                    <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest pl-1">Üye Detayları</h3>
                    <Card className="border-border shadow-md overflow-hidden bg-card">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="font-bold text-primary">Üye</TableHead>
                                    <TableHead className="text-right font-bold text-primary">Borç</TableHead>
                                    <TableHead className="text-right font-bold text-primary">Alacak</TableHead>
                                    <TableHead className="text-right font-bold text-primary">Net</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {MOCK_SETTLEMENTS.map((row) => (
                                    <TableRow key={row.userId} className="border-border">
                                        <TableCell className="font-medium text-foreground">{row.userName}</TableCell>
                                        <TableCell className="text-right text-red-500 font-medium">₺{row.totalDebt}</TableCell>
                                        <TableCell className="text-right text-green-500 font-medium">₺{row.totalCredit}</TableCell>
                                        <TableCell className={`text-right font-extrabold ${row.netAmount >= 0 ? "text-green-500" : "text-red-500"}`}>
                                            ₺{row.netAmount}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>
                </section>

                <div className="pt-4 pb-12 flex items-center justify-center gap-2 text-muted-foreground text-xs">
                    <Wallet size={14} />
                    <span>Hesaplamalar günlük sabit ücret üzerinden otomatik yapılmaktadır.</span>
                </div>
            </div>
        </AppLayout>
    );
}
