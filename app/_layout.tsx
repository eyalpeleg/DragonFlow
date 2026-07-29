import { useEffect, useState } from 'react';
import { Animated, AppState, StyleSheet, Text } from 'react-native';
import { Image } from 'expo-image';
import { Slot, router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { dismissParkingArmPrompt, requestNotificationPermission, setupNotificationChannels, setupParkingNotificationCategory } from '@/src/utils/notifications';
import FloatingBubble from '@/src/modules/FloatingBubble';
import ParkingWatcher from '@/src/modules/ParkingWatcher';
import { useTaskStore, computeBubbleScore, getTodayTomorrowStrs, urgentBubbleMessage } from '@/src/store/appStore';
import { initializeBackup, setupAutoBackup, onAppBackground } from '@/src/services/cloudBackup';
import { audioService } from '@/src/services/audioService';
import { useColorMode } from '@/src/styles/useColors';
import UndoSnackbar from '@/src/components/UndoSnackbar';

SplashScreen.preventAutoHideAsync().catch(() => {});

const SPLASH_BG = '#1F0A3D';
const SPLASH_GOLD = '#D4AF37';
const splashImage = require('@/assets/images/splash-icon.png');

export default function RootLayout() {
    const { setFloatingBubbleDismissed } = useTaskStore();
    const colorMode = useColorMode();
    const [splashVisible, setSplashVisible] = useState(true);
    const [splashOpacity] = useState(() => new Animated.Value(1));

    useEffect(() => {
        SplashScreen.hideAsync().catch(() => {});
        const holdMs = 1500;
        const fadeMs = 600;
        const t = setTimeout(() => {
            Animated.timing(splashOpacity, {
                toValue: 0,
                duration: fadeMs,
                useNativeDriver: true,
            }).start(() => setSplashVisible(false));
        }, holdMs);
        return () => clearTimeout(t);
    }, [splashOpacity]);

    useEffect(() => {
        audioService.initialize().catch(() => {});
        setupNotificationChannels();
        setupParkingNotificationCategory();
        requestNotificationPermission();
        FloatingBubble.canDrawOverlays().then((ok) => {
            if (!ok) FloatingBubble.requestOverlayPermission();
        }).catch(() => {});

        // Cold-start: AppState 'change' listener won't fire 'active' because
        // we already are 'active'. Hide the bubble service explicitly — if
        // Pomodoro is running, its component will re-establish the bubble
        // when the app next backgrounds.
        FloatingBubble.hide();

        // pomodoroVisible is in-memory store state (not persisted), but the
        // Zustand singleton survives an activity destroy/recreate when the
        // JS process stays alive. The AppState 'active' listeners that
        // normally close the modal don't fire on a fresh mount (no
        // transition), so a stale `true` would leave the Modal's scrim
        // covering the UI with no visible content.
        useTaskStore.getState().setPomodoroVisible(false);

        // Cloud backup initialization
        initializeBackup().catch(() => {});
        const unsubscribeBackup = setupAutoBackup();

        // Listen for native bubble dismiss gesture
        const unsubscribe = FloatingBubble.onDismissed(() => {
            setFloatingBubbleDismissed(true);
        });

        // Listen for native bubble double-tap → enter Focus mode on tasks list
        const unsubscribeOpenFocus = FloatingBubble.onOpenFocus(() => {
            useTaskStore.getState().setFocusMode(true);
            router.push('/(tabs)/tasks');
        });

        // Route parking notification actions: the arm prompt (pick a duration / not
        // parking) and the firing reminder (extend / open the parking app).
        const notifResponseSub = Notifications.addNotificationResponseReceivedListener((response) => {
            const data = response.notification.request.content.data as { type?: string };
            const action = response.actionIdentifier;

            if (data?.type === 'parking-arm') {
                const store = useTaskStore.getState();
                if (action === 'arm-60' || action === 'arm-120') {
                    console.log(`[ParkingWatcher] USER: set parking reminder to ${action === 'arm-60' ? 60 : 120} min (notification)`);
                    store.startParkingSession(action === 'arm-60' ? 60 : 120);
                    store.setParkingArmPromptVisible(false);
                    dismissParkingArmPrompt();
                } else if (action === 'not-parking') {
                    console.log('[ParkingWatcher] USER: dismissed arm prompt — not parking (notification)');
                    store.setParkingSuppressedUntil(Date.now() + (store.debugModeEnabled ? 2 : 30) * 60_000);
                    store.setParkingArmPromptVisible(false);
                    dismissParkingArmPrompt();
                    ParkingWatcher.startMonitoring();
                } else {
                    // Body tap → open the app; the pending arm modal shows for a custom duration.
                    console.log('[ParkingWatcher] USER: tapped arm notification body → opening app for custom duration');
                    store.setParkingArmPromptVisible(true);
                    router.push('/(tabs)/tasks');
                }
                return;
            }

            if (data?.type !== 'parking') return;
            if (action === 'extend-15') {
                console.log('[ParkingWatcher] USER: add 15 min (reminder notification)');
                // If the action relaunched the app, the store may still be rehydrating
                // (parkingSession not yet restored) — apply the extend once it is.
                if (useTaskStore.getState().hasHydrated) {
                    useTaskStore.getState().extendParkingSession(15);
                } else {
                    const unsub = useTaskStore.subscribe((s) => {
                        if (s.hasHydrated) { unsub(); s.extendParkingSession(15); }
                    });
                }
            } else if (action === 'open-parking') {
                console.log('[ParkingWatcher] USER: clicked Open Parking App (reminder notification)');
                ParkingWatcher.openParkingApp();
            } else {
                // Tapping the notification body → open the app on the tasks list.
                console.log('[ParkingWatcher] USER: tapped reminder notification body → opening app');
                router.push('/(tabs)/tasks');
            }
        });

        const sub = AppState.addEventListener('change', (nextState) => {
            const { tasks, dismissedFloatingBubble, showBubbleInBackground: showBubble } = useTaskStore.getState();
            if (nextState === 'active') {
                FloatingBubble.hide();
                if (dismissedFloatingBubble) {
                    setFloatingBubbleDismissed(false);
                }
            } else if (nextState === 'background') {
                const { pomodoroEndTime, parkingSession } = useTaskStore.getState();
                // Parking takes precedence over pomodoro and the task count (AC7a).
                if (parkingSession) {
                    const { todayStr, tomorrowStr } = getTodayTomorrowStrs();
                    const score = computeBubbleScore(tasks, todayStr, tomorrowStr);
                    if (showBubble) {
                        FloatingBubble.startParkingTimer(parkingSession.remindAt, score, urgentBubbleMessage(score));
                    }
                    onAppBackground();
                    return;
                }
                // Don't show task bubble if Pomodoro is running — timer component handles it
                if (pomodoroEndTime === null || pomodoroEndTime <= Date.now()) {
                    const pad = (n: number) => String(n).padStart(2, '0');
                    const now = new Date();
                    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
                    const tom = new Date(now);
                    tom.setDate(tom.getDate() + 1);
                    const tomorrowStr = `${tom.getFullYear()}-${pad(tom.getMonth() + 1)}-${pad(tom.getDate())}`;
                    const score = computeBubbleScore(tasks, todayStr, tomorrowStr);
                    if (score > 0 && !dismissedFloatingBubble && showBubble) {
                        FloatingBubble.show(score, `${score} Urgent ${score === 1 ? 'Task' : 'Tasks'}`);
                    }
                }
                onAppBackground();
            }
        });
        return () => {
            sub.remove();
            unsubscribe();
            unsubscribeOpenFocus();
            notifResponseSub.remove();
            unsubscribeBackup();
        };
    }, [setFloatingBubbleDismissed]);

    return (
        <SafeAreaProvider>
            <StatusBar style={colorMode === 'dark' ? 'light' : 'dark'} />
            <Slot />
            <UndoSnackbar />
            {splashVisible && (
                <Animated.View
                    pointerEvents="none"
                    style={[styles.splash, { opacity: splashOpacity }]}
                >
                    <Image source={splashImage} style={styles.splashImage} />
                    <Text style={styles.splashText}>DragonFlow</Text>
                </Animated.View>
            )}
        </SafeAreaProvider>
    );
}

const SPLASH_IMAGE_SIZE = 200;
const SPLASH_TEXT_GAP = 24;

const styles = StyleSheet.create({
    splash: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: SPLASH_BG,
    },
    splashImage: {
        position: 'absolute',
        width: SPLASH_IMAGE_SIZE,
        height: SPLASH_IMAGE_SIZE,
        left: '50%',
        top: '50%',
        marginLeft: -SPLASH_IMAGE_SIZE / 2,
        marginTop: -SPLASH_IMAGE_SIZE / 2,
    },
    splashText: {
        position: 'absolute',
        top: '50%',
        marginTop: SPLASH_IMAGE_SIZE / 2 + SPLASH_TEXT_GAP,
        width: '100%',
        textAlign: 'center',
        color: SPLASH_GOLD,
        fontSize: 32,
        fontWeight: '700',
        letterSpacing: 1.5,
    },
});
