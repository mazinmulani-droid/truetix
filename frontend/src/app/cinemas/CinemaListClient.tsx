"use client";

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin } from 'lucide-react';

export default function CinemaListClient({ initialCinemas }: { initialCinemas: any[] }) {
  const cinemasByCity = (initialCinemas || []).reduce((acc: any, cinema: any) => {
    const cityName =
      typeof cinema.city === 'object' && cinema.city !== null
        ? cinema.city.name
        : cinema.city || 'Other';

    if (!acc[cityName]) {
      acc[cityName] = [];
    }
    acc[cityName].push(cinema);
    return acc;
  }, {});

  return (
    <div>
      <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
        <h2 className="text-xl font-bold text-amber-500 flex items-center gap-2">
          National Theater Network
        </h2>
      </div>

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
                  <Link
                    key={cinema.id}
                    href={`/cinemas/${cinema.id}?name=${encodeURIComponent(cinema.name)}&address=${encodeURIComponent(cinema.address || '')}`}
                  >
                    <Card className="overflow-hidden border border-white/5 bg-black/40 backdrop-blur-sm group cursor-pointer hover:border-amber-500/50 transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_10px_40px_-10px_rgba(245,158,11,0.2)] h-full">
                      <CardContent className="p-6 relative overflow-hidden">
                        <div className="absolute -right-10 -top-10 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-colors" />
                        <div className="flex justify-between items-start mb-4">
                          <h3 className="font-bold text-xl text-amber-500 group-hover:text-amber-400 transition-colors pr-2">
                            {cinema.name}
                          </h3>
                        </div>
                        <div className="space-y-3 text-sm text-white/70">
                          <div className="flex items-start gap-3 group-hover:text-white transition-colors">
                            <span className="text-amber-500/50 mt-0.5">📍</span>
                            <span>{cinema.address}</span>
                          </div>
                          <div className="flex items-center gap-3 group-hover:text-white transition-colors">
                            <span className="text-amber-500/50">📞</span>
                            <span>{cinema.phone || cinema.hotline || '1800 555 0100'}</span>
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
