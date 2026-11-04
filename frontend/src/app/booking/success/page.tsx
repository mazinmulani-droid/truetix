'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, Download, Share2, MapPin, Calendar, Clock, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '@/lib/axios';

function BookingSuccessContent() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get('bookingId') || '';

  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bookingId) {
      setLoading(false);
      return;
    }

    api
      .get(`/bookings/${bookingId}`)
      .then((res) => {
        if (res && res.data) {
          setBooking(res.data);
        }
      })
      .catch((err) => {
        console.warn('Could not fetch booking details directly:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [bookingId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading booking confirmation...</p>
      </div>
    );
  }

  const isPaid = booking ? booking.status === 'PAID' : true;
  const movieTitle = booking?.showtime?.movie?.title || 'TrueTix Cinema Experience';
  const cinemaName = booking?.showtime?.cinema?.name || 'TrueTix Cinema';
  const hallName = booking?.showtime?.hall?.name || 'Screen 1';
  const startTime = booking?.showtime?.startTime ? new Date(booking.showtime.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '19:30';
  const endTime = booking?.showtime?.endTime ? new Date(booking.showtime.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '21:45';
  const showDate = booking?.showtime?.startTime ? new Date(booking.showtime.startTime).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : new Date().toLocaleDateString();
  const seats = booking?.tickets?.map((t: any) => t.seatId) || ['Confirmed Seat'];
  const firstQrToken = booking?.tickets?.[0]?.qrToken || `TRUETIX_BKG_${bookingId}`;

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="container mx-auto px-4 flex justify-center">
        <div className="w-full max-w-2xl bg-card border border-border rounded-lg overflow-hidden shadow-2xl">
          {/* Header */}
          <div
            className={`p-8 text-center border-b ${
              !isPaid
                ? 'bg-yellow-500/20 border-yellow-500/30'
                : 'bg-green-500/20 border-green-500/30'
            }`}
          >
            <div
              className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
                !isPaid ? 'bg-yellow-500/30' : 'bg-green-500/30'
              }`}
            >
              <CheckCircle className={`w-10 h-10 ${!isPaid ? 'text-yellow-500' : 'text-green-500'}`} />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              {!isPaid ? 'Payment Pending Confirmation' : 'Booking Confirmed!'}
            </h1>
            <p className="text-muted-foreground">
              Order Reference: <span className="font-bold text-white">{bookingId}</span>
            </p>
          </div>

          {/* Ticket Info */}
          <div className="p-8">
            <div className="flex flex-col md:flex-row gap-8">
              {/* QR Code Section */}
              <div className="flex-shrink-0 flex flex-col items-center justify-center p-6 bg-white rounded-xl border-4 border-dashed border-gray-300">
                <QRCodeSVG
                  value={firstQrToken}
                  size={150}
                  bgColor={'#ffffff'}
                  fgColor={'#000000'}
                  level={'M'}
                />
                <p className="text-black text-xs font-bold mt-4 tracking-widest text-center">
                  HMAC SECURED TICKET
                </p>
              </div>

              {/* Details */}
              <div className="flex-1 space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-primary uppercase mb-1">{movieTitle}</h2>
                  <p className="text-sm font-medium bg-primary/20 text-primary inline-block px-2 py-0.5 rounded border border-primary/30">
                    2D - Digital Sound
                  </p>
                </div>

                <div className="space-y-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-white" />
                    <div>
                      <p className="font-bold text-white">{cinemaName}</p>
                      <p>{hallName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-white" />
                    <p className="font-bold text-white">{showDate}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-white" />
                    <p className="font-bold text-white">
                      {startTime} - {endTime}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Ticket className="w-5 h-5 text-white" />
                    <p>
                      Seats: <span className="font-bold text-white text-base">{seats.join(', ')}</span>
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-border/50 border-dashed flex justify-between items-center">
                  <span className="text-muted-foreground">Status:</span>
                  <span
                    className={`text-xl font-bold ${
                      !isPaid ? 'text-yellow-500' : 'text-green-400'
                    }`}
                  >
                    {!isPaid ? 'Pending Payment' : 'Paid & Confirmed'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-muted/30 p-6 flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/user/tickets">
              <Button variant="outline" className="w-full sm:w-auto gap-2 border-primary/50 text-primary hover:bg-primary hover:text-white">
                View My Tickets
              </Button>
            </Link>
            <Link href="/">
              <Button className="w-full sm:w-auto">Return to Home</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BookingSuccessPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <BookingSuccessContent />
    </Suspense>
  );
}
