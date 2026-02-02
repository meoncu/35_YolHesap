import axios from 'axios';
import { db } from './firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { format, parseISO } from 'date-fns';

export interface FuelPriceData {
    benzin: number;
    motorin: number;
    lpg: number;
    lastUpdated?: any;
    date: string; // YYYY-MM-DD
}

/**
 * Fetches fuel prices for a specific date. 
 * Checks Firestore first, if not found pulls from API and saves.
 */
export const getFuelPrices = async (targetDate: string = format(new Date(), "yyyy-MM-dd")): Promise<FuelPriceData> => {
    try {
        // 1. Try Firestore cache first
        const fuelRef = doc(db, "fuelPrices", targetDate);
        const fuelSnap = await getDoc(fuelRef);

        if (fuelSnap.exists()) {
            return fuelSnap.data() as FuelPriceData;
        }

        // 2. Not in Firestore, fetch from API
        const response = await axios.get('https://hasanadiguzel.com.tr/api/akaryakit/sehir=ANKARA');

        // The API returns an object where keys are district IDs
        const allData = response.data.data;
        const districts = Object.values(allData) as any[];

        // Helper to parse Turkish currency format (e.g. "52,22")
        const parseTrPrice = (val: string) => {
            if (!val || val === "-" || val === "") return 0;
            return parseFloat(val.replace(',', '.')) || 0;
        };

        // Try to find a district that has as much data as possible
        let selectedDistrict = districts[0];
        for (const d of districts) {
            if (parseTrPrice(d["Otogaz_TL/lt"]) > 0) {
                selectedDistrict = d;
                break;
            }
        }

        const prices: FuelPriceData = {
            benzin: parseTrPrice(selectedDistrict["Kursunsuz_95(Excellium95)_TL/lt"]) || 40.0,
            motorin: parseTrPrice(selectedDistrict["Motorin(Eurodiesel)_TL/lt"]) || 42.0,
            lpg: parseTrPrice(selectedDistrict["Otogaz_TL/lt"]) || 20.0,
            date: targetDate,
            lastUpdated: new Date().toISOString()
        };

        // 3. Save to Firestore for future lookups
        await setDoc(fuelRef, prices);

        return prices;
    } catch (error) {
        console.error("Error fetching fuel prices:", error);
        return {
            benzin: 40.0,
            motorin: 42.0,
            lpg: 20.0,
            date: targetDate
        };
    }
};

/**
 * Fetches all stored fuel prices for a specific month
 */
export const getMonthFuelHistory = async (monthStr: string): Promise<Record<string, FuelPriceData>> => {
    const history: Record<string, FuelPriceData> = {};
    try {
        const q = query(
            collection(db, "fuelPrices"),
            where("date", ">=", `${monthStr}-01`),
            where("date", "<=", `${monthStr}-31`)
        );
        const snapshot = await getDocs(q);
        snapshot.forEach(doc => {
            const data = doc.data() as FuelPriceData;
            history[data.date] = data;
        });
    } catch (error) {
        console.error("Error fetching fuel history:", error);
    }
    return history;
};

// Haversine formula to calculate distance
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
};

const deg2rad = (deg: number) => {
    return deg * (Math.PI / 180);
};

export const calculateRouteDistance = (points: { latitude: number; longitude: number }[]): number => {
    let totalDistance = 0;
    for (let i = 0; i < points.length - 1; i++) {
        totalDistance += calculateDistance(
            points[i].latitude,
            points[i].longitude,
            points[i + 1].latitude,
            points[i + 1].longitude
        );
    }
    return totalDistance;
};
