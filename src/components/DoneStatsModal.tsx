import React, { useEffect, useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppColors } from '../styles/theme';
import { useColors } from '../styles/useColors';
import { useTaskStore } from '../store/appStore';
import { Task } from '../types';

interface Props {
    task: Task | null;
    onClose: () => void;
}

function formatDuration(ms: number): string {
    const totalMins = Math.floor(ms / 60000);
    const days = Math.floor(totalMins / 1440);
    const hours = Math.floor((totalMins % 1440) / 60);
    const mins = totalMins % 60;
    const parts: string[] = [];
    if (days > 0)  parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (mins > 0 || parts.length === 0) parts.push(`${mins}m`);
    return parts.join(' ');
}

export default function DoneStatsModal({ task, onClose }: Props) {
    const colors = useColors();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const insets = useSafeAreaInsets();
    const updateCompletionComment = useTaskStore((s) => s.updateCompletionComment);
    const [comment, setComment] = useState('');

    useEffect(() => {
        // Reload only when switching tasks; not on every parent re-render that hands us a new task object.
        if (task) setComment(task.completionComment ?? '');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [task?.id]);

    if (!task || task.status !== 'Done') return null;

    const durationMs = task.completedTime
        ? task.completedTime - task.createdAt
        : 0;

    const activeDurationMs = task.completedTime && task.startTime
        ? task.completedTime - task.startTime
        : null;

    // On-time check: compare completedTime date to dueDate
    let timeliness: { label: string; color: string; bg: string } | null = null;
    if (task.dueDate && task.completedTime) {
        const dueMs = new Date(task.dueDate + 'T23:59:59').getTime();
        const diff = Math.round((task.completedTime - dueMs) / 86400000);
        if (diff <= 0) {
            timeliness = { label: '✓ On Time', color: colors.accent.success, bg: colors.accent.successBg };
        } else {
            timeliness = { label: `⚠ ${diff}d late`, color: colors.accent.errorText, bg: colors.accent.errorBg };
        }
    }

    function handleClose() {
        if (task) updateCompletionComment(task.id, comment);
        onClose();
    }

    const completedDateStr = task.completedTime
        ? new Date(task.completedTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '—';

    return (
        <Modal visible animationType="slide" transparent onRequestClose={handleClose}>
            <View style={styles.overlay}>
                <View style={[styles.sheet, { paddingBottom: Math.max(20, insets.bottom) }]}>
                    {/* Handle */}
                    <View style={styles.handle} />

                    <Text style={styles.title} numberOfLines={2}>{task.title}</Text>
                    <Text style={styles.completedOn}>Completed {completedDateStr}</Text>

                    {/* Stats row */}
                    <View style={styles.statsRow}>
                        <View style={styles.statBox}>
                            <Text style={styles.statValue}>{formatDuration(durationMs)}</Text>
                            <Text style={styles.statLabel}>Total duration</Text>
                        </View>
                        {activeDurationMs !== null && (
                            <View style={styles.statBox}>
                                <Text style={styles.statValue}>{formatDuration(activeDurationMs)}</Text>
                                <Text style={styles.statLabel}>Active time</Text>
                            </View>
                        )}
                        {timeliness && (
                            <View style={[styles.timelinessBox, { backgroundColor: timeliness.bg }]}>
                                <Text style={[styles.timelinessText, { color: timeliness.color }]}>
                                    {timeliness.label}
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Comment */}
                    <Text style={styles.label}>Reflection</Text>
                    <TextInput
                        style={styles.commentInput}
                        value={comment}
                        onChangeText={setComment}
                        placeholder="Add a note about this task…"
                        placeholderTextColor={colors.text.veryLight}
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                    />

                    <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
                        <Text style={styles.closeBtnText}>Close</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
    overlay: { flex: 1, backgroundColor: c.overlay.scrimDeep, justifyContent: 'flex-end' },
    sheet: {
        backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
        padding: 20, paddingBottom: 36,
    },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: c.border.medium, alignSelf: 'center', marginBottom: 16 },
    title: { fontSize: 18, fontWeight: '700', color: c.text.primary, marginBottom: 4 },
    completedOn: { fontSize: 12, color: c.text.placeholder, marginBottom: 16 },
    statsRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginBottom: 20 },
    statBox: {
        flex: 1, minWidth: 90, backgroundColor: c.background, borderRadius: 12,
        padding: 12, alignItems: 'center',
    },
    statValue: { fontSize: 20, fontWeight: '700', color: c.text.primary },
    statLabel: { fontSize: 11, color: c.text.placeholder, marginTop: 2 },
    timelinessBox: {
        paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
        alignItems: 'center', justifyContent: 'center',
    },
    timelinessText: { fontSize: 13, fontWeight: '700' },
    label: { fontSize: 13, fontWeight: '600', color: c.text.subtle, marginBottom: 8 },
    commentInput: {
        borderWidth: 1, borderColor: c.border.light, borderRadius: 10,
        padding: 10, fontSize: 14, minHeight: 72, color: c.text.secondary,
    },
    closeBtn: {
        marginTop: 16, backgroundColor: c.primary, borderRadius: 12,
        paddingVertical: 14, alignItems: 'center',
    },
    closeBtnText: { color: c.white, fontWeight: '700', fontSize: 15 },
});
