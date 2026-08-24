"use client";

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, Navigation, Map as MapIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import dynamic from 'next/dynamic';

const CinemaMap = dynamic(() => import('./CinemaMap'), {
  ssr: false,
  loading: () => <div className="w-full h-[400px] mb-12 rounded-2xl bg-black/50 border border-white/10 flex items-center justify-center text-amber-500"><Loader2 className="w-8 h-8 animate-spin" /></div>
});

// Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c; // Distance in km
}

export default function CinemaListClient({ initialCinemas }: { initialCinemas: any[] }) {
  const [cinemas, setCinemas] = useState(initialCinemas);
  const [userLoc, setUserLoc] = useState<{lat: number, lng: number} | null>(null);
  const [loadingLoc, setLoadingLoc] = useState(false);
  const [showMap, setShowMap] = useState(false);

  const handleFindNearest = () => {
    setLoadingLoc(true);
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      setLoadingLoc(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLoc({ lat: latitude, lng: longitude });
        
        // Calculate distance and sort
        const withDistances = initialCinemas.map(c => {
          if (!c.lat || !c.lng) return { ...c, distance: Infinity };
          const dist = calculateDistance(latitude, longitude, c.lat, c.lng);
          return { ...c, distance: dist };
        });
        
        withDistances.sort((a, b) => a.distance - b.distance);
        setCinemas(withDistances);
        setLoadingLoc(false);
        setShowMap(true);
      },
      (error) => {
        console.error("Error getting location", error);
        alert("Failed to get location. Please ensure location permissions are granted.");
        setLoadingLoc(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Group by city if not sorted by distance
  const cinemasByCity = !userLoc ? cinemas.reduce((acc: any, cinema: any) => {
    const cityName = (typeof cinema.city === 'object' && cinema.city !== null) 
      ? cinema.city.name 
      : cinema.city || 'Other';
      
    if (!acc[cityName]) {
      acc[cityName] = [];
    }
    acc[cityName].push(cinema);
    return acc;
  }, {}) : { "Nearest to You": cinemas };

  const mapCenter: [number, number] = userLoc 
    ? [userLoc.lat, userLoc.lng] 
    : (cinemas[0]?.lat ? [cinemas[0].lat, cinemas[0].lng] : [18.5204, 73.8567]); // Default Pune

  return (
    <div>
      <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
        <Button 
          onClick={handleFindNearest} 
          disabled={loadingLoc}
          className="bg-amber-600 hover:bg-amber-700 text-white gap-2 font-bold w-full md:w-auto"
        >
          {loadingLoc ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
          Find Nearest Cinemas
        </Button>
        <Button 
          onClick={() => setShowMap(!showMap)} 
          variant="outline" 
          className="border-amber-500/50 text-amber-500 hover:bg-amber-500/10 gap-2 w-full md:w-auto"
        >
          <MapIcon className="w-4 h-4" />
          {showMap ? 'Hide Map' : 'Show Map'}
        </Button>
      </div>

      {showMap && (
        <CinemaMap mapCenter={mapCenter} userLoc={userLoc} cinemas={cinemas} />
      )}

      {Object.keys(cinemasByCity).length > 0 ? (
        <div className="space-y-12">
          {Object.entries(cinemasByCity).map(([city, cityCinemas]: [string, any]) => (
            <div key={city}>
              <h2 className="text-2xl font-black uppercase tracking-wider text-amber-500 mb-6 flex items-center gap-3 border-b border-white/10 pb-4">
                <MapPin className="w-6 h-6" />
                {city}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {cityCinemas.map((cinema: any) => (
                  <Link key={cinema.id} href={`/cinemas/${cinema.id}`}>
                    <Card className="overflow-hidden border border-white/5 bg-black/40 backdrop-blur-sm group cursor-pointer hover:border-amber-500/50 transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_10px_40px_-10px_rgba(245,158,11,0.2)] h-full">
                      <CardContent className="p-6 relative overflow-hidden">
                        <div className="absolute -right-10 -top-10 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-colors" />
                        <div className="flex justify-between items-start mb-4">
                          <h3 className="font-bold text-xl text-amber-500 group-hover:text-amber-400 transition-colors pr-2">{cinema.name}</h3>
                          {cinema.distance && (
                            <span className="bg-amber-500 text-black font-bold text-xs px-2 py-1 rounded shadow whitespace-nowrap">
                              {cinema.distance.toFixed(1)} km
                            </span>
                          )}
                        </div>
                        <div className="space-y-3 text-sm text-white/70">
                          <div className="flex items-start gap-3 group-hover:text-white transition-colors">
                            <span className="text-amber-500/50 mt-0.5">📍</span>
                            <span>{cinema.address}</span>
                          </div>
                          <div className="flex items-center gap-3 group-hover:text-white transition-colors">
                            <span className="text-amber-500/50">📞</span>
                            <span>{cinema.hotline || '1900 6017'}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-muted-foreground">
          No cinema information available.
        </div>
      )}
    </div>
  );
}
