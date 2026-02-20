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
    deleteDoc,
    limit
} from "firebase/firestore";

import { db } from "./firebase";
import { Trip, UserProfile, Group, DrivingTrack } from "@/types";
import { format } from "date-fns";
import { calculateRouteDistance, getFuelPrices } from "./fuel-service";

// User Services
export const getUsers = async (): Promise<UserProfile[]> => {
    const querySnapshot = await getDocs(collection(db, "users"));
    return querySnapshot.docs.map(doc => ({ ...doc.data() as UserProfile }));
};

export const getApprovedUsers = async (): Promise<UserProfile[]> => {
    try {
        const q = query(collection(db, "users"), where("isApproved", "==", true));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ ...doc.data() as UserProfile }));
    } catch (error) {
        console.error("Error fetching users:", error);
        return [];
    }
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

export const createManualUser = async (name: string): Promise<string> => {
    const uid = `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newProfile: UserProfile = {
        uid,
        name,
        email: "",
        phone: "",
        role: 'user',
        isApproved: true,
        createdAt: serverTimestamp() as any
    };
    await setDoc(doc(db, "users", uid), newProfile);
    return uid;
};

export const getUserByEmail = async (email: string): Promise<UserProfile | null> => {
    const q = query(collection(db, "users"), where("email", "==", email));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return snapshot.docs[0].data() as UserProfile;
};


// Trip Services
export const saveTrip = async (trip: Trip) => {
    // Ensure fuel prices for this date are fetched and stored
    try {
        await getFuelPrices(trip.date);
    } catch (e) {
        console.error("Failed to pre-fetch fuel prices for trip date:", e);
    }

    const tripRef = doc(collection(db, "trips"), `${trip.date}_${trip.groupId}`);
    await setDoc(tripRef, {
        ...trip,
        updatedAt: serverTimestamp()
    }, { merge: true });
};

export const deleteTrip = async (date: string, groupId: string = "main-group") => {
    const tripRef = doc(collection(db, "trips"), `${date}_${groupId}`);
    await deleteDoc(tripRef);
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
    try {
        const querySnapshot = await getDocs(collection(db, "trips"));
        return querySnapshot.docs.map(doc => {
            const data = doc.data() as Trip;
            return { ...data, id: doc.id };
        });
    } catch (error) {
        console.error("Error fetching all trips:", error);
        return [];
    }
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

export const getLatestLocation = async (uid: string) => {
    const today = format(new Date(), "yyyy-MM-dd");
    const q = query(
        collection(db, "routes"),
        where("date", "==", today),
        where("uid", "==", uid),
        orderBy("timestamp", "desc"),
        limit(1)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return snapshot.docs[0].data() as { latitude: number, longitude: number, timestamp: any };
};


export const getGroups = async (): Promise<Group[]> => {
    const querySnapshot = await getDocs(collection(db, "groups"));
    return querySnapshot.docs.map(doc => {
        const data = doc.data() as Group;
        return { ...data, id: doc.id };
    });
};

// end group services

// Driving Track Services
export const saveDrivingTrack = async (track: DrivingTrack) => {
    const trackRef = doc(collection(db, "drivingTracks"), `${track.date}_${track.userId}_${track.type}`);
    await setDoc(trackRef, {
        ...track,
        updatedAt: serverTimestamp()
    }, { merge: true });
};

export const getDrivingTracks = async (userId: string, month: string): Promise<DrivingTrack[]> => {
    // month format "YYYY-MM"
    const tracksRef = collection(db, "drivingTracks");
    const q = query(
        tracksRef,
        where("userId", "==", userId),
        where("date", ">=", `${month}-01`),
        where("date", "<=", `${month}-31`),
        orderBy("date", "desc")
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ ...doc.data() as DrivingTrack, id: doc.id }));
};

export const getAllDrivingTracks = async (month: string): Promise<DrivingTrack[]> => {
    const tracksRef = collection(db, "drivingTracks");
    const q = query(
        tracksRef,
        where("date", ">=", `${month}-01`),
        where("date", "<=", `${month}-31`),
        orderBy("date", "desc")
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ ...doc.data() as DrivingTrack, id: doc.id }));
};

export const getTracksByDateRange = async (startDate: string, endDate: string, userId?: string): Promise<DrivingTrack[]> => {
    const tracksRef = collection(db, "drivingTracks");
    let q;
    if (userId) {
        q = query(
            tracksRef,
            where("userId", "==", userId),
            where("date", ">=", startDate),
            where("date", "<=", endDate),
            orderBy("date", "desc")
        );
    } else {
        q = query(
            tracksRef,
            where("date", ">=", startDate),
            where("date", "<=", endDate),
            orderBy("date", "desc")
        );
    }
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ ...doc.data() as DrivingTrack, id: doc.id }));
};


export const calculateAndSaveTripDistance = async (tripId: string, date: string, driverUid: string) => {
    try {
        const points = await getRoute(date, driverUid);
        if (!points || points.length < 2) return 0;

        const routePoints = points.map((p: any) => ({
            latitude: p.latitude,
            longitude: p.longitude
        }));

        const distanceKm = calculateRouteDistance(routePoints);

        // Update Trip
        // tripId is typically "YYYY-MM-DD_groupId" but might be different if passed directly
        // Assuming we pass the pure ID or constructing it. 
        // Let's assume we update by constructing reference if we know the ID structure
        // or passing the doc reference path.
        // Actually, let's look at saveTrip: doc(collection(db, "trips"), `${trip.date}_${trip.groupId}`);
        // So tripId matches `${date}_main-group` usually.

        // For safety, let's assume tripId is the full doc ID
        const tripRef = doc(db, "trips", tripId);
        await updateDoc(tripRef, {
            distanceKm: distanceKm
        });

        return distanceKm;
    } catch (error) {
        console.error("Error calculating/saving distance:", error);
        return 0;
    }
};

// Global Settings
export interface AppSettings {
    dailyFee: number;
    previousDailyFee?: number;
    feeEffectiveDate?: string; // YYYY-MM-DD
    updatedAt?: any;
}

const DEFAULT_SETTINGS: AppSettings = {
    dailyFee: 100,
    previousDailyFee: 100,
    feeEffectiveDate: "2024-01-01"
};

export const getAppSettings = async (): Promise<AppSettings> => {
    try {
        const settingsRef = doc(db, "settings", "global");
        const settingsSnap = await getDoc(settingsRef);

        if (settingsSnap.exists()) {
            return { ...DEFAULT_SETTINGS, ...settingsSnap.data() } as AppSettings;
        }

        return DEFAULT_SETTINGS;
    } catch (error) {
        console.error("Error fetching settings:", error);
        return DEFAULT_SETTINGS;
    }
};

export const updateAppSettings = async (data: Partial<AppSettings>) => {
    const settingsRef = doc(db, "settings", "global");
    await setDoc(settingsRef, {
        ...data,
        updatedAt: serverTimestamp()
    }, { merge: true });
};
