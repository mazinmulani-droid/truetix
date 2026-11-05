"use client";

import { useAuthStore } from '@/store/useAuthStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { User, Ticket, Shield } from 'lucide-react';

export default function UserProfilePage() {
  const { user, isAuthenticated } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  if (!user) return null;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold border-l-4 border-primary pl-4 text-white">
        My Profile
      </h1>

      <Card className="bg-zinc-900/80 border-white/10 shadow-xl">
        <CardHeader className="border-b border-white/10 pb-4">
          <CardTitle className="flex items-center gap-2 text-white">
            <User className="w-5 h-5 text-primary" /> Account Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="grid grid-cols-3 border-b border-border/50 pb-4 text-sm">
            <div className="font-semibold text-muted-foreground">Full Name</div>
            <div className="col-span-2 text-white font-medium">{user.fullName}</div>
          </div>
          <div className="grid grid-cols-3 border-b border-border/50 pb-4 text-sm">
            <div className="font-semibold text-muted-foreground">Email Address</div>
            <div className="col-span-2 text-white font-medium">{user.email}</div>
          </div>
          <div className="grid grid-cols-3 border-b border-border/50 pb-4 text-sm">
            <div className="font-semibold text-muted-foreground">Account Role</div>
            <div className="col-span-2">
              <span className="bg-primary/20 text-primary px-3 py-1 rounded-full text-xs font-bold uppercase">
                {user.role}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-4">
        <Button
          onClick={() => router.push('/user/tickets')}
          className="bg-primary hover:bg-primary/90 text-white font-semibold"
        >
          <Ticket className="w-4 h-4 mr-2" /> View My Tickets
        </Button>
        {user.role === 'ADMIN' && (
          <Button
            variant="outline"
            onClick={() => router.push('/admin')}
            className="border-white/20 hover:bg-white/10"
          >
            <Shield className="w-4 h-4 mr-2 text-primary" /> Admin Dashboard
          </Button>
        )}
      </div>
    </div>
  );
}
