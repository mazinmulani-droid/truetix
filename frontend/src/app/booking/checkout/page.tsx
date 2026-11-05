'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronLeft, CreditCard, Wallet, Ticket, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useBookingStore } from '@/store/useBookingStore';
import { useAuthStore } from '@/store/useAuthStore';
import { api } from '@/lib/axios';

export default function CheckoutPage() {
  const router = useRouter();
  const {
    showtimeId,
    selectedSeats,
    reservationId,
    combos,
    appliedVoucher,
    getTotalAmount,
    resetBooking,
  } = useBookingStore();

  const { isAuthenticated, accessToken } = useAuthStore();
  const [paymentMethod] = useState<'MOCK_GATEWAY'>('MOCK_GATEWAY');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (selectedSeats.length === 0) {
      router.push('/booking/seats');
    }
  }, [selectedSeats, router]);

  const handleCheckout = async () => {
    if (!isAuthenticated) {
      toast.info('Please log in to complete checkout.');
      router.push('/login?redirect=/booking/checkout');
      return;
    }

    setIsProcessing(true);

    try {
      const res = await api.post('/bookings/checkout', {
        reservationId: reservationId || undefined,
        showtimeId: showtimeId || 'st_demo_1',
        seatIds: selectedSeats.map((s) => s.id),
        paymentMethod: paymentMethod === 'CGV_CARD' ? 'CGV_CARD' : 'MOCK_GATEWAY',
        comboIds: combos.map((c) => ({ comboId: c.comboId, quantity: c.quantity })),
        voucherCode: appliedVoucher?.code,
      });

      if (res && res.data) {
        const { bookingId, paymentUrl, status } = res.data;

        if (status === 'PAID') {
          toast.success('Payment completed successfully!');
          resetBooking();
          router.push(`/booking/success?bookingId=${bookingId}`);
          return;
        }

        if (paymentUrl) {
          toast.info('Redirecting to secure payment sandbox...');
          resetBooking();
          // Extract pathname and query from full URL or relative URL
          try {
            const urlObj = new URL(paymentUrl);
            router.push(urlObj.pathname + urlObj.search);
          } catch {
            router.push(paymentUrl);
          }
          return;
        }

        resetBooking();
        router.push(`/booking/success?bookingId=${bookingId}`);
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      const errMsg =
        error?.response?.data?.message ||
        error?.message ||
        'Checkout failed. Your seat hold may have expired.';
      toast.error(errMsg);

      // If hold expired, redirect user to reselect seats
      if (
        error?.response?.data?.code === 'SEAT_LOCK_EXPIRED_OR_NOT_OWNED' ||
        errMsg.toLowerCase().includes('expired')
      ) {
        setTimeout(() => {
          router.push(`/booking/seats?showtimeId=${showtimeId}`);
        }, 1500);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const seatsTotal = selectedSeats.reduce((acc, seat) => acc + seat.price, 0);

  return (
    <div className="min-h-screen bg-background py-10 pb-24">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="text-gray-400 hover:text-white"
            >
              <ChevronLeft className="w-6 h-6" />
            </Button>
            <div>
              <h1 className="text-3xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                <span className="w-2 h-8 bg-primary rounded-full shadow-[0_0_10px_rgba(225,29,72,0.8)]" />
                Checkout & Payment
              </h1>
              <p className="text-xs text-muted-foreground mt-1">
                Review your tickets and select your payment method.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Payment Method Selection */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-zinc-900/80 border-white/10 shadow-xl">
              <CardHeader className="border-b border-white/10 pb-4">
                <CardTitle className="text-lg uppercase text-white font-bold flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-primary" /> Select Payment Method
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4 pt-6">
                {/* Payment Option: Mock Payment Gateway */}
                <div
                  className="p-4 border rounded-xl flex items-center justify-between border-primary bg-primary/10 shadow-[0_0_15px_rgba(225,29,72,0.2)]"
                >
                  <div className="flex items-center gap-4">
                    <div className="bg-blue-500/20 p-3 rounded-lg text-blue-400 border border-blue-500/30">
                      <CreditCard className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base">
                        Simulated Payment Sandbox (Mock Gateway)
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Simulate credit card, netbanking, or UPI sandbox transaction
                      </p>
                    </div>
                  </div>
                  <div className="w-6 h-6 rounded-full border-2 flex items-center justify-center border-primary">
                    <div className="w-3 h-3 bg-primary rounded-full shadow-[0_0_8px_rgba(225,29,72,0.8)]" />
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
                  <ShieldCheck className="w-4 h-4 text-green-500" />
                  <span>Atomic database transaction protects seats during payment.</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Order Summary */}
          <div className="lg:col-span-1">
            <Card className="bg-zinc-900/80 border-white/10 shadow-xl sticky top-20">
              <CardHeader className="border-b border-white/10 pb-4">
                <CardTitle className="uppercase text-lg text-white font-bold flex items-center gap-2">
                  <Ticket className="w-5 h-5 text-primary" /> Order Summary
                </CardTitle>
              </CardHeader>

              <CardContent className="p-0">
                <div className="p-6 space-y-4">
                  {/* Seats */}
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-white">Cinema Seats ({selectedSeats.length})</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Seats: {selectedSeats.map((s) => s.name).join(', ')}
                      </p>
                    </div>
                    <p className="font-black text-white">{seatsTotal.toLocaleString('en-IN')} INR</p>
                  </div>

                  {/* Combos */}
                  {combos.length > 0 && (
                    <div className="pt-4 border-t border-white/10 border-dashed">
                      <p className="font-bold text-white mb-2 text-sm">
                        Food & Drinks ({combos.reduce((a, b) => a + b.quantity, 0)})
                      </p>
                      <div className="space-y-2">
                        {combos.map((combo) => (
                          <div key={combo.comboId} className="flex justify-between text-xs">
                            <span className="text-gray-300">
                              {combo.quantity}x {combo.name}
                            </span>
                            <span className="font-mono text-white">
                              {(combo.price * combo.quantity).toLocaleString('en-IN')} INR
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Discount */}
                  {appliedVoucher && (
                    <div className="pt-4 border-t border-white/10 border-dashed flex justify-between items-center text-primary">
                      <span className="font-bold text-xs flex items-center gap-1.5">
                        <Ticket className="w-4 h-4" /> Promo Code: {appliedVoucher.code}
                      </span>
                      <span className="font-black text-sm">
                        -{appliedVoucher.discountAmount.toLocaleString('en-IN')} INR
                      </span>
                    </div>
                  )}
                </div>

                {/* Total */}
                <div className="p-6 bg-primary/10 border-t border-primary/20 flex justify-between items-center">
                  <span className="font-black text-white text-lg uppercase tracking-wider">Total</span>
                  <span className="font-black text-3xl text-primary">
                    {getTotalAmount().toLocaleString('en-IN')} INR
                  </span>
                </div>

                <div className="p-6 pt-2">
                  <Button
                    className="w-full text-base md:text-lg font-bold h-12 bg-primary hover:bg-primary/90 text-white rounded-full shadow-[0_0_20px_rgba(225,29,72,0.5)]"
                    onClick={handleCheckout}
                    disabled={isProcessing}
                  >
                    {isProcessing ? 'Processing...' : 'Confirm & Proceed to Pay'}
                  </Button>
                  <p className="text-center text-[11px] text-muted-foreground mt-3">
                    Instant HMAC-signed electronic QR ticket delivered upon payment confirmation.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
