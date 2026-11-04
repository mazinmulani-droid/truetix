'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { QRCodeSVG } from 'qrcode.react';
import axios from 'axios';
import { toast } from 'sonner';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { API_URL } from '@/lib/constants';

function MockGatewayContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const bookingId = searchParams.get('bookingId') || searchParams.get('orderId');
  const amount = searchParams.get('amount');
  const signature = searchParams.get('signature') || '';

  const [isProcessing, setIsProcessing] = useState(false);

  if (!bookingId || !amount) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <h2 className="text-2xl font-bold text-destructive">Invalid Request</h2>
        <p className="text-muted-foreground">Missing payment information (bookingId, amount).</p>
        <Button onClick={() => router.push('/')}>Return to Home</Button>
      </div>
    );
  }

  const handleSimulatePayment = async (success: boolean) => {
    setIsProcessing(true);

    // Simulate short network delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    try {
      // Call unified mock callback endpoint
      const status = success ? 'SUCCESS' : 'CANCELLED';
      await axios.get(`${API_URL}/payments/mock/callback`, {
        params: {
          bookingId,
          amount,
          status,
          signature,
        },
      });

      if (success) {
        toast.success('Payment successful & booking confirmed!');
        router.push(`/booking/success?bookingId=${bookingId}`);
      } else {
        toast.error('Payment was cancelled.');
        router.push('/booking/seats');
      }
    } catch (error: any) {
      console.error(error);
      const msg = error?.response?.data?.message || 'An error occurred during payment processing.';
      toast.error(msg);
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">TRUETIX MOCK PAYMENT GATEWAY</h1>
        <p className="text-sm text-muted-foreground">Simulated Payment Gateway (Sandboxed SDE Environment)</p>
      </div>

      <Card className="border-border">
        <CardHeader className="bg-muted/50 border-b">
          <CardTitle className="text-lg flex items-center justify-between">
            <span>Order Summary</span>
            <span className="text-primary font-bold">
              {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(amount))}
            </span>
          </CardTitle>
          <CardDescription>Booking ID: {bookingId}</CardDescription>
        </CardHeader>

        <CardContent className="p-6 space-y-8">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="bg-white p-4 rounded-xl border">
              <QRCodeSVG
                value={`TRUETIX_MOCK_PAYMENT_${bookingId}_${amount}`}
                size={200}
                bgColor={'#ffffff'}
                fgColor={'#000000'}
                level={'Q'}
              />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Scan simulated QR code or click below to complete the test payment transaction.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Button
              variant="outline"
              className="w-full text-destructive hover:bg-destructive hover:text-white"
              onClick={() => handleSimulatePayment(false)}
              disabled={isProcessing}
            >
              Cancel Payment
            </Button>
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold"
              onClick={() => handleSimulatePayment(true)}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...
                </>
              ) : (
                <>
                  <ShieldCheck className="mr-2 h-4 w-4" /> Simulate Success
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function MockPaymentGatewayPage() {
  return (
    <div className="min-h-screen bg-background py-12 flex items-center justify-center">
      <div className="container mx-auto px-4">
        <Suspense fallback={<div className="text-center">Loading payment gateway...</div>}>
          <MockGatewayContent />
        </Suspense>
      </div>
    </div>
  );
}
