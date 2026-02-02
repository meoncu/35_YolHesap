"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
    onAuthStateChanged,
    User,
    signInWithPopup,
    GoogleAuthProvider,
    signOut
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";

interface AuthContextType {
    user: User | null;
    loading: boolean;
    profile: any | null;
    signInWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [profileLoading, setProfileLoading] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setUser(user);
            setLoading(false); // Auth is determined, stop global loading

            if (user) {
                setProfileLoading(true);
                try {
                    const userDoc = await getDoc(doc(db, "users", user.uid));
                    if (userDoc.exists()) {
                        const data = userDoc.data();
                        const isAdmin = user.email === 'meoncu@gmail.com';
                        const currentRole = isAdmin ? "admin" : "user";

                        // If DB role is different from what it should be based on email, update it
                        if (data.role !== currentRole) {
                            await updateDoc(doc(db, "users", user.uid), { role: currentRole });
                            setProfile({ ...data, role: currentRole });
                        } else {
                            setProfile(data);
                        }
                    } else {
                        const isAdmin = user.email === 'meoncu@gmail.com';
                        const newProfile = {
                            uid: user.uid,
                            name: user.displayName,
                            email: user.email,
                            photoURL: user.photoURL,
                            role: isAdmin ? "admin" : "user",
                            phone: "",
                            createdAt: serverTimestamp(),
                        };
                        await setDoc(doc(db, "users", user.uid), newProfile);
                        setProfile(newProfile);
                    }
                } catch (error) {
                    console.error("Error fetching/creating profile:", error);
                    setProfile({
                        uid: user.uid,
                        name: user.displayName,
                        email: user.email,
                        photoURL: user.photoURL,
                        role: user.email === 'meoncu@gmail.com' ? "admin" : "user",
                        phone: "",
                        offline: true
                    });
                } finally {
                    setProfileLoading(false);
                }
            } else {
                setProfile(null);
                setProfileLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    const signInWithGoogle = async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (error: any) {
            console.error("Error signing in with Google", error);
            const errorMessage = error.code === 'auth/popup-closed-by-user'
                ? 'Giriş penceresi kapatıldı.'
                : 'Giriş yapılırken bir hata oluştu.';
            // We can't use toast here directly without importing it, 
            // but we can pass it via context if needed or just handle it in the component.
            throw error;
        }
    };

    const logout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Error signing out", error);
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, profile, signInWithGoogle, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};
