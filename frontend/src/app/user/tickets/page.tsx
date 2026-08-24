"use client";

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { api } from '@/lib/axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { QRCodeSVG } from 'qrcode.react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, Clock, MapPin, Download } from 'lucide-react';
import { format } from 'date-fns';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export default function MyTicketsPage() {
  const { isAuthenticated } = useAuthStore();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchTickets = async () => {
      try {
        let combinedTickets = [];
        
        // 1. Fetch offline tickets
        try {
          const offlineTickets = JSON.parse(localStorage.getItem('truetix-offline-tickets') || '[]');
          combinedTickets = [...offlineTickets];
        } catch (e) {
          console.error('Failed to parse offline tickets', e);
        }

        // 2. Try fetching backend tickets
        try {
          const res = await api.get('/tickets/my-tickets');
          if (res.success && res.data.tickets) {
            combinedTickets = [...combinedTickets, ...res.data.tickets];
          }
        } catch (apiError) {
          console.warn('Backend tickets offline, displaying local tickets only');
        }
        
        setTickets(combinedTickets);
      } catch (error) {
        console.error('Failed to fetch tickets:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTickets();
  }, [isAuthenticated]);

  if (loading) {
    return <div className="container mx-auto px-4 py-12 text-center">Loading tickets...</div>;
  }

  const downloadPDF = async () => {
    const ticketElement = document.getElementById('pdf-ticket-template');
    if (!ticketElement || !selectedTicket) return;

    try {
      const canvas = await html2canvas(ticketElement, { scale: 3, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [210, 100] // Custom wide ticket size
      });
      
      pdf.addImage(imgData, 'PNG', 0, 0, 210, 100);
      pdf.save(`TrueTix_${selectedTicket.movieTitle.replace(/\s+/g, '_')}_Ticket.pdf`);
    } catch (error) {
      console.error('Error generating PDF', error);
    }
  };

  return (
    <div className="p-8 relative">
      <h1 className="text-3xl font-bold mb-8 border-l-4 border-primary pl-4">My Tickets</h1>
      
      {tickets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tickets.map((ticket: any) => (
            <Card key={ticket.id} className="overflow-hidden border-2 border-primary/20 hover:border-primary/50 transition-colors">
              <div className="bg-primary/10 px-6 py-3 border-b border-primary/20">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-lg text-primary">{ticket.movieTitle}</span>
                  <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                    {ticket.status === 'PAID' ? 'PAID' : ticket.status}
                  </span>
                </div>
              </div>
              <CardContent className="p-6">
                <div className="space-y-3 text-sm mb-6">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{ticket.cinemaName} - {ticket.screenName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{ticket.showDate ? format(new Date(ticket.showDate), 'dd/MM/yyyy') : 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{ticket.startTime} - {ticket.endTime}</span>
                  </div>
                  <div className="pt-2 border-t border-border mt-2">
                    <div className="flex justify-between font-medium">
                      <span className="text-muted-foreground">Seats:</span>
                      <span className="text-primary">{ticket.seats?.join(', ')}</span>
                    </div>
                  </div>
                </div>
                
                {ticket.status === 'PENDING' ? (
                  <Button 
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-white" 
                    disabled
                  >
                    Pending Verification
                  </Button>
                ) : (
                  <Button 
                    className="w-full" 
                    onClick={() => setSelectedTicket(ticket)}
                    variant="outline"
                  >
                    View QR Code
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-muted/30 rounded-lg">
          <p className="text-muted-foreground mb-4">You have no tickets yet.</p>
          <a href="/movies" className={buttonVariants()}>Book Tickets Now</a>
        </div>
      )}

      {/* QR Code Dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
        <DialogContent className="sm:max-w-md flex flex-col items-center justify-center p-8">
          <DialogHeader>
            <DialogTitle className="text-center text-xl mb-4 text-primary">
              Ticket QR Code
            </DialogTitle>
          </DialogHeader>
          
          {selectedTicket && (
            <div className="bg-white p-4 rounded-xl shadow-inner border border-zinc-200">
              <QRCodeSVG 
                value={selectedTicket.qrCodeData || selectedTicket.id} 
                size={200}
                level="Q"
                includeMargin={true}
              />
            </div>
          )}
          
          <div className="mt-6 text-center space-y-1 w-full">
            <p className="font-bold text-lg">{selectedTicket?.movieTitle}</p>
            <p className="text-sm text-muted-foreground">Seats: {selectedTicket?.seats?.join(', ')}</p>
            <p className="text-xs text-destructive mt-4 mb-6 font-medium uppercase tracking-wider">
              Please present this QR code to the usher at the cinema
            </p>
            
            <Button 
              className="w-full gap-2 bg-primary hover:bg-primary/90 text-white font-bold"
              onClick={downloadPDF}
            >
              <Download className="w-4 h-4" /> Download PDF Ticket
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden PDF Template for html2canvas */}
      <div className="absolute left-[-9999px] top-[-9999px]">
        {selectedTicket && (
          <div id="pdf-ticket-template" className="w-[800px] h-[380px] bg-white text-black p-8 font-sans relative flex border border-gray-200">
            {/* Left side (Details) */}
            <div className="flex-1 pr-8 border-r-2 border-dashed border-gray-300">
              <div className="border-b-4 border-red-600 pb-4 mb-4 flex justify-between items-center">
                <div>
                  <h1 className="text-4xl font-black tracking-tight text-red-600 uppercase">TrueTix</h1>
                  <p className="text-gray-500 font-bold uppercase tracking-widest text-xs mt-1">Official E-Ticket</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[10px] text-gray-500 uppercase">Booking Ref</p>
                  <p className="font-bold text-sm">{selectedTicket.id}</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <p className="text-gray-500 text-[10px] font-bold uppercase">Movie Title</p>
                  <h2 className="text-2xl font-black uppercase leading-none mt-1 text-black">{selectedTicket.movieTitle}</h2>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-500 text-[10px] font-bold uppercase">Date & Time</p>
                    <p className="text-lg font-bold text-black">
                      {selectedTicket.showDate ? format(new Date(selectedTicket.showDate), 'dd MMM yyyy') : 'N/A'}
                    </p>
                    <p className="text-sm font-bold text-gray-700">{selectedTicket.startTime} - {selectedTicket.endTime}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-[10px] font-bold uppercase">Cinema Location</p>
                    <p className="text-base font-bold text-black leading-tight">{selectedTicket.cinemaName}</p>
                    <p className="text-sm font-medium text-gray-600">{selectedTicket.screenName}</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Right side (Stub + QR) */}
            <div className="w-[240px] pl-8 flex flex-col justify-between items-center bg-gray-50 -my-8 -mr-8 p-8 border-l border-gray-200">
              <div className="text-center w-full">
                <p className="text-gray-500 text-[10px] font-bold uppercase">Admit</p>
                <p className="text-3xl font-black text-red-600 leading-none mt-1">{selectedTicket.seats?.join(', ')}</p>
              </div>
              
              <div className="w-40 h-40 bg-white p-2 border-2 border-dashed border-gray-300 rounded-xl my-4 flex items-center justify-center">
                <QRCodeSVG 
                  value={selectedTicket.qrCodeData || selectedTicket.id} 
                  size={140}
                  level="Q"
                  includeMargin={false}
                />
              </div>
              
              <div className="text-center">
                <p className="text-[9px] font-bold text-gray-400 tracking-widest uppercase">Scan at Entrance</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
