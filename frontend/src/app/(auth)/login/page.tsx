'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/useAuthStore';
import { api } from '@/lib/axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, UserCheck } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { setAuth } = useAuthStore();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res: any = await api.post('/auth/login', { email, password });
      if (res && res.data) {
        const { user, accessToken, refreshToken } = res.data;
        setAuth(user, accessToken, refreshToken);
        toast.success(`Welcome back, ${user.fullName}!`);
        router.push(redirectUrl);
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err?.response?.data?.message || err?.message || 'Invalid email or password.';
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  // Quick 1-click login for test demo sessions
  const handleQuickDemoLogin = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    // Direct submission
    setLoading(true);
    setError('');
    api
      .post('/auth/login', { email: demoEmail, password: demoPass })
      .then((res: any) => {
        if (res && res.data) {
          const { user, accessToken, refreshToken } = res.data;
          setAuth(user, accessToken, refreshToken);
          toast.success(`Logged in as ${user.fullName}!`);
          router.push(redirectUrl);
        }
      })
      .catch((err: any) => {
        const msg = err?.response?.data?.message || 'Login failed. Please seed database first.';
        setError(msg);
        toast.error(msg);
      })
      .finally(() => setLoading(false));
  };

  const handleGoogleLoginDisabled = () => {
    toast.info('Google OAuth 2.0 is disabled in this environment (provider token signature verification not configured). Please log in using email and password or the 1-click demo accounts below.');
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-4">
      <Card className="w-full max-w-md border-border/60 bg-card/90 backdrop-blur-xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Log In to TrueTix</CardTitle>
          <CardDescription>
            Enter your credentials or choose a quick demo account to test concurrency.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            {/* 1-Click Demo Accounts */}
            <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl space-y-2">
              <p className="text-xs font-bold text-primary flex items-center gap-1.5 uppercase tracking-wide">
                <UserCheck className="w-4 h-4" /> 1-Click Demo Accounts:
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs border-primary/30 hover:bg-primary/20"
                  onClick={() => handleQuickDemoLogin('alice@truetix.com', 'Password123!')}
                  disabled={loading}
                >
                  Alice (Customer A)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs border-primary/30 hover:bg-primary/20"
                  onClick={() => handleQuickDemoLogin('bob@truetix.com', 'Password123!')}
                  disabled={loading}
                >
                  Bob (Customer B)
                </Button>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground hover:text-white"
                onClick={() => handleQuickDemoLogin('admin@truetix.com', 'Password123!')}
                disabled={loading}
              >
                Admin (admin@truetix.com)
              </Button>
            </div>

            {/* Google OAuth (Honestly Disabled) */}
            <Button
              type="button"
              variant="outline"
              className="w-full flex items-center justify-center gap-3 border-border opacity-70 hover:opacity-100"
              onClick={handleGoogleLoginDisabled}
            >
              <svg className="w-4 h-4 opacity-50" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M12 5c1.7 0 3 .7 3.9 1.6l2.9-2.9C17 2 14.7 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z" />
                <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z" />
                <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15s.7 5.3 1.9 7.7l3.7-2.9z" />
                <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16c1.8 3.7 5.6 6.3 10.1 6.3z" />
              </svg>
              Google Sign-In (OAuth Disabled for Demo)
            </Button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or with email & password</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-lg">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" className="w-full font-bold" disabled={loading}>
              {loading ? 'Authenticating...' : 'Sign In'}
            </Button>
          </CardContent>
        </form>
        <CardFooter className="flex flex-col gap-2">
          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-primary hover:underline font-semibold">
              Sign up
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
