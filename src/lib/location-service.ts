/**
 * Reverse geocoding using Nominatim (OpenStreetMap)
 * Respects usage limits (max 1 request per second)
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
            {
                headers: {
                    'Accept-Language': 'tr-TR',
                    'User-Agent': '35_YolHesap_App'
                }
            }
        );

        if (!response.ok) {
            throw new Error('Geocoding failed');
        }

        const data = await response.json();

        // Try to extract the most relevant part: Road/Street
        const addr = data.address;
        if (!addr) return "Bilinmeyen Bölge";

        // Turkish road types: yol, cadde, sokak, bulvar
        const road = addr.road || addr.pedestrian || addr.suburb || addr.neighbourhood || addr.city_district || "";
        const city = addr.province || addr.city || "";

        if (road && city) return `${road}, ${city}`;
        if (road) return road;
        if (city) return city;

        return data.display_name || "Bilinmeyen Sokak";
    } catch (error) {
        console.error("Reverse geocoding error:", error);
        return "";
    }
}
