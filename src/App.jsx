import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import ApiKeyGate from '@/components/ApiKeyGate';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

import AppLayout from '@/components/layout/AppLayout';
import Home from '@/pages/Home';
import Notes from '@/pages/Notes';
import NoteEditor from '@/pages/NoteEditor';
import Recordings from '@/pages/Recordings';
import RecordingNew from '@/pages/RecordingNew';
import RecordingDetail from '@/pages/RecordingDetail';
import Timeline from '@/pages/Timeline';
import CalendarView from '@/pages/CalendarView';
import Tasks from '@/pages/Tasks';
import SmartAgent from '@/pages/SmartAgent';
import Availability from '@/pages/Availability';
import BookingPage from '@/pages/BookingPage';

import ShoppingLists from '@/pages/ShoppingLists';
import Recipes from '@/pages/Recipes';
import MeetingSummaries from '@/pages/MeetingSummaries';
import Contacts from '@/pages/Contacts';
import Expenses from '@/pages/Expenses';
import FollowUps from '@/pages/FollowUps';
import BookingLinks from '@/pages/BookingLinks';
import Settings from '@/pages/Settings';
import AdminPanel from '@/pages/AdminPanel';

const ADMIN_UID = import.meta.env.VITE_ADMIN_UID || '';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isAuthenticated, user } = useAuth();
  const [needsApiKey, setNeedsApiKey] = useState(false);
  const [apiKeyChecked, setApiKeyChecked] = useState(false);

  useEffect(() => {
    if (isLoadingAuth || !isAuthenticated || !user?.uid) {
      if (!isLoadingAuth) setApiKeyChecked(true);
      return;
    }
    const checkApiKey = async () => {
      if (user.uid === ADMIN_UID) { setApiKeyChecked(true); return; }
      try {
        const { getOrCreateUser } = await import('@/lib/firestoreService');
        const profile = await getOrCreateUser(user.uid);
        setNeedsApiKey(!profile?.apiKey);
      } catch {
        setNeedsApiKey(false);
      } finally {
        setApiKeyChecked(true);
      }
    };
    checkApiKey();
  }, [user, isLoadingAuth, isAuthenticated]);

  const handleApiKeySave = async (key) => {
    const { updateUserDoc } = await import('@/lib/firestoreService');
    await updateUserDoc(user.uid, { apiKey: key });
    setNeedsApiKey(false);
  };

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-muted border-t-accent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground font-heading">Loading MindFlow...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated && apiKeyChecked && needsApiKey && user?.uid !== ADMIN_UID) {
    return <ApiKeyGate onSave={handleApiKeySave} />;
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/notes/:id" element={<NoteEditor />} />
          <Route path="/recordings" element={<Recordings />} />
          <Route path="/recordings/new" element={<RecordingNew />} />
          <Route path="/recordings/:id" element={<RecordingDetail />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/calendar" element={<CalendarView />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/agent" element={<SmartAgent />} />
          <Route path="/availability" element={<Availability />} />
          <Route path="/shopping" element={<ShoppingLists />} />
          <Route path="/recipes" element={<Recipes />} />
          <Route path="/meetings" element={<MeetingSummaries />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/follow-ups" element={<FollowUps />} />
          <Route path="/booking-links" element={<BookingLinks />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/admin" element={<AdminPanel />} />
        </Route>
      </Route>

      <Route path="/book" element={<BookingPage />} />
      <Route path="/book/:slug" element={<BookingPage />} />

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
