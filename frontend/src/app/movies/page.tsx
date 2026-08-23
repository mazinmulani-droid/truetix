import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Play, Ticket } from 'lucide-react';
import { API_URL } from '@/lib/constants';

async function getMovies(status: 'NOW_SHOWING' | 'COMING_SOON') {
  try {
    const res = await fetch(`${API_URL}/movies?status=${status}&limit=20`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json.data) ? json.data : [];
  } catch (error) {
    console.error('Failed to fetch movies', error);
    return [];
  }
}

export default async function MoviesPage() {
  const [nowShowing, comingSoon] = await Promise.all([
    getMovies('NOW_SHOWING'),
    getMovies('COMING_SOON')
  ]);

  return (
    <div className="min-h-screen pb-20 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] pt-12">
      <div className="flex items-center justify-center mb-10">
        <div className="flex items-center gap-4">
          <div className="w-1.5 h-8 bg-primary rounded-full shadow-[0_0_10px_rgba(225,29,72,0.8)]" />
          <h1 className="text-4xl font-black uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60 py-2 leading-relaxed">Films at ClGV</h1>
          <div className="w-1.5 h-8 bg-primary rounded-full shadow-[0_0_10px_rgba(225,29,72,0.8)]" />
        </div>
      </div>

      <Tabs defaultValue="now-showing" className="w-full max-w-5xl mx-auto">
        <div className="flex justify-center mb-8">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="now-showing" className="text-lg">Now Showing</TabsTrigger>
            <TabsTrigger value="coming-soon" className="text-lg">Coming Soon</TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="now-showing">
          {nowShowing.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 px-4">
              {nowShowing.map((movie: any) => (
                <Link key={movie.id} href={`/movies/${movie.id}`}>
                  <Card className="overflow-hidden border border-white/5 bg-black/40 backdrop-blur-sm group cursor-pointer hover:border-primary/50 transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_10px_40px_-10px_rgba(225,29,72,0.3)]">
                    <CardContent className="p-0 relative">
                      <div className="absolute top-2 left-2 z-20 px-2 py-1 bg-red-600 text-white text-xs font-black rounded backdrop-blur-md shadow-lg">
                        {movie.ageRating || 'T18'}
                      </div>
                      <div className="aspect-[2/3] overflow-hidden rounded-t-lg relative">
                        <img 
                          src={movie.posterUrl || 'https://via.placeholder.com/300x450'} 
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
                          {movie.genres?.join(', ') || 'Action, Drama'} • {movie.duration || movie.durationMinutes || 120} mins
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 text-muted-foreground">
              No films currently showing.
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="coming-soon">
          {comingSoon.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 px-4">
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
                          Release date: {new Date(movie.releaseDate).toLocaleDateString('en-GB')}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 text-muted-foreground">
              No upcoming films information available.
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
