import React, { useState } from 'react';
import { Image, Text, View } from 'react-native';
import { flag, radius, useTheme } from '../theme';

// A leader's photo as a round portrait, cropped toward the face. No photo (or one that fails to load) = initials.
export function Portrait({ photoUrl, name, size = 56 }: { photoUrl?: string | null; name: string; size?: number }) {
  const { c } = useTheme();
  const [failed, setFailed] = useState(false);
  const initials = name.replace(/^dr\.?\s+/i, '').split(/[\s_]+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';
  if (photoUrl && !failed) {
    return (
      <Image
        source={{ uri: photoUrl }}
        onError={() => setFailed(true)}
        accessibilityLabel={`${name} portrait`}
        accessibilityIgnoresInvertColors
        resizeMode="cover"
        style={[{ width: size, height: size, borderRadius: radius.pill, backgroundColor: c.surface, borderWidth: 2, borderColor: flag.saffron }, { objectPosition: '50% 18%' } as object]}
      />
    );
  }
  return (
    <View accessibilityLabel={`${name} initials`} style={{ width: size, height: size, borderRadius: radius.pill, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: c.onAccent, fontSize: size * 0.36, fontWeight: '700' }}>{initials}</Text>
    </View>
  );
}
