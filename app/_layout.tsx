import { useEffect } from 'react';
import { AppState } from 'react-native';
import { Slot } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { requestNotificationPermission, setupNotificationChannels } from '@/src/utils/notifications';
import FloatingBubble from '@/src/modules/FloatingBubble';
import { useTaskStore } from '@/src/store/taskStore';
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
            const critical = tasks.filter(t => t.priority === 'Critical' && t.status !== 'Done');
            if (nextState === 'active') {
                FloatingBubble.hide();
            } else if (nextState === 'background') {
                if (critical.length > 0 && !dismissedFloatingBubble && showBubble) {
                    FloatingBubble.show(critical.length, critical[0].title);
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
