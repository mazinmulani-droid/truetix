"use client";

import { useEffect, useState } from 'react';
import { api } from '@/lib/axios';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Edit, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminMoviesPage() {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<any>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');

  const [formData, setFormData] = useState({
    title: '',
    titleOriginal: '',
    director: '',
    cast: '',
    genres: 'Drama, Romance',
    durationMinutes: 120,
    releaseDate: new Date().toISOString().split('T')[0],
    posterUrl: '',
    trailerUrl: '',
    ageRating: 'T18',
    languageType: 'SUB',
    status: 'COMING_SOON',
    description: '',
  });

  const fetchMovies = async () => {
    try {
      const res = await api.get('/movies?limit=100');
      if (res.success) {
        setMovies(Array.isArray(res.data) ? res.data : []);
      }
    } catch (error) {
      console.error('Failed to fetch movies', error);
      // Fallback sample movies for standalone demo mode
      setMovies([
        {
          id: 'mov_1',
          title: 'Avatar: The Way of Water',
          titleOriginal: 'Avatar: The Way of Water',
          director: 'James Cameron',
          cast: 'Sam Worthington, Zoe Saldana',
          genres: ['Action', 'Sci-Fi', 'Adventure'],
          durationMinutes: 192,
          releaseDate: '2026-06-15',
          status: 'NOW_SHOWING',
          posterUrl: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=600&auto=format&fit=crop',
          description: 'Jake Sully lives with his newfound family formed on the extrasolar moon Pandora.'
        },
        {
          id: 'mov_2',
          title: 'Oppenheimer',
          titleOriginal: 'Oppenheimer',
          director: 'Christopher Nolan',
          cast: 'Cillian Murphy, Emily Blunt, Robert Downey Jr.',
          genres: ['Biography', 'Drama', 'History'],
          durationMinutes: 180,
          releaseDate: '2026-07-20',
          status: 'NOW_SHOWING',
          posterUrl: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=600&auto=format&fit=crop',
          description: 'The story of American scientist J. Robert Oppenheimer and his role in the development of the atomic bomb.'
        },
        {
          id: 'mov_3',
          title: 'Dune: Part Two',
          titleOriginal: 'Dune: Part Two',
          director: 'Denis Villeneuve',
          cast: 'Timothée Chalamet, Zendaya, Rebecca Ferguson',
          genres: ['Action', 'Adventure', 'Drama'],
          durationMinutes: 166,
          releaseDate: '2026-09-10',
          status: 'COMING_SOON',
          posterUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=600&auto=format&fit=crop',
          description: 'Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family.'
        }
      ] as any);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMovies();
  }, []);

  const resetForm = () => {
    setFormData({
      title: '',
      titleOriginal: '',
      director: '',
      cast: '',
      genres: 'Drama, Romance',
      durationMinutes: 120,
      releaseDate: new Date().toISOString().split('T')[0],
      posterUrl: '',
      trailerUrl: '',
      ageRating: 'T18',
      languageType: 'SUB',
      status: 'COMING_SOON',
      description: '',
    });
    setSelectedMovie(null);
  };

  const openEditModal = (movie: any) => {
    setSelectedMovie(movie);
    setFormData({
      title: movie.title,
      titleOriginal: movie.titleOriginal || '',
      director: movie.director,
      cast: movie.cast || '',
      genres: movie.genres?.join(', ') || '',
      durationMinutes: movie.durationMinutes || 120,
      releaseDate: new Date(movie.releaseDate).toISOString().split('T')[0],
      posterUrl: movie.posterUrl || '',
      trailerUrl: movie.trailerUrl || '',
      ageRating: movie.ageRating || 'T18',
      languageType: movie.languageType || 'SUB',
      status: movie.status,
      description: movie.description || '',
    });
    setIsEditOpen(true);
  };

  const openDeleteModal = (movie: any) => {
    setSelectedMovie(movie);
    setIsDeleteOpen(true);
  };

  const handleAddMovie = async () => {
    try {
      const payload = {
        ...formData,
        genres: formData.genres.split(',').map((g: string) => g.trim()),
        durationMinutes: Number(formData.durationMinutes),
        releaseDate: new Date(formData.releaseDate).toISOString()
      };
      const res = await api.post('/admin/movies', payload);
      if (res.success) {
        toast.success('Film added successfully');
        setIsAddOpen(false);
        resetForm();
        fetchMovies();
      } else {
        toast.error(res.error?.message || res.message || 'An error occurred');
      }
    } catch (error: any) {
      console.error('Failed to add movie', error);
      toast.error(error.response?.data?.error?.message || error.response?.data?.message || 'Server error');
    }
  };

  const handleEditMovie = async () => {
    if (!selectedMovie) return;
    try {
      const payload = {
        ...formData,
        genres: formData.genres.split(',').map((g: string) => g.trim()),
        durationMinutes: Number(formData.durationMinutes),
        releaseDate: new Date(formData.releaseDate).toISOString()
      };
      const res = await api.put(`/admin/movies/${selectedMovie.id}`, payload);
      if (res.success) {
        toast.success('Film updated successfully');
        setIsEditOpen(false);
        resetForm();
        fetchMovies();
      } else {
        toast.error(res.error?.message || res.message || 'Error updating film');
      }
    } catch (error: any) {
      console.error('Failed to update movie', error);
      toast.error(error.response?.data?.error?.message || error.response?.data?.message || 'Server error');
    }
  };

  const handleDeleteMovie = async () => {
    if (!selectedMovie) return;
    try {
      const res = await api.delete(`/admin/movies/${selectedMovie.id}`);
      if (res.success) {
        toast.success('Film deleted successfully');
        setIsDeleteOpen(false);
        setSelectedMovie(null);
        fetchMovies();
      } else {
        toast.error(res.error?.message || res.message || 'Error deleting film');
      }
    } catch (error: any) {
      console.error('Failed to delete movie', error);
      toast.error(error.response?.data?.error?.message || error.response?.data?.message || 'Server error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold border-l-4 border-primary pl-4">Manage Films</h1>
        <Button className="gap-2" onClick={() => { resetForm(); setIsAddOpen(true); }}>
          <Plus className="h-4 w-4" /> Add New Film
        </Button>
      </div>

      <div className="flex gap-4 items-center bg-card p-4 rounded-lg border border-border/50">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <Input 
            className="pl-9" 
            placeholder="Search by film title or director..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="w-48">
          <select 
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
          >
            <option value="ALL">All statuses</option>
            <option value="NOW_SHOWING">Now Showing</option>
            <option value="COMING_SOON">Coming Soon</option>
          </select>
        </div>
      </div>

      <div className="bg-card/40 backdrop-blur-md border border-border/50 rounded-lg overflow-hidden shadow-2xl">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[60px]">#</TableHead>
              <TableHead>Film Title</TableHead>
              <TableHead>Director</TableHead>
              <TableHead>Genres</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Release Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                  Loading films...
                </TableCell>
              </TableRow>
            ) : (() => {
              const filtered = movies.filter((movie: any) => {
                const matchSearch = movie.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                    (movie.director || '').toLowerCase().includes(searchTerm.toLowerCase());
                const matchStatus = filterStatus === 'ALL' || movie.status === filterStatus;
                return matchSearch && matchStatus;
              });

              if (filtered.length === 0) {
                return (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">No matching films found</TableCell>
                  </TableRow>
                );
              }

              return filtered.map((movie: any, index: number) => (
                <TableRow key={movie.id}>
                  <TableCell className="font-medium text-xs text-center">{index + 1}</TableCell>
                  <TableCell className="font-bold">{movie.title}</TableCell>
                  <TableCell>{movie.director}</TableCell>
                  <TableCell>{movie.genres?.join(', ')}</TableCell>
                  <TableCell>{movie.durationMinutes} mins</TableCell>
                  <TableCell>{new Date(movie.releaseDate).toLocaleDateString('en-GB')}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      movie.status === 'NOW_SHOWING' 
                        ? 'bg-green-500/20 text-green-500' 
                        : 'bg-yellow-500/20 text-yellow-500'
                    }`}>
                      {movie.status === 'NOW_SHOWING' ? 'Now Showing' : 'Coming Soon'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500" onClick={() => openEditModal(movie)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => openDeleteModal(movie)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ));
            })()}
          </TableBody>
        </Table>
      </div>

      {/* Add Movie Modal */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Film</DialogTitle>
            <DialogDescription>
              Enter the film details to add it to the platform.
            </DialogDescription>
          </DialogHeader>
          <MovieFormFields formData={formData} setFormData={setFormData} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAddMovie}>Save Film</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Movie Modal */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Update Film</DialogTitle>
            <DialogDescription>
              Modify details for {selectedMovie?.title}.
            </DialogDescription>
          </DialogHeader>
          <MovieFormFields formData={formData} setFormData={setFormData} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEditMovie}>Update Film</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Movie Modal */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-destructive">Confirm Film Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{selectedMovie?.title}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteMovie}>Delete Film</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Extracted form fields component to avoid duplication
function MovieFormFields({ formData, setFormData }: { formData: any, setFormData: any }) {
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const uploadData = new FormData();
    uploadData.append('file', file);

    try {
      const res = await api.post('/upload', uploadData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      if (res.success) {
        setFormData((prev: any) => ({ ...prev, posterUrl: res.data.url }));
        toast.success('Image uploaded successfully');
      } else {
        toast.error('Image upload failed');
      }
    } catch (error: any) {
      console.error('Upload failed', error);
      toast.error(error.response?.data?.error?.message || error.response?.data?.message || 'Server error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Film Title</Label>
          <Input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="e.g. Inception" />
        </div>
        <div className="space-y-2">
          <Label>Original Title</Label>
          <Input value={formData.titleOriginal} onChange={e => setFormData({...formData, titleOriginal: e.target.value})} placeholder="e.g. Inception (2010)" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Director</Label>
          <Input value={formData.director} onChange={e => setFormData({...formData, director: e.target.value})} placeholder="Christopher Nolan" />
        </div>
        <div className="space-y-2">
          <Label>Cast</Label>
          <Input value={formData.cast} onChange={e => setFormData({...formData, cast: e.target.value})} placeholder="Leonardo DiCaprio, Ellen Page..." />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Genres (comma separated)</Label>
          <Input value={formData.genres} onChange={e => setFormData({...formData, genres: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>Duration (minutes)</Label>
          <Input type="number" value={formData.durationMinutes} onChange={e => setFormData({...formData, durationMinutes: Number(e.target.value)})} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Release Date</Label>
          <Input type="date" value={formData.releaseDate} onChange={e => setFormData({...formData, releaseDate: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>Status (Automatic)</Label>
          <select 
            className="flex h-10 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm text-muted-foreground ring-offset-background cursor-not-allowed"
            value={formData.status} 
            disabled
          >
            <option value="NOW_SHOWING">Now Showing</option>
            <option value="COMING_SOON">Coming Soon</option>
          </select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Poster Image</Label>
        <div className="flex flex-col gap-3">
          {formData.posterUrl && (
            <img src={formData.posterUrl} alt="Poster preview" className="w-32 h-48 object-cover rounded-md border border-border" />
          )}
          <div className="flex gap-2 items-center">
            <Input 
              type="file" 
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleImageUpload}
              disabled={uploading}
              className="flex-1 cursor-pointer"
            />
            {uploading && <span className="text-sm text-muted-foreground animate-pulse">Uploading...</span>}
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Trailer URL (YouTube)</Label>
        <Input value={formData.trailerUrl} onChange={e => setFormData({...formData, trailerUrl: e.target.value})} placeholder="https://youtube.com/..." />
      </div>
      <div className="space-y-2">
        <Label>Synopsis & Description</Label>
        <textarea 
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
          value={formData.description}
          onChange={e => setFormData({...formData, description: e.target.value})}
          placeholder="Film synopsis..."
        />
      </div>
    </div>
  );
}
