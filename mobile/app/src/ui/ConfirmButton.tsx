import React, { useEffect, useState } from 'react';
import { Button } from './Button';

// Two taps for anything that cannot be undone: the first tap changes the label, the second does it, and it resets after
// a few seconds. (Alert.alert does nothing in a browser, so this works everywhere.)
export function ConfirmButton({ label, confirmLabel = 'Tap again to confirm', onConfirm, variant = 'danger', loading }: {
  label: string; confirmLabel?: string; onConfirm: () => void; variant?: 'primary' | 'secondary' | 'danger'; loading?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return undefined;
    const id = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(id);
  }, [armed]);
  return <Button label={armed ? confirmLabel : label} variant={variant} loading={loading} onPress={() => { if (armed) { setArmed(false); onConfirm(); } else setArmed(true); }} />;
}
