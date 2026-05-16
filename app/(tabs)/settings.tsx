import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { COLORS } from '@/src/styles/theme';
import { DEFAULT_CATEGORY_ID, useTaskStore } from '@/src/store/appStore';
import AddCategoryModal from '@/src/components/AddCategoryModal';
import EditCategoryModal from '@/src/components/EditCategoryModal';
import SoundSelectorDropdown from '@/src/components/SoundSelectorDropdown';
import VolumeControl from '@/src/components/VolumeControl';
import { Category, SoundType } from '@/src/types';
import { exportToFile, importFromFile } from '@/src/utils/dataTransfer';
import { playPreviewSound } from '@/src/utils/notifications';
import { useBackupStore, googleAuth, backupService, BackupMetadata } from '@/src/services/cloudBackup';

const HEADER_HEIGHT = 56;
const appIcon = require('@/assets/images/dragonflow3.png');
const SWITCH_TRACK_COLOR = { false: COLORS.text.disabled, true: COLORS.primary } as const;
const BUILD_TIMESTAMP = new Date(Constants.expoConfig?.extra?.buildTimestamp).toLocaleString();
const SOUND_TYPE_OPTIONS: SoundType[] = ['AppSound', 'Disabled'];

function CollapsibleSection({ title, children }: { title: string; children: React.ReactNode }) {
    const [expanded, setExpanded] = useState(true);
    return (
        <View style={sectionStyles.wrapper}>
            <TouchableOpacity style={sectionStyles.header} onPress={() => setExpanded((v) => !v)} activeOpacity={0.7}>
                <Text style={sectionStyles.title}>{title}</Text>
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.text.placeholder} />
            </TouchableOpacity>
            {expanded && children}
        </View>
    );
}

