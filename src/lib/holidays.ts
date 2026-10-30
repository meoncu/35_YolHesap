import { format } from "date-fns";

export interface Holiday {
  date: string; // YYYY-MM-DD or MM-DD for fixed
  name: string;
  shortName: string;
  type: "national" | "religious" | "general";
  isHalfDay?: boolean;
}

const FIXED_HOLIDAYS: Record<string, Omit<Holiday, "date">> = {
  "01-01": {
    name: "Yılbaşı",
    shortName: "Yılbaşı",
    type: "general",
  },
  "04-23": {
    name: "23 Nisan Ulusal Egemenlik ve Çocuk Bayramı",
    shortName: "23 Nisan",
    type: "national",
  },
  "05-01": {
    name: "1 Mayıs Emek ve Dayanışma Günü",
    shortName: "1 Mayıs",
    type: "general",
  },
  "05-19": {
    name: "19 Mayıs Atatürk'ü Anma, Gençlik ve Spor Bayramı",
    shortName: "19 Mayıs",
    type: "national",
  },
  "07-15": {
    name: "15 Temmuz Demokrasi ve Millî Birlik Günü",
    shortName: "15 Temmuz",
    type: "national",
  },
  "08-30": {
    name: "30 Ağustos Zafer Bayramı",
    shortName: "30 Ağustos",
    type: "national",
  },
  "10-28": {
    name: "29 Ekim Cumhuriyet Bayramı Arifesi",
    shortName: "Arife",
    type: "national",
    isHalfDay: true,
  },
  "10-29": {
    name: "29 Ekim Cumhuriyet Bayramı",
    shortName: "29 Ekim",
    type: "national",
  },
};

