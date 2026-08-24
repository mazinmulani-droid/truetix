'use client';

import { useEffect, useState, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/axios';
import { toast } from 'sonner';
import { Clock, Monitor, ChevronRight, Armchair, Lock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBookingStore } from '@/store/useBookingStore';
import { useAuthStore } from '@/store/useAuthStore';
import { io } from 'socket.io-client';
import { SOCKET_URL } from '@/lib/constants';

interface Seat {
  id: string; // row + col e.g. A1
  row: string;
  col: number;
  type: 'STANDARD' | 'VIP' | 'COUPLE' | 'BED';
  status: 'AVAILABLE' | 'HOLDING' | 'RESERVED' | 'SOLD' | 'BLOCKED';
  priceModifier: number;
  price?: number;
  heldByUserId?: string;
}

const generateDefaultMatrix = () => {
  const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const grid: any[][] = [];
  const seatMap: Record<string, Seat> = {};

  rows.forEach((rowLetter) => {
    const rowArr: any[] = [];
    const isVip = ['D', 'E', 'F', 'G'].includes(rowLetter);
    const isCouple = rowLetter === 'H';
    const cols = isCouple ? 5 : 10;

    for (let c = 1; c <= cols; c++) {
      const seatId = `${rowLetter}${c}`;
      const type: 'STANDARD' | 'VIP' | 'COUPLE' = isCouple ? 'COUPLE' : isVip ? 'VIP' : 'STANDARD';
      const priceMod = isCouple ? 1.8 : isVip ? 1.25 : 1.0;
      const isSold = (rowLetter === 'C' && (c === 4 || c === 5)) || (rowLetter === 'F' && c === 7);

      const seatObj: Seat = {
        id: seatId,
        row: rowLetter,
        col: c,
        type: type,
        status: isSold ? 'SOLD' : 'AVAILABLE',
        priceModifier: priceMod,
        price: Math.round(100000 * priceMod)
      };

      rowArr.push(seatObj);
      seatMap[seatId] = seatObj;
    }
    grid.push(rowArr);
  });

  return {
    matrix: { rows: rows.length, cols: 10, grid },
    seatMap,
    basePrice: 100000
  };
};

function SeatsContent() {
  const searchParams = useSearchParams();
  const showtimeId = searchParams.get('showtimeId') || 'st_1';
  const router = useRouter();

  const [matrix, setMatrix] = useState<any>(null);
  const [seats, setSeats] = useState<Record<string, Seat>>({});
  const [basePrice, setBasePrice] = useState(100000);
  const [loading, setLoading] = useState(true);
  const [secondsRemaining, setSecondsRemaining] = useState(600); // 10-min Redis TTL
  
  const { 
    selectedSeats, 
    toggleSeat, 
    setShowtime, 
    setReservation 
  } = useBookingStore();
  const { isAuthenticated, user } = useAuthStore();
  const prevSelectedRef = useRef<string[]>([]);

  // 10-Minute Lock Timer Countdown when seats are selected
  useEffect(() => {
    if (selectedSeats.length === 0) {
      setSecondsRemaining(600);
      return;
    }

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          toast.error('Seat hold session expired. Please reselect your seats.');
          useBookingStore.setState({ selectedSeats: [] });
          return 600;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [selectedSeats.length]);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Cross-Tab Real-Time Sync via BroadcastChannel
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel('truetix_seat_sync');
      channel.onmessage = (event) => {
        const { type, showtimeId: eventShowtimeId, seatIds, senderId } = event.data;
        if (eventShowtimeId !== showtimeId) return;

        setSeats((prev) => {
          const updated = { ...prev };
          if (type === 'LOCK_SEATS') {
            seatIds.forEach((sId: string) => {
              if (updated[sId] && updated[sId].status !== 'SOLD') {
                updated[sId] = { ...updated[sId], status: 'HOLDING', heldByUserId: senderId };
              }
            });
          } else if (type === 'RELEASE_SEATS') {
            seatIds.forEach((sId: string) => {
              if (updated[sId] && updated[sId].status === 'HOLDING') {
                updated[sId] = { ...updated[sId], status: 'AVAILABLE', heldByUserId: undefined };
              }
            });
          } else if (type === 'BOOK_SEATS') {
            seatIds.forEach((sId: string) => {
              if (updated[sId]) {
                updated[sId] = { ...updated[sId], status: 'SOLD' };
              }
            });
          }
          return updated;
        });
      };
    } catch (e) {
      console.warn('BroadcastChannel not supported');
    }

    return () => {
      if (channel) channel.close();
    };
  }, [showtimeId]);

  // Broadcast current selections to other open tabs / windows
  useEffect(() => {
    const currentIds = selectedSeats.map(s => s.id);
    const prevIds = prevSelectedRef.current;

    // Determine newly locked and newly released seats
    const newlyLocked = currentIds.filter(id => !prevIds.includes(id));
    const newlyReleased = prevIds.filter(id => !currentIds.includes(id));

    try {
      const channel = new BroadcastChannel('truetix_seat_sync');
      if (newlyLocked.length > 0) {
        channel.postMessage({
          type: 'LOCK_SEATS',
          showtimeId,
          seatIds: newlyLocked,
          senderId: user?.id || 'local_user'
        });
      }
      if (newlyReleased.length > 0) {
        channel.postMessage({
          type: 'RELEASE_SEATS',
          showtimeId,
          seatIds: newlyReleased,
          senderId: user?.id || 'local_user'
        });
      }
      channel.close();
    } catch (e) {
      // Ignored
    }

    prevSelectedRef.current = currentIds;
  }, [selectedSeats, showtimeId, user?.id]);

  useEffect(() => {
    const fetchMatrix = async () => {
      try {
        const res: any = await api.get(`/showtimes/${showtimeId}/seats`);
        if (res.success && res.data?.hall?.roomMatrix?.grid) {
          const data = res.data;
          setMatrix(data.hall.roomMatrix);
          setBasePrice(data.basePrice || 100000);
          
          const seatMap: Record<string, Seat> = {};
          data.hall.roomMatrix.grid.forEach((row: any) => {
            if (Array.isArray(row)) {
              row.forEach((seat: any) => {
                if (seat && seat.id) seatMap[seat.id] = seat;
              });
            }
          });
          
          if (data.seats && Array.isArray(data.seats)) {
            data.seats.forEach((s: any) => {
              if (seatMap[s.seatId]) {
                seatMap[s.seatId] = {
                  ...seatMap[s.seatId],
                  status: s.status,
                  priceModifier: s.priceModifier,
                  price: s.price,
                  heldByUserId: s.heldByUserId
                };
              }
            });
          }
          setSeats(seatMap);
          setShowtime(data.movieId || 'mov_1', data.cinemaId || 'cin_1', showtimeId);
          setLoading(false);
          return;
        }
      } catch (error) {
        console.warn('Backend offline, generating default auditorium seat layout.');
      }

      // Default Matrix Fallback
      const fallback = generateDefaultMatrix();
      setMatrix(fallback.matrix);
      setSeats(fallback.seatMap);
      setBasePrice(fallback.basePrice);
      setShowtime('mov_1', 'cin_1', showtimeId);
      setLoading(false);
    };

    fetchMatrix();

    // Socket.io for live updates
    let socket: any = null;
    try {
      socket = io(SOCKET_URL);
      socket.emit('join:showtime', { showtimeId });
      socket.on('seat:state_changed', (data: any) => {
        setSeats(prevSeats => {
          const newSeats = { ...prevSeats };
          if (newSeats[data.seatId]) {
            newSeats[data.seatId] = { 
              ...newSeats[data.seatId], 
              status: data.status,
              heldByUserId: data.heldByUserId
            };
          }
          return newSeats;
        });
      });
    } catch (err) {
      console.warn('WebSocket server offline, running in resilient standalone mode.');
    }

    return () => {
      if (socket) socket.disconnect();
    };
  }, [showtimeId, setShowtime]);

  const handleSeatClick = (seat: Seat) => {
    const currentSeat = seats[seat.id] || seat;
    const isSelected = !!selectedSeats.find(s => s.id === currentSeat.id);

    // Double Booking / Sold Seat Click Protection
    if (currentSeat.status === 'SOLD') {
      toast.error(`🚫 Double-Booking Blocked: Seat ${currentSeat.id} is already SOLD and cannot be booked!`, {
        description: 'PostgreSQL Transaction and Redlock prevent duplicate ticket purchases.',
        duration: 4000
      });
      return;
    }

    // Temporary Hold / Concurrency Lock Protection
    if (currentSeat.status === 'HOLDING' && !isSelected && currentSeat.heldByUserId !== user?.id) {
      toast.warning(`⏳ Double-Booking Blocked: Seat ${currentSeat.id} is currently held by another customer!`, {
        description: 'Protected by 10-Minute Redis TTL temporary seat lock.',
        duration: 4000
      });
      return;
    }

    if (currentSeat.status === 'BLOCKED') {
      toast.error(`Seat ${currentSeat.id} is currently unavailable.`);
      return;
    }

    const price = currentSeat.price ? currentSeat.price : Math.round(basePrice * (currentSeat.priceModifier || 1.0));
    toggleSeat({
      id: currentSeat.id,
      name: currentSeat.id,
      price: price
    });
  };

  const handleHoldSeats = async () => {
    if (selectedSeats.length === 0) return;
    
    if (!isAuthenticated) {
      toast.info('Booking as guest. Continuing to snacks & combos!');
    }
    
    try {
      const res: any = await api.post(`/bookings/hold-seat`, {
        showtimeId,
        seatIds: selectedSeats.map(s => s.id)
      });
      
      if (res.success) {
        setReservation(res.data.reservationId, res.data.expiresAt);
        router.push('/booking/fb');
        return;
      }
    } catch (error: any) {
      if (error.response?.status === 409) {
        toast.error('Some of the seats you selected have just been booked. Please choose different seats.');
        return;
      }
    }

    // Fallback: reserve locally with 10-minute expiry
    const mockReservationId = `res_${Date.now()}`;
    const mockExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    setReservation(mockReservationId, mockExpiresAt);
    router.push('/booking/fb');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground font-semibold">Loading TrueTix Auditorium Layout...</p>
      </div>
    );
  }

  const totalPrice = selectedSeats.reduce((acc, seat) => acc + seat.price, 0);

  return (
    <div className="min-h-screen bg-background pb-32 pt-6">
      <div className="container mx-auto px-4 py-4">
        
        {/* Header with Title and 10-Min TTL Countdown */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black text-white uppercase tracking-tight flex items-center gap-3">
              <span className="w-2 h-8 bg-primary rounded-full shadow-[0_0_12px_rgba(225,29,72,0.8)]" />
              Choose Your Seats
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Select up to 8 seats in standard, VIP, or couple rows.</p>
          </div>

          {selectedSeats.length > 0 && (
            <div className="flex items-center gap-3 bg-red-950/60 border border-primary/40 px-4 py-2 rounded-full shadow-[0_0_20px_rgba(225,29,72,0.3)] animate-pulse">
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-xs text-gray-300 font-medium">Temporary Lock (10-min TTL):</span>
              <span className="text-sm font-black text-primary font-mono">{formatTimer(secondsRemaining)}</span>
            </div>
          )}
        </div>

        {/* Screen Indicator */}
        <div className="flex flex-col items-center mb-12">
          <div className="w-full max-w-2xl h-12 bg-gradient-to-b from-primary/30 to-transparent rounded-t-full border-t-4 border-primary flex items-center justify-center shadow-[0_-10px_35px_rgba(225,29,72,0.4)]">
            <span className="text-white font-bold uppercase tracking-widest text-xs md:text-sm flex items-center gap-2">
              <Monitor className="w-4 h-4 text-primary" /> SCREEN THIS WAY
            </span>
          </div>
        </div>

        {/* Seat Matrix Grid */}
        <div className="overflow-x-auto pb-8 scrollbar-thin scrollbar-thumb-primary/20">
          <p className="text-xs text-center text-muted-foreground mb-6 md:hidden">
            ↔ Swipe horizontally to view full auditorium layout
          </p>
          
          <div className="min-w-max mx-auto flex flex-col items-center gap-3 px-4">
            {matrix?.grid?.map((rowArr: any[], rowIndex: number) => (
              <div key={`row-${rowIndex}`} className="flex items-center gap-4">
                <div className="w-6 text-center font-bold text-muted-foreground text-sm">
                  {String.fromCharCode(65 + rowIndex)}
                </div>
                
                <div className="flex gap-2">
                  {rowArr.map((seat: any, colIndex: number) => {
                    if (!seat || seat.type === 'EMPTY') {
                      return <div key={`empty-${rowIndex}-${colIndex}`} className="w-8 h-8 md:w-10 md:h-10" />;
                    }

                    const currentSeat = seats[seat.id] || seat;
                    const isSelected = !!selectedSeats.find(s => s.id === currentSeat.id);
                    
                    let bgClass = "bg-zinc-800 text-gray-300 border-zinc-700 hover:border-primary hover:text-white cursor-pointer"; // AVAILABLE STANDARD
                    if (currentSeat.type === 'VIP') bgClass = "bg-amber-950/40 border-amber-500/50 text-amber-300 hover:bg-amber-500/30 cursor-pointer";
                    if (currentSeat.type === 'COUPLE') bgClass = "bg-pink-950/40 border-pink-500/50 text-pink-300 hover:bg-pink-500/30 cursor-pointer";
                    
                    if (currentSeat.status === 'SOLD') bgClass = "bg-zinc-950 text-zinc-600 border-zinc-900 cursor-not-allowed opacity-50 hover:border-destructive/60 hover:text-destructive";
                    if (currentSeat.status === 'HOLDING' && !isSelected) bgClass = "bg-yellow-950/70 text-yellow-400 border-yellow-500/80 cursor-not-allowed shadow-[0_0_12px_rgba(234,179,8,0.4)] animate-pulse";
                    if (currentSeat.status === 'BLOCKED') bgClass = "bg-black text-transparent cursor-not-allowed border-none opacity-20";
                    
                    if (isSelected) bgClass = "bg-primary text-white shadow-[0_0_15px_rgba(225,29,72,0.8)] border-primary scale-110 z-10 transition-transform font-bold cursor-pointer";

                    return (
                      <button
                        key={currentSeat.id}
                        type="button"
                        onClick={() => handleSeatClick(currentSeat)}
                        className={`
                          relative h-8 md:h-10 rounded-t-lg rounded-b-sm border flex items-center justify-center text-xs font-semibold transition-all
                          ${currentSeat.type === 'COUPLE' ? 'w-[4.5rem] md:w-[5.5rem]' : 'w-8 md:w-10'}
                          ${bgClass}
                        `}
                      >
                        {isSelected ? (
                          <Armchair className="w-4 h-4" />
                        ) : currentSeat.status === 'SOLD' ? (
                          <span className="text-[10px] font-bold text-zinc-600 line-through">✕ {currentSeat.id}</span>
                        ) : currentSeat.status === 'HOLDING' ? (
                          <span className="text-[10px] font-bold text-yellow-400 flex items-center gap-0.5"><Lock className="w-3 h-3" /> {currentSeat.id}</span>
                        ) : (
                          currentSeat.id
                        )}
                      </button>
                    );
                  })}
                </div>
                
                <div className="w-6 text-center font-bold text-muted-foreground text-sm">
                  {String.fromCharCode(65 + rowIndex)}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Legends */}
        <div className="flex flex-wrap justify-center gap-4 md:gap-8 mt-6 p-4 bg-zinc-950/80 backdrop-blur-md rounded-xl border border-white/10 max-w-3xl mx-auto shadow-lg">
          <div className="flex items-center gap-2 text-xs md:text-sm text-gray-300">
            <div className="w-5 h-5 bg-zinc-800 border border-zinc-700 rounded-t-lg" /> Standard
          </div>
          <div className="flex items-center gap-2 text-xs md:text-sm text-amber-400">
            <div className="w-5 h-5 bg-amber-950/40 border border-amber-500/50 rounded-t-lg" /> VIP
          </div>
          <div className="flex items-center gap-2 text-xs md:text-sm text-pink-400">
            <div className="w-8 h-5 bg-pink-950/40 border border-pink-500/50 rounded-t-lg" /> Couple
          </div>
          <div className="flex items-center gap-2 text-xs md:text-sm text-primary font-bold">
            <div className="w-5 h-5 bg-primary border border-primary rounded-t-lg shadow-[0_0_8px_rgba(225,29,72,0.8)]" /> Selected
          </div>
          <div className="flex items-center gap-2 text-xs md:text-sm text-yellow-400 font-medium">
            <div className="w-5 h-5 bg-yellow-950/70 border border-yellow-500/80 rounded-t-lg flex items-center justify-center text-[9px]">🔒</div> Holding (10m)
          </div>
          <div className="flex items-center gap-2 text-xs md:text-sm text-zinc-500">
            <div className="w-5 h-5 bg-zinc-950 border border-zinc-800 rounded-t-lg opacity-50 flex items-center justify-center text-[10px] text-zinc-600">✕</div> Sold
          </div>
        </div>
      </div>

      {/* Bottom Summary Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-zinc-950/95 backdrop-blur-xl border-t border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.8)] z-50 p-4">
        <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="w-full sm:w-auto flex justify-between sm:block">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Selected Seats:</p>
              <p className="font-black text-base md:text-lg text-white max-w-[240px] md:max-w-none truncate">
                {selectedSeats.length > 0 
                  ? selectedSeats.map(s => s.name).join(', ') 
                  : 'None selected'}
              </p>
            </div>
            <div className="text-right sm:hidden">
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Subtotal:</p>
              <p className="font-black text-xl text-primary">{totalPrice.toLocaleString('en-US')} VND</p>
            </div>
          </div>
          
          <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-6">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Subtotal:</p>
              <p className="font-black text-2xl text-primary">{totalPrice.toLocaleString('en-US')} VND</p>
            </div>
            
            <Button 
              size="lg" 
              onClick={handleHoldSeats}
              disabled={selectedSeats.length === 0}
              className="w-full sm:w-auto text-base md:text-lg font-bold px-8 shadow-lg shadow-primary/40 bg-primary hover:bg-primary/90 text-white rounded-full"
            >
              Continue to Combos <ChevronRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SeatsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <SeatsContent />
    </Suspense>
  );
}
