"use client";

import { useAuthStore } from '@/store/useAuthStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

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
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8 border-l-4 border-primary pl-4">My Profile</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          {/* TrueTix Card */}
          <div className="bg-gradient-to-br from-zinc-800 to-black rounded-xl p-6 shadow-xl border border-zinc-700 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl"></div>
            <div className="relative z-10">
              <div className="flex justify-between items-center mb-6">
                <span className="text-primary font-bold text-xl">TrueTix CARD</span>
                <span className="text-zinc-400 text-sm tracking-widest">{user.membershipTier || 'MEMBER'}</span>
              </div>
              
              <div className="space-y-1 mb-8">
                <p className="text-sm text-zinc-400 uppercase">Full Name</p>
                <p className="font-bold text-lg text-white">{user.fullName}</p>
              </div>
              
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-sm text-zinc-400">Reward Points</p>
                  <p className="font-bold text-2xl text-white">{user.points || 0}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-zinc-400">Card Balance</p>
                  <p className="font-bold text-lg text-white">
                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(user.truetixCardBalance || 0)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Account Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 border-b border-border pb-4">
                <div className="font-semibold text-muted-foreground">Full Name</div>
                <div className="col-span-2">{user.fullName}</div>
              </div>
              <div className="grid grid-cols-3 border-b border-border pb-4">
                <div className="font-semibold text-muted-foreground">Email</div>
                <div className="col-span-2">{user.email}</div>
              </div>
              <div className="grid grid-cols-3 border-b border-border pb-4">
                <div className="font-semibold text-muted-foreground">Membership Tier</div>
                <div className="col-span-2">
                  <span className="bg-primary/20 text-primary px-3 py-1 rounded-full text-xs font-bold">
                    {user.membershipTier || 'MEMBER'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <div className="flex gap-4">
            <Button variant="outline" onClick={() => router.push('/user/tickets')}>
              View My Tickets
            </Button>
            <Button>Edit Profile</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
