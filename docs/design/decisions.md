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
