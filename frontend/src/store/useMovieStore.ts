import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Movie {
  id: string;
  title: string;
  titleOriginal?: string;
  director: string;
  cast?: string;
  genres: string[];
  durationMinutes: number;
  releaseDate: string;
  posterUrl: string;
  trailerUrl?: string;
  ageRating: 'P' | 'K' | 'T13' | 'T16' | 'T18';
  languageType: string;
  status: 'NOW_SHOWING' | 'COMING_SOON';
  description: string;
  showtimes?: any[];
}

const DEFAULT_MOVIES: Movie[] = [
  {
    id: 'mov_1',
    title: 'Avatar: The Way of Water',
    titleOriginal: 'Avatar: The Way of Water',
    director: 'James Cameron',
    cast: 'Sam Worthington, Zoe Saldana, Sigourney Weaver',
    genres: ['Action', 'Sci-Fi', 'Adventure'],
    durationMinutes: 192,
    releaseDate: '2026-06-15',
    posterUrl: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=600&auto=format&fit=crop',
    trailerUrl: 'https://www.youtube.com/watch?v=d9MyW72ELq0',
    ageRating: 'T13',
    languageType: 'SUB',
    status: 'NOW_SHOWING',
    description: 'Jake Sully lives with his newfound family formed on the extrasolar moon Pandora. Once a familiar threat returns to finish what was previously started, Jake must work with Neytiri and the army of the Na\'vi race to protect their home.'
  },
  {
    id: 'mov_2',
    title: 'Oppenheimer',
    titleOriginal: 'Oppenheimer',
    director: 'Christopher Nolan',
    cast: 'Cillian Murphy, Emily Blunt, Matt Damon, Robert Downey Jr.',
    genres: ['Biography', 'Drama', 'History'],
    durationMinutes: 180,
    releaseDate: '2026-07-20',
    posterUrl: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=600&auto=format&fit=crop',
    trailerUrl: 'https://www.youtube.com/watch?v=uYPbbksJxIg',
    ageRating: 'T18',
    languageType: 'SUB',
    status: 'NOW_SHOWING',
    description: 'The story of American scientist J. Robert Oppenheimer and his role in the development of the atomic bomb during World War II.'
  },
  {
    id: 'mov_3',
    title: 'Dune: Part Two',
    titleOriginal: 'Dune: Part Two',
    director: 'Denis Villeneuve',
    cast: 'Timothée Chalamet, Zendaya, Rebecca Ferguson, Javier Bardem',
    genres: ['Action', 'Adventure', 'Drama', 'Sci-Fi'],
    durationMinutes: 166,
    releaseDate: '2026-09-10',
    posterUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=600&auto=format&fit=crop',
    trailerUrl: 'https://www.youtube.com/watch?v=Way9Dexny3w',
    ageRating: 'T16',
    languageType: 'SUB',
    status: 'NOW_SHOWING',
    description: 'Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family.'
  },
  {
    id: 'mov_4',
    title: 'Deadpool & Wolverine',
    titleOriginal: 'Deadpool & Wolverine',
    director: 'Shawn Levy',
    cast: 'Ryan Reynolds, Hugh Jackman, Emma Corrin',
    genres: ['Action', 'Comedy', 'Sci-Fi'],
    durationMinutes: 127,
    releaseDate: '2026-07-26',
    posterUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=600&auto=format&fit=crop',
    trailerUrl: 'https://www.youtube.com/watch?v=73_1biulkYk',
    ageRating: 'T18',
    languageType: 'SUB',
    status: 'NOW_SHOWING',
    description: 'Wolverine is recovering from his injuries when he crosses paths with the loudmouth Deadpool. They team up to defeat a common enemy.'
  },
  {
    id: 'mov_5',
    title: 'Gladiator II',
    titleOriginal: 'Gladiator II',
    director: 'Ridley Scott',
    cast: 'Paul Mescal, Pedro Pascal, Denzel Washington',
    genres: ['Action', 'Drama', 'Adventure'],
    durationMinutes: 148,
    releaseDate: '2026-11-22',
    posterUrl: 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?q=80&w=600&auto=format&fit=crop',
    trailerUrl: 'https://www.youtube.com/watch?v=4rgYUipGJNo',
    ageRating: 'T18',
    languageType: 'SUB',
    status: 'COMING_SOON',
    description: 'Years after witnessing the death of the revered hero Maximus at the hands of his uncle, Lucius must enter the Colosseum after his home is conquered.'
  },
  {
    id: 'mov_6',
    title: 'Interstellar (10th Anniversary)',
    titleOriginal: 'Interstellar',
    director: 'Christopher Nolan',
    cast: 'Matthew McConaughey, Anne Hathaway, Jessica Chastain',
    genres: ['Sci-Fi', 'Adventure', 'Drama'],
    durationMinutes: 169,
    releaseDate: '2026-12-05',
    posterUrl: 'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?q=80&w=600&auto=format&fit=crop',
    trailerUrl: 'https://www.youtube.com/watch?v=zSWdZVtXT7E',
    ageRating: 'T13',
    languageType: 'SUB',
    status: 'COMING_SOON',
    description: 'When Earth becomes uninhabitable in the future, a farmer and ex-NASA pilot, Joseph Cooper, is tasked to pilot a spacecraft, along with a team of researchers, to find a new planet for humans.'
  }
];

interface MovieState {
  movies: Movie[];
  _hasHydrated: boolean;
  addMovie: (movie: Movie) => void;
  updateMovie: (id: string, movie: Partial<Movie>) => void;
  deleteMovie: (id: string) => void;
  getMovieById: (id: string) => Movie | undefined;
  setHasHydrated: (state: boolean) => void;
}

export const useMovieStore = create<MovieState>()(
  persist(
    (set, get) => ({
      movies: DEFAULT_MOVIES,
      _hasHydrated: false,
      addMovie: (newMovie) =>
        set((state) => ({
          movies: [newMovie, ...state.movies.filter(m => m.id !== newMovie.id)],
        })),
      updateMovie: (id, updated) =>
        set((state) => ({
          movies: state.movies.map((m) => (m.id === id ? { ...m, ...updated } : m)),
        })),
      deleteMovie: (id) =>
        set((state) => ({
          movies: state.movies.filter((m) => m.id !== id),
        })),
      getMovieById: (id) => {
        return get().movies.find((m) => m.id === id);
      },
      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: 'truetix-movie-catalog',
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
