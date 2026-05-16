# Architecture Decision Records

## ADR-001: Expo + Expo Router

**Decision:** Use Expo with Expo Router for cross-platform development with file-based routing.

**Context:** Needed a framework that supports Android and iOS from a single codebase with minimal native configuration. Expo provides managed builds (EAS), OTA updates, and a rich plugin ecosystem. Expo Router adds file-based routing similar to Next.js, making navigation declarative.

**Consequences:**
- Fast iteration with Expo Go during development
- EAS handles build signing and distribution
- Some native features (like FloatingBubble) require custom native modules and dev builds
- Typed routes enabled via `experiments.typedRoutes`

---

## ADR-002: Zustand + AsyncStorage for State

**Decision:** Use Zustand with `persist` middleware backed by AsyncStorage for all app state.

**Context:** The app is local-first with no backend. Needed a lightweight state manager that supports persistence without boilerplate. Redux was considered too heavy for a personal app. Zustand's `persist` middleware provides automatic serialization to AsyncStorage.

**Consequences:**
- Single store holds tasks, categories, filters, and settings
- Data survives app restarts without any backend
- No cloud sync — data lives only on the device
- Set-based filters require custom serialization (Zustand handles this)

---

## ADR-003: Android Native Module for Floating Bubble

**Decision:** Build a custom Android native module (`FloatingBubble`) to show a system overlay with critical task count.

**Context:** Wanted a persistent visual reminder for critical tasks even when the app is in the background. Android supports system overlay windows (`TYPE_APPLICATION_OVERLAY`). No Expo plugin existed for this use case.

**Consequences:**
- Android-only feature (no iOS equivalent yet)
- Requires `SYSTEM_ALERT_WINDOW` permission
- Controlled from JS via the Zustand store side effects
- Gracefully guarded against missing permissions

---

## ADR-004: Notification Channel Design

**Decision:** Use four dedicated Android notification channels: `critical-tasks`, `pomodoro`, `task-reminders`, `today-tasks`.

**Context:** Android requires notification channels for grouping and user control. Separating channels lets users mute pomodoro alerts without losing critical task notifications, for example.

**Consequences:**
- Users can independently control each notification type in system settings
- Critical channel uses HIGH importance with vibration pattern
- Today channel uses DEFAULT importance (less intrusive)
- Notifications silently disabled in Expo Go (SDK 53+ limitation)

---

## ADR-005: Category System with IDs

**Decision:** Categories use generated string IDs rather than name-based keys. Five built-in categories ship with the app.

**Context:** Originally categories were name-based, which made renaming impossible without breaking task references. Switching to ID-based categories decouples display names from data relationships.

**Consequences:**
- Tasks reference `categoryId` (stable) not category name
- Categories can be renamed without data migration
- Built-in categories (Default, Friends, Personal, Fitness, Study) can't be deleted
- User-created categories get random IDs via `makeId()`

---

## ADR-006: Dark Mode via Twin Palettes + `useColors()` Hook

**Decision:** Implement dark mode by maintaining two palette objects (`lightColors`, `darkColors`) with identical key shapes in `src/styles/theme.ts`, selected at runtime by a `useColors()` hook driven from a `darkMode` boolean in the Zustand store. Each themed component converts its `StyleSheet.create({...})` into a `makeStyles(c: AppColors)` factory called inside the component and memoized with `useMemo`. Theme preference is a user-controlled toggle (no "follow system" mode) accessible from the top of the Settings screen.

**Context:** The codebase had ~25 components with `StyleSheet.create` called at module load against a flat `COLORS` object. The previous "Dark mode" entry in features.md described `userInterfaceStyle: "automatic"` in `app.json`, but no JS branched on the OS color scheme — surfaces, text, and borders were hardcoded light. We needed real theming that adapts every screen, modal, and bottom-tab, owned by the user rather than the OS. We rejected: (a) a 3-way `system / light / dark` preference (too much UI for a personal app — the user wanted a single switch), (b) restructuring to semantic CSS-variable-style tokens (large refactor for minimal benefit at this scale), (c) auto-deriving dark variants from light values (magical, produces unexpected hues).

**Consequences:**
- Single source of truth for both palettes — adding a new color key requires defining both light and dark values
- `useColors()` triggers a render of every consuming component when `darkMode` flips, which is the desired behavior
- `makeStyles(c) + useMemo` recomputes the stylesheet on mode change but otherwise hits the memo cache
- The previous user-customizable accent inputs (`themeColorPrimary/Secondary/Action`) were dropped in the same PR series; primary/secondary/action are now fixed brand colors that read on both backgrounds
- `COLORS` survives as a back-compat alias for non-UI code (notification icon tint, category fallback colors) where mode doesn't matter
- Status bar style is driven at runtime via `expo-status-bar` in `app/_layout.tsx`; cold-start splash may briefly show the previous mode's bar (acceptable)
- Persisted store schema bumped to v2 to drop the legacy `themeColor*` keys on rehydrate
