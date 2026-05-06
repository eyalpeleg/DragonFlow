import React, { useRef, useState } from 'react';
import { PanResponder, StyleSheet, View, Dimensions, Text } from 'react-native';
import Animated, { useAnimatedStyle, withTiming, useSharedValue, runOnJS } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTaskStore } from '@/src/store/taskStore';
import FloatingBubbleDropTarget from './FloatingBubbleDropTarget';

interface Props {
    criticalCount: number;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const BUBBLE_SIZE = 60;
const TARGET_SIZE = 80;
const TARGET_CENTER_X = SCREEN_WIDTH / 2;
const TARGET_CENTER_Y = SCREEN_HEIGHT - 120;

export default function FloatingBubbleWrapper({ criticalCount }: Props) {
    const { setFloatingBubbleDismissed } = useTaskStore();
    const [isDragging, setIsDragging] = useState(false);

    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                runOnJS(setIsDragging)(true);
            },
            onPanResponderMove: (e, { dx, dy }) => {
                translateX.value = dx;
                translateY.value = dy;
            },
            onPanResponderRelease: (e, { dx, dy }) => {
                runOnJS(setIsDragging)(false);
                const bubbleCenterX = SCREEN_WIDTH - 16 - BUBBLE_SIZE / 2 + dx;
                const bubbleCenterY = 16 + BUBBLE_SIZE / 2 + dy;

                const distance = Math.sqrt(
                    Math.pow(bubbleCenterX - TARGET_CENTER_X, 2) +
                    Math.pow(bubbleCenterY - TARGET_CENTER_Y, 2)
                );

                if (distance < 80) {
                    // Dismiss bubble
                    translateX.value = withTiming(TARGET_CENTER_X - (SCREEN_WIDTH - 16 - BUBBLE_SIZE / 2), { duration: 200 });
                    translateY.value = withTiming(TARGET_CENTER_Y - (16 + BUBBLE_SIZE / 2), { duration: 200 });
                    setTimeout(() => {
                        setFloatingBubbleDismissed(true);
                    }, 200);
                } else {
                    // Snap back
                    translateX.value = withTiming(0, { duration: 300 });
                    translateY.value = withTiming(0, { duration: 300 });
                }
            },
        })
    ).current;

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
    }));

    if (criticalCount === 0) return null;

    return (
        <>
            <FloatingBubbleDropTarget isVisible={isDragging} />
            <Animated.View
                style={[styles.bubble, animatedStyle]}
                {...panResponder.panHandlers}
            >
                <View style={styles.bubbleContent}>
                    <Ionicons name="alert-circle" size={20} color="white" />
                    {criticalCount > 0 && (
                        <Text style={styles.count}>{criticalCount}</Text>
                    )}
                </View>
            </Animated.View>
        </>
    );
}

const styles = StyleSheet.create({
    bubble: {
        position: 'absolute',
        top: 16,
        right: 16,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#E53935',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 5,
    },
    bubbleContent: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    count: {
        position: 'absolute',
        fontSize: 10,
        fontWeight: 'bold',
        color: 'white',
        right: 2,
        top: 2,
        backgroundColor: '#B71C1C',
        borderRadius: 8,
        minWidth: 16,
        height: 16,
        textAlign: 'center',
        paddingHorizontal: 2,
    },
});
