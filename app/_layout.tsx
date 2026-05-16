import { useEffect } from 'react';
import { AppState } from 'react-native';
import { Slot, router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { requestNotificationPermission, setupNotificationChannels } from '@/src/utils/notifications';
import FloatingBubble from '@/src/modules/FloatingBubble';
import { useTaskStore, computeBubbleScore } from '@/src/store/appStore';
import { backupService } from '@/src/services/cloudBackup';
import { audioService } from '@/src/services/audioService';
import { useColorMode } from '@/src/styles/useColors';

export default function RootLayout() {
    const { setFloatingBubbleDismissed } = useTaskStore();
    const colorMode = useColorMode();

    useEffect(() => {
        audioService.initialize().catch(() => {});
        setupNotificationChannels();
        requestNotificationPermission();
        FloatingBubble.canDrawOverlays().then((ok) => {
            if (!ok) FloatingBubble.requestOverlayPermission();
        }).catch(() => {});

        // Cloud backup initialization
        backupService.initializeBackup().catch(() => {});
        const unsubscribeBackup = backupService.setupAutoBackup();

        // Listen for native bubble dismiss gesture
        const unsubscribe = FloatingBubble.onDismissed(() => {
            setFloatingBubbleDismissed(true);
        });

        // Listen for native bubble double-tap → enter Focus mode on tasks list
        const unsubscribeOpenFocus = FloatingBubble.onOpenFocus(() => {
            useTaskStore.getState().setFocusMode(true);
            router.push('/(tabs)/tasks');
        });

        const sub = AppState.addEventListener('change', (nextState) => {
            const { tasks, dismissedFloatingBubble, showBubbleInBackground: showBubble } = useTaskStore.getState();
            if (nextState === 'active') {
                FloatingBubble.hide();
                if (dismissedFloatingBubble) {
                    setFloatingBubbleDismissed(false);
                }
            } else if (nextState === 'background') {
                // Don't show task bubble if Pomodoro is running — timer component handles it
                const { pomodoroEndTime } = useTaskStore.getState();
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
                backupService.onAppBackground();
            }
        });
        return () => {
            sub.remove();
            unsubscribe();
            unsubscribeOpenFocus();
            unsubscribeBackup();
        };
    }, [setFloatingBubbleDismissed]);

    return (
        <SafeAreaProvider>
            <StatusBar style={colorMode === 'dark' ? 'light' : 'dark'} />
            <Slot />
        </SafeAreaProvider>
    );
}
