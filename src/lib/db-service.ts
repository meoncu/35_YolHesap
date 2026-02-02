import {
    collection,
    doc,
    getDocs,
    getDoc,
    setDoc,
    updateDoc,
    query,
    where,
    serverTimestamp,
    orderBy,
    deleteDoc
} from "firebase/firestore";
import { db } from "./firebase";
import { Trip, UserProfile, Group } from "@/types";

// User Services
export const getUsers = async (): Promise<UserProfile[]> => {
    const querySnapshot = await getDocs(collection(db, "users"));
    return querySnapshot.docs.map(doc => ({ ...doc.data() as UserProfile }));
};

export const updateUserProfile = async (uid: string, data: Partial<UserProfile>) => {
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, {
        ...data,
        updatedAt: serverTimestamp()
    });
};

export const deleteUserProfile = async (uid: string) => {
    await deleteDoc(doc(db, "users", uid));
};

// Trip Services
export const saveTrip = async (trip: Trip) => {
    const tripRef = doc(collection(db, "trips"), `${trip.date}_${trip.groupId}`);
    await setDoc(tripRef, {
        ...trip,
        updatedAt: serverTimestamp()
    }, { merge: true });
};

export const getTripsByMonth = async (month: string) => {
    // month format "YYYY-MM"
    const tripsRef = collection(db, "trips");
    const q = query(
        tripsRef,
        where("date", ">=", `${month}-01`),
        where("date", "<=", `${month}-31`),
        orderBy("date", "asc")
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
        const data = doc.data() as Trip;
        return { ...data, id: doc.id };
    });
};

export const getAllTrips = async (): Promise<Trip[]> => {
    const querySnapshot = await getDocs(collection(db, "trips"));
    return querySnapshot.docs.map(doc => {
        const data = doc.data() as Trip;
        return { ...data, id: doc.id };
    });
};

// Location Services
export const saveLocation = async (uid: string, latitude: number, longitude: number) => {
    const today = format(new Date(), "yyyy-MM-dd");
    const locationRef = doc(collection(db, "routes"), `${today}_${uid}_${Date.now()}`);
    await setDoc(locationRef, {
        uid,
        latitude,
        longitude,
        timestamp: serverTimestamp(),
        date: today
    });
};

export const getRoute = async (date: string, uid: string) => {
    const q = query(
        collection(db, "routes"),
        where("date", "==", date),
        where("uid", "==", uid),
        orderBy("timestamp", "asc")
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data());
};

// Group Services
export const getGroups = async (): Promise<Group[]> => {
    const querySnapshot = await getDocs(collection(db, "groups"));
    return querySnapshot.docs.map(doc => {
        const data = doc.data() as Group;
        return { ...data, id: doc.id };
    });
};

import { format } from "date-fns";
