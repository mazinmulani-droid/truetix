'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { toast } from 'sonner';
import { Clock, ChevronRight, ChevronLeft, Ticket, CheckCircle2, ShoppingBag, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useBookingStore } from '@/store/useBookingStore';
import { useAuthStore } from '@/store/useAuthStore';
import { Input } from '@/components/ui/input';
import { API_URL } from '@/lib/constants';

const DEFAULT_COMBOS = [
  {
    id: 'combo_1',
    title: 'Single Combo (1 Popcorn + 1 Soft Drink)',
    description: '1 Large Butter Popcorn (64oz) & 1 Large Soft Drink (32oz)',
    price: 85000,
    imageUrl: 'https://images.unsplash.com/photo-1585647347483-22b66260dfff?q=80&w=600&auto=format&fit=crop',
  },
  {
    id: 'combo_2',
    title: 'Couple Combo (1 Jumbo Popcorn + 2 Drinks)',
    description: '1 Jumbo Sweet/Salted Popcorn & 2 Large Soft Drinks of your choice',
    price: 115000,
    imageUrl: 'https://images.unsplash.com/photo-1572177812156-58036aae439c?q=80&w=600&auto=format&fit=crop',
  },
  {
    id: 'combo_3',
    title: 'Family Feast Combo (2 Popcorns + 4 Drinks + Nachos)',
    description: '2 Jumbo Popcorns, 4 Drinks & 1 Warm Crispy Nachos with Cheese Dip',
    price: 210000,
    imageUrl: 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?q=80&w=600&auto=format&fit=crop',
  },
  {
    id: 'combo_4',
    title: 'Hot Crispy Nachos & Melted Cheese Dip',
    description: 'Warm salted artisan tortilla chips served with rich melted cheddar sauce',
    price: 65000,
    imageUrl: 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?q=80&w=600&auto=format&fit=crop',
  }
];

