export type UserRole = 'user' | 'admin';

export interface UserProfile {
    uid: string;
    name: string;
    email: string;
    phone: string;
    role: UserRole;
    photoURL?: string;
    isApproved?: boolean;
    isVerified?: boolean;
    createdAt?: any;
    vehicle?: {
        plate: string;
        model: string;
        fuelType: 'benzin' | 'motorin' | 'lpg' | 'elektrik';
        consumption: number; // liters per 100km
    };
}

export interface Group {
    id: string;
    name: string;
    dailyFee: number;
    members: string[]; // Array of uids
    adminId: string;
}

export interface Trip {
    id?: string;
    date: string; // YYYY-MM-DD
    groupId: string;
    driverUid: string;
    participants: string[]; // Array of uids who joined that day
    totalCollected: number;
    type?: 'morning' | 'evening' | 'full';
    routeId?: string;
    distanceKm?: number;
    isInherited?: boolean;
}

export interface Route {
    id: string;
    name: string;
    startLocation: { lat: number; lng: number; address?: string };
    endLocation: { lat: number; lng: number; address?: string };
    polyline: string;
}

export interface MonthlySettlement {
    userId: string;
    userName: string;
    totalDebt: number; // Borç (yolcu olduğu günler)
    totalCredit: number; // Alacak (şoför olduğu günler)
    netAmount: number; // Credit - Debt
}

export interface DrivingTrackPoint {
    lat: number;
    lng: number;
    timestamp: number;
    speed?: number; // km/h
    address?: string; // Street/Road info
}

export interface DrivingTrack {
    id?: string;
    userId: string;
    date: string;
    startTime: string;
    endTime: string;
    distanceKm: number;
    avgSpeed: number; // km/h
    points: DrivingTrackPoint[];
    type: 'morning' | 'evening';
}

