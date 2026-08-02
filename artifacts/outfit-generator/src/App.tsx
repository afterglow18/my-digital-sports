import { QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, Redirect, Router as WouterRouter } from 'wouter';
import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppLayout } from './components/layout/AppLayout';
import WardrobePage from './pages/wardrobe';
import GeneratePage from './pages/generate';
import SavedPage from './pages/saved';
import FavoritesPage from './pages/favorites';
import AccountPage from './pages/account';
import WelcomePage from './pages/welcome';
import { SubscriptionProvider } from '@/lib/revenuecat';
import { queryClient } from '@/lib/queryClient';
import { useVisionIndexer } from '@/lib/visionIndexer';

// ── First-launch welcome ──────────────────────────────────────────────────────
const ENTERED_KEY = "suitcase-entered";

function hasEntered(): boolean {
  try {
    return (
      sessionStorage.getItem(ENTERED_KEY) === "1" ||
      new URLSearchParams(window.location.search).get("preview") === "1"
    );
  } catch {
    return false;
  }
}

function markEntered() {
  try { sessionStorage.setItem(ENTERED_KEY, "1"); } catch {}
}

// ── Router ────────────────────────────────────────────────────────────────────
function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/"         component={WardrobePage}  />
        <Route path="/generate" component={GeneratePage}  />
        <Route path="/saved"    component={SavedPage}     />
        <Route path="/favorites" component={FavoritesPage} />
        <Route path="/account"  component={AccountPage}   />
        <Redirect to="/" />
      </Switch>
    </AppLayout>
  );
}

// ── App shell — shows welcome on first session, then the app ─────────────────
function AppShell() {
  const [entered, setEntered]   = useState<boolean>(hasEntered);
  const { isIndexing }          = useVisionIndexer();
  // Don't flash the toast immediately on cold launch — wait 6 s before showing it
  const [toastReady, setToastReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setToastReady(true), 6000);
    return () => clearTimeout(t);
  }, []);

  const handleEnter = useCallback(() => {
    markEntered();
    setEntered(true);
  }, []);

  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      {/* App always mounted so it's visible the moment the splash fades */}
      <Router />
      {!entered && <WelcomePage onEnter={handleEnter} />}

      {/* Non-blocking "Preparing photo search…" toast while indexer runs */}
      <AnimatePresence>
        {isIndexing && toastReady && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[200]
                       px-4 py-2.5 rounded-full border-2 border-black bg-white
                       shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]
                       text-xs font-bold uppercase tracking-wide whitespace-nowrap pointer-events-none"
          >
            🔍 Preparing photo search…
          </motion.div>
        )}
      </AnimatePresence>
    </WouterRouter>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SubscriptionProvider>
        <AppShell />
      </SubscriptionProvider>
    </QueryClientProvider>
  );
}

export default App;
