import React, { useState, useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Mail, Lock, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { invitesService } from "@/lib/firestoreService";

const WORKER_URL = import.meta.env.VITE_CALENDAR_WORKER_URL || '';

export default function Register() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const inviteId = searchParams.get("invite");
  const isStripeSuccess = searchParams.get("checkout") === "success";
  const stripePlan = searchParams.get("plan") || "";

  const [invite, setInvite] = useState(null);
  const [inviteLoading, setInviteLoading] = useState(true);
  const [inviteError, setInviteError] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkInvite = async () => {
      // Coming from Stripe checkout — no invite needed
      if (isStripeSuccess) {
        setInviteLoading(false);
        return;
      }
      if (!inviteId) {
        setInviteError("Registration requires a valid invite link.");
        setInviteLoading(false);
        return;
      }
      try {
        const inv = await invitesService.get(inviteId);
        if (!inv) {
          setInviteError("This invite link is invalid.");
        } else if (inv.used) {
          setInviteError("This invite link has already been used.");
        } else {
          setInvite(inv);
        }
      } catch {
        setInviteError("Could not verify invite. Please try again.");
      } finally {
        setInviteLoading(false);
      }
    };
    checkInvite();
  }, [inviteId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(firebaseAuth, email, password);
      if (inviteId) await invitesService.markUsed(inviteId).catch(() => {});

      // Link Stripe subscription to new account
      if (isStripeSuccess && WORKER_URL) {
        try {
          const idToken = await cred.user.getIdToken();
          const claimResp = await fetch(`${WORKER_URL}/stripe/claim`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Firebase ${idToken}` },
            body: JSON.stringify({ email }),
          });
          const claimData = claimResp.ok ? await claimResp.json() : null;
          const resolvedPlan = claimData?.plan || (stripePlan.includes('pro') ? 'pro' : 'starter');
          const { updateUserDoc } = await import('@/lib/firestoreService');
          await updateUserDoc(cred.user.uid, {
            plan: resolvedPlan,
            subscriptionStatus: claimData?.status || 'active',
          });
        } catch {}
      }

      navigate("/");
    } catch (err) {
      setError(err.code === "auth/email-already-in-use"
        ? "An account with this email already exists"
        : err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    try {
      const cred = await signInWithPopup(firebaseAuth, new GoogleAuthProvider());
      if (inviteId) await invitesService.markUsed(inviteId).catch(() => {});

      if (isStripeSuccess && WORKER_URL) {
        try {
          const idToken = await cred.user.getIdToken();
          const googleEmail = cred.user.email || '';
          const claimResp = await fetch(`${WORKER_URL}/stripe/claim`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Firebase ${idToken}` },
            body: JSON.stringify({ email: googleEmail }),
          });
          const claimData = claimResp.ok ? await claimResp.json() : null;
          const resolvedPlan = claimData?.plan || (stripePlan.includes('pro') ? 'pro' : 'starter');
          const { updateUserDoc } = await import('@/lib/firestoreService');
          await updateUserDoc(cred.user.uid, {
            plan: resolvedPlan,
            subscriptionStatus: claimData?.status || 'active',
          });
        } catch {}
      }

      navigate("/");
    } catch (err) {
      if (err.code !== "auth/popup-closed-by-user") {
        setError(err.message || "Google sign-in failed");
      }
    }
  };

  if (inviteLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (inviteError) {
    return (
      <AuthLayout icon={AlertTriangle} title="Invite Required" subtitle="This app is invite-only">
        <div className="p-4 rounded-xl bg-destructive/10 text-destructive text-sm mb-6 text-center">
          {inviteError}
        </div>
        <p className="text-sm text-muted-foreground text-center">
          Already have an account?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">Log in</Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={UserPlus}
      title={isStripeSuccess ? "Payment successful — create your account" : "Create your account"}
      subtitle={isStripeSuccess ? `Your ${stripePlan.includes('pro') ? 'Pro' : 'Starter'} plan is ready. Just set up your login below.` : "Sign up to get started"}
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">Log in</Link>
        </>
      }
    >
      <Button variant="outline" className="w-full h-12 text-sm font-medium mb-6" onClick={handleGoogle}>
        <GoogleIcon className="w-5 h-5 mr-2" />
        Continue with Google
      </Button>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground">or</span>
        </div>
      </div>

      {isStripeSuccess && (
        <div className="mb-4 p-3 rounded-lg bg-success/10 text-success text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          Payment confirmed. Create your account to access the app.
        </div>
      )}
      {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="email" type="email" autoComplete="email" autoFocus placeholder="you@example.com"
              value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 h-12" required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="password" type="password" autoComplete="new-password" placeholder="••••••••"
              value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 h-12" required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="confirm" type="password" autoComplete="new-password" placeholder="••••••••"
              value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pl-10 h-12" required />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating account...</> : "Create account"}
        </Button>
      </form>
    </AuthLayout>
  );
}
