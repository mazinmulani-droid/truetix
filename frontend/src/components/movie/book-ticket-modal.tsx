'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export function BookTicketModal({ movie, showtimes: customShowtimes }: { movie: any; showtimes?: any[] }) {
  const [open, setOpen] = useState(false);

  const showtimesList = (customShowtimes && customShowtimes.length > 0)
    ? customShowtimes
    : (movie?.showtimes && movie.showtimes.length > 0)
      ? movie.showtimes
      : [
          {
            id: 'st_1',
            startTime: new Date(Date.now() + 3600000).toISOString(),
            cinema: { name: 'TrueTix Leicester Square' },
            hall: { name: 'IMAX Screen 1' }
          },
          {
            id: 'st_2',
            startTime: new Date(Date.now() + 10800000).toISOString(),
            cinema: { name: 'TrueTix Leicester Square' },
            hall: { name: 'Dolby Atmos Screen 2' }
          }
        ];

  // Group showtimes by Date
  const showtimesByDate: Record<string, any[]> = {};
  if (showtimesList && showtimesList.length > 0) {
    showtimesList.forEach((st: any) => {
      const dateStr = new Date(st.startTime).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
      if (!showtimesByDate[dateStr]) showtimesByDate[dateStr] = [];
      showtimesByDate[dateStr].push(st);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button 
          size="lg" 
          className="text-lg font-bold px-8 shadow-lg shadow-primary/30 uppercase mt-4 w-full md:w-auto"
        />
      }>
        <Ticket className="w-5 h-5 mr-2" />
        Book Tickets Now
      </DialogTrigger>
      <DialogContent className="max-w-2xl border-border bg-card">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold uppercase text-primary border-b border-border pb-4 mb-2">
            Select Showtime - {movie.title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-6">
          {Object.keys(showtimesByDate).length > 0 ? (
            Object.entries(showtimesByDate).map(([date, showtimes]) => (
              <div key={date} className="bg-background/50 border border-border rounded-lg p-4">
                <h4 className="font-bold text-lg mb-4 text-primary">{date}</h4>
                
                {(() => {
                  const byCinema: Record<string, any[]> = {};
                  showtimes.forEach(st => {
                    const cName = st.cinema?.name || 'Other Cinema';
                    if (!byCinema[cName]) byCinema[cName] = [];
                    byCinema[cName].push(st);
                  });

                  return Object.entries(byCinema).map(([cinemaName, stList]) => (
                    <div key={cinemaName} className="mb-4 last:mb-0">
                      <h5 className="font-semibold text-sm mb-2 text-white">{cinemaName}</h5>
                      <div className="flex flex-wrap gap-2">
                        {stList.map((st: any) => (
                          <Link key={st.id} href={`/booking/seats?showtimeId=${st.id}`}>
                            <Button 
                              variant="outline" 
                              className="border-primary/50 hover:bg-primary hover:text-white transition-colors"
                              onClick={() => setOpen(false)}
                            >
                              {new Date(st.startTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}
                            </Button>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            ))
          ) : (
            <div className="bg-card border border-border rounded-lg p-8 text-center">
              <p className="text-muted-foreground">No showtimes currently available for this film.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
