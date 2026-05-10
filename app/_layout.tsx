import { useEffect } from 'react';
import { AppState } from 'react-native';
import { Slot } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { requestNotificationPermission, setupNotificationChannels } from '@/src/utils/notifications';
import FloatingBubble from '@/src/modules/FloatingBubble';
import { useTaskStore, computeBubbleScore } from '@/src/store/taskStore';
import { backupService } from '@/src/services/cloudBackup';

export default function RootLayout() {
    const { setFloatingBubbleDismissed, showBubbleInBackground } = useTaskStore();

    useEffect(() => {
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

        const sub = AppState.addEventListener('change', (nextState) => {
            const { tasks, dismissedFloatingBubble, showBubbleInBackground: showBubble } = useTaskStore.getState();
            if (nextState === 'active') {
                FloatingBubble.hide();
            } else if (nextState === 'background') {
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
                backupService.onAppBackground();
            }
        });
        return () => {
            sub.remove();
            unsubscribe();
            unsubscribeBackup();
        };
    }, [setFloatingBubbleDismissed]);

    return (
        <SafeAreaProvider>
            <Slot />
        </SafeAreaProvider>
    );
}
