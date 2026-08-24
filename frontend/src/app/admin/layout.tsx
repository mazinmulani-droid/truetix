"use client";

import { useAuthStore } from '@/store/useAuthStore';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LayoutDashboard, Film, MapPin, Users, Settings, LogOut, CalendarRange, Image as ImageIcon, Building2, Popcorn, Ticket, QrCode, Menu, X, Shield, Wallet } from 'lucide-react';
import { Oswald } from 'next/font/google';
import { Button } from '@/components/ui/button';

const oswald = Oswald({ subsets: ['latin', 'vietnamese'] });

const navLinks = [
  { href: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/admin/movies', icon: Film, label: 'Manage Films' },
  { href: '/admin/banners', icon: ImageIcon, label: 'Manage Banners' },
  { href: '/admin/cinemas', icon: MapPin, label: 'Manage Cinemas' },
  { href: '/admin/showtimes', icon: CalendarRange, label: 'Manage Showtimes' },
  { href: '/admin/users', icon: Users, label: 'Manage Users' },
  { href: '/admin/settings', icon: Settings, label: 'Settings' },
];

const secondaryLinks = [
  { href: '/admin/cities', icon: Building2, label: 'Cities & Regions' },
  { href: '/admin/combos', icon: Popcorn, label: 'Food & Drinks' },
  { href: '/admin/vouchers', icon: Ticket, label: 'Vouchers & Offers' },
  { href: '/admin/payments', icon: Wallet, label: 'UPI Approvals' },
  { href: '/admin/tickets/scan', icon: QrCode, label: 'Ticket Scanner (QR)' },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isAuthenticated, logout, _hasHydrated } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!_hasHydrated) return; // Wait for hydration
    
    if (!isAuthenticated) {
      router.push('/login');
    } else if (user?.role !== 'ADMIN') {
      router.push('/');
    }
  }, [isAuthenticated, user, router, _hasHydrated]);

  if (!mounted || !_hasHydrated || !user || user.role !== 'ADMIN') return null;

  const currentNav = [...navLinks, ...secondaryLinks].find(
    (l) => (l.href === '/admin' ? pathname === '/admin' : pathname.startsWith(l.href))
  );

  return (
    <div className={`flex flex-col md:flex-row h-[calc(100vh-4rem)] relative overflow-hidden bg-black ${oswald.className}`}>
      {/* Cinematic Background Image */}
      <div 
        className="absolute inset-0 z-0 opacity-20 pointer-events-none mix-blend-luminosity"
        style={{
          backgroundImage: 'url("https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=2059&auto=format&fit=crop")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      {/* Gradient overlay to ensure text readability */}
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-black/80 via-black/90 to-background pointer-events-none" />
      {/* Ambient Light Effects */}
      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-primary/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-primary/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute top-[40%] left-[30%] w-[300px] h-[300px] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Mobile Admin Bar */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-border bg-card/80 backdrop-blur-xl z-20">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <span className="font-bold text-lg text-primary tracking-wide">TrueTix CMS</span>
          {currentNav && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
              {currentNav.label}
            </span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="gap-1.5"
        >
          {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          Menu
        </Button>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-[8rem] z-30 bg-black/90 backdrop-blur-2xl p-6 overflow-y-auto flex flex-col justify-between">
          <nav className="space-y-1">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Management</p>
            {navLinks.map((link) => {
              const isActive = link.href === '/admin' ? pathname === '/admin' : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-colors ${
                    isActive ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <link.icon className="w-5 h-5" />
                  {link.label}
                </Link>
              );
            })}

            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-4 mb-2">Operations</p>
            {secondaryLinks.map((link) => {
              const isActive = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-colors ${
                    isActive ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <link.icon className="w-5 h-5" />
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="pt-6 border-t border-border/60 mt-6">
            <button
              onClick={() => {
                logout();
                router.push('/login');
              }}
              className="flex items-center justify-center gap-3 w-full py-3 text-sm font-medium bg-destructive/20 text-destructive border border-destructive/40 rounded-lg"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="w-64 bg-card/60 backdrop-blur-xl border-r border-border/50 flex flex-col hidden md:flex z-10">
        <div className="p-6 border-b border-border">
          <h2 className="text-xl font-bold text-primary tracking-wider uppercase">TrueTix Admin</h2>
          <p className="text-sm text-muted-foreground mt-1">Management CMS</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navLinks.map((link) => {
            const isActive = link.href === '/admin' ? pathname === '/admin' : pathname.startsWith(link.href);
            return (
              <Link 
                key={link.href}
                href={link.href} 
                onClick={(e) => {
                  if (isActive) e.preventDefault();
                }}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-md transition-colors ${isActive ? 'bg-primary/20 text-primary border-r-2 border-primary' : 'hover:bg-primary/10 hover:text-primary'}`}
              >
                <link.icon className="h-5 w-5" />
                {link.label}
              </Link>
            );
          })}
          
          <div className="pt-4 mt-4 border-t border-border/50" />
          
          {secondaryLinks.map((link) => {
            const isActive = pathname.startsWith(link.href);
            return (
              <Link 
                key={link.href}
                href={link.href} 
                onClick={(e) => {
                  if (isActive) e.preventDefault();
                }}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-md transition-colors ${isActive ? 'bg-primary/20 text-primary border-r-2 border-primary' : 'hover:bg-primary/10 hover:text-primary'}`}
              >
                <link.icon className="h-5 w-5" />
                {link.label}
              </Link>
            );
          })}
        </nav>
        
        <div className="p-4 border-t border-border">
          <button 
            onClick={() => {
              logout();
              router.push('/login');
            }}
            className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-destructive rounded-md hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-5 w-5" />
            Log out
          </button>
        </div>
      </aside>
      
      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 z-10">
        {children}
      </main>
    </div>
  );
}
