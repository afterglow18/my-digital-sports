import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { initializeRevenueCat } from './lib/revenuecat';

// Fire RC init immediately — before React mounts — so configure() isn't
// delayed by component rendering. Non-fatal if it fails (browser, no key, etc.)
initializeRevenueCat().catch((err) =>
  console.warn("[RevenueCat] Init error (non-fatal):", err)
);

createRoot(document.getElementById('root')!).render(<App />);
