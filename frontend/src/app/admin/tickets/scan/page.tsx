"use client";

import { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { QrCode, ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';

export default function TicketScanPage() {
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [ticketDetails, setTicketDetails] = useState<any>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  const scanResultRef = useRef<string | null>(null);
  const isVerifyingRef = useRef<boolean>(false);

  const [manualToken, setManualToken] = useState('');

  useEffect(() => {
    scannerRef.current = new Html5QrcodeScanner(
      "qr-reader",
      { fps: 10, qrbox: { width: 250, height: 250 }, supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA] },
      false
    );

    scannerRef.current.render(onScanSuccess, onScanFailure);

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch((error) => {
          console.error("Failed to clear scanner: ", error);
        });
      }
    };
  }, []);

  const onScanSuccess = (decodedText: string) => {
    if (decodedText !== scanResultRef.current && !isVerifyingRef.current) {
      scanResultRef.current = decodedText;
      setScanResult(decodedText);
      verifyTicket(decodedText);
    }
  };

  const onScanFailure = () => {
    // Ignore frame scan failures
  };

  const verifyTicket = async (qrToken: string) => {
    isVerifyingRef.current = true;
    setIsVerifying(true);
    setTicketDetails(null);

    try {
      const res = await api.post(
        '/tickets/verify-qr',
        { qrToken },
        {
          headers: {
            'x-scanner-key': process.env.NEXT_PUBLIC_TURNSTILE_SECRET_KEY || 'turnstile-secret-key-2026',
          },
        }
      );

      if (res && res.data) {
        const data = res.data;
        setTicketDetails({
          status: 'VALID',
          message: 'Ticket successfully verified and checked in!',
          ticket: {
            user: { fullName: data.customerName || 'Customer' },
            seatName: data.seatId,
            booking: {
              showtime: {
                movie: { title: data.movieTitle },
                cinema: { name: data.cinemaName },
                hall: { name: data.hallName },
                startTime: data.checkedInAt,
              },
            },
          },
        });
        toast.success(`Ticket VALID. Admit customer for Seat ${data.seatId}.`);
      }
    } catch (error: any) {
      const errMsg =
        error?.response?.data?.message ||
        error?.message ||
        'Verification failed: Invalid or duplicate ticket.';
      setTicketDetails({
        status: 'INVALID',
        message: errMsg,
      });
      toast.error(errMsg);
    } finally {
      isVerifyingRef.current = false;
      setIsVerifying(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualToken.trim()) return;
    scanResultRef.current = manualToken;
    setScanResult(manualToken);
    verifyTicket(manualToken.trim());
  };

  const handleReset = () => {
    scanResultRef.current = null;
    setScanResult(null);
    setTicketDetails(null);
    setManualToken('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <QrCode className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold">Cinema Turnstile Ticket Scanner</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>QR Scanner & Manual Token Input</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div id="qr-reader" className="w-full max-w-sm mx-auto overflow-hidden rounded-xl border-2 border-primary/20"></div>

            <form onSubmit={handleManualSubmit} className="space-y-3 pt-4 border-t border-border/50">
              <label className="text-xs font-bold text-muted-foreground uppercase">Or Enter / Paste QR Token String</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. TKT.eyJ0aWNrZXRJZCI... (HMAC token)"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary font-mono text-xs"
                />
                <Button type="submit" disabled={!manualToken.trim() || isVerifying}>
                  Verify
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Turnstile Admission Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!scanResult && !isVerifying && (
              <div className="text-center py-12 text-muted-foreground">
                Point customer&apos;s digital ticket QR code towards the camera or paste token above.
              </div>
            )}

            {isVerifying && (
              <div className="flex flex-col items-center justify-center py-12 space-y-4 text-primary">
                <Loader2 className="w-12 h-12 animate-spin" />
                <p className="font-medium">Validating HMAC signature & database check-in...</p>
              </div>
            )}

            {ticketDetails && !isVerifying && (
              <div className={`p-6 rounded-xl border-2 ${ticketDetails.status === 'VALID' ? 'bg-green-500/10 border-green-500/50' : 'bg-destructive/10 border-destructive/50'}`}>
                <div className="flex items-center gap-4 mb-6">
                  {ticketDetails.status === 'VALID' ? (
                    <ShieldCheck className="w-12 h-12 text-green-500" />
                  ) : (
                    <ShieldAlert className="w-12 h-12 text-destructive" />
                  )}
                  <div>
                    <h3 className={`text-2xl font-bold ${ticketDetails.status === 'VALID' ? 'text-green-500' : 'text-destructive'}`}>
                      {ticketDetails.status === 'VALID' ? 'VALID TICKET - ADMIT' : 'ACCESS DENIED'}
                    </h3>
                    <p className="text-sm font-medium opacity-80">{ticketDetails.message}</p>
                  </div>
                </div>

                {ticketDetails.ticket && (
                  <div className="space-y-2 text-sm mt-4 pt-4 border-t border-border/50">
                    <p><span className="text-muted-foreground w-28 inline-block">Customer:</span> <span className="font-bold">{ticketDetails.ticket.user?.fullName}</span></p>
                    <p><span className="text-muted-foreground w-28 inline-block">Film:</span> <span className="font-bold">{ticketDetails.ticket.booking?.showtime?.movie?.title}</span></p>
                    <p><span className="text-muted-foreground w-28 inline-block">Cinema:</span> <span className="font-bold">{ticketDetails.ticket.booking?.showtime?.cinema?.name}</span></p>
                    <p><span className="text-muted-foreground w-28 inline-block">Screen:</span> <span className="font-bold">{ticketDetails.ticket.booking?.showtime?.hall?.name}</span></p>
                    <p><span className="text-muted-foreground w-28 inline-block">Seat:</span> <span className="font-bold text-lg text-primary">{ticketDetails.ticket.seatName}</span></p>
                  </div>
                )}

                <Button className="w-full mt-6" variant="outline" onClick={handleReset}>
                  Scan Next Ticket
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
