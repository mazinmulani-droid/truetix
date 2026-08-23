"use client";

import { useEffect, useState } from 'react';
import { api } from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Ticket, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from 'date-fns';

export default function AdminVouchersPage() {
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ 
    code: '', 
    title: '', 
    discountType: 'FIXED_AMOUNT', 
    discountValue: 0,
    minOrderValue: 0,
    expiresAt: ''
  });

  useEffect(() => {
    fetchVouchers();
  }, []);

  const fetchVouchers = async () => {
    try {
      const res = await api.get('/admin/vouchers');
      if (res.success) setVouchers(Array.isArray(res.data) ? res.data : (res.data?.data || []));
    } catch (error) {
      toast.error('Failed to load vouchers list');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = () => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    setFormData({ 
      code: '', 
      title: '', 
      discountType: 'FIXED_AMOUNT', 
      discountValue: 0,
      minOrderValue: 0,
      expiresAt: nextWeek.toISOString().slice(0, 16) // Format YYYY-MM-DDThh:mm
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        code: formData.code,
        title: formData.title,
        discountType: formData.discountType,
        discountValue: Number(formData.discountValue),
        minOrderValue: Number(formData.minOrderValue),
        expiresAt: new Date(formData.expiresAt).toISOString()
      };

      await api.post('/admin/vouchers', payload);
      toast.success('Voucher created successfully');
      setIsDialogOpen(false);
      fetchVouchers();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'An error occurred');
    }
  };

  if (loading) return <div className="p-8 text-center">Loading vouchers...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold border-l-4 border-primary pl-4 flex items-center gap-2">
          <Ticket className="w-8 h-8 text-primary" /> Vouchers & Promotional Offers
        </h1>
        <Button onClick={handleOpenDialog} className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> Issue Voucher
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {vouchers.map((voucher) => (
          <Card key={voucher.id} className="border-border/50 bg-card/40 backdrop-blur-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl flex justify-between items-start">
                <span className="font-bold text-primary">{voucher.code}</span>
                <span className={`text-xs px-2 py-1 rounded ${voucher.status === 'ACTIVE' ? 'bg-green-500/20 text-green-500' : 'bg-destructive/20 text-destructive'}`}>
                  {voucher.status}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium mb-4">{voucher.title}</p>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>Discount: <span className="text-white font-bold">{voucher.discountType === 'FIXED_AMOUNT' ? `${voucher.discountValue.toLocaleString()} ₫` : `${voucher.discountValue}%`}</span></p>
                <p>Min. Spend: {voucher.minOrderValue.toLocaleString()} ₫</p>
                <p>Expiry: {format(new Date(voucher.expiresAt), 'dd/MM/yyyy HH:mm')}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Issue Voucher Code</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Voucher Code (e.g. CLGV50K)</Label>
              <Input required value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})} />
            </div>
            <div className="space-y-2">
              <Label>Title (e.g. £5 off orders over £20)</Label>
              <Input required value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Discount Type</Label>
                <Select value={formData.discountType} onValueChange={(val) => setFormData({...formData, discountType: val})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIXED_AMOUNT">Fixed Amount (VND)</SelectItem>
                    <SelectItem value="PERCENTAGE">Percentage (%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Discount Value</Label>
                <Input type="number" required value={formData.discountValue} onChange={(e) => setFormData({...formData, discountValue: Number(e.target.value)})} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Minimum Order Value (VND)</Label>
              <Input type="number" value={formData.minOrderValue} onChange={(e) => setFormData({...formData, minOrderValue: Number(e.target.value)})} />
            </div>
            
            <div className="space-y-2">
              <Label>Expiration Date & Time</Label>
              <Input type="datetime-local" required value={formData.expiresAt} onChange={(e) => setFormData({...formData, expiresAt: e.target.value})} />
            </div>

            <div className="flex justify-end pt-4">
              <Button type="submit">Issue Voucher</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
