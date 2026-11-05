"use client";

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  QrCode,
  Film,
  MapPin,
  CalendarRange,
  Users,
  Building2,
  ArrowRight,
  ShieldCheck,
  Cpu,
} from 'lucide-react';

const adminActions = [
  {
    title: 'Turnstile Ticket Scanner',
    description: 'Verify HMAC QR tickets and admit attendees at cinema entrances.',
    href: '/admin/tickets/scan',
    icon: QrCode,
    badge: 'Core Feature',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10 border-emerald-500/20',
  },
  {
    title: 'Film Catalog Management',
    description: 'Create, update, and manage movies currently showing or coming soon.',
    href: '/admin/movies',
    icon: Film,
    badge: 'Catalog',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10 border-amber-500/20',
  },
  {
    title: 'Cinemas & Theaters',
    description: 'Manage physical theater locations, auditoriums, and screen types.',
    href: '/admin/cinemas',
    icon: MapPin,
    badge: 'Venues',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10 border-blue-500/20',
  },
  {
    title: 'Showtime Scheduling',
    description: 'Schedule movie screenings across auditoriums and set base ticket pricing.',
    href: '/admin/showtimes',
    icon: CalendarRange,
    badge: 'Schedules',
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/10 border-rose-500/20',
  },
  {
    title: 'User Accounts & Roles',
    description: 'Inspect registered users, manage system permissions, and view audit history.',
    href: '/admin/users',
    icon: Users,
    badge: 'Security',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10 border-purple-500/20',
  },
  {
    title: 'Cities & Regions',
    description: 'Organize cinema chains by geographical cities and distribution zones.',
    href: '/admin/cities',
    icon: Building2,
    badge: 'Geography',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10 border-cyan-500/20',
  },
];

export default function AdminDashboardPage() {
  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-6">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-wider text-white flex items-center gap-3">
            <span className="w-2.5 h-8 bg-primary rounded-full shadow-[0_0_12px_rgba(225,29,72,0.8)]" />
            Administration & Operations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            TrueTix Ticket Reservation Platform Control Center
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded-full text-xs font-semibold">
            <ShieldCheck className="w-4 h-4" />
            Authenticated Administrator
          </div>
        </div>
      </div>

      {/* Engineering Architecture Highlight */}
      <Card className="bg-zinc-950/70 border-white/10 backdrop-blur-md">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="bg-primary/20 p-3 rounded-xl border border-primary/30 text-primary">
              <Cpu className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-white text-base">
                Engineering Focus: High-Reliability Seat Reservation
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                TrueTix demonstrates atomic seat locking via Redis (<code>SET NX EX</code>), real-time WebSocket state synchronization, ACID transaction checkout in PostgreSQL, mock payment HMAC signature verification, and tamper-proof digital QR ticket verification with atomic single check-in.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navigation Quick Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {adminActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.href} href={action.href} className="group block">
              <Card className="h-full bg-card/40 backdrop-blur-md border border-border/50 shadow-lg hover:border-primary/50 hover:bg-card/70 transition-all duration-300 flex flex-col justify-between">
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <div className={`p-2.5 rounded-lg border ${action.bgColor} ${action.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-muted text-muted-foreground">
                      {action.badge}
                    </span>
                  </div>
                  <CardTitle className="text-lg font-bold text-white group-hover:text-primary transition-colors">
                    {action.title}
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground leading-relaxed">
                    {action.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center text-xs font-semibold text-primary group-hover:translate-x-1 transition-transform gap-1">
                    Open Management <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
