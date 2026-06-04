import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppColors } from '@/src/styles/theme';
import { useColors } from '@/src/styles/useColors';
import { getCategoryColor, getCategoryName, useTaskStore } from '@/src/store/appStore';
import { formatDuration, getDailySummary, getTasksCompletedToday, getWeeklyTimeSpent, getWeeklyCategoryStats } from '@/src/utils/summaryLogic';
import { Task } from '@/src/types';

const HEADER_HEIGHT = 56;
const appIcon = require('@/assets/images/dragonflow3.png');

type ProgressView = 'today' | 'week';

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
    const colors = useColors();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    return (
        <View style={[styles.statCard, color ? { borderTopColor: color, borderTopWidth: 3 } : {}]}>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
}

function CategoryBar({ category, count, total, color }: { category: string; count: number; total: number; color: string }) {
    const colors = useColors();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return (
        <View style={styles.catRow}>
            <View style={[styles.catDot, { backgroundColor: color }]} />
            <Text style={styles.catName}>{category}</Text>
            <View style={styles.barContainer}>
                <View style={[styles.barFill, { width: `${pct}%` as any, backgroundColor: color }]} />
            </View>
            <Text style={styles.catCount}>{count}</Text>
        </View>
    );
}

function getWeekBounds(weekOffset: number, firstDayOfWeek: 'sunday' | 'monday'): { start: Date; end: Date } {
    const firstDay = firstDayOfWeek === 'sunday' ? 0 : 1;
    const now = new Date();
    const day = now.getDay();
    const daysBack = (day - firstDay + 7) % 7;
    const start = new Date(now);
    start.setDate(now.getDate() - daysBack + weekOffset * 7);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
}

export default function ProgressScreen() {
    const colors = useColors();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const tasks = useTaskStore((s) => s.tasks);
    const categories = useTaskStore((s) => s.categories);
    const hasHydrated = useTaskStore((s) => s.hasHydrated);
    const firstDayOfWeek = useTaskStore((s) => s.firstDayOfWeek);

    const [view, setView] = useState<ProgressView>('today');
    const [weekOffset, setWeekOffset] = useState(0);

    if (!hasHydrated) {
        return (
            <SafeAreaView style={[styles.container, styles.centered]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Image source={appIcon} style={styles.headerIcon} />
                <View style={styles.headerContent}>
                    <Text style={styles.headerTitle}>Progress</Text>
                </View>
            </View>

            <View style={styles.segmentRow}>
                <TouchableOpacity
                    style={[styles.segment, view === 'today' && { backgroundColor: colors.primary }]}
                    onPress={() => { setView('today'); setWeekOffset(0); }}
                >
                    <Text style={[styles.segmentText, view === 'today' && { color: colors.white }]}>Today</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.segment, view === 'week' && { backgroundColor: colors.primary }]}
                    onPress={() => setView('week')}
                >
                    <Text style={[styles.segmentText, view === 'week' && { color: colors.white }]}>Weekly</Text>
                </TouchableOpacity>
            </View>

            {view === 'today' ? (
                <TodayView activeTasks={tasks} categories={categories} />
            ) : (
                <WeekView
                    activeTasks={tasks}
                    categories={categories}
                    firstDayOfWeek={firstDayOfWeek}
                    weekOffset={weekOffset}
                    setWeekOffset={setWeekOffset}
                />
            )}
        </SafeAreaView>
    );
}

