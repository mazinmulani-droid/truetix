import Link from 'next/link';

export const Footer = () => {
  return (
    <footer className="border-t border-border bg-background py-10 mt-auto">
      <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <h3 className="font-bold text-lg mb-4 text-primary">ClGV</h3>
          <p className="text-sm text-muted-foreground">
            Experience world-class cinema with state-of-the-art screens
            and exceptional service.
          </p>
        </div>
        <div>
          <h4 className="font-semibold mb-4">ClGV Cinemas</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <Link href="/about" className="hover:text-primary transition-colors">
                About Us
              </Link>
            </li>
            <li>
              <Link href="/contact" className="hover:text-primary transition-colors">
                Contact Us
              </Link>
            </li>
            <li>
              <Link href="/careers" className="hover:text-primary transition-colors">
                Careers
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-4">Terms & Policies</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <Link href="/terms" className="hover:text-primary transition-colors">
                Terms of Service
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="hover:text-primary transition-colors">
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link href="/payment-policy" className="hover:text-primary transition-colors">
                Payment Policy
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-4">Customer Support</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Hotline: 1900 6017</li>
            <li>Email: support@clgv.co.uk</li>
          </ul>
        </div>
      </div>
      <div className="container mx-auto px-4 mt-8 pt-8 border-t border-border text-center text-sm text-muted-foreground">
        © 2026 ClGV Film Ticket Platform. All rights reserved.
      </div>
    </footer>
  );
};
