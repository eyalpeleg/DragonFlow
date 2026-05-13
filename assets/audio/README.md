# Notification Audio Files

This directory contains custom notification sounds for DragonFlow.

## Required Files

- **ding.mp3** - Notification sound for task reminders (1-hour and 5-minute warnings)
  - Standard notification ding/bell sound
  - ~0.5-1 second duration
  
- **tada.mp3** - Completion sound for pomodoro timer
  - Uplifting "ta da" or success chime sound
  - ~0.5-1 second duration

## Setup

You can source free notification sounds from:
- [Freesound.org](https://freesound.org/) - Search for "notification ding" or "success sound"
- [Zapsplat](https://www.zapsplat.com/) - Free sound effects library
- [Pixabay Sounds](https://pixabay.com/sound-effects/) - Free audio clips

Once you have the files, place them in this directory as `ding.mp3` and `tada.mp3`.

## Fallback

If audio files are not present, the app will gracefully fall back to the system default notification sound. The notification sounds setting toggle will still work to enable/disable all notification sounds.
