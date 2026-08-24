import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, Ticket, Percent, CreditCard, Popcorn } from 'lucide-react';

const OFFERS = [
  {
    id: "offer_1",
    title: "Welcome to TrueTix!",
    code: "WELCOME20",
    description: "Enjoy ₹20 off your first food and beverage combo order. Valid for new members only.",
    icon: Sparkles,
    color: "from-blue-500 to-cyan-400",
    shadow: "shadow-blue-500/20"
  },
  {
    id: "offer_2",
    title: "TrueTix Mega Discount",
    code: "TRUETIX50",
    description: "Get a flat ₹50 discount on any Family Feast combo. Perfect for weekend blockbusters!",
    icon: Ticket,
    color: "from-amber-500 to-orange-400",
    shadow: "shadow-amber-500/20"
  },
  {
    id: "offer_3",
    title: "HDFC Credit Card Offer",
    code: "HDFC30",
    description: "Flat 30% off on all movie tickets when paying with HDFC Credit Cards.",
    icon: CreditCard,
    color: "from-purple-500 to-pink-500",
    shadow: "shadow-purple-500/20"
  },
  {
    id: "offer_4",
    title: "Student Special",
    code: "STUDENT",
    description: "Show your college ID at the counter and get a free Popcorn upgrade on any combo.",
    icon: Popcorn,
    color: "from-green-500 to-emerald-400",
    shadow: "shadow-green-500/20"
  }
];

export default function PromotionsPage() {
  return (
    <div className="min-h-screen bg-background py-12 pb-24 relative overflow-hidden">
      {/* Background glowing effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px] -z-10" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] -z-10" />

      <div className="container mx-auto px-4 max-w-6xl">
        <div className="text-center mb-16 space-y-4">
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-2xl mb-4 border border-primary/20">
            <Percent className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-5xl font-black uppercase tracking-tight text-white">
            Exclusive <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-orange-500">Offers</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Unlock the best cinematic experience at TrueTix Pune with our exclusive deals and promo codes.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {OFFERS.map((offer) => {
            const Icon = offer.icon;
            return (
              <Card key={offer.id} className={`group bg-zinc-900/50 backdrop-blur-md border-white/5 hover:border-white/20 transition-all duration-300 overflow-hidden shadow-2xl hover:${offer.shadow}`}>
                <CardContent className="p-0 relative flex">
                  {/* Left colored accent bar */}
                  <div className={`w-3 bg-gradient-to-b ${offer.color} group-hover:w-4 transition-all duration-300`} />
                  
                  <div className="p-8 flex-1">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`p-3 rounded-xl bg-gradient-to-br ${offer.color} bg-opacity-10 shadow-lg`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="px-4 py-1.5 bg-black/60 rounded-full border border-white/10 font-mono text-sm font-bold text-white tracking-widest">
                        {offer.code}
                      </div>
                    </div>
                    
                    <h3 className="text-2xl font-bold text-white mb-2">{offer.title}</h3>
                    <p className="text-muted-foreground leading-relaxed mb-6">
                      {offer.description}
                    </p>
                    
                    <Link 
                      href="/movies"
                      className="inline-flex items-center gap-2 text-sm font-bold text-white uppercase tracking-wider hover:text-primary transition-colors"
                    >
                      Book Now <span className="text-primary group-hover:translate-x-1 transition-transform">➔</span>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
