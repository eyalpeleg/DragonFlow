import React, { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/src/styles/theme';
import { useTaskStore } from '@/src/store/taskStore';

export default function SettingsScreen() {
    const { showBubbleInBackground, defaultTaskTime, setShowBubbleInBackground, setDefaultTaskTime } = useTaskStore();
    const [tempTime, setTempTime] = useState(defaultTaskTime);

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

                {/* Info Section */}
                <View style={[styles.section, { marginTop: 40 }]}>
                    <Text style={styles.sectionTitle}>About</Text>
                    <View style={styles.infoBox}>
                        <Text style={styles.infoText}>DragonFlow v1.0</Text>
                        <Text style={styles.infoSubtext}>Personal task management</Text>
                    </View>
                </View>
            </ScrollView>
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
