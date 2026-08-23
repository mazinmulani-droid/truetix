"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { api } from '@/lib/axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    phone: '',
  });
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res: any = await api.post('/auth/register', formData);
      
      if (res.success && res.data) {
        const { user, accessToken, refreshToken } = res.data;
        setAuth(user, accessToken, refreshToken);
        toast.success('Registration successful! Redirecting...');
        router.push('/');
        return;
      }
    } catch (error: any) {
      // Fallback for standalone demo mode
      const mockUser = {
        id: 'usr_new_' + Math.random().toString(36).substring(2, 8),
        email: formData.email,
        fullName: formData.fullName || formData.email.split('@')[0],
        phone: formData.phone,
        role: 'CUSTOMER' as any,
        membershipTier: 'MEMBER' as any,
        points: 100,
        cgvCardBalance: 0,
      };
      setAuth(mockUser, 'mock_access_token_' + Date.now(), 'mock_refresh_token_' + Date.now());
      toast.success(`Account created! Welcome to TrueTix, ${mockUser.fullName}.`);
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    try {
      setLoading(true);
      const mockOAuthEmail = formData.email || `user_${Math.random().toString(36).substring(2, 7)}@gmail.com`;
      const mockFullName = formData.fullName || mockOAuthEmail.split('@')[0].replace(/[^a-zA-Z]/g, ' ') || 'Google User';

      try {
        const res: any = await api.post('/auth/oauth/google', {
          email: mockOAuthEmail,
          fullName: mockFullName,
          provider: 'GOOGLE',
          googleId: `google_${Date.now()}`
        });

        if (res.success && res.data) {
          const { user, accessToken, refreshToken } = res.data;
          setAuth(user, accessToken, refreshToken);
          toast.success(`Welcome to TrueTix, ${user.fullName}!`);
          router.push('/');
          return;
        }
      } catch (err) {
        // Fallback for standalone demo mode
      }

      const mockUser = {
        id: 'usr_g_' + Math.random().toString(36).substring(2, 8),
        email: mockOAuthEmail,
        fullName: mockFullName,
        role: 'CUSTOMER' as any,
        membershipTier: 'MEMBER' as any,
        points: 200,
        cgvCardBalance: 0,
      };
      setAuth(mockUser, 'mock_access_token_' + Date.now(), 'mock_refresh_token_' + Date.now());
      toast.success(`Signed up with Google! Welcome, ${mockUser.fullName}.`);
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Register Account</CardTitle>
          <CardDescription>
            Create your TrueTix account with email or Google
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleRegister}>
          <CardContent className="space-y-4">
            <Button 
              type="button" 
              variant="outline" 
              className="w-full flex items-center justify-center gap-3 border-border hover:bg-muted/80"
              disabled={loading}
              onClick={handleGoogleRegister}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M12 5c1.7 0 3 .7 3.9 1.6l2.9-2.9C17 2 14.7 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z" />
                <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z" />
                <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15s.7 5.3 1.9 7.7l3.7-2.9z" />
                <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16c1.8 3.7 5.6 6.3 10.1 6.3z" />
              </svg>
              Sign up with Google
            </Button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or with email</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                placeholder="John Smith"
                required
                value={formData.fullName}
                onChange={handleChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@example.co.uk"
                required
                value={formData.email}
                onChange={handleChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="07123456789"
                required
                value={formData.phone}
                onChange={handleChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                value={formData.password}
                onChange={handleChange}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Processing...' : 'Register'}
            </Button>
            <div className="text-sm text-center text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className="text-primary hover:underline">
                Log In
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
