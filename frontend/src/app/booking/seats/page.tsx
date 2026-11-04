'use client';

import { useEffect, useState, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/axios';
import { toast } from 'sonner';
import { Clock, Monitor, ChevronRight, Armchair, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBookingStore } from '@/store/useBookingStore';
import { useAuthStore } from '@/store/useAuthStore';
import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '@/lib/constants';

interface Seat {
  id: string; // e.g. A1
  row: string;
  col: number;
  type: 'STANDARD' | 'VIP' | 'COUPLE' | 'ACCESSIBLE' | 'EMPTY_SPACE';
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

      const seatObj: Seat = {
        id: seatId,
        row: rowLetter,
        col: c,
        type: type,
        status: 'AVAILABLE',
        priceModifier: priceMod,
        price: Math.round(250 * priceMod),
      };

      rowArr.push(seatObj);
      seatMap[seatId] = seatObj;
    }
    grid.push(rowArr);
  });

  return {
    matrix: { rows: rows.length, cols: 10, grid },
    seatMap,
    basePrice: 250,
  };
};

function SeatsContent() {
  const searchParams = useSearchParams();
  const showtimeId = searchParams.get('showtimeId') || 'st_demo_1';
  const router = useRouter();

  const [matrix, setMatrix] = useState<any>(null);
  const [seats, setSeats] = useState<Record<string, Seat>>({});
  const [basePrice, setBasePrice] = useState(250);
  const [loading, setLoading] = useState(true);
  const [secondsRemaining, setSecondsRemaining] = useState(600);
  const [socket, setSocket] = useState<Socket | null>(null);

  const { selectedSeats, toggleSeat, setShowtime, setReservation } = useBookingStore();
  const { isAuthenticated, user, accessToken } = useAuthStore();

  // Load seat matrix and statuses from NestJS backend
  const loadShowtimeSeats = useCallback(async () => {
    try {
      const res = await api.get(`/showtimes/${showtimeId}/seats`);
      if (res && res.data) {
        const data = res.data;
        setBasePrice(data.basePrice || 250);
        setShowtime(data.movieId || 'mov_1', data.cinemaId || 'cin_1', showtimeId);

        const seatMap: Record<string, Seat> = {};
        if (Array.isArray(data.seats)) {
          data.seats.forEach((s: any) => {
            seatMap[s.seatId] = {
              id: s.seatId,
              row: s.row,
              col: s.col,
              type: s.type,
              status: s.status,
              priceModifier: s.priceModifier || 1.0,
              price: s.price,
              heldByUserId: s.heldByUserId,
            };
          });
        }

        if (data.hall?.roomMatrix?.grid) {
          setMatrix(data.hall.roomMatrix);
        } else {
          const fallback = generateDefaultMatrix();
          setMatrix(fallback.matrix);
        }
        setSeats(seatMap);
        setLoading(false);
        return;
      }
    } catch {
      // Fallback matrix if backend showtime is demo
    }

    const fallback = generateDefaultMatrix();
    setMatrix(fallback.matrix);
    setSeats(fallback.seatMap);
    setBasePrice(fallback.basePrice);
    setShowtime('mov_1', 'cin_1', showtimeId);
    setLoading(false);
  }, [showtimeId, setShowtime]);

  // Initial load
  useEffect(() => {
    loadShowtimeSeats();
  }, [loadShowtimeSeats]);

  // Connect to NestJS WebSocket Gateway for real-time seat synchronization
  useEffect(() => {
    const s = io(SOCKET_URL, {
      auth: { token: accessToken || '' },
      transports: ['websocket', 'polling'],
    });

    s.on('connect', () => {
      s.emit('join:showtime', { showtimeId });
    });

    s.on('seat:state_changed', (payload: { showtimeId: string; seatId: string; status: any; heldByUserId?: string }) => {
      if (payload.showtimeId === showtimeId) {
        setSeats((prev) => {
          const existing = prev[payload.seatId];
          if (!existing) return prev;
          return {
            ...prev,
            [payload.seatId]: {
              ...existing,
              status: payload.status,
              heldByUserId: payload.heldByUserId,
            },
          };
        });
      }
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, [showtimeId, accessToken]);

  // 10-Minute Lock Timer Countdown when seats are held
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
          loadShowtimeSeats();
          return 600;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [selectedSeats.length, loadShowtimeSeats]);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSeatClick = async (seat: Seat) => {
    const currentSeat = seats[seat.id] || seat;
    const isSelected = !!selectedSeats.find((s) => s.id === currentSeat.id);
    const currentUserId = user?.id;

    if (currentSeat.status === 'SOLD') {
      toast.error(`Seat ${currentSeat.id} is already SOLD.`);
      return;
    }

    if (currentSeat.status === 'HOLDING' && !isSelected && currentSeat.heldByUserId && currentSeat.heldByUserId !== currentUserId) {
      toast.warning(`Seat ${currentSeat.id} is currently held by another user.`);
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
      price: price,
    });
  };

  // Hold seats atomically in NestJS / Redis
  const handleHoldSeats = async () => {
    if (selectedSeats.length === 0) return;

    if (!isAuthenticated) {
      toast.info('Please log in to reserve your seats.');
      router.push(`/login?redirect=/booking/seats?showtimeId=${showtimeId}`);
      return;
    }

    try {
      const seatIds = selectedSeats.map((s) => s.id);
      const res = await api.post('/bookings/hold-seat', {
        showtimeId,
        seatIds,
      });

      if (res && res.data) {
        const { reservationId, expiresAt } = res.data;
        setReservation(reservationId, expiresAt);
        toast.success(`Reserved ${seatIds.length} seat(s) for 10 minutes.`);
        router.push('/booking/fb');
        return;
      }
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err?.message || 'Failed to hold seats';
      toast.error(errMsg);
      // Refresh seats from backend to reflect true state
      loadShowtimeSeats();
    }
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
                    if (!seat || seat.type === 'EMPTY_SPACE' || seat.type === 'EMPTY') {
                      return <div key={`empty-${rowIndex}-${colIndex}`} className="w-8 h-8 md:w-10 md:h-10" />;
                    }

                    const currentSeat = seats[seat.id] || seat;
                    const isSelected = !!selectedSeats.find((s) => s.id === currentSeat.id);
                    const currentUserId = user?.id;
                    const isHeldByOther =
                      currentSeat.status === 'HOLDING' && !isSelected && currentSeat.heldByUserId && currentSeat.heldByUserId !== currentUserId;

                    let bgClass = 'bg-zinc-800 text-gray-300 border-zinc-700 hover:border-primary hover:text-white cursor-pointer';
                    if (currentSeat.type === 'VIP') bgClass = 'bg-amber-950/40 border-amber-500/50 text-amber-300 hover:bg-amber-500/30 cursor-pointer';
                    if (currentSeat.type === 'COUPLE') bgClass = 'bg-pink-950/40 border-pink-500/50 text-pink-300 hover:bg-pink-500/30 cursor-pointer';

                    if (currentSeat.status === 'SOLD') bgClass = 'bg-zinc-950 text-zinc-600 border-zinc-900 cursor-not-allowed opacity-50';
                    if (isHeldByOther)
                      bgClass =
                        'bg-amber-500 text-zinc-950 border-2 border-amber-300 font-black cursor-not-allowed shadow-[0_0_20px_rgba(245,158,11,0.9)] scale-105 z-10 transition-transform animate-pulse';
                    if (currentSeat.status === 'BLOCKED') bgClass = 'bg-black text-transparent cursor-not-allowed border-none opacity-20';

                    if (isSelected)
                      bgClass =
                        'bg-primary text-white shadow-[0_0_15px_rgba(225,29,72,0.8)] border-primary scale-110 z-10 transition-transform font-bold cursor-pointer';

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
                        ) : isHeldByOther ? (
                          <span className="text-[11px] font-black text-zinc-950 flex items-center justify-center gap-1">
                            <Lock className="w-3.5 h-3.5 text-zinc-950 stroke-[3]" />
                            {currentSeat.id}
                          </span>
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
          <div className="flex items-center gap-2 text-xs md:text-sm text-amber-300 font-bold">
            <div className="w-6 h-6 bg-amber-500 text-zinc-950 border-2 border-amber-300 rounded-t-lg flex items-center justify-center text-[10px] font-black shadow-[0_0_12px_rgba(245,158,11,0.8)]">
              <Lock className="w-3.5 h-3.5 stroke-[3]" />
            </div>
            Locked / Held (10m)
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
                {selectedSeats.length > 0 ? selectedSeats.map((s) => s.name).join(', ') : 'None selected'}
              </p>
            </div>
            <div className="text-right sm:hidden">
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Subtotal:</p>
              <p className="font-black text-xl text-primary">{totalPrice.toLocaleString('en-IN')} INR</p>
            </div>
          </div>

          <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-6">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Subtotal:</p>
              <p className="font-black text-2xl text-primary">{totalPrice.toLocaleString('en-IN')} INR</p>
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
