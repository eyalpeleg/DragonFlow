# DragonFlow Native Module

This Expo Config Plugin provides DragonFlow's native Android functionality that survives `npx expo prebuild --clean`.

## What's Included

- **FloatingBubbleModule.kt** - React Native bridge for floating bubble overlay
- **FloatingBubbleService.kt** - Draggable floating bubble overlay with orientation support
- **SoundAlarmReceiver.kt** - Plays task completion and Pomodoro timer sounds
- **BootReceiver.kt** - Restores floating bubble on device boot if urgent tasks exist
- **Resources** - bubble_icon.png (notification icon), ding.mp3 and tada.mp3 (sound files)

## How It Works

When `npx expo prebuild` runs:
1. This plugin loads from `app.json`
2. The `app.plugin.js` copies all native files from `android/src/` to `android/app/src/main/`
3. The native module is automatically discovered and registered by Expo's autolinking system

## File Structure

```
modules/dragonflow-native/
├── android/src/main/
│   ├── java/com/plgsw/dragonflow/  (Kotlin source files)
│   └── res/
│       ├── drawable/                (UI resources)
│       └── raw/                      (Audio files)
├── app.plugin.js                    (Expo Config Plugin)
├── package.json
└── README.md
```

## Future Extensions

This module is designed to accommodate additional native features beyond the bubble:
- Camera integration
- Custom sensors
- Platform-specific APIs
- Additional audio handling

Simply add new Kotlin files to `android/src/main/java/com/plgsw/dragonflow/` and they will be automatically copied during prebuild.
