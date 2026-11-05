import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { HomeMovieShowcase } from '@/components/home/movie-showcase';
import { API_URL } from '@/lib/constants';
import { Ticket, Sparkles, MapPin } from 'lucide-react';

async function getHomeData() {
  try {
    const res = await fetch(`${API_URL}/home`, { cache: 'no-store' });
    if (!res.ok) throw new Error('API offline');
    const json = await res.json();
    return json.data;
  } catch (error) {
    console.warn('Backend API offline, loading default showcase catalog.');
    return {
      movies: {
        nowShowing: [
          {
            id: 'mov_1',
            title: 'Avatar: The Way of Water',
            genres: ['Action', 'Sci-Fi'],
            durationMinutes: 192,
            releaseDate: '2026-06-15',
            ageRating: 'T13',
            languageType: 'SUB',
            posterUrl: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=600&auto=format&fit=crop',
          },
          {
            id: 'mov_2',
            title: 'Oppenheimer',
            genres: ['Biography', 'Drama'],
            durationMinutes: 180,
            releaseDate: '2026-07-20',
            ageRating: 'T18',
            languageType: 'SUB',
            posterUrl: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=600&auto=format&fit=crop',
          },
          {
            id: 'mov_3',
            title: 'Dune: Part Two',
            genres: ['Action', 'Adventure'],
            durationMinutes: 166,
            releaseDate: '2026-09-10',
            ageRating: 'T16',
            languageType: 'SUB',
            posterUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=600&auto=format&fit=crop',
          },
          {
            id: 'mov_4',
            title: 'Deadpool & Wolverine',
            genres: ['Action', 'Comedy'],
            durationMinutes: 127,
            releaseDate: '2026-07-26',
            ageRating: 'T18',
            languageType: 'SUB',
            posterUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=600&auto=format&fit=crop',
          },
        ],
        comingSoon: [
          {
            id: 'mov_5',
            title: 'Gladiator II',
            genres: ['Action', 'Drama'],
            durationMinutes: 148,
            releaseDate: '2026-11-22',
            ageRating: 'T18',
            languageType: 'SUB',
            posterUrl: 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?q=80&w=600&auto=format&fit=crop',
          },
          {
            id: 'mov_6',
            title: 'Interstellar (10th Anniversary)',
            genres: ['Sci-Fi', 'Adventure'],
            durationMinutes: 169,
            releaseDate: '2026-12-05',
            ageRating: 'T13',
            languageType: 'SUB',
            posterUrl: 'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?q=80&w=600&auto=format&fit=crop',
          },
        ],
      },
      featuredCinemas: [
        {
          id: 'cin_01',
          name: 'TrueTix Phoenix Mall Cinema',
          address: 'Phoenix Palladium, Lower Parel, Mumbai',
        },
      ],
    };
  }
}

export default async function Home() {
  const data = await getHomeData();

  if (!data) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-destructive mb-4">Unable to load home page data</h1>
        <p className="text-muted-foreground">Please check the connection to the backend server.</p>
      </div>
    );
  }

  const nowShowing = data.movies?.nowShowing || [];
  const comingSoon = data.movies?.comingSoon || [];
  const featuredCinemas = data.featuredCinemas || [];

  return (
    <div className="min-h-screen pb-20 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]">
      {/* Hero Section */}
      <section className="relative w-full py-20 bg-gradient-to-b from-black via-zinc-950 to-background border-b border-white/10 overflow-hidden">
        <div className="container mx-auto px-4 text-center max-w-4xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" /> High-Concurrency Real-Time Ticketing
          </div>
          <h1 className="text-4xl sm:text-6xl font-black uppercase tracking-tight text-white leading-tight">
            Seamless Movie Booking with Instant Seat Locking
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Select your favorite film, choose your seats in real-time, and experience zero double-booking with atomic Redis reservation locking and digital HMAC QR tickets.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Link
              href="/movies"
              className={buttonVariants({
                size: 'lg',
                className: 'rounded-full font-bold px-8 shadow-lg shadow-primary/30',
              })}
            >
              <Ticket className="w-5 h-5 mr-2" /> Browse Movies
            </Link>
            <Link
              href="/cinemas"
              className={buttonVariants({
                variant: 'outline',
                size: 'lg',
                className: 'rounded-full font-bold px-8 border-white/20 hover:bg-white/10',
              })}
            >
              <MapPin className="w-5 h-5 mr-2" /> Find Theaters
            </Link>
          </div>
        </div>
      </section>

      {/* Dynamic Persistent Movies Showcase (Now Showing & Coming Soon) */}
      <HomeMovieShowcase 
        initialNowShowing={nowShowing}
        initialComingSoon={comingSoon}
      />

      {/* Featured Cinemas Section */}
      {featuredCinemas.length > 0 && (
        <section className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-4">
              <div className="w-1.5 h-8 bg-amber-500 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.8)]" />
              <h2 className="text-4xl font-black uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-600 py-2 leading-relaxed">
                Featured Cinemas
              </h2>
            </div>
            <Link href="/cinemas" className="text-sm font-bold uppercase tracking-widest text-amber-500 hover:text-white transition-colors flex items-center gap-2 group">
              All Cinemas
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredCinemas.map((cinema: any) => (
              <Link key={cinema.id} href={`/cinemas/${cinema.id}`}>
                <Card className="overflow-hidden border border-white/5 bg-black/40 backdrop-blur-sm group cursor-pointer hover:border-amber-500/50 transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_10px_40px_-10px_rgba(245,158,11,0.2)] h-full">
                  <CardContent className="p-6 relative overflow-hidden">
                    <div className="absolute -right-10 -top-10 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-colors" />
                    <h3 className="font-bold text-xl mb-3 text-amber-500 group-hover:text-amber-400 transition-colors">
                      {cinema.name}
                    </h3>
                    <p className="text-sm text-white/70 flex items-start gap-2">
                      <span className="text-amber-500/50 mt-1">📍</span>
                      {cinema.address}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
