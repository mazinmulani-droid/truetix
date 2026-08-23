"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Play, Ticket } from 'lucide-react';
import { useMovieStore, Movie } from '@/store/useMovieStore';

interface HomeMovieShowcaseProps {
  initialNowShowing: any[];
  initialComingSoon: any[];
}

export function HomeMovieShowcase({ initialNowShowing, initialComingSoon }: HomeMovieShowcaseProps) {
  const storeMovies = useMovieStore((state) => state.movies);
  const _hasHydrated = useMovieStore((state) => state._hasHydrated);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const moviesToUse: Movie[] = (mounted && _hasHydrated && storeMovies.length > 0)
    ? storeMovies
    : (initialNowShowing.concat(initialComingSoon) as Movie[]);

  const nowShowing = moviesToUse.filter((m) => m.status === 'NOW_SHOWING');
  const comingSoon = moviesToUse.filter((m) => m.status === 'COMING_SOON');

  return (
    <>
      {/* Now Showing Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-4">
            <div className="w-1.5 h-8 bg-primary rounded-full shadow-[0_0_10px_rgba(225,29,72,0.8)]" />
            <h2 className="text-4xl font-black uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60 py-2 leading-relaxed">
              Now Showing
            </h2>
          </div>
          <Link
            href="/movies?status=NOW_SHOWING"
            className="text-sm font-bold uppercase tracking-widest text-primary hover:text-white transition-colors flex items-center gap-2 group"
          >
            View all
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {nowShowing.map((movie: any) => (
            <Link key={movie.id} href={`/movies/${movie.id}`}>
              <Card className="overflow-hidden border border-white/5 bg-black/40 backdrop-blur-sm group cursor-pointer hover:border-primary/50 transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_10px_40px_-10px_rgba(225,29,72,0.3)]">
                <CardContent className="p-0 relative">
                  <div className="absolute top-2 left-2 z-20 px-2 py-1 bg-red-600 text-white text-xs font-black rounded backdrop-blur-md shadow-lg">
                    {movie.ageRating || 'T18'}
                  </div>

                  <div className="aspect-[2/3] overflow-hidden rounded-t-lg relative">
                    <img
                      src={movie.posterUrl || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=600&auto=format&fit=crop'}
                      alt={movie.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
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
                      {Array.isArray(movie.genres) ? movie.genres.join(', ') : movie.genres || 'Action, Drama'}
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
            <h2 className="text-4xl font-black uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60 py-2 leading-relaxed">
              Coming Soon
            </h2>
          </div>
          <Link
            href="/movies?status=COMING_SOON"
            className="text-sm font-bold uppercase tracking-widest text-blue-500 hover:text-white transition-colors flex items-center gap-2 group"
          >
            View all
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {comingSoon.map((movie: any) => (
            <Link key={movie.id} href={`/movies/${movie.id}`}>
              <Card className="overflow-hidden border border-white/5 bg-black/40 backdrop-blur-sm group cursor-pointer hover:border-blue-500/50 transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_10px_40px_-10px_rgba(59,130,246,0.3)]">
                <CardContent className="p-0 relative">
                  <div className="absolute top-2 left-2 z-20 px-2 py-1 bg-blue-600 text-white text-xs font-black rounded backdrop-blur-md shadow-lg">
                    {movie.ageRating || 'T18'}
                  </div>

                  <div className="aspect-[2/3] overflow-hidden rounded-t-lg relative">
                    <img
                      src={movie.posterUrl || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=600&auto=format&fit=crop'}
                      alt={movie.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col items-center justify-center gap-4 backdrop-blur-[2px]">
                      <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md border border-white/30 hover:bg-white/40 transition-colors hover:scale-110">
                        <Play className="w-5 h-5 text-white ml-1" />
                      </div>
                      <div className="px-4 py-2 bg-blue-600 text-white text-sm font-bold uppercase rounded-full hover:bg-blue-500 flex items-center gap-2 shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-transform hover:scale-105">
                        <Ticket className="w-4 h-4" /> View Details
                      </div>
                    </div>
                  </div>
                  <div className="p-4 space-y-1 bg-gradient-to-t from-black to-black/80 border-t border-white/5">
                    <h3 className="font-bold text-lg line-clamp-1 group-hover:text-blue-500 transition-colors">
                      {movie.title}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {Array.isArray(movie.genres) ? movie.genres.join(', ') : movie.genres || 'Action, Adventure'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