function TodayView({ activeTasks, categories }: { activeTasks: Task[]; categories: { id: string; name: string; color: string }[] }) {
    const colors = useColors();
    const styles = useMemo(() => makeStyles(colors), [colors]);

    const summary = getDailySummary(activeTasks);
    const completedToday = getTasksCompletedToday(activeTasks);

    const categoryBreakdown = categories
        .map((cat) => ({
            category: cat.name,
            color: cat.color,
            count: completedToday.filter((t: Task) => t.categoryId === cat.id).length,
        }))
        .filter((c) => c.count > 0);

    return (
        <>
            <View style={styles.statsRow}>
                <StatCard label="Total" value={summary.total} />
                <StatCard label="Done" value={summary.done} color={colors.status['Done']} />
                <StatCard label="Active" value={summary.inProgress} color={colors.status['In Progress']} />
                <StatCard label="Done %" value={`${summary.completionRate}%`} color={colors.primary} />
            </View>

            <Text style={styles.sectionTitle}>Completed Today</Text>
            {completedToday.length === 0 ? (
                <View style={styles.emptySection}>
                    <Text style={styles.emptyText}>No tasks completed yet today</Text>
                </View>
            ) : (
                <FlatList
                    data={completedToday}
                    keyExtractor={(item) => item.id}
                    style={styles.list}
                    renderItem={({ item }) => {
                        const color = getCategoryColor(categories, item.categoryId);
                        const name = getCategoryName(categories, item.categoryId);
                        return (
                            <View style={styles.taskRow}>
                                <View style={[styles.taskDot, { backgroundColor: color }]} />
                                <Text style={styles.taskTitle} numberOfLines={1}>{item.title}</Text>
                                <View style={[styles.catChip, { backgroundColor: color }]}>
                                    <Text style={styles.catChipText}>{name}</Text>
                                </View>
                            </View>
                        );
                    }}
                />
            )}

            {categoryBreakdown.length > 0 && (
                <>
                    <Text style={styles.sectionTitle}>By Category</Text>
                    <View style={styles.catSection}>
                        {categoryBreakdown.map((c) => (
                            <CategoryBar key={c.category} category={c.category} count={c.count} total={completedToday.length} color={c.color} />
                        ))}
                    </View>
                </>
            )}
        </>
    );
}

interface WeekViewProps {
    activeTasks: Task[];
    categories: { id: string; name: string; color: string }[];
    firstDayOfWeek: 'sunday' | 'monday';
    weekOffset: number;
    setWeekOffset: (updater: number | ((prev: number) => number)) => void;
}

