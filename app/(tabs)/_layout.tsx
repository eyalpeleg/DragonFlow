import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PomodoroMiniBar from '@/src/components/PomodoroMiniBar';
import PomodoroTimer from '@/src/components/PomodoroTimer';
import { usePomodoroController } from '@/src/hooks/usePomodoroController';
import { useTaskStore } from '@/src/store/appStore';
import { useColorMode, useColors } from '@/src/styles/useColors';

export default function TabLayout() {
    const colors = useColors();
    const mode = useColorMode();
    const insets = useSafeAreaInsets();
    const tabBarHeight = (Platform.OS === 'ios' ? 49 : 56) + insets.bottom + 4;
    const setPomodoroVisible = useTaskStore((s) => s.setPomodoroVisible);
    const controller = usePomodoroController();
    const { modeIdx, secondsLeft, running, isPaused, customTimerSeconds,
        handleStart, handlePause, handleReset, handleSelectMode, handleSetCustomTimerSeconds } = controller;
    const activeTintColor = mode === 'light' ? '#5e3d8a' : colors.primary;

    return (
        <View style={styles.root}>
            <Tabs
                screenOptions={{
                    tabBarActiveTintColor: activeTintColor,
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
                    name="progress"
                    options={{
                        title: 'Progress',
                        tabBarIcon: ({ color, size }) => (
                            <Ionicons name="stats-chart" color={color} size={size} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="pomodoro"
                    options={{
                        title: 'Pomodoro',
                        tabBarIcon: ({ color, size }) => (
                            <Ionicons name="hourglass" color={color} size={size} />
                        ),
                    }}
                    listeners={{
                        tabPress: (e) => {
                            e.preventDefault();
                            setPomodoroVisible(true);
                        },
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

            <View style={[styles.miniBarHost, { bottom: tabBarHeight }]} pointerEvents="box-none">
                <PomodoroMiniBar
                    modeIdx={modeIdx}
                    secondsLeft={secondsLeft}
                    running={running}
                    isPaused={isPaused}
                    onTogglePause={running ? handlePause : handleStart}
                    onStop={handleReset}
                />
            </View>

            <PomodoroTimer
                modeIdx={modeIdx}
                secondsLeft={secondsLeft}
                running={running}
                isPaused={isPaused}
                customTimerSeconds={customTimerSeconds}
                onSelectMode={handleSelectMode}
                onSetCustomTimerSeconds={handleSetCustomTimerSeconds}
                onStart={handleStart}
                onPause={handlePause}
                onReset={handleReset}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    miniBarHost: {
        position: 'absolute',
        left: 0,
        right: 0,
    },
});
