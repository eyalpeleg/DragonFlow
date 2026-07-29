import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import PangoWatcher from '../modules/PangoWatcher';
import { useTaskStore } from '../store/appStore';
import { AppColors } from '../styles/theme';
import { useColors } from '../styles/useColors';
import { formatOverdue, formatParkingCountdown, isExpired, type ExtendDelta } from '../utils/parking';

interface Props {
    visible: boolean;
    onClose: () => void;
}

const EXTEND_DELTAS: ExtendDelta[] = [5, 15, 30, 60];

// In-app controls for an active parking session (opened from the bubble tap):
// live countdown, Extend (5/15/30/60), Open Pango, Done. AC4a/AC5/AC5a/AC6/AC7.
export default function PangoActionSheet({ visible, onClose }: Props) {
    const colors = useColors();
    const styles = makeStyles(colors);
    const session = useTaskStore((s) => s.parkingSession);
    const extendParkingSession = useTaskStore((s) => s.extendParkingSession);
    const clearParkingSession = useTaskStore((s) => s.clearParkingSession);
    const [now, setNow] = useState(() => Date.now());

    // Tick the countdown while the sheet is open.
    useEffect(() => {
        if (!visible) return;
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, [visible]);

    if (!session) return null;

    const overdue = isExpired(session, now);
    const label = overdue
        ? formatOverdue(now - session.remindAt)
        : formatParkingCountdown(session.remindAt - now);

    function handleExtend(delta: ExtendDelta) {
        const ok = extendParkingSession(delta);
        if (!ok) Alert.alert('Cannot extend', 'Parking is capped at 24 hours from when it started.');
    }

    function handleDone() {
        clearParkingSession();
        onClose();
    }

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable style={styles.overlay} onPress={onClose}>
                <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
                    <View style={styles.header}>
                        <Ionicons name="car" size={22} color={overdue ? colors.text.error : colors.primary} />
                        <Text style={styles.title}>Pango parking</Text>
                    </View>
                    <Text
                        style={[styles.countdown, overdue && styles.countdownOverdue]}
                        accessibilityLabel={overdue ? `Overdue by ${label}` : `${label} remaining`}
                    >
                        {overdue ? `Overdue ${label}` : `${label} left`}
                    </Text>

                    <Text style={styles.label}>Extend by</Text>
                    <View style={styles.chips}>
                        {EXTEND_DELTAS.map((d) => (
                            <Pressable
                                key={`pango-extend-${d}`}
                                accessibilityRole="button"
                                accessibilityLabel={`Extend by ${d} minutes`}
                                style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]}
                                onPress={() => handleExtend(d)}
                            >
                                <Text style={styles.chipText}>+{d}m</Text>
                            </Pressable>
                        ))}
                    </View>

                    <View style={styles.actions}>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Open Pango"
                            style={({ pressed }) => [styles.openBtn, pressed && { opacity: 0.7 }]}
                            onPress={() => PangoWatcher.openPango()}
                        >
                            <Ionicons name="open-outline" size={16} color={colors.primary} />
                            <Text style={styles.openText}>Open Pango</Text>
                        </Pressable>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Mark parking done"
                            style={({ pressed }) => [styles.doneBtn, pressed && { opacity: 0.7 }]}
                            onPress={handleDone}
                        >
                            <Ionicons name="checkmark" size={16} color={colors.surface} />
                            <Text style={styles.doneText}>Done</Text>
                        </Pressable>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
    overlay: { flex: 1, backgroundColor: c.overlay.scrimDeep, justifyContent: 'center', alignItems: 'center' },
    sheet: { backgroundColor: c.surfaceElevated, borderRadius: 16, padding: 20, width: '85%' },
    header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { fontSize: 18, fontWeight: '700', color: c.text.primary },
    countdown: { fontSize: 28, fontWeight: '800', color: c.text.primary, marginTop: 10, fontVariant: ['tabular-nums'] },
    countdownOverdue: { color: c.text.error },
    label: { fontSize: 13, fontWeight: '600', color: c.text.muted, marginTop: 18, marginBottom: 8 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
        minHeight: 44, minWidth: 56, paddingHorizontal: 14, borderRadius: 22,
        borderWidth: 1, borderColor: c.border.medium, alignItems: 'center', justifyContent: 'center',
    },
    chipText: { fontSize: 14, fontWeight: '700', color: c.text.primary },
    actions: { flexDirection: 'row', gap: 10, marginTop: 20 },
    openBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: c.primary,
    },
    openText: { color: c.primary, fontWeight: '700', fontSize: 14 },
    doneBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        minHeight: 44, borderRadius: 10, backgroundColor: c.primary,
    },
    doneText: { color: c.surface, fontWeight: '700', fontSize: 14 },
});
