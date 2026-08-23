import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { BannerSlider } from '@/components/home/banner-slider';
import { API_URL } from '@/lib/constants';
import { Play, Ticket, Clock, Film, Sparkles, MapPin } from 'lucide-react';

async function getHomeData() {
  try {
    const res = await fetch(`${API_URL}/home`, { cache: 'no-store' });
    if (!res.ok) throw new Error('API offline');
    const json = await res.json();
    return json.data;
  } catch (error) {
    console.warn('Backend API offline, loading default showcase catalog.');
    return {
      banners: [
        {
          id: 'b1',
          title: 'TrueTix IMAX Experience',
          imageUrl: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=2070&auto=format&fit=crop',
          linkUrl: '/movies'
        },
        {
          id: 'b2',
          title: 'Avatar: The Way of Water',
          imageUrl: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=2070&auto=format&fit=crop',
          linkUrl: '/movies'
        }
      ],
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
            posterUrl: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=600&auto=format&fit=crop'
          },
          {
            id: 'mov_2',
            title: 'Oppenheimer',
            genres: ['Biography', 'Drama'],
            durationMinutes: 180,
            releaseDate: '2026-07-20',
            ageRating: 'T18',
            languageType: 'SUB',
            posterUrl: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=600&auto=format&fit=crop'
          },
          {
            id: 'mov_3',
            title: 'Dune: Part Two',
            genres: ['Action', 'Adventure'],
            durationMinutes: 166,
            releaseDate: '2026-09-10',
            ageRating: 'T16',
            languageType: 'SUB',
            posterUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=600&auto=format&fit=crop'
          },
          {
            id: 'mov_4',
            title: 'Deadpool & Wolverine',
            genres: ['Action', 'Comedy'],
            durationMinutes: 127,
            releaseDate: '2026-07-26',
            ageRating: 'T18',
            languageType: 'SUB',
            posterUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=600&auto=format&fit=crop'
          }
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
            posterUrl: 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?q=80&w=600&auto=format&fit=crop'
          },
          {
            id: 'mov_6',
            title: 'Interstellar (10th Anniversary)',
            genres: ['Sci-Fi', 'Adventure'],
            durationMinutes: 169,
            releaseDate: '2026-12-05',
            ageRating: 'T13',
            languageType: 'SUB',
            posterUrl: 'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?q=80&w=600&auto=format&fit=crop'
          }
        ]
      },
      featuredCinemas: [
        {
          id: 'cin_1',
          name: 'TrueTix Leicester Square',
          address: 'Leicester Square, London WC2H 7NA'
        },
        {
          id: 'cin_2',
          name: 'TrueTix Manchester Central',
          address: 'Deansgate, Manchester M3 4EN'
        }
      ]
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
  const banners = data.banners || [];
  const featuredCinemas = data.featuredCinemas || [];

  return (
    <div className="min-h-screen pb-20 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]">
      {/* Hero Banner Section */}
      <section className="relative w-full h-[500px] md:h-[700px] bg-black overflow-hidden border-b border-white/10">
        <BannerSlider banners={banners} />
      </section>

      {/* Movies Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-4">
            <div className="w-1.5 h-8 bg-primary rounded-full shadow-[0_0_10px_rgba(225,29,72,0.8)]" />
            <h2 className="text-4xl font-black uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60 py-2 leading-relaxed">Now Showing</h2>
          </div>
          <Link href="/movies?status=NOW_SHOWING" className="text-sm font-bold uppercase tracking-widest text-primary hover:text-white transition-colors flex items-center gap-2 group">
            View all
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </Link>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {nowShowing.map((movie: any) => (
            <Link key={movie.id} href={`/movies/${movie.id}`}>
              <Card className="overflow-hidden border border-white/5 bg-black/40 backdrop-blur-sm group cursor-pointer hover:border-primary/50 transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_10px_40px_-10px_rgba(225,29,72,0.3)]">
                <CardContent className="p-0 relative">
                  {/* Rating Badge */}
                  <div className="absolute top-2 left-2 z-20 px-2 py-1 bg-red-600 text-white text-xs font-black rounded backdrop-blur-md shadow-lg">
                    {movie.ageRating || 'T18'}
                  </div>
                  
                  <div className="aspect-[2/3] overflow-hidden rounded-t-lg relative">
                    <img 
                      src={movie.posterUrl || 'https://via.placeholder.com/300x450'} 
                      alt={movie.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    {/* Glassmorphism Overlay on Hover */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col items-center justify-center gap-4 backdrop-blur-[2px]">
                      <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md border border-white/30 hover:bg-white/40 transition-colors hover:scale-110">
                        <Play className="w-5 h-5 text-white ml-1" />
                      </div>
                      <div className="px-4 py-2 bg-primary text-white text-sm font-bold uppercase rounded-full hover:bg-primary/90 flex items-center gap-2 shadow-[0_0_15px_rgba(225,29,72,0.5)] transition-transform hover:scale-105">
                        <Ticket className="w-4 h-4" /> Book Tickets
                      </div>
                    </div>
                  </div>
                  <div className="p-4 space-y-1 bg-gradient-to-t from-black to-black/80 border-t border-white/5">
                    <h3 className="font-bold text-lg line-clamp-1 group-hover:text-primary transition-colors">
                      {movie.title}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {movie.genres?.join(', ') || 'Action, Drama'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
      
      {/* Coming Soon Section */}
      <section className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-4">
            <div className="w-1.5 h-8 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
            <h2 className="text-4xl font-black uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60 py-2 leading-relaxed">Coming Soon</h2>
          </div>
          <Link href="/movies?status=COMING_SOON" className="text-sm font-bold uppercase tracking-widest text-blue-500 hover:text-white transition-colors flex items-center gap-2 group">
            View all
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </Link>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {comingSoon.map((movie: any) => (
            <Link key={movie.id} href={`/movies/${movie.id}`}>
              <Card className="overflow-hidden border border-white/5 bg-black/40 backdrop-blur-sm group cursor-pointer hover:border-blue-500/50 transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_10px_40px_-10px_rgba(59,130,246,0.3)]">
                <CardContent className="p-0 relative">
                  <div className="aspect-[2/3] overflow-hidden rounded-t-lg relative">
                    <img 
                      src={movie.posterUrl || 'https://via.placeholder.com/300x450'} 
                      alt={movie.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 grayscale group-hover:grayscale-0 opacity-80 group-hover:opacity-100"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col items-center justify-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md border border-white/30 hover:bg-white/40 transition-colors hover:scale-110">
                        <Play className="w-5 h-5 text-white ml-1" />
                      </div>
                    </div>
                  </div>
                  <div className="p-4 space-y-1 bg-gradient-to-t from-black to-black/80 border-t border-white/5">
                    <h3 className="font-bold text-lg line-clamp-1 group-hover:text-blue-400 transition-colors">
                      {movie.title}
                    </h3>
                    <p className="text-xs text-blue-400/80 font-medium">
                      {new Date(movie.releaseDate).toLocaleDateString('en-GB')}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Cinemas Section (Optional) */}
      {featuredCinemas.length > 0 && (
        <section className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-4">
              <div className="w-1.5 h-8 bg-amber-500 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.8)]" />
              <h2 className="text-4xl font-black uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-600 py-2 leading-relaxed">Featured Cinemas</h2>
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
