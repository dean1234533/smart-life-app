import { Lock, ArrowUpRight } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';

export default function ProGate({ children, feature = 'This feature' }) {
  const { isPro, plan } = useAuth();

  if (isPro) return children;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5 text-center px-6">
      <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
        <Lock className="w-6 h-6 text-muted-foreground" />
      </div>
      <div>
        <h2 className="text-xl font-bold mb-2">{feature} is a Pro feature</h2>
        <p className="text-muted-foreground text-sm max-w-xs mx-auto">
          {plan === 'starter'
            ? 'Upgrade to Pro to unlock this and all other Pro features.'
            : 'Subscribe to access all features.'}
        </p>
      </div>
      <Button asChild>
        <a href="https://dbworkouts.co.uk/smart-app#pricing" target="_blank" rel="noopener">
          Upgrade to Pro <ArrowUpRight className="w-4 h-4 ml-1" />
        </a>
      </Button>
    </div>
  );
}