const RELIGIOUS_HOLIDAYS: Record<string, Omit<Holiday, "date">> = {
  // 2024
  "2024-04-09": { name: "Ramazan Bayramı Arifesi", shortName: "Arife", type: "religious", isHalfDay: true },
  "2024-04-10": { name: "Ramazan Bayramı (1. Gün)", shortName: "R. Bayramı 1", type: "religious" },
  "2024-04-11": { name: "Ramazan Bayramı (2. Gün)", shortName: "R. Bayramı 2", type: "religious" },
  "2024-04-12": { name: "Ramazan Bayramı (3. Gün)", shortName: "R. Bayramı 3", type: "religious" },
  "2024-06-15": { name: "Kurban Bayramı Arifesi", shortName: "Arife", type: "religious", isHalfDay: true },
  "2024-06-16": { name: "Kurban Bayramı (1. Gün)", shortName: "K. Bayramı 1", type: "religious" },
  "2024-06-17": { name: "Kurban Bayramı (2. Gün)", shortName: "K. Bayramı 2", type: "religious" },
  "2024-06-18": { name: "Kurban Bayramı (3. Gün)", shortName: "K. Bayramı 3", type: "religious" },
  "2024-06-19": { name: "Kurban Bayramı (4. Gün)", shortName: "K. Bayramı 4", type: "religious" },

  // 2025
  "2025-03-29": { name: "Ramazan Bayramı Arifesi", shortName: "Arife", type: "religious", isHalfDay: true },
  "2025-03-30": { name: "Ramazan Bayramı (1. Gün)", shortName: "R. Bayramı 1", type: "religious" },
  "2025-03-31": { name: "Ramazan Bayramı (2. Gün)", shortName: "R. Bayramı 2", type: "religious" },
  "2025-04-01": { name: "Ramazan Bayramı (3. Gün)", shortName: "R. Bayramı 3", type: "religious" },
  "2025-06-05": { name: "Kurban Bayramı Arifesi", shortName: "Arife", type: "religious", isHalfDay: true },
  "2025-06-06": { name: "Kurban Bayramı (1. Gün)", shortName: "K. Bayramı 1", type: "religious" },
  "2025-06-07": { name: "Kurban Bayramı (2. Gün)", shortName: "K. Bayramı 2", type: "religious" },
  "2025-06-08": { name: "Kurban Bayramı (3. Gün)", shortName: "K. Bayramı 3", type: "religious" },
  "2025-06-09": { name: "Kurban Bayramı (4. Gün)", shortName: "K. Bayramı 4", type: "religious" },

  // 2026
  "2026-03-19": { name: "Ramazan Bayramı Arifesi", shortName: "Arife", type: "religious", isHalfDay: true },
  "2026-03-20": { name: "Ramazan Bayramı (1. Gün)", shortName: "R. Bayramı 1", type: "religious" },
  "2026-03-21": { name: "Ramazan Bayramı (2. Gün)", shortName: "R. Bayramı 2", type: "religious" },
  "2026-03-22": { name: "Ramazan Bayramı (3. Gün)", shortName: "R. Bayramı 3", type: "religious" },
  "2026-05-26": { name: "Kurban Bayramı Arifesi", shortName: "Arife", type: "religious", isHalfDay: true },
  "2026-05-27": { name: "Kurban Bayramı (1. Gün)", shortName: "K. Bayramı 1", type: "religious" },
  "2026-05-28": { name: "Kurban Bayramı (2. Gün)", shortName: "K. Bayramı 2", type: "religious" },
  "2026-05-29": { name: "Kurban Bayramı (3. Gün)", shortName: "K. Bayramı 3", type: "religious" },
  "2026-05-30": { name: "Kurban Bayramı (4. Gün)", shortName: "K. Bayramı 4", type: "religious" },

  // 2027
  "2027-03-08": { name: "Ramazan Bayramı Arifesi", shortName: "Arife", type: "religious", isHalfDay: true },
  "2027-03-09": { name: "Ramazan Bayramı (1. Gün)", shortName: "R. Bayramı 1", type: "religious" },
  "2027-03-10": { name: "Ramazan Bayramı (2. Gün)", shortName: "R. Bayramı 2", type: "religious" },
  "2027-03-11": { name: "Ramazan Bayramı (3. Gün)", shortName: "R. Bayramı 3", type: "religious" },
  "2027-05-15": { name: "Kurban Bayramı Arifesi", shortName: "Arife", type: "religious", isHalfDay: true },
  "2027-05-16": { name: "Kurban Bayramı (1. Gün)", shortName: "K. Bayramı 1", type: "religious" },
  "2027-05-17": { name: "Kurban Bayramı (2. Gün)", shortName: "K. Bayramı 2", type: "religious" },
  "2027-05-18": { name: "Kurban Bayramı (3. Gün)", shortName: "K. Bayramı 3", type: "religious" },
  "2027-05-19": { name: "Kurban Bayramı (4. Gün) & 19 Mayıs", shortName: "K. Bayramı 4", type: "religious" },

  // 2028
  "2028-02-26": { name: "Ramazan Bayramı Arifesi", shortName: "Arife", type: "religious", isHalfDay: true },
  "2028-02-27": { name: "Ramazan Bayramı (1. Gün)", shortName: "R. Bayramı 1", type: "religious" },
  "2028-02-28": { name: "Ramazan Bayramı (2. Gün)", shortName: "R. Bayramı 2", type: "religious" },
  "2028-02-29": { name: "Ramazan Bayramı (3. Gün)", shortName: "R. Bayramı 3", type: "religious" },
  "2028-05-04": { name: "Kurban Bayramı Arifesi", shortName: "Arife", type: "religious", isHalfDay: true },
  "2028-05-05": { name: "Kurban Bayramı (1. Gün)", shortName: "K. Bayramı 1", type: "religious" },
  "2028-05-06": { name: "Kurban Bayramı (2. Gün)", shortName: "K. Bayramı 2", type: "religious" },
  "2028-05-07": { name: "Kurban Bayramı (3. Gün)", shortName: "K. Bayramı 3", type: "religious" },
  "2028-05-08": { name: "Kurban Bayramı (4. Gün)", shortName: "K. Bayramı 4", type: "religious" },

  // 2029
  "2029-02-13": { name: "Ramazan Bayramı Arifesi", shortName: "Arife", type: "religious", isHalfDay: true },
  "2029-02-14": { name: "Ramazan Bayramı (1. Gün)", shortName: "R. Bayramı 1", type: "religious" },
  "2029-02-15": { name: "Ramazan Bayramı (2. Gün)", shortName: "R. Bayramı 2", type: "religious" },
  "2029-02-16": { name: "Ramazan Bayramı (3. Gün)", shortName: "R. Bayramı 3", type: "religious" },
  "2029-04-23": { name: "23 Nisan & Kurban Bayramı Arifesi", shortName: "23 Nisan", type: "national" },
  "2029-04-24": { name: "Kurban Bayramı (1. Gün)", shortName: "K. Bayramı 1", type: "religious" },
  "2029-04-25": { name: "Kurban Bayramı (2. Gün)", shortName: "K. Bayramı 2", type: "religious" },
  "2029-04-26": { name: "Kurban Bayramı (3. Gün)", shortName: "K. Bayramı 3", type: "religious" },
  "2029-04-27": { name: "Kurban Bayramı (4. Gün)", shortName: "K. Bayramı 4", type: "religious" },

  // 2030
  "2030-02-03": { name: "Ramazan Bayramı Arifesi", shortName: "Arife", type: "religious", isHalfDay: true },
  "2030-02-04": { name: "Ramazan Bayramı (1. Gün)", shortName: "R. Bayramı 1", type: "religious" },
  "2030-02-05": { name: "Ramazan Bayramı (2. Gün)", shortName: "R. Bayramı 2", type: "religious" },
  "2030-02-06": { name: "Ramazan Bayramı (3. Gün)", shortName: "R. Bayramı 3", type: "religious" },
  "2030-04-12": { name: "Kurban Bayramı Arifesi", shortName: "Arife", type: "religious", isHalfDay: true },
  "2030-04-13": { name: "Kurban Bayramı (1. Gün)", shortName: "K. Bayramı 1", type: "religious" },
  "2030-04-14": { name: "Kurban Bayramı (2. Gün)", shortName: "K. Bayramı 2", type: "religious" },
  "2030-04-15": { name: "Kurban Bayramı (3. Gün)", shortName: "K. Bayramı 3", type: "religious" },
  "2030-04-16": { name: "Kurban Bayramı (4. Gün)", shortName: "K. Bayramı 4", type: "religious" },
};

export function getHoliday(dateOrStr: Date | string): Holiday | null {
  const dateStr = typeof dateOrStr === "string" ? dateOrStr : format(dateOrStr, "yyyy-MM-dd");
  const monthDay = dateStr.slice(5); // MM-DD

  if (RELIGIOUS_HOLIDAYS[dateStr]) {
    return {
      date: dateStr,
      ...RELIGIOUS_HOLIDAYS[dateStr],
    };
  }

  if (FIXED_HOLIDAYS[monthDay]) {
    return {
      date: dateStr,
      ...FIXED_HOLIDAYS[monthDay],
    };
  }

  return null;
}

export function getHolidaysForMonth(year: number, monthIndex: number): Holiday[] {
  const monthPrefix = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
  const holidays: Holiday[] = [];

  for (let day = 1; day <= 31; day++) {
    const dateObj = new Date(year, monthIndex, day);
    if (dateObj.getMonth() !== monthIndex) break;
    const h = getHoliday(dateObj);
    if (h) holidays.push(h);
  }

  return holidays;
}