export default function FBAndVoucherPage() {
  const router = useRouter();
  const {
    showtimeId,
    selectedSeats,
    reservationId,
    expiresAt,
    combos,
    addCombo,
    removeCombo,
    appliedVoucher,
    applyVoucher,
    getTotalAmount,
    resetBooking
  } = useBookingStore();
  const { isAuthenticated, accessToken } = useAuthStore();

  const [availableCombos, setAvailableCombos] = useState<any[]>(DEFAULT_COMBOS);
  const [voucherCode, setVoucherCode] = useState('');
  const [timeLeft, setTimeLeft] = useState<string>('09:45');
  const [isMounted, setIsMounted] = useState(false);
  
  const [showExitPrompt, setShowExitPrompt] = useState(false);
  const [exitAction, setExitAction] = useState<(() => void) | null>(null);
  const isConfirmedExitRef = useRef(false);

  useEffect(() => {
    // Timer countdown
    const timer = setInterval(() => {
      if (!expiresAt) return;
      const now = new Date().getTime();
      const expires = new Date(expiresAt).getTime();
      const diff = expires - now;

      if (diff <= 0) {
        clearInterval(timer);
        toast.error('Seat reservation time has expired. Please select your seats again.');
        router.push('/booking/seats');
      } else {
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresAt, router]);

  useEffect(() => {
    setIsMounted(true);

    // Fetch Combos from backend API if available
    axios.get(`${API_URL}/combos`)
      .then(res => {
        if (res.data.success && Array.isArray(res.data.data) && res.data.data.length > 0) {
          setAvailableCombos(res.data.data);
        }
      })
      .catch(() => {
        // Use default combos
        setAvailableCombos(DEFAULT_COMBOS);
      });
  }, []);

  const handleApplyVoucher = async () => {
    if (!voucherCode) return;
    
    // Sample voucher codes support for standalone mode
    const upper = voucherCode.trim().toUpperCase();
    if (upper === 'WELCOME20' || upper === 'TRUETIX50' || upper === 'DISCOUNT10') {
      const discount = upper === 'TRUETIX50' ? 50000 : 25000;
      applyVoucher({ 
        code: upper, 
        discountAmount: discount 
      });
      toast.success(`Voucher "${upper}" applied! Saved ${discount.toLocaleString('en-US')} VND`);
      return;
    }

    try {
      const res = await axios.post(
        `${API_URL}/vouchers/apply`,
        {
          code: voucherCode,
          orderAmount: getTotalAmount(),
        },
        {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        }
      );

      if (res.data.success) {
        applyVoucher({ 
          code: voucherCode, 
          discountAmount: res.data.data.discountAmount 
        });
        toast.success(`Voucher applied successfully! Discount: ${res.data.data.discountAmount.toLocaleString('en-US')} VND`);
        return;
      }
    } catch (error: any) {
      toast.error('Invalid promo code. Try "WELCOME20" or "TRUETIX50"!');
    }
  };

  const handleNext = () => {
    router.push('/booking/checkout');
  };

  if (!isMounted) return null;

  return (
    <div className="min-h-screen bg-background pb-36 pt-4">
      {/* Top Timer Bar */}
      <div className="bg-primary/10 border-b border-primary/20 sticky top-0 z-40 backdrop-blur-md">
        <div className="container mx-auto px-4 h-12 flex justify-between items-center text-sm font-medium">
          <span className="text-gray-300">Hold Reference: <span className="text-primary font-mono font-bold">{reservationId ? reservationId.substring(0, 12) : 'res_active_lock'}</span></span>
          <span className="flex items-center gap-2 text-primary font-bold font-mono">
            <Clock className="w-4 h-4 text-primary animate-pulse" /> Time Remaining: {timeLeft}
          </span>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-8">

          {/* Food & Drinks Section */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black uppercase tracking-tight text-white flex items-center gap-3">
                <span className="w-2 h-6 bg-primary rounded-full shadow-[0_0_10px_rgba(225,29,72,0.8)]" />
                Food & Drink Combos
              </h2>
              <span className="text-xs text-muted-foreground">Optional add-ons</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {availableCombos.map((combo) => {
                const selected = combos.find(c => c.comboId === combo.id);
                const quantity = selected ? selected.quantity : 0;

                return (
                  <Card key={combo.id} className="bg-zinc-900/80 border-white/10 overflow-hidden flex flex-row h-36 hover:border-primary/40 transition-all">
                    <div className="w-36 bg-zinc-950 shrink-0 relative overflow-hidden">
                      <img 
                        src={combo.imageUrl || 'https://images.unsplash.com/photo-1585647347483-22b66260dfff?q=80&w=600&auto=format&fit=crop'} 
                        alt={combo.title} 
                        className="w-full h-full object-cover transition-transform hover:scale-105" 
                      />
                    </div>
                    <div className="p-3 flex flex-col justify-between w-full">
                      <div>
                        <h3 className="font-bold text-sm text-white leading-tight">{combo.title}</h3>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{combo.description}</p>
                      </div>
                      <div className="flex justify-between items-end pt-2">
                        <span className="font-black text-primary text-sm">{combo.price.toLocaleString('en-US')} VND</span>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            disabled={quantity === 0}
                            className="h-7 w-7 rounded-full border-white/20 text-white hover:bg-white/10"
                            onClick={() => {
                              if (quantity > 1) {
                                addCombo({ comboId: combo.id, name: combo.title, price: combo.price, quantity: quantity - 1 });
                              } else if (quantity === 1) {
                                removeCombo(combo.id);
                              }
                            }}
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="w-5 text-center text-sm font-black text-white">{quantity}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7 rounded-full bg-primary/20 hover:bg-primary border-primary/50 text-white"
                            onClick={() => {
                              addCombo({ comboId: combo.id, name: combo.title, price: combo.price, quantity: quantity + 1 });
                            }}
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>

          {/* Vouchers & Rewards Section */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold uppercase text-white flex items-center gap-2">
                <Ticket className="text-primary w-5 h-5" /> Offers & Promo Vouchers
              </h2>
            </div>
            
            <Card className="bg-zinc-900/80 border-white/10">
              <CardContent className="p-5 space-y-4">
                <div className="flex flex-col md:flex-row gap-3">
                  <Input
                    placeholder="Enter voucher promo code (e.g. TRUETIX50, WELCOME20)..."
                    value={voucherCode}
                    onChange={(e) => setVoucherCode(e.target.value)}
                    className="flex-1 bg-black/50 border-white/10 text-white uppercase font-mono"
                  />
                  <Button onClick={handleApplyVoucher} variant="secondary" className="font-bold">Apply Code</Button>
                </div>

                {appliedVoucher && (
                  <div className="flex items-center justify-between p-3 bg-primary/10 border border-primary/40 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="text-primary w-5 h-5" />
                      <div>
                        <p className="font-bold text-white text-sm">Voucher Applied: {appliedVoucher.code}</p>
                        <p className="text-xs text-primary font-bold">Discount: -{appliedVoucher.discountAmount.toLocaleString('en-US')} VND</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => applyVoucher(null)} className="text-xs text-muted-foreground hover:text-white">Remove</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

        </div>
      </div>

      {/* Bottom Summary Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-zinc-950/95 backdrop-blur-xl border-t border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.8)] z-50 p-4">
        <div className="container mx-auto flex justify-between items-center max-w-4xl">
          <Button 
            variant="outline" 
            onClick={() => router.back()} 
            className="border-white/20 text-gray-300 hover:text-white"
          >
            <ChevronLeft className="mr-2 w-4 h-4" /> Go Back
          </Button>

          <div className="flex items-center gap-6 flex-1 justify-end">
            <div className="text-right">
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Total:</p>
              <div className="flex items-end gap-2 flex-col md:flex-row">
                {appliedVoucher && (
                  <span className="text-xs line-through text-muted-foreground font-mono">
                    {(getTotalAmount() + appliedVoucher.discountAmount).toLocaleString('en-US')} VND
                  </span>
                )}
                <span className="font-black text-2xl text-primary">{getTotalAmount().toLocaleString('en-US')} VND</span>
              </div>
            </div>
            
            <Button
              size="lg"
              onClick={handleNext}
              className="text-base md:text-lg font-bold px-8 shadow-lg shadow-primary/40 bg-primary hover:bg-primary/90 text-white rounded-full"
            >
              Checkout <ChevronRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
