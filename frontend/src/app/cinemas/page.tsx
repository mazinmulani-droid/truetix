import { API_URL } from '@/lib/constants';
import CinemaListClient from './CinemaListClient';

const DEFAULT_CINEMAS = [
  {
    id: "cin_1",
    name: "TrueTix Phoenix Marketcity",
    address: "Viman Nagar Road, Viman Nagar, Pune, Maharashtra 411014",
    city: "Pune",
    hotline: "1800 123 4567",
    lat: 18.5621,
    lng: 73.9167
  },
  {
    id: "cin_2",
    name: "TrueTix Amanora Mall",
    address: "Amanora Park Town, Hadapsar, Pune, Maharashtra 411028",
    city: "Pune",
    hotline: "1800 123 4567",
    lat: 18.5196,
    lng: 73.9427
  },
  {
    id: "cin_3",
    name: "TrueTix Seasons Mall",
    address: "Magarpatta City, Hadapsar, Pune, Maharashtra 411013",
    city: "Pune",
    hotline: "1800 123 4567",
    lat: 18.5195,
    lng: 73.9317
  },
  {
    id: "cin_4",
    name: "TrueTix Westend Mall",
    address: "Aundh, Pune, Maharashtra 411007",
    city: "Pune",
    hotline: "1800 123 4567",
    lat: 18.5622,
    lng: 73.8073
  },
  {
    id: "cin_5",
    name: "TrueTix Pavilion Mall",
    address: "Senapati Bapat Road, Shivajinagar, Pune, Maharashtra 411016",
    city: "Pune",
    hotline: "1800 123 4567",
    lat: 18.5332,
    lng: 73.8306
  }
];

async function getCinemas() {
  try {
    const res = await fetch(`${API_URL}/cinemas`, { next: { revalidate: 60 } });
    if (!res.ok) return DEFAULT_CINEMAS;
    const json = await res.json();
    const data = Array.isArray(json.data) ? json.data : [];
    return data.length > 0 ? data : DEFAULT_CINEMAS;
  } catch (error) {
    console.error('Failed to fetch cinemas, using defaults', error);
    return DEFAULT_CINEMAS;
  }
}

export default async function CinemasPage() {
  const cinemas = await getCinemas();

  // If backend provided cinemas without lat/lng, merge with defaults
  const enhancedCinemas = cinemas.map((c: any) => {
    const fallback = DEFAULT_CINEMAS.find(dc => dc.id === c.id);
    if (!c.lat && fallback) {
      return { ...c, lat: fallback.lat, lng: fallback.lng };
    }
    return c;
  });

  return (
    <div className="min-h-screen pb-20 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] pt-12">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-center mb-12">
          <div className="flex items-center gap-4">
            <div className="w-1.5 h-8 bg-amber-500 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.8)]" />
            <h1 className="text-4xl font-black uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-600 py-2 leading-relaxed text-center">TrueTix Cinemas Network</h1>
            <div className="w-1.5 h-8 bg-amber-500 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.8)]" />
          </div>
        </div>

        <CinemaListClient initialCinemas={enhancedCinemas} />
      </div>
    </div>
  );
}
