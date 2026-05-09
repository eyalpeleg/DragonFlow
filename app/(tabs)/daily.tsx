import React from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '@/src/styles/theme';
import { getCategoryColor, getCategoryName, useTaskStore } from '@/src/store/taskStore';
import { getDailySummary, getTasksCompletedToday } from '@/src/utils/summaryLogic';
import { Task } from '@/src/types';

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
    return (
        <View style={[styles.statCard, color ? { borderTopColor: color, borderTopWidth: 3 } : {}]}>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
}

function CategoryBar({ category, count, total, color }: { category: string; count: number; total: number; color: string }) {
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

export default function DailyScreen() {
    const tasks = useTaskStore((s) => s.tasks);
    const categories = useTaskStore((s) => s.categories);
    const hasHydrated = useTaskStore((s) => s.hasHydrated);

    if (!hasHydrated) {
        return (
            <SafeAreaView style={[styles.container, styles.centered]}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </SafeAreaView>
        );
    }

    const activeTasks = tasks.filter((t) => !t.archivedAt);
    const summary = getDailySummary(activeTasks);
    const completedToday = getTasksCompletedToday(activeTasks);

    const categoryBreakdown = categories
        .map((cat) => ({
            category: cat.name,
            color: cat.color,
            count: completedToday.filter((t: Task) => t.categoryId === cat.id).length,
        }))
        .filter((c) => c.count > 0);

    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Today</Text>
                <Text style={styles.headerDate}>{today}</Text>
            </View>

            <View style={styles.statsRow}>
                <StatCard label="Total" value={summary.total} />
                <StatCard label="Done" value={summary.done} color={COLORS.status['Done']} />
                <StatCard label="Active" value={summary.inProgress} color={COLORS.status['In Progress']} />
                <StatCard label="Done %" value={`${summary.completionRate}%`} color={COLORS.primary} />
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
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    centered: { justifyContent: 'center', alignItems: 'center' },
    header: { backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
    headerTitle: { color: 'white', fontSize: 24, fontWeight: 'bold' },
    headerDate: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 },
    statsRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 12, gap: 8 },
    statCard: { flex: 1, backgroundColor: 'white', borderRadius: 10, padding: 10, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
    statValue: { fontSize: 20, fontWeight: 'bold', color: '#222' },
    statLabel: { fontSize: 10, color: '#888', marginTop: 2 },
    sectionTitle: { fontSize: 14, fontWeight: '700', color: '#555', paddingHorizontal: 16, marginTop: 8, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
    list: { maxHeight: 220 },
    taskRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: 'white', marginHorizontal: 12, marginBottom: 6, borderRadius: 8 },
    taskDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
    taskTitle: { flex: 1, fontSize: 14, color: '#333' },
    catChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
    catChipText: { fontSize: 10, color: 'white', fontWeight: '600' },
    emptySection: { paddingHorizontal: 16, paddingVertical: 20, alignItems: 'center' },
    emptyText: { color: '#aaa', fontSize: 14 },
    catSection: { paddingHorizontal: 16, paddingBottom: 16 },
    catRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    catDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
    catName: { width: 70, fontSize: 13, color: '#444' },
    barContainer: { flex: 1, height: 8, backgroundColor: '#eee', borderRadius: 4, overflow: 'hidden', marginHorizontal: 8 },
    barFill: { height: '100%', borderRadius: 4 },
    catCount: { width: 24, fontSize: 13, fontWeight: '600', color: '#555', textAlign: 'right' },
});