const sectionStyles = StyleSheet.create({
    wrapper: { marginBottom: 24 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    title: { fontSize: 14, fontWeight: '700', color: COLORS.text.subtle, textTransform: 'uppercase' },
});

function formatRelativeTime(isoString: string | null): string {
    if (!isoString) return 'Never';
    const diff = Date.now() - new Date(isoString).getTime();
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

export default function SettingsScreen() {
    const { showBubbleInBackground, defaultTaskTime, firstDayOfWeek, pomodoroSoundType, tasksSoundType, pomodoroVolume, tasksVolume, categories, debugModeEnabled, darkMode, deleteCategory, setShowBubbleInBackground, setDefaultTaskTime, setFirstDayOfWeek, setPomodoroSoundType, setTasksSoundType, setPomodoroVolume, setTasksVolume, setDebugModeEnabled, setDarkMode } = useTaskStore();
    const [tempTime, setTempTime] = useState(defaultTaskTime);
    const [addCatVisible, setAddCatVisible] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [tasksDropdownOpen, setTasksDropdownOpen] = useState(false);
    const [pomodoroDropdownOpen, setPomodoroDropdownOpen] = useState(false);
    const [tasksVolumeVisible, setTasksVolumeVisible] = useState(false);
    const [pomodoroVolumeVisible, setPomodoroVolumeVisible] = useState(false);

    const { isSignedIn, userEmail, autoBackupEnabled, lastBackupTime, backupStatus, setAutoBackup, setSignedIn, setSignedOut } = useBackupStore();
    const [restorePickerVisible, setRestorePickerVisible] = useState(false);
    const [availableBackups, setAvailableBackups] = useState<BackupMetadata[]>([]);
    const [selectedBackupId, setSelectedBackupId] = useState<string | null>(null);
    const [loadingBackups, setLoadingBackups] = useState(false);

    async function handleGoogleSignIn() {
        try {
            const tokens = await googleAuth.signIn();
            setSignedIn(tokens.userEmail ?? 'Unknown', tokens.userName);
        } catch (e: any) {
            if (!e.message?.includes('cancelled')) {
                Alert.alert('Sign-in Failed', e.message ?? 'Something went wrong.');
            }
        }
    }

    async function handleGoogleSignOut() {
        await googleAuth.signOut();
        setSignedOut();
    }

    async function handleCloudBackup() {
        try {
            await backupService.performBackup();
            Alert.alert('Backup Complete', 'Your data has been backed up to Google Drive.');
        } catch (e: any) {
            Alert.alert('Backup Failed', e.message ?? 'Something went wrong.');
        }
    }

    async function handleOpenRestorePicker() {
        setLoadingBackups(true);
        setRestorePickerVisible(true);
        try {
            const backups = await backupService.listAvailableBackups();
            setAvailableBackups(backups);
            if (backups.length > 0) setSelectedBackupId(backups[0].fileId);
        } catch (e: any) {
            Alert.alert('Error', e.message ?? 'Could not load backups.');
            setRestorePickerVisible(false);
        } finally {
            setLoadingBackups(false);
        }
    }

    async function handleRestore() {
        if (!selectedBackupId) return;
        setRestorePickerVisible(false);
        Alert.alert(
            'Restore Backup',
            'This will replace all current tasks with the selected backup. Continue?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Restore',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const result = await backupService.performRestore(selectedBackupId);
                            Alert.alert('Restore Complete', `${result.tasksImported} task(s) restored.`);
                        } catch (e: any) {
                            Alert.alert('Restore Failed', e.message ?? 'Something went wrong.');
                        }
                    },
                },
            ],
        );
    }

    async function handleExport() {
        try {
            await exportToFile();
        } catch (e: any) {
            Alert.alert('Export Failed', e.message ?? 'Something went wrong.');
        }
    }

    function handleImport() {
        Alert.alert(
            'Import Data',
            'This will replace all current tasks with the imported data. Continue?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Replace',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const result = await importFromFile();
                            if (result) {
                                Alert.alert('Import Complete', `${result.tasksImported} task(s) imported.`);
                            }
                        } catch (e: any) {
                            Alert.alert('Import Failed', e.message ?? 'Something went wrong.');
                        }
                    },
                },
            ]
        );
    }

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
                <Image source={appIcon} style={styles.headerIcon} />
                <View style={styles.headerContent}>
                    <Text style={styles.headerTitle}>Settings</Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.settingRow}>
                    <View style={styles.settingLabel}>
                        <Ionicons name="moon" size={20} color={COLORS.primary} />
                        <View style={styles.ml12}>
                            <Text style={styles.settingTitle}>Dark Mode</Text>
                            <Text style={styles.settingDesc}>Use a dark color theme across the app</Text>
                        </View>
                    </View>
                    <Switch
                        value={darkMode}
                        onValueChange={setDarkMode}
                        trackColor={SWITCH_TRACK_COLOR}
                        thumbColor={COLORS.white}
                    />
                </View>

                <CollapsibleSection title="Floating Bubble">
                    <View style={styles.settingRow}>
                        <View style={styles.settingLabel}>
                            <Ionicons name="alert-circle" size={20} color={COLORS.primary} />
                            <View style={styles.ml12}>
                                <Text style={styles.settingTitle}>Show Bubble</Text>
                                <Text style={styles.settingDesc}>Display urgent task badge when app is in the background</Text>
                            </View>
                        </View>
                        <Switch
                            value={showBubbleInBackground}
                            onValueChange={setShowBubbleInBackground}
                            trackColor={SWITCH_TRACK_COLOR}
                            thumbColor={COLORS.white}
                        />
                    </View>
                </CollapsibleSection>

                <CollapsibleSection title="Audio">

                    {/* Tasks Sound Section */}
                    <View style={styles.settingBlock}>
                        <Text style={styles.settingTitle}>Task Reminders Sound</Text>
                        <Text style={styles.settingDesc}>Sound played for task notifications</Text>
                        <View style={styles.soundSelectorRow}>
                            <TouchableOpacity
                                style={styles.soundDropdownButton}
                                onPress={() => setTasksDropdownOpen(true)}
                            >
                                <Text style={styles.soundDropdownButtonText}>{tasksSoundType}</Text>
                                <Ionicons name="chevron-down" size={18} color={COLORS.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.volumeButton}
                                onPress={() => setTasksVolumeVisible(true)}
                            >
                                <Ionicons name="volume-high" size={20} color={COLORS.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.playButton, tasksSoundType === 'Disabled' && styles.playButtonDisabled]}
                                onPress={() => playPreviewSound('ding', tasksSoundType, tasksVolume).catch(console.error)}
                                disabled={tasksSoundType === 'Disabled'}
                            >
                                <Ionicons name="musical-note" size={20} color={tasksSoundType === 'Disabled' ? COLORS.text.disabled : COLORS.white} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Pomodoro Sound Section */}
                    <View style={styles.settingBlock}>
                        <Text style={styles.settingTitle}>Pomodoro Sound</Text>
                        <Text style={styles.settingDesc}>Sound played when timer completes</Text>
                        <View style={styles.soundSelectorRow}>
                            <TouchableOpacity
                                style={styles.soundDropdownButton}
                                onPress={() => setPomodoroDropdownOpen(true)}
                            >
                                <Text style={styles.soundDropdownButtonText}>{pomodoroSoundType}</Text>
                                <Ionicons name="chevron-down" size={18} color={COLORS.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.volumeButton}
                                onPress={() => setPomodoroVolumeVisible(true)}
                            >
                                <Ionicons name="volume-high" size={20} color={COLORS.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.playButton, pomodoroSoundType === 'Disabled' && styles.playButtonDisabled]}
                                onPress={() => playPreviewSound('bell', pomodoroSoundType, pomodoroVolume).catch(console.error)}
                                disabled={pomodoroSoundType === 'Disabled'}
                            >
                                <Ionicons name="musical-note" size={20} color={pomodoroSoundType === 'Disabled' ? COLORS.text.disabled : COLORS.white} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </CollapsibleSection>

                <CollapsibleSection title="Task-List">
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
                    <View style={[styles.settingBlock, styles.settingBlockGap]}>
                        <Text style={styles.settingTitle}>First Day of Week</Text>
                        <Text style={styles.settingDesc}>Sets the start of the week in the weekly report</Text>
                        <View style={styles.weekDayRow}>
                            {(['sunday', 'monday'] as const).map((day) => (
                                <TouchableOpacity
                                    key={day}
                                    style={[styles.weekDayBtn, firstDayOfWeek === day && styles.weekDayBtnActive]}
                                    onPress={() => setFirstDayOfWeek(day)}
                                >
                                    <Text style={[styles.weekDayText, firstDayOfWeek === day && styles.weekDayTextActive]}>
                                        {day.charAt(0).toUpperCase() + day.slice(1)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                    <View style={[styles.settingBlock, styles.settingBlockGap]}>
                        {categories.map((cat) => {
                            const isDefault = cat.id === DEFAULT_CATEGORY_ID;
                            return (
                                <View key={cat.id} style={styles.catRow}>
                                    <View style={[styles.catDot, { backgroundColor: cat.color }]} />
                                    <Text style={styles.catName}>{cat.name}</Text>
                                    {isDefault && (
                                        <Ionicons name="lock-closed" size={14} color={COLORS.text.veryLight} style={styles.mr8} />
                                    )}
                                    {!isDefault && (
                                        <View style={styles.catActions}>
                                            <TouchableOpacity onPress={() => setEditingCategory(cat)} style={styles.catActionBtn}>
                                                <Ionicons name="pencil" size={16} color={COLORS.primary} />
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => handleDeleteCategory(cat)} style={styles.catActionBtn}>
                                                <Ionicons name="trash" size={16} color={COLORS.text.error} />
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
                </CollapsibleSection>

                <CollapsibleSection title="Data">
                    <View style={styles.settingBlock}>
                        <TouchableOpacity style={styles.dataRow} onPress={handleExport}>
                            <Ionicons name="download-outline" size={20} color={COLORS.primary} />
                            <View style={styles.ml12flex}>
                                <Text style={styles.settingTitle}>Export Data</Text>
                                <Text style={styles.settingDesc}>Save tasks & categories to a JSON backup file</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={COLORS.text.disabled} />
                        </TouchableOpacity>
                        <View style={styles.dataDivider} />
                        <TouchableOpacity style={styles.dataRow} onPress={handleImport}>
                            <Ionicons name="push-outline" size={20} color={COLORS.primary} />
                            <View style={styles.ml12flex}>
                                <Text style={styles.settingTitle}>Import Data</Text>
                                <Text style={styles.settingDesc}>Restore from a backup file (replaces current data)</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={COLORS.text.disabled} />
                        </TouchableOpacity>
                    </View>
                    <View style={[styles.settingBlock, styles.settingBlockGap]}>
                        {!isSignedIn ? (
                            <View style={styles.cloudSignInWrapper}>
                                <Ionicons name="cloud-outline" size={32} color={COLORS.primary} />
                                <Text style={styles.settingTitleCentered}>Google Drive Backup</Text>
                                <Text style={styles.settingDescCentered}>Automatically back up your tasks to Google Drive</Text>
                                <TouchableOpacity style={styles.signInBtn} onPress={handleGoogleSignIn}>
                                    <Ionicons name="logo-google" size={18} color={COLORS.white} />
                                    <Text style={styles.signInText}>Sign in with Google</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <>
                                <View style={styles.cloudUserRow}>
                                    <Ionicons name="person-circle-outline" size={24} color={COLORS.primary} />
                                    <Text style={styles.cloudUserEmail} numberOfLines={1}>{userEmail}</Text>
                                    <TouchableOpacity onPress={handleGoogleSignOut}>
                                        <Text style={styles.signOutText}>Sign Out</Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.dataDivider} />
                                <View style={styles.dataRowSpaceBetween}>
                                    <View style={styles.syncRow}>
                                        <Ionicons name="sync-outline" size={20} color={COLORS.primary} />
                                        <Text style={styles.autoBackupTitle}>Auto-backup</Text>
                                    </View>
                                    <Switch
                                        value={autoBackupEnabled}
                                        onValueChange={setAutoBackup}
                                        trackColor={SWITCH_TRACK_COLOR}
                                        thumbColor={COLORS.white}
                                    />
                                </View>
                                <View style={styles.dataDivider} />
                                <View style={styles.dataRowSpaceBetween}>
                                    <Text style={styles.settingDesc}>Last backup</Text>
                                    <Text style={styles.lastBackupValue}>{formatRelativeTime(lastBackupTime)}</Text>
                                </View>
                                <View style={styles.dataDivider} />
                                <TouchableOpacity style={styles.dataRow} onPress={handleCloudBackup} disabled={backupStatus === 'backing-up'}>
                                    {backupStatus === 'backing-up' ? (
                                        <ActivityIndicator size="small" color={COLORS.primary} />
                                    ) : (
                                        <Ionicons name="cloud-upload-outline" size={20} color={COLORS.primary} />
                                    )}
                                    <View style={styles.ml12flex}>
                                        <Text style={styles.settingTitle}>Back Up Now</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={18} color={COLORS.text.disabled} />
                                </TouchableOpacity>
                                <View style={styles.dataDivider} />
                                <TouchableOpacity style={styles.dataRow} onPress={handleOpenRestorePicker} disabled={backupStatus === 'restoring'}>
                                    {backupStatus === 'restoring' ? (
                                        <ActivityIndicator size="small" color={COLORS.primary} />
                                    ) : (
                                        <Ionicons name="cloud-download-outline" size={20} color={COLORS.primary} />
                                    )}
                                    <View style={styles.ml12flex}>
                                        <Text style={styles.settingTitle}>Restore from Backup</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={18} color={COLORS.text.disabled} />
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </CollapsibleSection>

                <CollapsibleSection title="Troubleshooting">
                    <View style={styles.settingRow}>
                        <View style={styles.settingLabel}>
                            <Ionicons name="bug" size={20} color={COLORS.primary} />
                            <View style={styles.ml12}>
                                <Text style={styles.settingTitle}>Debug Mode</Text>
                                <Text style={styles.settingDesc}>Show new task list design (preview)</Text>
                            </View>
                        </View>
                        <Switch
                            value={debugModeEnabled}
                            onValueChange={setDebugModeEnabled}
                            trackColor={SWITCH_TRACK_COLOR}
                            thumbColor={COLORS.white}
                        />
                    </View>
                </CollapsibleSection>

                <CollapsibleSection title="About">
                    <View style={styles.infoBox}>
                        <Text style={styles.infoText}>DragonFlow v1.0</Text>
                        <Text style={styles.infoSubtext}>Personal task management</Text>
                        <Text style={styles.infoSubtext}>Build: {BUILD_TIMESTAMP}</Text>
                    </View>
                </CollapsibleSection>
            </ScrollView>

            <AddCategoryModal visible={addCatVisible} onClose={() => setAddCatVisible(false)} />
            <EditCategoryModal visible={!!editingCategory} category={editingCategory} onClose={() => setEditingCategory(null)} />

            <SoundSelectorDropdown
                visible={tasksDropdownOpen}
                options={SOUND_TYPE_OPTIONS}
                selectedValue={tasksSoundType}
                onSelect={setTasksSoundType}
                onClose={() => setTasksDropdownOpen(false)}
            />
            <SoundSelectorDropdown
                visible={pomodoroDropdownOpen}
                options={SOUND_TYPE_OPTIONS}
                selectedValue={pomodoroSoundType}
                onSelect={setPomodoroSoundType}
                onClose={() => setPomodoroDropdownOpen(false)}
            />

            <VolumeControl
                visible={tasksVolumeVisible}
                volume={tasksVolume}
                onVolumeChange={setTasksVolume}
                onClose={() => setTasksVolumeVisible(false)}
                onPlayPreview={(vol) => playPreviewSound('ding', tasksSoundType, vol).catch(console.error)}
            />
            <VolumeControl
                visible={pomodoroVolumeVisible}
                volume={pomodoroVolume}
                onVolumeChange={setPomodoroVolume}
                onClose={() => setPomodoroVolumeVisible(false)}
                onPlayPreview={(vol) => playPreviewSound('bell', pomodoroSoundType, vol).catch(console.error)}
            />

            {/* Restore Picker Modal */}
            <Modal visible={restorePickerVisible} animationType="slide" transparent>
                <View style={styles.restoreOverlay}>
                    <View style={styles.restoreContent}>
                        <Text style={styles.restoreTitle}>Restore from Backup</Text>
                        {loadingBackups ? (
                            <ActivityIndicator size="large" color={COLORS.primary} style={styles.restoreLoader} />
                        ) : availableBackups.length === 0 ? (
                            <Text style={styles.noBackupsText}>No backups found on Google Drive.</Text>
                        ) : (
                            <ScrollView style={styles.backupScrollView}>
                                {(['weekly', 'daily', 'ongoing'] as const).map((bucket) => {
                                    const inBucket = availableBackups
                                        .filter((b) => b.bucket === bucket)
                                        .sort(
                                            (a, b) =>
                                                new Date(b.modifiedTime).getTime() -
                                                new Date(a.modifiedTime).getTime(),
                                        );
                                    if (inBucket.length === 0) return null;
                                    const headerLabel = bucket === 'ongoing' ? 'Ongoing' : bucket === 'daily' ? 'Daily' : 'Weekly';
                                    return (
                                        <View key={bucket}>
                                            <Text style={styles.bucketHeader}>{headerLabel}</Text>
                                            {inBucket.map((backup) => {
                                                const isSelected = selectedBackupId === backup.fileId;
                                                const date = new Date(backup.modifiedTime).toLocaleString('en-US', {
                                                    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                                                });
                                                const taskLabel = backup.taskCount !== undefined ? ` — ${backup.taskCount} tasks` : '';
                                                return (
                                                    <TouchableOpacity
                                                        key={backup.fileId}
                                                        style={isSelected ? styles.restoreRowSelected : styles.restoreRow}
                                                        onPress={() => setSelectedBackupId(backup.fileId)}
                                                    >
                                                        <Ionicons
                                                            name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                                                            size={20}
                                                            color={isSelected ? COLORS.primary : COLORS.text.disabled}
                                                        />
                                                        <Text style={isSelected ? styles.restoreRowTextSelected : styles.restoreRowText}>
                                                            {date}{taskLabel}
                                                        </Text>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>
                                    );
                                })}
                            </ScrollView>
                        )}
                        <View style={styles.restoreBtnRow}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setRestorePickerVisible(false)}>
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            {availableBackups.length > 0 && (
                                <TouchableOpacity style={styles.restoreBtn} onPress={handleRestore}>
                                    <Text style={styles.restoreBtnText}>Restore</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.surfaceAlt.muted },
    header: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 16,
        height: HEADER_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerIcon: { width: 50, height: 50, borderRadius: 6, marginRight: 12 },
    headerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { color: COLORS.white, fontSize: 20, fontWeight: 'bold' },
    content: { padding: 20, paddingBottom: 40 },
    settingRow: {
        backgroundColor: COLORS.white,
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: COLORS.shadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    settingLabel: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    settingTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text.primary, marginBottom: 2 },
    settingTitleCentered: { fontSize: 16, fontWeight: '600', color: COLORS.text.primary, marginTop: 8, textAlign: 'center' },
    settingDesc: { fontSize: 12, color: COLORS.text.placeholder },
    settingDescCentered: { fontSize: 12, color: COLORS.text.placeholder, textAlign: 'center', marginBottom: 12 },
    settingBlock: {
        backgroundColor: COLORS.white,
        borderRadius: 12,
        padding: 16,
        shadowColor: COLORS.shadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    settingBlockGap: {
        marginTop: 12,
    },
    timeInputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 10 },
    timeInput: {
        borderWidth: 1,
        borderColor: COLORS.border.light,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.primary,
        width: 80,
        textAlign: 'center',
    },
    timeFormat: { fontSize: 12, color: COLORS.text.placeholder },
    catRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border.subtle,
    },
    catDot: { width: 14, height: 14, borderRadius: 7, marginRight: 12 },
    catName: { flex: 1, fontSize: 15, color: COLORS.text.secondary, fontWeight: '500' },
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
    dataRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
    },
    dataRowSpaceBetween: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        justifyContent: 'space-between',
    },
    dataDivider: { height: 1, backgroundColor: COLORS.border.subtle },
    infoBox: {
        backgroundColor: COLORS.white,
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        shadowColor: COLORS.shadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    infoText: { fontSize: 16, fontWeight: '600', color: COLORS.text.primary },
    infoSubtext: { fontSize: 12, color: COLORS.text.placeholder, marginTop: 4 },
    signInBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: COLORS.primary,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 10,
    },
    signInText: { color: COLORS.white, fontWeight: 'bold', fontSize: 15 },
    cloudSignInWrapper: { alignItems: 'center', paddingVertical: 8 },
    cloudUserRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
    cloudUserEmail: { fontSize: 12, color: COLORS.text.placeholder, flex: 1, marginLeft: 8 },
    signOutText: { fontSize: 13, color: COLORS.text.error, fontWeight: '600' },
    syncRow: { flexDirection: 'row', alignItems: 'center' },
    autoBackupTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text.primary, marginLeft: 12 },
    lastBackupValue: { fontSize: 12, color: COLORS.text.muted, fontWeight: '600' },
    restoreOverlay: {
        flex: 1,
        backgroundColor: COLORS.overlay.scrimStrong,
        justifyContent: 'flex-end',
    },
    restoreContent: {
        backgroundColor: COLORS.white,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        paddingBottom: 40,
    },
    restoreTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text.primary, textAlign: 'center' },
    restoreLoader: { marginVertical: 30 },
    noBackupsText: { fontSize: 12, color: COLORS.text.placeholder, textAlign: 'center', marginVertical: 30 },
    backupScrollView: { maxHeight: 360, marginVertical: 12 },
    bucketHeader: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.text.weak,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginTop: 8,
        marginBottom: 4,
        paddingHorizontal: 4,
    },
    restoreRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 14,
        paddingHorizontal: 8,
        borderRadius: 10,
    },
    restoreRowSelected: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 14,
        paddingHorizontal: 8,
        borderRadius: 10,
        backgroundColor: COLORS.overlay.accentSoft,
    },
    restoreRowText: { fontSize: 15, color: COLORS.text.body, fontWeight: '500' },
    restoreRowTextSelected: { fontSize: 15, color: COLORS.primary, fontWeight: '500' },
    restoreBtnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 15, marginTop: 8 },
    cancelBtn: { padding: 12 },
    cancelBtnText: { color: COLORS.text.placeholder, fontWeight: 'bold', fontSize: 15 },
    restoreBtn: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 10,
    },
    restoreBtnText: { color: COLORS.white, fontWeight: 'bold', fontSize: 15 },
    weekDayRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
    weekDayBtn: {
        flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center',
        borderWidth: 1, borderColor: COLORS.border.muted, backgroundColor: COLORS.surfaceAlt.light,
    },
    weekDayBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    weekDayText: { fontSize: 14, fontWeight: '600', color: COLORS.text.subtle },
    weekDayTextActive: { color: COLORS.white },
    ml12: { marginLeft: 12 },
    ml12flex: { marginLeft: 12, flex: 1 },
    mr8: { marginRight: 8 },
    soundSelectorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        gap: 12,
    },
    soundDropdownButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: COLORS.border.muted,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: COLORS.surfaceAlt.light,
    },
    soundDropdownButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.primary,
    },
    volumeButton: {
        width: 40,
        height: 40,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.primary,
    },
    playButton: {
        backgroundColor: COLORS.primary,
        width: 40,
        height: 40,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    playButtonDisabled: {
        backgroundColor: COLORS.border.muted,
    },
});
