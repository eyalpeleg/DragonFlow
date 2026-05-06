import { useEffect } from 'react';
import { AppState } from 'react-native';
import { Slot } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { requestNotificationPermission, setupNotificationChannels } from '@/src/utils/notifications';
import FloatingBubble from '@/src/modules/FloatingBubble';
import { useTaskStore } from '@/src/store/taskStore';
import FloatingBubbleWrapper from '@/src/components/FloatingBubbleWrapper';

export default function RootLayout() {
    const tasks = useTaskStore((s) => s.tasks);
    const dismissedFloatingBubble = useTaskStore((s) => s.dismissedFloatingBubble);
    const critical = tasks.filter(t => t.priority === 'Critical' && t.status !== 'Done');
    const criticalCount = critical.length;

    useEffect(() => {
        setupNotificationChannels();
        requestNotificationPermission();
        FloatingBubble.canDrawOverlays().then((ok) => {
            if (!ok) FloatingBubble.requestOverlayPermission();
        });

        const sub = AppState.addEventListener('change', (nextState) => {
            const { tasks } = useTaskStore.getState();
            const critical = tasks.filter(t => t.priority === 'Critical' && t.status !== 'Done');
            if (nextState === 'active') {
                FloatingBubble.hide();
            } else if (nextState === 'background') {
                if (critical.length > 0) {
                    FloatingBubble.show(critical.length, critical[0].title);
                }
            }
        });
        return () => sub.remove();
    }, []);

    return (
        <SafeAreaProvider>
            <Slot />
            {!dismissedFloatingBubble && <FloatingBubbleWrapper criticalCount={criticalCount} />}
        </SafeAreaProvider>
    );
}
