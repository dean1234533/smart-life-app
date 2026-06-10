import { useState } from 'react';
import { Key, Loader2, ExternalLink, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';

export default function ApiKeyGate({ onSave }) {
  const [key, setKey] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!key.trim()) return;
    setSaving(true);
    setError('');
    try {
      await onSave(key.trim());
    } catch (err) {
      setError(err.message || 'Failed to save API key');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center z-50 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="p-8 rounded-3xl border border-border/60 bg-card shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-accent/15 border border-accent/30 flex items-center justify-center mx-auto mb-6">
            <Key className="w-7 h-7 text-accent" />
          </div>

          <h2 className="text-xl font-display font-bold text-center mb-1">API Key Required</h2>
          <p className="text-sm text-muted-foreground text-center mb-6">
            Enter your Gemini API key to power AI features. It's stored securely and never shared.
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          <div className="relative mb-4">
            <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type={show ? 'text' : 'password'}
              placeholder="AIza..."
              value={key}
              onChange={(e) => setKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              className="pl-10 pr-10 h-12 rounded-xl"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <Button
            onClick={handleSave}
            disabled={!key.trim() || saving}
            className="w-full h-12 rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground font-medium mb-4"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save & Continue'}
          </Button>

          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-accent transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Get a free Gemini API key at Google AI Studio
          </a>
        </div>
      </motion.div>
    </div>
  );
}
