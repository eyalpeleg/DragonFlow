# DragonFlow Native Module

This module stores DragonFlow's native Android code and resources that survive `npx expo prebuild --clean`. Custom files are copied to the build directory via hooks/scripts, not by the plugin itself.

## What's Included

- **FloatingBubbleModule.kt** - React Native bridge for floating bubble overlay
- **FloatingBubbleService.kt** - Draggable floating bubble overlay with orientation support
- **SoundAlarmReceiver.kt** - Plays task completion and Pomodoro timer sounds
- **BootReceiver.kt** - Restores floating bubble on device boot if urgent tasks exist
- **Resources** - bubble_icon.png (notification icon), ding.mp3 and tada.mp3 (sound files)

## How Files Get Copied

Native files are copied via three independent mechanisms (see CLAUDE.md for full details):

1. **Local dev**: `npm run prebuild:clean` or `npm run prebuild` (chains expo + copy script)
2. **EAS Cloud**: `eas-build-post-install.sh` hook runs automatically
3. **Other CI**: Manually run `node ./scripts/copy-native-files.js` after prebuild

The `app.plugin.js` plugin is registered in `app.json` but does NOT copy files (it runs too early, before android directory is cleared). File copying is handled by `scripts/copy-native-files.js` invoked after prebuild completes.

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
