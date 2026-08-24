"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wallet, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function UPIApprovalsPage() {
  const [tickets, setTickets] = useState<any[]>([]);

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = () => {
    const offlineTickets = JSON.parse(localStorage.getItem('truetix-offline-tickets') || '[]');
    setTickets(offlineTickets);
  };

  const pendingTickets = tickets.filter(t => t.status === 'PENDING');
  const paidTickets = tickets.filter(t => t.status === 'PAID');

  const approvePayment = (id: string) => {
    const updatedTickets = tickets.map(t => {
      if (t.id === id) {
        return { ...t, status: 'PAID' };
      }
      return t;
    });
    localStorage.setItem('truetix-offline-tickets', JSON.stringify(updatedTickets));
    setTickets(updatedTickets);
    toast.success(`Payment for ${id} approved successfully.`);
  };

  const rejectPayment = (id: string) => {
    if (confirm('Are you sure you want to reject this payment and delete the pending ticket?')) {
      const updatedTickets = tickets.filter(t => t.id !== id);
      localStorage.setItem('truetix-offline-tickets', JSON.stringify(updatedTickets));
      setTickets(updatedTickets);
      toast.info(`Payment for ${id} rejected.`);
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-black mb-8 border-l-4 border-primary pl-4 uppercase">UPI Payment Approvals</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Pending Approvals */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2 text-yellow-500">
            <Wallet className="w-5 h-5" /> Pending Verification ({pendingTickets.length})
          </h2>
          
          {pendingTickets.length === 0 ? (
            <Card className="bg-muted/10 border-dashed">
              <CardContent className="p-8 text-center text-muted-foreground">
                No pending UPI payments.
              </CardContent>
            </Card>
          ) : (
            pendingTickets.map(ticket => (
              <Card key={ticket.id} className="border-yellow-500/30 bg-yellow-500/5">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-lg text-white">{ticket.id}</h3>
                      <p className="text-sm text-muted-foreground">{ticket.movieTitle}</p>
                    </div>
                    <span className="bg-yellow-500 text-yellow-950 text-xs font-bold px-2 py-1 rounded">
                      PENDING
                    </span>
                  </div>
                  
                  <div className="text-sm space-y-1 mb-6 text-gray-300">
                    <p>Seats: <span className="font-mono">{ticket.seats.join(', ')}</span></p>
                    <p>Date: {new Date(ticket.showDate).toLocaleDateString()}</p>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white" 
                      onClick={() => approvePayment(ticket.id)}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" /> Approve
                    </Button>
                    <Button 
                      variant="outline" 
                      className="flex-1 border-red-500/50 text-red-500 hover:bg-red-500 hover:text-white"
                      onClick={() => rejectPayment(ticket.id)}
                    >
                      <XCircle className="w-4 h-4 mr-2" /> Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Recently Approved */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2 text-green-500">
            <CheckCircle className="w-5 h-5" /> Recently Approved ({paidTickets.length})
          </h2>
          
          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
            {paidTickets.length === 0 ? (
              <Card className="bg-muted/10 border-dashed">
                <CardContent className="p-8 text-center text-muted-foreground">
                  No recently approved payments.
                </CardContent>
              </Card>
            ) : (
              paidTickets.map(ticket => (
                <Card key={ticket.id} className="border-white/5 bg-black/40 opacity-70 hover:opacity-100 transition-opacity">
                  <CardContent className="p-4 flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-sm text-white">{ticket.id}</h3>
                      <p className="text-xs text-muted-foreground">{ticket.movieTitle}</p>
                    </div>
                    <span className="text-green-500 text-xs font-bold border border-green-500/30 px-2 py-1 rounded bg-green-500/10">
                      PAID
                    </span>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
