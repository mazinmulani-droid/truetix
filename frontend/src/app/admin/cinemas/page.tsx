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
import { Plus, Edit, Trash2, MonitorPlay } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function AdminCinemasPage() {
  const [cinemas, setCinemas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isHallsOpen, setIsHallsOpen] = useState(false);
  const [selectedCinema, setSelectedCinema] = useState<any>(null);
  const [cities, setCities] = useState([]);

  const [formData, setFormData] = useState({
    cityId: '',
    name: '',
    address: '',
    phone: '',
    amenities: 'Parking, Popcorn Bar'
  });

  const [hallData, setHallData] = useState({
    name: 'Hall 1',
    screenType: 'STANDARD'
  });

  const fetchCinemas = async () => {
    try {
      const res = await api.get('/cinemas');
      if (res.success) {
        setCinemas(Array.isArray(res.data) ? res.data : []);
      }
    } catch (error) {
      console.error('Failed to fetch cinemas', error);
      // Fallback sample cinemas for standalone demo mode
      setCinemas([
        {
          id: 'cin_1',
          name: 'TrueTix Leicester Square',
          city: { name: 'London' },
          address: 'Leicester Square, London WC2H 7NA',
          phone: '020 7123 4567',
          halls: [
            { id: 'hall_1', name: 'IMAX Laser Hall 1', screenType: 'IMAX' },
            { id: 'hall_2', name: 'Dolby Atmos Screen 2', screenType: 'STANDARD' }
          ]
        },
        {
          id: 'cin_2',
          name: 'TrueTix Manchester Central',
          city: { name: 'Manchester' },
          address: 'Deansgate, Manchester M3 4EN',
          phone: '0161 832 9988',
          halls: [
            { id: 'hall_3', name: 'Screen 1', screenType: 'STANDARD' }
          ]
        }
      ] as any);
    } finally {
      setLoading(false);
    }
  };

  const fetchCities = async () => {
    try {
      const res = await api.get('/cities');
      if (res.success) {
        setCities(res.data || []);
        if (res.data && res.data.length > 0) {
          setFormData(prev => ({ ...prev, cityId: res.data[0].id }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch cities', error);
    }
  };

  useEffect(() => {
    fetchCinemas();
    fetchCities();
  }, []);

  const handleAddCinema = async () => {
    try {
      const payload = {
        ...formData,
        amenities: formData.amenities.split(',').map(a => a.trim())
      };
      const res = await api.post('/cinemas', payload);
      if (res.success) {
        toast.success('Cinema added successfully');
        setIsAddOpen(false);
        setFormData({
          cityId: cities.length > 0 ? (cities[0] as any).id : '',
          name: '',
          address: '',
          phone: '',
          amenities: 'Parking, Popcorn Bar'
        });
        fetchCinemas();
      } else {
        if (res.error?.code === 'DUPLICATE_CINEMA_NAME') {
          setIsAddOpen(false);
          toast.error('Error: Cinema name already exists in the system!');
        } else {
          toast.error(res.error?.message || res.message || 'An error occurred');
        }
      }
    } catch (error: any) {
      console.error('Failed to add cinema', error);
      if (error.response?.data?.error?.code === 'DUPLICATE_CINEMA_NAME') {
        setIsAddOpen(false);
        toast.error('Error: Cinema name already exists in the system!');
      } else {
        toast.error(error.response?.data?.error?.message || error.response?.data?.message || 'Server error');
      }
    }
  };

  const handleAddHall = async () => {
    if (!selectedCinema) return;
    try {
      const payload = {
        cinemaId: selectedCinema.id,
        name: hallData.name,
        screenType: hallData.screenType,
        roomMatrix: { dimensions: { rows: 10, cols: 10 }, aisles: { vertical: [5], horizontal: [5] }, grid: [] }
      };
      const res = await api.post('/halls', payload);
      if (res.success) {
        toast.success('Screen auditorium added successfully');
        fetchCinemas();
        // Update selected cinema data immediately
        setSelectedCinema((prev: any) => ({
          ...prev,
          halls: [...(prev.halls || []), res.data]
        }));
      } else {
        if (res.error?.code === 'DUPLICATE_HALL_NAME') {
          toast.error('Error: Screen name already exists for this cinema!');
        } else {
          toast.error(res.error?.message || res.message || 'An error occurred');
        }
      }
    } catch (error: any) {
      console.error('Failed to add hall', error);
      if (error.response?.data?.error?.code === 'DUPLICATE_HALL_NAME') {
        toast.error('Error: Screen name already exists for this cinema!');
      } else {
        toast.error(error.response?.data?.error?.message || error.response?.data?.message || 'Server error');
      }
    }
  };

  const notifyMissingApi = () => {
    toast.info('Feature awaiting backend API integration');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold border-l-4 border-primary pl-4">Manage Cinemas</h1>
        
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger render={<Button className="gap-2" />}>
            <Plus className="h-4 w-4" /> Add New Cinema
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add New Cinema</DialogTitle>
              <DialogDescription>
                Create a new cinema venue and assign it to a city or region.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>City / Region</Label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  value={formData.cityId}
                  onChange={e => setFormData({...formData, cityId: e.target.value})}
                >
                  {cities.map((city: any) => (
                    <option key={city.id} value={city.id}>{city.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Cinema Name</Label>
                <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. ClGV Leicester Square..." />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="e.g. 10 High Street..." />
              </div>
              <div className="space-y-2">
                <Label>Hotline</Label>
                <Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="1900 6017" />
              </div>
              <div className="space-y-2">
                <Label>Amenities (comma separated)</Label>
                <Input value={formData.amenities} onChange={e => setFormData({...formData, amenities: e.target.value})} placeholder="Parking, IMAX, Bar..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
              <Button onClick={handleAddCinema}>Save Cinema</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>

      <Dialog open={isHallsOpen} onOpenChange={setIsHallsOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Manage Screens & Auditoriums - {selectedCinema?.name}</DialogTitle>
            <DialogDescription>
              Add new screens and configure seat matrix.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-6">
            <div className="flex gap-4 items-end bg-muted/50 p-4 rounded-lg border border-border">
              <div className="flex-1 space-y-2">
                <Label>Screen Name</Label>
                <Input value={hallData.name} onChange={e => setHallData({...hallData, name: e.target.value})} placeholder="e.g. Screen 1" />
              </div>
              <div className="flex-1 space-y-2">
                <Label>Screen Format</Label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  value={hallData.screenType}
                  onChange={e => setHallData({...hallData, screenType: e.target.value})}
                >
                  <option value="STANDARD">2D / Standard</option>
                  <option value="IMAX">IMAX</option>
                  <option value="FOUR_DX">4DX</option>
                  <option value="SCREEN_X">ScreenX</option>
                  <option value="GOLD_CLASS">Gold Class</option>
                  <option value="LAMOUR_BED">L&apos;Amour Bed</option>
                </select>
              </div>
              <Button onClick={handleAddHall}>Add Screen</Button>
            </div>
            
            <div>
              <h4 className="font-bold mb-3 border-b border-border pb-2">Screen Auditoriums List</h4>
              {selectedCinema?.halls && selectedCinema.halls.length > 0 ? (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                  {selectedCinema.halls.map((hall: any) => (
                    <div key={hall.id} className="flex justify-between items-center p-3 bg-card border border-border rounded-lg">
                      <div>
                        <p className="font-bold">{hall.name}</p>
                        <p className="text-xs text-muted-foreground">{hall.screenType}</p>
                      </div>
                      <Link href={`/admin/halls/${hall.id}/matrix`}>
                        <Button size="sm" variant="outline" className="gap-2 border-primary/50 text-primary">
                          <MonitorPlay className="w-4 h-4" /> Seat Matrix
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm text-center py-4">No screens configured for this cinema.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="bg-card/40 backdrop-blur-md border border-border/50 rounded-lg overflow-hidden shadow-2xl">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[80px] text-center">#</TableHead>
              <TableHead>Cinema Name</TableHead>
              <TableHead>City / Region</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Hotline</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  Loading cinemas...
                </TableCell>
              </TableRow>
            ) : cinemas.length > 0 ? (
              cinemas.map((cinema: any, index: number) => (
                <TableRow key={cinema.id}>
                  <TableCell className="font-medium text-center">{index + 1}</TableCell>
                  <TableCell className="font-bold">{cinema.name}</TableCell>
                  <TableCell>{cinema.city?.name || cinema.city}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{cinema.address}</TableCell>
                  <TableCell>{cinema.hotline || cinema.phone || 'N/A'}</TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-primary" 
                      title="Manage screen auditoriums"
                      onClick={() => {
                        setSelectedCinema(cinema);
                        setIsHallsOpen(true);
                      }}
                    >
                      <MonitorPlay className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500" onClick={notifyMissingApi}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={notifyMissingApi}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  No cinema data available
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
