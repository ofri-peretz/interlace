/**
 * Whether the device itself asks for more contrast: iOS "Increase Contrast" (Darker System Colors).
 * React Native exposes no such setting on Android, where this stays false and the reader chooses in
 * the app. Read once, then kept live. A failure to read is "no", never a crash.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

export function useSystemMoreContrast(): boolean {
  const [more, setMore] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let live = true;
    AccessibilityInfo.isDarkerSystemColorsEnabled()
      .then((on) => live && setMore(on))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('darkerSystemColorsChanged', setMore);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  return more;
}
