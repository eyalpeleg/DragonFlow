import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/src/styles/theme';
import { DEFAULT_CATEGORY_ID, useTaskStore } from '@/src/store/taskStore';
import AddCategoryModal from '@/src/components/AddCategoryModal';
import EditCategoryModal from '@/src/components/EditCategoryModal';
import { Category } from '@/src/types';

export default function SettingsScreen() {
    const { showBubbleInBackground, defaultTaskTime, categories, deleteCategory, setShowBubbleInBackground, setDefaultTaskTime } = useTaskStore();
    const [tempTime, setTempTime] = useState(defaultTaskTime);
    const [addCatVisible, setAddCatVisible] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);

    function handleDeleteCategory(cat: Category) {
        if (cat.id === DEFAULT_CATEGORY_ID) {
            Alert.alert('Cannot delete', 'The Default category cannot be deleted.');
            return;
        }
        Alert.alert(
            'Delete Category',
            `Delete "${cat.name}"? Tasks using this category will be reassigned to Default.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => deleteCategory(cat.id),
                },
            ]
        );
    }

    const handleTimeChange = (text: string) => {
        setTempTime(text);
        if (text.match(/^\d{2}:\d{2}$/)) {
            const [hours, mins] = text.split(':').map(Number);
            if (hours >= 0 && hours < 24 && mins >= 0 && mins < 60) {
                setDefaultTaskTime(text);
            }
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Settings</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Bubble Settings */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Floating Bubble</Text>
                    <View style={styles.settingRow}>
                        <View style={styles.settingLabel}>
                            <Ionicons name="alert-circle" size={20} color={COLORS.primary} />
                            <View style={{ marginLeft: 12 }}>
                                <Text style={styles.settingTitle}>Show in Background</Text>
                                <Text style={styles.settingDesc}>Display critical task badge when app is closed</Text>
                            </View>
                        </View>
                        <Switch
                            value={showBubbleInBackground}
                            onValueChange={setShowBubbleInBackground}
                            trackColor={{ false: '#ccc', true: COLORS.primary }}
                            thumbColor="white"
                        />
                    </View>
                </View>

                {/* Task Defaults */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Task Defaults</Text>
                    <View style={styles.settingBlock}>
                        <Text style={styles.settingTitle}>Default Task Time</Text>
                        <Text style={styles.settingDesc}>Time used when creating new tasks</Text>
                        <View style={styles.timeInputRow}>
                            <TextInput
                                style={styles.timeInput}
                                value={tempTime}
                                onChangeText={handleTimeChange}
                                placeholder="HH:MM"
                                maxLength={5}
                                keyboardType="numbers-and-punctuation"
                            />
                            <Text style={styles.timeFormat}>24-hour format</Text>
                        </View>
                    </View>
                </View>

                {/* Categories */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Categories</Text>
                    <View style={styles.settingBlock}>
                        {categories.map((cat) => {
                            const isDefault = cat.id === DEFAULT_CATEGORY_ID;
                            return (
                                <View key={cat.id} style={styles.catRow}>
                                    <View style={[styles.catDot, { backgroundColor: cat.color }]} />
                                    <Text style={styles.catName}>{cat.name}</Text>
                                    {isDefault && (
                                        <Ionicons name="lock-closed" size={14} color="#bbb" style={{ marginRight: 8 }} />
                                    )}
                                    {!isDefault && (
                                        <View style={styles.catActions}>
                                            <TouchableOpacity onPress={() => setEditingCategory(cat)} style={styles.catActionBtn}>
                                                <Ionicons name="pencil" size={16} color={COLORS.primary} />
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => handleDeleteCategory(cat)} style={styles.catActionBtn}>
                                                <Ionicons name="trash" size={16} color="#E53935" />
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>
                            );
                        })}
                        <TouchableOpacity style={styles.addCatBtn} onPress={() => setAddCatVisible(true)}>
                            <Ionicons name="add-circle-outline" size={20} color={COLORS.primary} />
                            <Text style={styles.addCatText}>Add Category</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Info Section */}
                <View style={[styles.section, { marginTop: 16 }]}>
                    <Text style={styles.sectionTitle}>About</Text>
                    <View style={styles.infoBox}>
                        <Text style={styles.infoText}>DragonFlow v1.0</Text>
                        <Text style={styles.infoSubtext}>Personal task management</Text>
                    </View>
                </View>
            </ScrollView>

            <AddCategoryModal visible={addCatVisible} onClose={() => setAddCatVisible(false)} />
            <EditCategoryModal visible={!!editingCategory} category={editingCategory} onClose={() => setEditingCategory(null)} />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    header: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 20,
        paddingVertical: 16,
        alignItems: 'center',
    },
    headerTitle: { color: 'white', fontSize: 24, fontWeight: 'bold' },
    content: { padding: 20, paddingBottom: 40 },
    section: { marginBottom: 24 },
    sectionTitle: { fontSize: 14, fontWeight: '700', color: '#666', marginBottom: 12, textTransform: 'uppercase' },
    settingRow: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    settingLabel: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    settingTitle: { fontSize: 16, fontWeight: '600', color: '#222', marginBottom: 2 },
    settingDesc: { fontSize: 12, color: '#999' },
    settingBlock: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    timeInputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 10 },
    timeInput: {
        borderWidth: 1,
        borderColor: '#eee',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.primary,
        width: 80,
        textAlign: 'center',
    },
    timeFormat: { fontSize: 12, color: '#999' },
    catRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    catDot: { width: 14, height: 14, borderRadius: 7, marginRight: 12 },
    catName: { flex: 1, fontSize: 15, color: '#333', fontWeight: '500' },
    catActions: { flexDirection: 'row', gap: 12 },
    catActionBtn: { padding: 4 },
    addCatBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 12,
        marginTop: 4,
    },
    addCatText: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
    infoBox: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    infoText: { fontSize: 16, fontWeight: '600', color: '#222' },
    infoSubtext: { fontSize: 12, color: '#999', marginTop: 4 },
});
