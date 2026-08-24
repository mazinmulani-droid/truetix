"use client";

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, Download, Share2, MapPin, Calendar, Clock, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QRCodeSVG } from 'qrcode.react';

function BookingSuccessContent() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get('bookingId') || 'BKG_MOCK_12345';
  
  const [mounted, setMounted] = useState(false);
  const [ticketDetails, setTicketDetails] = useState<any>(null);

  useEffect(() => {
    setMounted(true);
    
    // Read ticket from offline storage
    const offlineTickets = JSON.parse(localStorage.getItem('truetix-offline-tickets') || '[]');
    const foundTicket = offlineTickets.find((t: any) => t.id === bookingId);
    
    if (foundTicket) {
      setTicketDetails(foundTicket);
    } else {
      // Generate mock HMAC if not found
      const payloadBase64 = btoa(JSON.stringify({ bkg: bookingId, seats: ['MOCK'] }));
      const mockHmac = Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, '0')).join('');
      
      setTicketDetails({
        movieTitle: "TrueTix Cinema Experience",
        cinemaName: "TrueTix Phoenix Marketcity",
        screenName: "IMAX Screen 1",
        showDate: new Date().toISOString(),
        startTime: "19:30",
        endTime: "21:40",
        seats: ["H1", "H2"],
        qrCodeData: `TKT.${payloadBase64}.${mockHmac}`
      });
    }
  }, [bookingId]);

  if (!mounted || !ticketDetails) return null;

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="container mx-auto px-4 flex justify-center">
        <div className="w-full max-w-2xl bg-card border border-border rounded-lg overflow-hidden shadow-2xl">
          
          {/* Header */}
          <div className="bg-green-500/20 p-8 text-center border-b border-green-500/30">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/30 mb-4">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Booking Confirmed!</h1>
            <p className="text-muted-foreground">Order Reference: <span className="font-bold text-white">{bookingId}</span></p>
          </div>

          {/* Ticket Info */}
          <div className="p-8">
            <div className="flex flex-col md:flex-row gap-8">
              
              {/* QR Code Section */}
              <div className="flex-shrink-0 flex flex-col items-center justify-center p-6 bg-white rounded-xl border-4 border-dashed border-gray-300">
                <QRCodeSVG 
                  value={ticketDetails.qrCodeData}
                  size={150}
                  bgColor={"#ffffff"}
                  fgColor={"#000000"}
                  level={"M"}
                />
                <p className="text-black text-xs font-bold mt-4 tracking-widest text-center">E-TICKET QR</p>
              </div>

              {/* Details */}
              <div className="flex-1 space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-primary uppercase mb-1">{ticketDetails.movieTitle}</h2>
                  <p className="text-sm font-medium bg-primary/20 text-primary inline-block px-2 py-0.5 rounded border border-primary/30">
                    2D - Standard
                  </p>
                </div>

                <div className="space-y-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-white" />
                    <div>
                      <p className="font-bold text-white">{ticketDetails.cinemaName}</p>
                      <p>{ticketDetails.screenName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-white" />
                    <p className="font-bold text-white">
                      {new Date(ticketDetails.showDate).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-white" />
                    <p className="font-bold text-white">{ticketDetails.startTime} - {ticketDetails.endTime}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Ticket className="w-5 h-5 text-white" />
                    <p>Seats: <span className="font-bold text-white text-base">{ticketDetails.seats.join(', ')}</span></p>
                  </div>
                </div>

                <div className="pt-4 border-t border-border/50 border-dashed flex justify-between items-center">
                  <span className="text-muted-foreground">Status:</span>
                  <span className="text-xl font-bold text-green-400">Paid & Confirmed</span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-muted/30 p-6 flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="outline" className="gap-2 border-primary/50 text-primary hover:bg-primary hover:text-white">
              <Download className="w-4 h-4" /> Download PDF Ticket
            </Button>
            <Button variant="outline" className="gap-2">
              <Share2 className="w-4 h-4" /> Share
            </Button>
            <Link href="/">
              <Button className="w-full">Return to Home</Button>
            </Link>
          </div>
        </div>
        
        {/* Helper Note */}
        <p className="text-center text-xs text-muted-foreground mt-6 max-w-lg">
          Please present this QR code to cinema staff upon arrival. An electronic copy has also been sent to your email and saved in your &ldquo;My Tickets&rdquo; section.
        </p>
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
