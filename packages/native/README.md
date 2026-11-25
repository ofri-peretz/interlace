# @interlace/native

Interlace for React Native (iOS and Android, through Expo or bare React Native). It has the same
tokens and the same game rules as `@interlace/ui`, rendered as native views.

## What is in it

| Piece                                                | What it does                                                                                              |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `InterlaceProvider`, `useTheme`, `useThemedStyles`   | The theme for light, dark or the system setting, built once per scheme and memoised.                       |
| `Text`                                               | Type roles (`display` to `caption`, plus `numeral`) and tones. Headings are announced as headers.          |
| `Button`, `PressableScale`                           | Press feedback on the UI thread, 44pt minimum targets and a busy state.                                    |
| `Stack`, `Card`, `Badge`, `Screen`, `ListRow`        | Layout, surfaces, status pills, safe areas, and a list row a FlashList can recycle.                        |
| `Reveal`                                             | Holds content back until the reader asks for it, then fades it in and announces it.                        |
| `Slider`                                             | Gesture Handler and Reanimated drive it. It uses the web game's `fromPosition`, so log ranges match.       |
| `CloserGame`, `StreakStrip`                          | The Closer game and the streak, scored by the same models as the web (`@interlace/ui/games/*-model`).      |
| `createTheme`, `auditPalette`, `contrastRatio`       | Pure helpers. A consumer can hold its brand overrides to the same WCAG floors in its own tests.           |

## Branding

A consumer brands Interlace through tokens. It never edits a component.

```tsx
<InterlaceProvider
  scheme="system"
  overrides={{
    light: { primary: '#1f4fd1', background: '#faf8f4' },
    dark: { primary: '#9db6ff' },
    radius: 10,
    fonts: { display: 'MySerif-Bold' },
  }}
>
  <App />
</InterlaceProvider>
```

The overrides take the camelCased `--interlace-*` names (`primaryForeground`, `mutedForeground`).
Pass a stable object, such as a module constant, so the theme is built once.

## Performance

- Motion is transform and opacity only, on the UI thread. Under Reduce Motion it becomes a dim, or nothing.
- Styles are built once per theme, not once per render. Components are memoised.
- No component wraps a list in a `ScrollView`. Use `Screen` without `scroll`, and a FlashList, for long lists.

## Where the tokens come from

`src/tokens.generated.ts` is generated from `apps/registry/public/tokens/interlace.tokens.json`, which
is generated from `packages/ui/styles/brand/*.css`. React Native paints sRGB, so native reads each
token's hex fallback. That is the same pixel the browser paints from the oklch value.

```bash
npm run tokens -w @interlace/native          # regenerate
npm run tokens:check -w @interlace/native    # fail on drift (the test script runs it)
```

## Peer dependencies

`react`, `react-native` 0.81 or later (New Architecture), `react-native-reanimated` 4,
`react-native-worklets`, `react-native-gesture-handler` 3 and `react-native-safe-area-context` 5.
Expo SDK 54 and later ship them all.
