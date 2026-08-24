import { notFound } from 'next/navigation';
import { MapPin, Phone, Monitor, Popcorn, Car } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { API_URL } from '@/lib/constants';

const DEFAULT_CINEMAS = [
  {
    id: "cin_1",
    name: "TrueTix Phoenix Marketcity",
    address: "Viman Nagar Road, Viman Nagar, Pune, Maharashtra 411014",
    city: "Pune",
    hotline: "1800 123 4567",
    amenities: ["IMAX", "Free Parking", "Popcorn Stand"],
    halls: [
      { id: "hall_1", name: "Screen 1", screenType: "IMAX" },
      { id: "hall_2", name: "Screen 2", screenType: "2D" },
      { id: "hall_3", name: "Screen 3", screenType: "3D" }
    ]
  },
  {
    id: "cin_2",
    name: "TrueTix Amanora Mall",
    address: "Amanora Park Town, Hadapsar, Pune, Maharashtra 411028",
    city: "Pune",
    hotline: "1800 123 4567",
    amenities: ["Free Parking", "Popcorn Stand"],
    halls: [
      { id: "hall_4", name: "Screen 1", screenType: "2D" },
      { id: "hall_5", name: "Screen 2", screenType: "4DX" }
    ]
  },
  {
    id: "cin_3",
    name: "TrueTix Seasons Mall",
    address: "Magarpatta City, Hadapsar, Pune, Maharashtra 411013",
    city: "Pune",
    hotline: "1800 123 4567",
    amenities: ["Free Parking", "VIP Lounge"],
    halls: [
      { id: "hall_6", name: "Screen 1", screenType: "2D" }
    ]
  },
  {
    id: "cin_4",
    name: "TrueTix Westend Mall",
    address: "Aundh, Pune, Maharashtra 411007",
    city: "Pune",
    hotline: "1800 123 4567",
    amenities: ["Free Parking"],
    halls: [
      { id: "hall_7", name: "Screen 1", screenType: "2D" }
    ]
  },
  {
    id: "cin_5",
    name: "TrueTix Pavilion Mall",
    address: "Senapati Bapat Road, Shivajinagar, Pune, Maharashtra 411016",
    city: "Pune",
    hotline: "1800 123 4567",
    amenities: ["Free Parking", "Popcorn Stand"],
    halls: [
      { id: "hall_8", name: "Screen 1", screenType: "2D" }
    ]
  }
];

async function getCinema(id: string) {
  try {
    const res = await fetch(`${API_URL}/cinemas/${id}`, { next: { revalidate: 0 } });
    if (!res.ok) {
      if (res.status === 404) return DEFAULT_CINEMAS.find(c => c.id === id) || null;
      throw new Error('Failed to fetch cinema');
    }
    const json = await res.json();
    return json.data || DEFAULT_CINEMAS.find(c => c.id === id) || null;
  } catch (error) {
    console.error(error);
    return DEFAULT_CINEMAS.find(c => c.id === id) || null;
  }
}

export default async function CinemaDetailPage({ 
  params,
  searchParams
}: { 
  params: Promise<{ id: string }>,
  searchParams: Promise<{ name?: string, address?: string }>
}) {
  const { id } = await params;
  const { name, address } = await searchParams;
  let cinema = await getCinema(id);

  if (!cinema && (id.startsWith('cin_dyn_') || id.startsWith('cin_real_'))) {
    cinema = {
      id: id,
      name: name || "TrueTix Partner Cinema",
      address: address || "Local City Center",
      city: "Local",
      hotline: "1800 555 0100",
      amenities: ["IMAX", "Free Parking", "Popcorn Stand"],
      halls: [
        { id: "hall_1", name: "Screen 1", screenType: "IMAX" },
        { id: "hall_2", name: "Screen 2", screenType: "2D" },
        { id: "hall_3", name: "Screen 3", screenType: "3D" }
      ]
    };
  }

  if (!cinema) {
    notFound();
  }

  const getIconForAmenity = (amenity: string) => {
    const lower = amenity.toLowerCase();
    if (lower.includes('imax') || lower.includes('4dx')) return <Monitor className="w-5 h-5" />;
    if (lower.includes('parking') || lower.includes('đỗ xe')) return <Car className="w-5 h-5" />;
    if (lower.includes('popcorn') || lower.includes('bắp')) return <Popcorn className="w-5 h-5" />;
    return <Monitor className="w-5 h-5" />;
  };

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="container mx-auto px-4">
        {/* Cinema Header */}
        <div className="bg-card border border-border rounded-lg overflow-hidden shadow-2xl mb-12">
          <div className="h-64 bg-muted relative">
            <img 
              src="https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80" 
              alt="Cinema Background"
              className="w-full h-full object-cover opacity-50"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
            <div className="absolute bottom-0 left-0 w-full p-8">
              <h1 className="text-4xl font-bold text-white mb-2">{cinema.name}</h1>
              <div className="flex flex-col sm:flex-row gap-4 text-muted-foreground">
                <span className="flex items-center gap-2"><MapPin className="w-4 h-4" /> {cinema.address}</span>
                <span className="flex items-center gap-2"><Phone className="w-4 h-4" /> {cinema.phone || cinema.hotline || '1900 6017'}</span>
              </div>
            </div>
          </div>
          
          {/* Amenities */}
          <div className="p-8 border-t border-border/50 bg-card/50">
            <h3 className="text-lg font-bold mb-4 uppercase">Facilities & Amenities</h3>
            <div className="flex flex-wrap gap-4">
              {cinema.amenities && cinema.amenities.map((amenity: string, idx: number) => (
                <div key={idx} className="flex items-center gap-2 bg-muted/50 px-4 py-2 rounded-full border border-border">
                  {getIconForAmenity(amenity)}
                  <span className="text-sm font-medium">{amenity}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Halls Section */}
        <div className="space-y-6">
          <h2 className="text-3xl font-bold border-l-4 border-primary pl-4 uppercase">Screens & Auditoriums</h2>
          
          {cinema.halls && cinema.halls.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {cinema.halls.map((hall: any) => (
                <Card key={hall.id} className="bg-card/40 backdrop-blur-md border border-border/50 hover:border-primary/50 transition-colors">
                  <CardContent className="p-6 text-center">
                    <Monitor className="w-12 h-12 mx-auto mb-4 text-primary opacity-80" />
                    <h3 className="text-2xl font-bold mb-2 text-white">{hall.name}</h3>
                    <div className="inline-block px-3 py-1 bg-primary/20 text-primary border border-primary/30 rounded-full text-sm font-bold uppercase tracking-wider mt-2">
                      {hall.screenType}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-lg p-10 text-center text-muted-foreground">
              This cinema has not configured any screens yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
