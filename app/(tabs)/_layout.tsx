import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useColors } from '@/src/styles/useColors';

export default function TabLayout() {
    const colors = useColors();
    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.text.weak,
                headerShown: false,
                tabBarStyle: { paddingBottom: 4, backgroundColor: colors.surface, borderTopColor: colors.border.light },
            }}
        >
            <Tabs.Screen
                name="tasks"
                options={{
                    title: 'Tasks',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="list" color={color} size={size} />
                    ),
                }}
            />
            <Tabs.Screen
                name="daily"
                options={{
                    title: 'Today',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="today" color={color} size={size} />
                    ),
                }}
            />
            <Tabs.Screen
                name="weekly"
                options={{
                    title: 'Weekly',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="stats-chart" color={color} size={size} />
                    ),
                }}
            />
            <Tabs.Screen
                name="settings"
                options={{
                    title: 'Settings',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="settings" color={color} size={size} />
                    ),
                }}
            />
        </Tabs>
    );
}
