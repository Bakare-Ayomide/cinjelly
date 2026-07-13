import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global Compatibility Patches & Error Mitigation
if (typeof window !== 'undefined') {
  // 1. Prevent ReferenceError: e is not defined in any legacy or third-party scripts
  if (!('e' in window)) {
    try {
      (window as any).e = new Proxy({}, {
        get: (_target, prop) => {
          if (prop === 'preventDefault' || prop === 'stopPropagation') {
            return () => {};
          }
          return undefined;
        }
      });
    } catch {
      (window as any).e = undefined;
    }
  }

  // 2. Patch ScreenOrientation.prototype.lock to prevent "Illegal invocation" and sandbox iframe restrictions
  if (window.screen && window.screen.orientation) {
    try {
      const proto = Object.getPrototypeOf(window.screen.orientation);
      if (proto && proto.lock) {
        const originalLock = proto.lock;
        proto.lock = function(orientation: any) {
          try {
            return originalLock.call(window.screen.orientation, orientation);
          } catch (err) {
            console.warn('Screen orientation lock handled gracefully:', err);
            return Promise.resolve();
          }
        };
      } else if ((window.screen.orientation as any).lock) {
        const originalLock = (window.screen.orientation as any).lock;
        (window.screen.orientation as any).lock = function(orientation: any) {
          try {
            return originalLock.call(window.screen.orientation, orientation);
          } catch (err) {
            console.warn('Screen orientation lock handled gracefully:', err);
            return Promise.resolve();
          }
        };
      }
    } catch (e) {
      console.warn('Failed to patch ScreenOrientation.lock:', e);
    }
  }

  // 3. Intercept and downgrade non-fatal HLS.js errors & orientation errors from console.error
  const originalConsoleError = console.error;
  console.error = function(...args) {
    try {
      const argStr = args.map(a => {
        if (!a) return '';
        if (a instanceof Error) return a.stack || a.message;
        if (typeof a === 'object') {
          try { return JSON.stringify(a); } catch { return String(a); }
        }
        return String(a);
      }).join(' ');

      // Downgrade non-fatal HLS warnings & orientation lock issues to console.warn
      if (
        (argStr.includes('HLS Error') && argStr.includes('Fatal: false')) ||
        argStr.includes('error locking orientation') ||
        argStr.includes('ScreenOrientation')
      ) {
        console.warn('[Mitigated Error]', ...args);
        return;
      }
    } catch {
      // Avoid crash in interceptor
    }
    originalConsoleError.apply(console, args);
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
