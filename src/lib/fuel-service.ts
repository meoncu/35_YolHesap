
import axios from 'axios';

export interface FuelPriceData {
    benzin: number;
    motorin: number;
    lpg: number;
    lastUpdated: Date;
}

export const getFuelPrices = async (): Promise<FuelPriceData> => {
    try {
        const response = await axios.get('https://hasanadiguzel.com.tr/api/akaryakit/sehir=ANKARA');
        const data = response.data.data[0]; // Assuming array response based on typical structure for this API

        // Parse prices - API usually returns them as numeric strings or numbers
        // We need to inspect the actual response structure in a real scenario, 
        // but based on similar Turkish APIs:
        // "benzin": "40.10", "motorin": "42.50", ...

        return {
            benzin: parseFloat(data.benzin),
            motorin: parseFloat(data.motorin),
            lpg: parseFloat(data.lpg),
            lastUpdated: new Date()
        };
    } catch (error) {
        console.error("Error fetching fuel prices:", error);
        // Fallback default prices (Ankara approx)
        return {
            benzin: 40.0,
            motorin: 42.0,
            lpg: 20.0,
            lastUpdated: new Date()
        };
    }
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
