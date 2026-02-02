"use client";

import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Phone, UserPlus, Settings, MoreHorizontal, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { UserProfile, Group } from "@/types";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { getUsers, updateUserProfile } from "@/lib/db-service";

export default function GroupPage() {
    const { profile, user } = useAuth();
    const [group, setGroup] = useState<Group | null>(null);
    const [members, setMembers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);

    // Edit Name State
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
    const [newName, setNewName] = useState("");

    useEffect(() => {
        const fetchGroupData = async () => {
            setLoading(true);
            try {
                const fetchedUsers = await getUsers();
                setMembers(fetchedUsers);

                // For now, setting a default group info since we haven't implemented group creation UI
                setGroup({
                    id: "main-group",
                    name: "YolPay Grubu",
                    dailyFee: 100,
                    members: fetchedUsers.map(u => u.uid),
                    adminId: "meoncu@gmail.com" // Placeholder logic
                });
            } catch (error) {
                console.error("Error fetching group data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchGroupData();
    }, []);

    const openEditDialog = (member: UserProfile) => {
        setEditingUser(member);
        setNewName(member.name || "");
        setIsEditDialogOpen(true);
    };

    const handleUpdateName = async () => {
        if (!editingUser || !newName.trim()) return;

        try {
            await updateUserProfile(editingUser.uid, { name: newName });

            // Update local state
            setMembers(members.map(m =>
                m.uid === editingUser.uid ? { ...m, name: newName } : m
            ));

            toast.success("Kullanıcı ismi güncellendi");
            setIsEditDialogOpen(false);
        } catch (error) {
            console.error("Error updating name:", error);
            toast.error("İsim güncellenirken bir hata oluştu");
        }
    };

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
                            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Grup Üyeleri</h1>
                            <p className="text-gray-500">{group?.name || "YolPay Grubu"}</p>
                        </div>
                    </div>
                    {profile?.role === 'admin' && (
                        <Button size="icon" variant="outline" className="rounded-full shadow-sm">
                            <UserPlus size={20} />
                        </Button>
                    )}
                </header>

                {/* members List */}
                <div className="space-y-3">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest pl-1">Üye Listesi</h3>

                    <div className="grid gap-3">
                        {loading ? (
                            <div className="flex justify-center py-12">
                                <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#143A5A] border-t-transparent"></div>
                            </div>
                        ) : members.length > 0 ? (
                            members.map((member, i) => (
                                <motion.div
                                    key={member.uid}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: i * 0.05 }}
                                >
                                    <Card className="border-none shadow-sm hover:shadow-md transition-all overflow-hidden bg-white">
                                        <CardContent className="p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-12 w-12 border-2 border-gray-50 shadow-sm">
                                                    <AvatarImage src={member.photoURL} />
                                                    <AvatarFallback className="bg-blue-50 text-[#143A5A] font-bold">
                                                        {member.name?.charAt(0) || "U"}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-semibold text-gray-900">{member.name}</p>
                                                        {member.role === 'admin' && (
                                                            <span className="px-1.5 py-0.5 bg-[#E9EDF2] text-[#143A5A] rounded text-[10px] uppercase font-heavy">Admin</span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-gray-500">{member.email}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {member.phone && (
                                                    <a href={`tel:${member.phone}`}>
                                                        <Button size="icon" variant="ghost" className="h-9 w-9 rounded-full bg-green-50 text-green-600 hover:bg-green-100 transition-colors">
                                                            <Phone size={18} />
                                                        </Button>
                                                    </a>
                                                )}
                                                {profile?.role === 'admin' && (
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button size="icon" variant="ghost" className="h-9 w-9 rounded-full text-gray-400">
                                                                <MoreHorizontal size={18} />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onClick={() => openEditDialog(member)}>
                                                                <Settings className="mr-2 h-4 w-4" />
                                                                <span>İsim Düzenle</span>
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ))
                        ) : (
                            <p className="text-center py-12 text-gray-500">Henüz üye bulunamadı.</p>
                        )}
                    </div>
                </div>

                {profile?.role === 'admin' && (
                    <div className="pt-4 pb-12">
                        <Button className="w-full h-12 gradient-primary shadow-lg flex items-center gap-2">
                            <Settings size={20} />
                            Grup Ayarlarını Düzenle
                        </Button>
                    </div>
                )}
            </div>

            {/* Edit Name Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Üye İsmini Düzenle</DialogTitle>
                        <DialogDescription>
                            Bu kullanıcının site genelinde görünecek ismini değiştirebilirsiniz.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Görünen İsim</label>
                            <Input
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder="İsim Soyisim"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="rounded-xl">İptal</Button>
                        <Button onClick={handleUpdateName} className="bg-blue-600 hover:bg-blue-700 rounded-xl">Kaydet</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
