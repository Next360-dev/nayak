import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { SecureStore } from './storage';

const KEY = 'aso_last_news_visit';

// "Since you last looked": the time the app was last sent to the background (or closed).
// Read once when the screen mounts, so markers stay stable while the user scrolls.
export function useLastVisit(): number | null {
  const [since, setSince] = useState<number | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    SecureStore.getItemAsync(KEY).then((v) => {
      const n = v ? Number(v) : NaN;
      if (alive.current && Number.isFinite(n)) setSince(n);
    }).catch(() => {});
    const save = () => { SecureStore.setItemAsync(KEY, String(Date.now())).catch(() => {}); };
    const sub = AppState.addEventListener('change', (s) => { if (s !== 'active') save(); });
    return () => { alive.current = false; sub.remove(); save(); };
  }, []);
  return since;
}
