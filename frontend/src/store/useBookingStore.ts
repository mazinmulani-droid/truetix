import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface BookingState {
  movieId: string | null;
  cinemaId: string | null;
  showtimeId: string | null;
  selectedSeats: { id: string; price: number; name: string }[];
  reservationId: string | null;
  expiresAt: string | null;

  // Actions
  setShowtime: (movieId: string, cinemaId: string, showtimeId: string) => void;
  toggleSeat: (seat: { id: string; price: number; name: string }) => void;
  setReservation: (reservationId: string, expiresAt: string) => void;
  resetBooking: () => void;

  // Computed
  getTotalAmount: () => number;
}

export const useBookingStore = create<BookingState>()(
  persist(
    (set, get) => ({
      movieId: null,
      cinemaId: null,
      showtimeId: null,
      selectedSeats: [],
      reservationId: null,
      expiresAt: null,

      setShowtime: (movieId, cinemaId, showtimeId) =>
        set({
          movieId,
          cinemaId,
          showtimeId,
          selectedSeats: [],
          reservationId: null,
          expiresAt: null,
        }),

      toggleSeat: (seat) =>
        set((state) => {
          const exists = state.selectedSeats.find((s) => s.id === seat.id);
          if (exists) {
            return { selectedSeats: state.selectedSeats.filter((s) => s.id !== seat.id) };
          } else {
            return { selectedSeats: [...state.selectedSeats, seat] };
          }
        }),

      setReservation: (reservationId, expiresAt) => set({ reservationId, expiresAt }),

      resetBooking: () =>
        set({
          movieId: null,
          cinemaId: null,
          showtimeId: null,
          selectedSeats: [],
          reservationId: null,
          expiresAt: null,
        }),

      getTotalAmount: () => {
        const state = get();
        return state.selectedSeats.reduce((acc, seat) => acc + seat.price, 0);
      },
    }),
    {
      name: 'truetix-booking-storage',
    }
  )
);
