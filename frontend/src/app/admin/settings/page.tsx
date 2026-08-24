"use client";

import { useState } from "react";
import { Oswald } from "next/font/google";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Save, Settings2, Contact, CreditCard } from "lucide-react";

const oswald = Oswald({ subsets: ["latin", "vietnamese"] });

export default function AdminSettingsPage() {
  const [isSaving, setIsSaving] = useState(false);

  // States for Cinema Operations
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [bookingDays, setBookingDays] = useState("7");
  const [openTime, setOpenTime] = useState("08:00");
  const [closeTime, setCloseTime] = useState("23:30");

  // States for Contact
  const [hotline, setHotline] = useState("1900 6017");
  const [email, setEmail] = useState("support@truetix.in");
  const [address, setAddress] = useState("Kalyani Nagar, Pune, Maharashtra");
  const [facebookUrl, setFacebookUrl] = useState("https://www.facebook.com/truetixindia");

  // States for Payments & Loyalty Points
  const [pointConversion, setPointConversion] = useState("1000"); // 1 point = 1000 INR
  const [vipBonus, setVipBonus] = useState("5"); // 5%
  const [vvipBonus, setVvipBonus] = useState("10"); // 10%
  const [holdSeatTime, setHoldSeatTime] = useState("10"); // 10 mins

  const handleSave = () => {
    setIsSaving(true);
    // Simulate save API call
    setTimeout(() => {
      setIsSaving(false);
      toast.success("Settings saved successfully!", {
        description: "Your platform configurations have been updated.",
      });
    }, 1000);
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className={`${oswald.className} text-3xl font-bold text-primary uppercase tracking-wider`}>
            System Settings
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure global platform operational rules and details
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="gap-2">
          <Save className="h-4 w-4" />
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <Tabs defaultValue="operations" className="w-full">
        <TabsList className="mb-6 grid w-full grid-cols-1 md:grid-cols-3 gap-2 bg-transparent h-auto p-0">
          <TabsTrigger
            value="operations"
            className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary border border-border/50 bg-card py-3"
          >
            <Settings2 className="w-4 h-4 mr-2" />
            Cinema Operations
          </TabsTrigger>
          <TabsTrigger
            value="contact"
            className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary border border-border/50 bg-card py-3"
          >
            <Contact className="w-4 h-4 mr-2" />
            Contact & Support
          </TabsTrigger>
          <TabsTrigger
            value="payment"
            className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary border border-border/50 bg-card py-3"
          >
            <CreditCard className="w-4 h-4 mr-2" />
            Payments & Rewards
          </TabsTrigger>
        </TabsList>

        {/* 1. Cinema Operations */}
        <TabsContent value="operations" className="mt-0">
          <Card className="border-primary/20 bg-card/60 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className={oswald.className}>Operational Rules</CardTitle>
              <CardDescription>Configure operating hours and booking reservation rules.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center space-x-2 border p-4 rounded-lg bg-background/50 border-destructive/30">
                <Checkbox 
                  id="maintenance" 
                  checked={maintenanceMode}
                  onCheckedChange={(checked) => setMaintenanceMode(checked === true)}
                />
                <div className="grid gap-1.5 leading-none">
                  <Label htmlFor="maintenance" className="text-destructive font-medium cursor-pointer">
                    Enable Maintenance Mode
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    When enabled, customer checkout and booking will be temporarily disabled.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="bookingDays">Advance Booking Window (Days)</Label>
                  <Input 
                    id="bookingDays" 
                    type="number" 
                    value={bookingDays}
                    onChange={(e) => setBookingDays(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">e.g. 7 days</p>
                </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Opening Time (HH:mm)</Label>
                      <Select value={openTime} onValueChange={setOpenTime}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Opening Time" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[250px]">
                          {Array.from({ length: 24 * 12 }).map((_, i) => {
                            const h = Math.floor(i / 12).toString().padStart(2, '0');
                            const m = ((i % 12) * 5).toString().padStart(2, '0');
                            const time = `${h}:${m}`;
                            return <SelectItem key={`open-${time}`} value={time}>{time}</SelectItem>;
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Closing Time (HH:mm)</Label>
                      <Select value={closeTime} onValueChange={setCloseTime}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Closing Time" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[250px]">
                          {Array.from({ length: 24 * 12 }).map((_, i) => {
                            const h = Math.floor(i / 12).toString().padStart(2, '0');
                            const m = ((i % 12) * 5).toString().padStart(2, '0');
                            const time = `${h}:${m}`;
                            return <SelectItem key={`close-${time}`} value={time}>{time}</SelectItem>;
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 2. Contact Information */}
        <TabsContent value="contact" className="mt-0">
          <Card className="border-primary/20 bg-card/60 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className={oswald.className}>Contact & Brand Details</CardTitle>
              <CardDescription>Configure contact channels shown on the footer and customer support pages.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="hotline">Customer Support Hotline</Label>
                  <Input 
                    id="hotline" 
                    value={hotline}
                    onChange={(e) => setHotline(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Support Email</Label>
                  <Input 
                    id="email" 
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Headquarters Address</Label>
                <Input 
                  id="address" 
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="facebook">Facebook Page URL</Label>
                <Input 
                  id="facebook" 
                  type="url"
                  value={facebookUrl}
                  onChange={(e) => setFacebookUrl(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. Payments & Rewards */}
        <TabsContent value="payment" className="mt-0">
          <Card className="border-primary/20 bg-card/60 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className={oswald.className}>Payments & Loyalty Rewards</CardTitle>
              <CardDescription>Set reward point conversion ratios and seat reservation lock hold duration.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="pointConv">Point Conversion Rate (INR)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-sm text-muted-foreground">1 point =</span>
                    <Input 
                      id="pointConv" 
                      type="number"
                      className="pl-20"
                      value={pointConversion}
                      onChange={(e) => setPointConversion(e.target.value)}
                    />
                    <span className="absolute right-3 top-2.5 text-sm text-muted-foreground">₹</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="holdTime">Seat Reservation Hold Timer (minutes)</Label>
                  <Input 
                    id="holdTime" 
                    type="number" 
                    value={holdSeatTime}
                    onChange={(e) => setHoldSeatTime(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Used in distributed seat locking (Redis Redlock).</p>
                </div>
              </div>

              <div className="pt-4 border-t border-border/50">
                <h3 className="text-sm font-medium mb-4">Loyalty Tier Accrual Multipliers</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="vipBonus">VIP Tier (%)</Label>
                    <div className="relative">
                      <Input 
                        id="vipBonus" 
                        type="number"
                        value={vipBonus}
                        onChange={(e) => setVipBonus(e.target.value)}
                      />
                      <span className="absolute right-3 top-2.5 text-sm text-muted-foreground">%</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vvipBonus">VVIP Tier (%)</Label>
                    <div className="relative">
                      <Input 
                        id="vvipBonus" 
                        type="number"
                        value={vvipBonus}
                        onChange={(e) => setVvipBonus(e.target.value)}
                      />
                      <span className="absolute right-3 top-2.5 text-sm text-muted-foreground">%</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
