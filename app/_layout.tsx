import { useEffect } from 'react';
import { AppState } from 'react-native';
import { Slot } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { requestNotificationPermission, setupNotificationChannels } from '@/src/utils/notifications';
import FloatingBubble from '@/src/modules/FloatingBubble';
import { useTaskStore } from '@/src/store/taskStore';

export default function RootLayout() {
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
        </SafeAreaProvider>
    );
}
