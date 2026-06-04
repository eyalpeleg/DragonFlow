import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppColors } from '../styles/theme';
import { useColors } from '../styles/useColors';
import { useTaskStore } from '../store/appStore';

const VISIBLE_MS = 4000;
const FADE_MS = 180;

export default function UndoSnackbar() {
    const colors = useColors();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const insets = useSafeAreaInsets();
    const lastDoneUndo = useTaskStore((s) => s.lastDoneUndo);
    const undoLastDone = useTaskStore((s) => s.undoLastDone);
    const clearLastDoneUndo = useTaskStore((s) => s.clearLastDoneUndo);

    const opacity = useRef(new Animated.Value(0)).current;
    const dismissTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!lastDoneUndo) {
            Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }).start();
            return;
        }
        Animated.timing(opacity, { toValue: 1, duration: FADE_MS, useNativeDriver: true }).start();
        if (dismissTimeoutRef.current) clearTimeout(dismissTimeoutRef.current);
        dismissTimeoutRef.current = setTimeout(() => {
            clearLastDoneUndo();
        }, VISIBLE_MS);
        return () => {
            if (dismissTimeoutRef.current) {
                clearTimeout(dismissTimeoutRef.current);
                dismissTimeoutRef.current = null;
            }
        };
    }, [lastDoneUndo, opacity, clearLastDoneUndo]);

    if (!lastDoneUndo) return null;

    return (
        <Animated.View
            pointerEvents="box-none"
            style={[styles.wrapper, { bottom: insets.bottom + 80, opacity }]}
        >
            <View style={styles.snackbar}>
                <Text style={styles.message}>Task completed</Text>
                <TouchableOpacity onPress={undoLastDone} style={styles.action} accessibilityLabel="Undo">
                    <Text style={styles.actionText}>UNDO</Text>
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
    wrapper: {
        position: 'absolute',
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    snackbar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.text.primary,
        borderRadius: 8,
        paddingLeft: 16,
        paddingRight: 8,
        paddingVertical: 10,
        marginHorizontal: 16,
        minWidth: 240,
        elevation: 6,
        shadowColor: c.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
    message: { color: c.white, fontSize: 14, flex: 1 },
    action: { paddingHorizontal: 12, paddingVertical: 4 },
    actionText: { color: c.secondary, fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
});
