"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { Button, buttonVariants } from '@/components/ui/button';
import { Film, User, LogOut, Menu, X, Ticket, Sparkles, MapPin, Shield } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export const Header = () => {
  const { user, isAuthenticated, logout } = useAuthStore();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center mx-auto px-4 justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2" onClick={closeMobileMenu}>
            <div className="bg-primary/20 p-1.5 rounded-lg border border-primary/40">
              <Film className="h-5 w-5 text-primary" />
            </div>
            <span className="text-xl font-bold font-heading tracking-wider bg-gradient-to-r from-white via-slate-200 to-primary bg-clip-text text-transparent">
              TrueTix
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <Link href="/movies" className="transition-colors hover:text-primary">
              Films
            </Link>
            <Link href="/cinemas" className="transition-colors hover:text-primary">
              Cinemas
            </Link>
            <Link href="/promotions" className="transition-colors hover:text-primary">
              Offers
            </Link>
          </nav>
        </div>

        {/* Right Desktop Profile / Auth */}
        <div className="hidden md:flex items-center space-x-4">
          {isAuthenticated && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger className={buttonVariants({ variant: 'ghost', size: 'icon', className: 'rounded-full border border-border/60' })}>
                <User className="h-5 w-5 text-primary" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end">
                <div className="flex flex-col space-y-1 p-2 border-b border-border/50">
                  <p className="text-sm font-medium leading-none">
                    {user.fullName}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground mt-1">
                    {user.email}
                  </p>
                </div>
                {user.role === 'ADMIN' && (
                  <DropdownMenuItem onClick={() => router.push('/admin')} className="cursor-pointer">
                    <Shield className="mr-2 h-4 w-4 text-primary" />
                    Admin Dashboard
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => router.push('/user')} className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  My Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/user/tickets')} className="cursor-pointer">
                  <Ticket className="mr-2 h-4 w-4" />
                  My Tickets
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => logout()} className="cursor-pointer text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Link href="/login" className={buttonVariants({ variant: 'ghost' })}>
                Log in
              </Link>
              <Link href="/register" className={buttonVariants({ className: 'shadow-md shadow-primary/20' })}>
                Register
              </Link>
            </>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <div className="flex items-center md:hidden gap-2">
          {isAuthenticated && (
            <Link href="/user/tickets" className={buttonVariants({ variant: 'ghost', size: 'icon', className: 'h-9 w-9' })}>
              <Ticket className="h-5 w-5 text-primary" />
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="h-10 w-10 text-foreground"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
      </div>

      {/* Mobile Drawer Navigation Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-border bg-card/95 backdrop-blur-xl px-4 pt-3 pb-6 animate-in slide-in-from-top duration-200">
          <div className="space-y-4">
            {isAuthenticated && user && (
              <div className="p-3 bg-background/80 rounded-lg border border-border flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">{user.fullName}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary/20 text-primary uppercase">
                  {user.role}
                </span>
              </div>
            )}

            <nav className="flex flex-col space-y-1">
              <Link
                href="/movies"
                onClick={closeMobileMenu}
                className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-muted font-medium text-sm"
              >
                <Film className="w-4 h-4 text-primary" /> Films
              </Link>
              <Link
                href="/cinemas"
                onClick={closeMobileMenu}
                className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-muted font-medium text-sm"
              >
                <MapPin className="w-4 h-4 text-primary" /> Cinemas
              </Link>
              <Link
                href="/promotions"
                onClick={closeMobileMenu}
                className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-muted font-medium text-sm"
              >
                <Sparkles className="w-4 h-4 text-primary" /> Offers
              </Link>

              {isAuthenticated && (
                <>
                  <div className="border-t border-border/60 my-2 pt-2" />
                  {user?.role === 'ADMIN' && (
                    <Link
                      href="/admin"
                      onClick={closeMobileMenu}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-md bg-primary/10 text-primary font-medium text-sm"
                    >
                      <Shield className="w-4 h-4" /> Admin Dashboard
                    </Link>
                  )}
                  <Link
                    href="/user"
                    onClick={closeMobileMenu}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-muted font-medium text-sm"
                  >
                    <User className="w-4 h-4 text-primary" /> My Profile
                  </Link>
                  <Link
                    href="/user/tickets"
                    onClick={closeMobileMenu}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-muted font-medium text-sm"
                  >
                    <Ticket className="w-4 h-4 text-primary" /> My Tickets
                  </Link>
                  <button
                    onClick={() => {
                      logout();
                      closeMobileMenu();
                    }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-md text-destructive hover:bg-destructive/10 font-medium text-sm text-left w-full"
                  >
                    <LogOut className="w-4 h-4" /> Log out
                  </button>
                </>
              )}
            </nav>

            {!isAuthenticated && (
              <div className="pt-2 grid grid-cols-2 gap-3 border-t border-border/60">
                <Link
                  href="/login"
                  onClick={closeMobileMenu}
                  className={buttonVariants({ variant: 'outline', className: 'w-full' })}
                >
                  Log in
                </Link>
                <Link
                  href="/register"
                  onClick={closeMobileMenu}
                  className={buttonVariants({ className: 'w-full' })}
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