function WeekView({ activeTasks, categories, firstDayOfWeek, weekOffset, setWeekOffset }: WeekViewProps) {
    const colors = useColors();
    const styles = useMemo(() => makeStyles(colors), [colors]);

    const { start: weekStart, end: weekEnd } = getWeekBounds(weekOffset, firstDayOfWeek);
    const weekStartMs = weekStart.getTime();
    const weekEndMs = weekEnd.getTime();

    const doneTasks = activeTasks
        .filter((t: Task) => t.status === 'Done' && t.completedTime && t.completedTime >= weekStartMs && t.completedTime <= weekEndMs)
        .sort((a: Task, b: Task) => (b.completedTime ?? 0) - (a.completedTime ?? 0));

    const weeklyTasks = weekOffset === 0
        ? activeTasks.filter((t: Task) => t.status !== 'Done' || (t.completedTime && t.completedTime >= weekStartMs && t.completedTime <= weekEndMs))
        : doneTasks;

    const summary = getDailySummary(weeklyTasks);
    const timeSpent = getWeeklyTimeSpent(activeTasks, weekStartMs, weekEndMs);
    const catStats = getWeeklyCategoryStats(activeTasks, weekStartMs, weekEndMs);
    const totalDone = Object.values(catStats as Record<string, number>).reduce((a: number, b: number) => a + b, 0);

    const dateRange = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    const weekTitle = weekOffset === 0 ? 'This Week' : weekOffset === -1 ? 'Last Week' : dateRange;

    return (
        <>
            <View style={styles.weekNavRow}>
                <TouchableOpacity style={styles.navBtn} onPress={() => setWeekOffset((o: number) => o - 1)}>
                    <Ionicons name="chevron-back" size={22} color={colors.text.muted} />
                </TouchableOpacity>
                <Text style={styles.weekTitle}>{weekTitle}</Text>
                <TouchableOpacity
                    style={styles.navBtn}
                    onPress={() => weekOffset < 0 && setWeekOffset((o: number) => o + 1)}
                    disabled={weekOffset === 0}
                >
                    <Ionicons name="chevron-forward" size={22} color={weekOffset < 0 ? colors.text.muted : colors.text.disabled} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scroll}>
                <View style={styles.statsRow}>
                    <StatCard label="Done" value={summary.done} color={colors.status['Done']} />
                    <StatCard label="In Progress" value={summary.inProgress} color={colors.status['In Progress']} />
                    <StatCard label="Done %" value={`${summary.completionRate}%`} color={colors.primary} />
                </View>

                <Text style={styles.sectionTitle}>By Category</Text>
                <View style={styles.catSection}>
                    {categories.map((cat) => {
                        const count = (catStats as Record<string, number>)[cat.id] ?? 0;
                        const ms = (timeSpent as Record<string, number>)[cat.id] ?? 0;
                        const pct = totalDone > 0 ? Math.round((count / totalDone) * 100) : 0;
                        return (
                            <View key={cat.id} style={styles.catRow}>
                                <View style={[styles.catDot, { backgroundColor: cat.color }]} />
                                <Text style={styles.catName}>{cat.name}</Text>
                                <View style={styles.barContainer}>
                                    <View style={[styles.barFill, { width: `${pct}%` as any, backgroundColor: cat.color }]} />
                                </View>
                                <Text style={styles.catCount}>{count}</Text>
                                {ms > 0 && <Text style={styles.catTime}>{formatDuration(ms)}</Text>}
                            </View>
                        );
                    })}
                </View>

                <Text style={styles.sectionTitle}>Task Log</Text>
                {doneTasks.length === 0 ? (
                    <View style={styles.emptySection}>
                        <Text style={styles.emptyText}>No completed tasks this week</Text>
                    </View>
                ) : (
                    doneTasks.map((task: Task) => {
                        const ms = task.startTime && task.completedTime ? task.completedTime - task.startTime : 0;
                        const color = getCategoryColor(categories, task.categoryId);
                        const name = getCategoryName(categories, task.categoryId);
                        return (
                            <View key={task.id} style={styles.logRow}>
                                <View style={[styles.catDot, { backgroundColor: color }]} />
                                <Text style={styles.logTitle} numberOfLines={1}>{task.title}</Text>
                                <View style={[styles.catChip, { backgroundColor: color }]}>
                                    <Text style={styles.catChipText}>{name}</Text>
                                </View>
                                {ms > 0 && <Text style={styles.logTime}>{formatDuration(ms)}</Text>}
                            </View>
                        );
                    })
                )}
            </ScrollView>
        </>
    );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    centered: { justifyContent: 'center', alignItems: 'center' },
    header: { backgroundColor: c.primary, paddingHorizontal: 16, height: HEADER_HEIGHT, flexDirection: 'row', alignItems: 'center' },
    headerIcon: { width: 50, height: 50, borderRadius: 6, marginRight: 12 },
    headerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { color: c.white, fontSize: 20, fontWeight: 'bold' },
    segmentRow: { flexDirection: 'row', marginHorizontal: 16, marginTop: 12, marginBottom: 4, backgroundColor: c.surfaceAlt.soft, borderRadius: 10, padding: 4 },
    segment: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
    segmentText: { fontSize: 14, fontWeight: '600', color: c.text.muted },
    weekNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
    navBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    weekTitle: { fontSize: 15, fontWeight: '700', color: c.text.primary },
    scroll: { paddingBottom: 40 },
    statsRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 12, gap: 8 },
    statCard: { flex: 1, backgroundColor: c.surface, borderRadius: 10, padding: 10, alignItems: 'center', shadowColor: c.shadow, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
    statValue: { fontSize: 20, fontWeight: 'bold', color: c.text.primary },
    statLabel: { fontSize: 10, color: c.text.weak, marginTop: 2, textAlign: 'center' },
    sectionTitle: { fontSize: 14, fontWeight: '700', color: c.text.muted, paddingHorizontal: 16, marginTop: 8, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
    list: { maxHeight: 220 },
    taskRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: c.surface, marginHorizontal: 12, marginBottom: 6, borderRadius: 8 },
    taskDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
    taskTitle: { flex: 1, fontSize: 14, color: c.text.secondary },
    catChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
    catChipText: { fontSize: 10, color: c.white, fontWeight: '600' },
    emptySection: { paddingHorizontal: 16, paddingVertical: 20, alignItems: 'center' },
    emptyText: { color: c.text.light, fontSize: 14 },
    catSection: { paddingHorizontal: 16, paddingBottom: 16 },
    catRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    catDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
    catName: { width: 70, fontSize: 13, color: c.text.body },
    barContainer: { flex: 1, height: 8, backgroundColor: c.border.light, borderRadius: 4, overflow: 'hidden', marginHorizontal: 8 },
    barFill: { height: '100%', borderRadius: 4 },
    catCount: { width: 24, fontSize: 13, fontWeight: '600', color: c.text.muted, textAlign: 'right' },
    catTime: { width: 44, fontSize: 11, color: c.text.weak, textAlign: 'right', marginLeft: 6 },
    logRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: c.surface, marginHorizontal: 12, marginBottom: 6, borderRadius: 8 },
    logTitle: { flex: 1, fontSize: 13, color: c.text.secondary },
    logTime: { fontSize: 11, color: c.text.weak, marginLeft: 6 },
});
