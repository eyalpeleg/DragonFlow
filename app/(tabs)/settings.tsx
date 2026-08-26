import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, AppState, FlatList, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { AppColors } from '@/src/styles/theme';
import { useColors } from '@/src/styles/useColors';
import { DEFAULT_CATEGORY_ID, useTaskStore } from '@/src/store/appStore';
import ParkingWatcher from '@/src/modules/ParkingWatcher';
import AddCategoryModal from '@/src/components/AddCategoryModal';
import EditCategoryModal from '@/src/components/EditCategoryModal';
import ParkingDisclosureModal from '@/src/components/ParkingDisclosureModal';
import SoundSelectorDropdown from '@/src/components/SoundSelectorDropdown';
import VolumeControl from '@/src/components/VolumeControl';
import { Category, SoundType } from '@/src/types';
import { exportToFile, importFromFile } from '@/src/utils/dataTransfer';
import { playPreviewSound } from '@/src/utils/notifications';
import { useBackupStore, googleAuth, performBackup, listAvailableBackups, performRestore, BackupMetadata } from '@/src/services/cloudBackup';

const HEADER_HEIGHT = 56;
const appIcon = require('@/assets/images/dragonflow3.png');
const APP_VERSION = Constants.expoConfig?.version ?? '?';
const ANDROID_VERSION_CODE = Constants.expoConfig?.android?.versionCode ?? '?';
const BUILD_TIMESTAMP = new Date(Constants.expoConfig?.extra?.buildTimestamp).toLocaleString();
const SOUND_TYPE_OPTIONS: SoundType[] = ['AppSound', 'Disabled'];
const pressedOpacity = { opacity: 0.7 } as const;

const BUCKET_LABEL: Record<'weekly' | 'daily' | 'ongoing', string> = {
    weekly: 'Weekly',
    daily: 'Daily',
    ongoing: 'Ongoing',
};

interface BackupSection {
    bucket: 'weekly' | 'daily' | 'ongoing';
    inBucket: BackupMetadata[];
}

interface BackupRowProps {
    backup: BackupMetadata;
    isSelected: boolean;
    onSelect: (fileId: string) => void;
    styles: ReturnType<typeof makeStyles>;
    accentColor: string;
    disabledColor: string;
}

function BackupRow({ backup, isSelected, onSelect, styles, accentColor, disabledColor }: BackupRowProps) {
    const date = new Date(backup.modifiedTime).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
    const taskLabel = backup.taskCount !== undefined ? ` — ${backup.taskCount} tasks` : '';
    return (
        <Pressable
            style={({ pressed }) => [isSelected ? styles.restoreRowSelected : styles.restoreRow, pressed && pressedOpacity]}
            onPress={() => onSelect(backup.fileId)}
        >
            <Ionicons
                name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color={isSelected ? accentColor : disabledColor}
            />
            <Text style={isSelected ? styles.restoreRowTextSelected : styles.restoreRowText}>
                {date}{taskLabel}
            </Text>
        </Pressable>
    );
}

interface BackupSectionRowProps {
    section: BackupSection;
    selectedBackupId: string | null;
    onSelect: (fileId: string) => void;
    styles: ReturnType<typeof makeStyles>;
    accentColor: string;
    disabledColor: string;
}

function BackupSectionRow({ section, selectedBackupId, onSelect, styles, accentColor, disabledColor }: BackupSectionRowProps) {
    return (
        <View>
            <Text style={styles.bucketHeader}>{BUCKET_LABEL[section.bucket]}</Text>
            {section.inBucket.map((backup) => (
                <BackupRow
                    key={backup.fileId}
                    backup={backup}
                    isSelected={selectedBackupId === backup.fileId}
                    onSelect={onSelect}
                    styles={styles}
                    accentColor={accentColor}
                    disabledColor={disabledColor}
                />
            ))}
        </View>
    );
}

const backupSectionKeyExtractor = (section: BackupSection) => section.bucket;

function CollapsibleSection({ title, children }: { title: string; children: React.ReactNode }) {
    const colors = useColors();
    const sectionStyles = makeSectionStyles(colors);
    const [expanded, setExpanded] = useState(true);
    return (
        <View style={sectionStyles.wrapper}>
            <Pressable
                style={({ pressed }) => [sectionStyles.header, pressed && { opacity: 0.7 }]}
                onPress={() => setExpanded((v) => !v)}
            >
                <Text style={sectionStyles.title}>{title}</Text>
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.text.placeholder} />
            </Pressable>
            {expanded && children}
        </View>
    );
}

const makeSectionStyles = (c: AppColors) => StyleSheet.create({
    wrapper: { marginBottom: 24 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    title: { fontSize: 14, fontWeight: '700', color: c.text.subtle, textTransform: 'uppercase' },
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

type LoadBackupsResult =
    | { ok: true; backups: BackupMetadata[] }
    | { ok: false; error: string };

async function loadBackupsSafe(): Promise<LoadBackupsResult> {
    try {
        const backups = await listAvailableBackups();
        return { ok: true, backups };
    } catch (e: any) {
        return { ok: false, error: e?.message ?? 'Could not load backups.' };
    }
}

async function handleCloudBackup() {
    try {
        await performBackup();
        Alert.alert('Backup Complete', 'Your data has been backed up to Google Drive.');
    } catch (e: any) {
        Alert.alert('Backup Failed', e.message ?? 'Something went wrong.');
    }
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

export default function SettingsScreen() {
    const colors = useColors();
    const styles = makeStyles(colors);
    const switchTrackColor = { false: colors.text.disabled, true: colors.secondary };
    const { showBubbleInBackground, defaultTaskTime, firstDayOfWeek, pomodoroSoundType, tasksSoundType, pomodoroVolume, tasksVolume, categories, debugModeEnabled, darkMode, reflectOnDone, parkingReminderEnabled, deleteCategory, setShowBubbleInBackground, setDefaultTaskTime, setFirstDayOfWeek, setPomodoroSoundType, setTasksSoundType, setPomodoroVolume, setTasksVolume, setDebugModeEnabled, setDarkMode, setReflectOnDone, setParkingReminderEnabled } = useTaskStore();
    const [tempTime, setTempTime] = useState(defaultTaskTime);
    const [addCatVisible, setAddCatVisible] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [tasksDropdownOpen, setTasksDropdownOpen] = useState(false);
    const [pomodoroDropdownOpen, setPomodoroDropdownOpen] = useState(false);
    const [tasksVolumeVisible, setTasksVolumeVisible] = useState(false);
    const [pomodoroVolumeVisible, setPomodoroVolumeVisible] = useState(false);

    // Parking reminder: track the (revocable) Usage-access grant and the disclosure gate.
    const [parkingUsageGranted, setParkingUsageGranted] = useState(true);
    const [parkingDisclosureVisible, setParkingDisclosureVisible] = useState(false);
    const refreshUsageAccess = useCallback(() => {
        ParkingWatcher.hasUsageAccess().then(setParkingUsageGranted).catch(() => {});
    }, []);
    // Re-check on focus + when returning from the system settings screen (AC15).
    useFocusEffect(useCallback(() => {
        refreshUsageAccess();
        const sub = AppState.addEventListener('change', (s) => { if (s === 'active') refreshUsageAccess(); });
        return () => sub.remove();
    }, [refreshUsageAccess]));

    function handleToggleParking(next: boolean) {
        console.log(`[ParkingWatcher] USER: toggled parking reminder ${next ? 'ON' : 'OFF'} (settings)`);
        if (next) {
            setParkingDisclosureVisible(true); // AC13 — disclosure before enabling
        } else {
            setParkingReminderEnabled(false);
        }
    }
    function confirmParkingDisclosure() {
        console.log('[ParkingWatcher] USER: confirmed disclosure → enabling parking reminder (settings)');
        setParkingDisclosureVisible(false);
        setParkingReminderEnabled(true);
        ParkingWatcher.hasUsageAccess().then((granted) => {
            setParkingUsageGranted(granted);
            if (!granted) ParkingWatcher.requestUsageAccess(); // AC14 — deep-link to grant
        }).catch(() => {});
    }

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

    async function handleOpenRestorePicker() {
        setLoadingBackups(true);
        setRestorePickerVisible(true);
        const result = await loadBackupsSafe();
        setLoadingBackups(false);
        if (result.ok) {
            setAvailableBackups(result.backups);
            if (result.backups.length > 0) setSelectedBackupId(result.backups[0].fileId);
        } else {
            Alert.alert('Error', result.error);
            setRestorePickerVisible(false);
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
                            const result = await performRestore(selectedBackupId);
                            Alert.alert('Restore Complete', `${result.tasksImported} task(s) restored.`);
                        } catch (e: any) {
                            Alert.alert('Restore Failed', e.message ?? 'Something went wrong.');
                        }
                    },
                },
            ],
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

    const backupSections: BackupSection[] = [];
    for (const bucket of ['weekly', 'daily', 'ongoing'] as const) {
        const inBucket: BackupMetadata[] = [];
        for (const b of availableBackups) {
            if (b.bucket === bucket) inBucket.push(b);
        }
        inBucket.sort(
            (a, b) => new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime(),
        );
        if (inBucket.length > 0) backupSections.push({ bucket, inBucket });
    }

    const renderBackupSection = ({ item: section }: { item: BackupSection }) => (
        <BackupSectionRow
            section={section}
            selectedBackupId={selectedBackupId}
            onSelect={setSelectedBackupId}
            styles={styles}
            accentColor={colors.secondary}
            disabledColor={colors.text.disabled}
        />
    );

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
                        <Ionicons name="moon" size={20} color={colors.secondary} />
                        <View style={styles.ml12}>
                            <Text style={styles.settingTitle}>Dark Mode</Text>
                            <Text style={styles.settingDesc}>Use a dark color theme across the app</Text>
                        </View>
                    </View>
                    <Switch
                        value={darkMode}
                        onValueChange={setDarkMode}
                        trackColor={switchTrackColor}
                        thumbColor={colors.white}
                    />
                </View>

                <CollapsibleSection title="Floating Bubble">
                    <View style={styles.settingRow}>
                        <View style={styles.settingLabel}>
                            <Ionicons name="alert-circle" size={20} color={colors.secondary} />
                            <View style={styles.ml12}>
                                <Text style={styles.settingTitle}>Show Bubble</Text>
                                <Text style={styles.settingDesc}>Display urgent task badge when app is in the background</Text>
                            </View>
                        </View>
                        <Switch
                            value={showBubbleInBackground}
                            onValueChange={setShowBubbleInBackground}
                            trackColor={switchTrackColor}
                            thumbColor={colors.white}
                        />
                    </View>
                </CollapsibleSection>

                <CollapsibleSection title="Parking Reminder">
                    <View style={styles.settingRow}>
                        <View style={styles.settingLabel}>
                            <Ionicons name="car-outline" size={20} color={colors.secondary} />
                            <View style={styles.ml12}>
                                <Text style={styles.settingTitle}>Parking reminder</Text>
                                <Text style={styles.settingDesc}>When you use your parking app, offer to remind you to stop the parking session</Text>
                            </View>
                        </View>
                        <Switch
                            value={parkingReminderEnabled}
                            onValueChange={handleToggleParking}
                            trackColor={switchTrackColor}
                            thumbColor={colors.white}
                        />
                    </View>
                    {parkingReminderEnabled && !parkingUsageGranted && (
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Grant usage access"
                            style={({ pressed }) => [styles.signInBtn, pressed && { opacity: 0.7 }]}
                            onPress={() => { console.log('[ParkingWatcher] USER: clicked Grant usage access (settings)'); ParkingWatcher.requestUsageAccess(); }}
                        >
                            <Ionicons name="warning-outline" size={18} color={colors.white} />
                            <Text style={styles.signInText}>Grant “Usage access” to enable detection</Text>
                        </Pressable>
                    )}
                </CollapsibleSection>

                <CollapsibleSection title="Audio">

                    {/* Tasks Sound Section */}
                    <View style={styles.settingBlock}>
                        <Text style={styles.settingTitle}>Task Reminders Sound</Text>
                        <Text style={styles.settingDesc}>Sound played for task notifications</Text>
                        <View style={styles.soundSelectorRow}>
                            <Pressable
                                style={({ pressed }) => [styles.soundDropdownButton, pressed && { opacity: 0.7 }]}
                                onPress={() => setTasksDropdownOpen(true)}
                            >
                                <Text style={styles.soundDropdownButtonText}>{tasksSoundType}</Text>
                                <Ionicons name="chevron-down" size={18} color={colors.secondary} />
                            </Pressable>
                            <Pressable
                                style={({ pressed }) => [styles.volumeButton, pressed && { opacity: 0.7 }]}
                                onPress={() => setTasksVolumeVisible(true)}
                            >
                                <Ionicons name="volume-high" size={20} color={colors.secondary} />
                            </Pressable>
                            <Pressable
                                style={({ pressed }) => [styles.playButton, tasksSoundType === 'Disabled' && styles.playButtonDisabled, pressed && { opacity: 0.7 }]}
                                onPress={() => playPreviewSound('ding', tasksSoundType, tasksVolume).catch(console.error)}
                                disabled={tasksSoundType === 'Disabled'}
                            >
                                <Ionicons name="musical-note" size={20} color={tasksSoundType === 'Disabled' ? colors.text.disabled : colors.white} />
                            </Pressable>
                        </View>
                    </View>

                    {/* Pomodoro Sound Section */}
                    <View style={styles.settingBlock}>
                        <Text style={styles.settingTitle}>Pomodoro Sound</Text>
                        <Text style={styles.settingDesc}>Sound played when timer completes</Text>
                        <View style={styles.soundSelectorRow}>
                            <Pressable
                                style={({ pressed }) => [styles.soundDropdownButton, pressed && { opacity: 0.7 }]}
                                onPress={() => setPomodoroDropdownOpen(true)}
                            >
                                <Text style={styles.soundDropdownButtonText}>{pomodoroSoundType}</Text>
                                <Ionicons name="chevron-down" size={18} color={colors.secondary} />
                            </Pressable>
                            <Pressable
                                style={({ pressed }) => [styles.volumeButton, pressed && { opacity: 0.7 }]}
                                onPress={() => setPomodoroVolumeVisible(true)}
                            >
                                <Ionicons name="volume-high" size={20} color={colors.secondary} />
                            </Pressable>
                            <Pressable
                                style={({ pressed }) => [styles.playButton, pomodoroSoundType === 'Disabled' && styles.playButtonDisabled, pressed && { opacity: 0.7 }]}
                                onPress={() => playPreviewSound('bell', pomodoroSoundType, pomodoroVolume).catch(console.error)}
                                disabled={pomodoroSoundType === 'Disabled'}
                            >
                                <Ionicons name="musical-note" size={20} color={pomodoroSoundType === 'Disabled' ? colors.text.disabled : colors.white} />
                            </Pressable>
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
                                placeholderTextColor={colors.text.placeholder}
                                maxLength={5}
                                keyboardType="numbers-and-punctuation"
                            />
                            <Text style={styles.timeFormat}>24-hour format</Text>
                        </View>
                    </View>
                    <View style={[styles.settingBlock, styles.settingBlockGap]}>
                        <View style={styles.reflectRow}>
                            <View style={styles.reflectLabel}>
                                <Text style={styles.settingTitle}>Prompt for reflection when marking Done</Text>
                                <Text style={styles.settingDesc}>Open the reflection note immediately after marking a task done.</Text>
                            </View>
                            <Switch
                                value={reflectOnDone}
                                onValueChange={setReflectOnDone}
                                trackColor={switchTrackColor}
                                thumbColor={colors.white}
                            />
                        </View>
                    </View>
                    <View style={[styles.settingBlock, styles.settingBlockGap]}>
                        <Text style={styles.settingTitle}>First Day of Week</Text>
                        <Text style={styles.settingDesc}>Sets the start of the week in the weekly report</Text>
                        <View style={styles.weekDayRow}>
                            {(['sunday', 'monday'] as const).map((day) => (
                                <Pressable
                                    key={day}
                                    style={({ pressed }) => [styles.weekDayBtn, firstDayOfWeek === day && styles.weekDayBtnActive, pressed && { opacity: 0.7 }]}
                                    onPress={() => setFirstDayOfWeek(day)}
                                >
                                    <Text style={[styles.weekDayText, firstDayOfWeek === day && styles.weekDayTextActive]}>
                                        {day.charAt(0).toUpperCase() + day.slice(1)}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    </View>
                    <View style={[styles.settingBlock, styles.settingBlockGap]}>
                        <Text style={styles.settingTitle}>Categories</Text>
                        <Text style={styles.settingDesc}>Tags for organizing tasks</Text>
                        {categories.map((cat) => {
                            const isDefault = cat.id === DEFAULT_CATEGORY_ID;
                            return (
                                <View key={cat.id} style={styles.catRow}>
                                    <View style={[styles.catDot, { backgroundColor: cat.color }]} />
                                    <Text style={styles.catName}>{cat.name}</Text>
                                    {isDefault && (
                                        <Ionicons name="lock-closed" size={14} color={colors.text.veryLight} style={styles.mr8} />
                                    )}
                                    {!isDefault && (
                                        <View style={styles.catActions}>
                                            <Pressable
                                                onPress={() => setEditingCategory(cat)}
                                                style={({ pressed }) => [styles.catActionBtn, pressed && { opacity: 0.7 }]}
                                            >
                                                <Ionicons name="pencil" size={16} color={colors.secondary} />
                                            </Pressable>
                                            <Pressable
                                                onPress={() => handleDeleteCategory(cat)}
                                                style={({ pressed }) => [styles.catActionBtn, pressed && { opacity: 0.7 }]}
                                            >
                                                <Ionicons name="trash" size={16} color={colors.text.error} />
                                            </Pressable>
                                        </View>
                                    )}
                                </View>
                            );
                        })}
                        <Pressable
                            style={({ pressed }) => [styles.addCatBtn, pressed && { opacity: 0.7 }]}
                            onPress={() => setAddCatVisible(true)}
                        >
                            <Ionicons name="add-circle-outline" size={20} color={colors.secondary} />
                            <Text style={styles.addCatText}>Add Category</Text>
                        </Pressable>
                    </View>
                </CollapsibleSection>

                <CollapsibleSection title="Data">
                    <View style={styles.settingBlock}>
                        <Pressable
                            style={({ pressed }) => [styles.dataRow, pressed && { opacity: 0.7 }]}
                            onPress={handleExport}
                        >
                            <Ionicons name="download-outline" size={20} color={colors.secondary} />
                            <View style={styles.ml12flex}>
                                <Text style={styles.settingTitle}>Export Data</Text>
                                <Text style={styles.settingDesc}>Save tasks & categories to a JSON backup file</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={colors.text.disabled} />
                        </Pressable>
                        <View style={styles.dataDivider} />
                        <Pressable
                            style={({ pressed }) => [styles.dataRow, pressed && { opacity: 0.7 }]}
                            onPress={handleImport}
                        >
                            <Ionicons name="push-outline" size={20} color={colors.secondary} />
                            <View style={styles.ml12flex}>
                                <Text style={styles.settingTitle}>Import Data</Text>
                                <Text style={styles.settingDesc}>Restore from a backup file (replaces current data)</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={colors.text.disabled} />
                        </Pressable>
                    </View>
                    <View style={[styles.settingBlock, styles.settingBlockGap]}>
                        {!isSignedIn ? (
                            <View style={styles.cloudSignInWrapper}>
                                <Ionicons name="cloud-outline" size={32} color={colors.secondary} />
                                <Text style={styles.settingTitleCentered}>Google Drive Backup</Text>
                                <Text style={styles.settingDescCentered}>Automatically back up your tasks to Google Drive</Text>
                                <Pressable
                                    style={({ pressed }) => [styles.signInBtn, pressed && { opacity: 0.7 }]}
                                    onPress={handleGoogleSignIn}
                                >
                                    <Ionicons name="logo-google" size={18} color={colors.white} />
                                    <Text style={styles.signInText}>Sign in with Google</Text>
                                </Pressable>
                            </View>
                        ) : (
                            <>
                                <View style={styles.cloudUserRow}>
                                    <Ionicons name="person-circle-outline" size={24} color={colors.secondary} />
                                    <Text style={styles.cloudUserEmail} numberOfLines={1}>{userEmail}</Text>
                                    <Pressable
                                        onPress={handleGoogleSignOut}
                                        style={({ pressed }) => pressed && { opacity: 0.7 }}
                                    >
                                        <Text style={styles.signOutText}>Sign Out</Text>
                                    </Pressable>
                                </View>
                                <View style={styles.dataDivider} />
                                <View style={styles.dataRowSpaceBetween}>
                                    <View style={styles.syncRow}>
                                        <Ionicons name="sync-outline" size={20} color={colors.secondary} />
                                        <Text style={styles.autoBackupTitle}>Auto-backup</Text>
                                    </View>
                                    <Switch
                                        value={autoBackupEnabled}
                                        onValueChange={setAutoBackup}
                                        trackColor={switchTrackColor}
                                        thumbColor={colors.white}
                                    />
                                </View>
                                <View style={styles.dataDivider} />
                                <View style={styles.dataRowSpaceBetween}>
                                    <Text style={styles.settingDesc}>Last backup</Text>
                                    <Text style={styles.lastBackupValue}>{formatRelativeTime(lastBackupTime)}</Text>
                                </View>
                                <View style={styles.dataDivider} />
                                <Pressable
                                    style={({ pressed }) => [styles.dataRow, pressed && { opacity: 0.7 }]}
                                    onPress={handleCloudBackup}
                                    disabled={backupStatus === 'backing-up'}
                                >
                                    {backupStatus === 'backing-up' ? (
                                        <ActivityIndicator size="small" color={colors.secondary} />
                                    ) : (
                                        <Ionicons name="cloud-upload-outline" size={20} color={colors.secondary} />
                                    )}
                                    <View style={styles.ml12flex}>
                                        <Text style={styles.settingTitle}>Back Up Now</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={18} color={colors.text.disabled} />
                                </Pressable>
                                <View style={styles.dataDivider} />
                                <Pressable
                                    style={({ pressed }) => [styles.dataRow, pressed && { opacity: 0.7 }]}
                                    onPress={handleOpenRestorePicker}
                                    disabled={backupStatus === 'restoring'}
                                >
                                    {backupStatus === 'restoring' ? (
                                        <ActivityIndicator size="small" color={colors.secondary} />
                                    ) : (
                                        <Ionicons name="cloud-download-outline" size={20} color={colors.secondary} />
                                    )}
                                    <View style={styles.ml12flex}>
                                        <Text style={styles.settingTitle}>Restore from Backup</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={18} color={colors.text.disabled} />
                                </Pressable>
                            </>
                        )}
                    </View>
                </CollapsibleSection>

                <CollapsibleSection title="Troubleshooting">
                    <View style={styles.settingRow}>
                        <View style={styles.settingLabel}>
                            <Ionicons name="bug" size={20} color={colors.secondary} />
                            <View style={styles.ml12}>
                                <Text style={styles.settingTitle}>Debug Mode</Text>
                                <Text style={styles.settingDesc}>Show new task list design (preview)</Text>
                            </View>
                        </View>
                        <Switch
                            value={debugModeEnabled}
                            onValueChange={setDebugModeEnabled}
                            trackColor={switchTrackColor}
                            thumbColor={colors.white}
                        />
                    </View>
                </CollapsibleSection>

                <CollapsibleSection title="About">
                    <View style={styles.infoBox}>
                        <Text style={styles.infoText}>DragonFlow v{APP_VERSION} ({ANDROID_VERSION_CODE})</Text>
                        <Text style={styles.infoSubtext}>Personal task management</Text>
                        <Text style={styles.infoSubtext}>Build: {BUILD_TIMESTAMP}</Text>
                    </View>
                </CollapsibleSection>
            </ScrollView>

            <AddCategoryModal visible={addCatVisible} onClose={() => setAddCatVisible(false)} />
            <EditCategoryModal key={editingCategory?.id ?? 'none'} visible={!!editingCategory} category={editingCategory} onClose={() => setEditingCategory(null)} />

            <ParkingDisclosureModal
                visible={parkingDisclosureVisible}
                onCancel={() => setParkingDisclosureVisible(false)}
                onContinue={confirmParkingDisclosure}
            />

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
                            <ActivityIndicator size="large" color={colors.secondary} style={styles.restoreLoader} />
                        ) : availableBackups.length === 0 ? (
                            <Text style={styles.noBackupsText}>No backups found on Google Drive.</Text>
                        ) : (
                            <FlatList
                                style={styles.backupScrollView}
                                data={backupSections}
                                keyExtractor={backupSectionKeyExtractor}
                                renderItem={renderBackupSection}
                            />
                        )}
                        <View style={styles.restoreBtnRow}>
                            <Pressable
                                style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}
                                onPress={() => setRestorePickerVisible(false)}
                            >
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </Pressable>
                            {availableBackups.length > 0 && (
                                <Pressable
                                    style={({ pressed }) => [styles.restoreBtn, pressed && { opacity: 0.7 }]}
                                    onPress={handleRestore}
                                >
                                    <Text style={styles.restoreBtnText}>Restore</Text>
                                </Pressable>
                            )}
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: {
        backgroundColor: c.primary,
        paddingHorizontal: 16,
        height: HEADER_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerIcon: { width: 50, height: 50, borderRadius: 6, marginRight: 12 },
    headerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { color: c.white, fontSize: 20, fontWeight: 'bold' },
    content: { padding: 20, paddingBottom: 40 },
    settingRow: {
        backgroundColor: c.surface,
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0px 1px 2px rgba(0,0,0,0.05)',
    },
    settingLabel: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    settingTitle: { fontSize: 16, fontWeight: '600', color: c.text.primary, marginBottom: 2 },
    settingTitleCentered: { fontSize: 16, fontWeight: '600', color: c.text.primary, marginTop: 8, textAlign: 'center' },
    settingDesc: { fontSize: 12, color: c.text.placeholder },
    settingDescCentered: { fontSize: 12, color: c.text.placeholder, textAlign: 'center', marginBottom: 12 },
    settingBlock: {
        backgroundColor: c.surface,
        borderRadius: 12,
        padding: 16,
        boxShadow: '0px 1px 2px rgba(0,0,0,0.05)',
    },
    settingBlockGap: {
        marginTop: 12,
    },
    timeInputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 10 },
    timeInput: {
        borderWidth: 1,
        borderColor: c.border.light,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 16,
        fontWeight: '600',
        color: c.secondary,
        width: 80,
        textAlign: 'center',
    },
    timeFormat: { fontSize: 12, color: c.text.placeholder },
    catRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: c.border.subtle,
    },
    catDot: { width: 14, height: 14, borderRadius: 7, marginRight: 12 },
    catName: { flex: 1, fontSize: 15, color: c.text.secondary, fontWeight: '500' },
    catActions: { flexDirection: 'row', gap: 12 },
    catActionBtn: { padding: 4 },
    addCatBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 12,
        marginTop: 4,
    },
    addCatText: { fontSize: 14, fontWeight: '600', color: c.secondary },
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
    dataDivider: { height: 1, backgroundColor: c.border.subtle },
    infoBox: {
        backgroundColor: c.surface,
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        boxShadow: '0px 1px 2px rgba(0,0,0,0.05)',
    },
    infoText: { fontSize: 16, fontWeight: '600', color: c.text.primary },
    infoSubtext: { fontSize: 12, color: c.text.placeholder, marginTop: 4 },
    signInBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: c.secondary,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 10,
    },
    signInText: { color: c.white, fontWeight: 'bold', fontSize: 15 },
    cloudSignInWrapper: { alignItems: 'center', paddingVertical: 8 },
    cloudUserRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
    cloudUserEmail: { fontSize: 12, color: c.text.placeholder, flex: 1, marginLeft: 8 },
    signOutText: { fontSize: 13, color: c.text.error, fontWeight: '600' },
    syncRow: { flexDirection: 'row', alignItems: 'center' },
    autoBackupTitle: { fontSize: 16, fontWeight: '600', color: c.text.primary, marginLeft: 12 },
    lastBackupValue: { fontSize: 12, color: c.text.muted, fontWeight: '600' },
    restoreOverlay: {
        flex: 1,
        backgroundColor: c.overlay.scrimStrong,
        justifyContent: 'flex-end',
    },
    restoreContent: {
        backgroundColor: c.surfaceElevated,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        paddingBottom: 40,
    },
    restoreTitle: { fontSize: 18, fontWeight: 'bold', color: c.text.primary, textAlign: 'center' },
    restoreLoader: { marginVertical: 30 },
    noBackupsText: { fontSize: 12, color: c.text.placeholder, textAlign: 'center', marginVertical: 30 },
    backupScrollView: { maxHeight: 360, marginVertical: 12 },
    bucketHeader: {
        fontSize: 12,
        fontWeight: '700',
        color: c.text.weak,
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
        backgroundColor: c.overlay.accentSoft,
    },
    restoreRowText: { fontSize: 15, color: c.text.body, fontWeight: '500' },
    restoreRowTextSelected: { fontSize: 15, color: c.secondary, fontWeight: '500' },
    restoreBtnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 15, marginTop: 8 },
    cancelBtn: { padding: 12 },
    cancelBtnText: { color: c.text.placeholder, fontWeight: 'bold', fontSize: 15 },
    restoreBtn: {
        backgroundColor: c.secondary,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 10,
    },
    restoreBtnText: { color: c.white, fontWeight: 'bold', fontSize: 15 },
    reflectRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    reflectLabel: { flex: 1, marginRight: 12 },
    weekDayRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
    weekDayBtn: {
        flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center',
        borderWidth: 1, borderColor: c.border.muted, backgroundColor: c.surfaceAlt.light,
    },
    weekDayBtnActive: { backgroundColor: c.secondary, borderColor: c.secondary },
    weekDayText: { fontSize: 14, fontWeight: '600', color: c.text.subtle },
    weekDayTextActive: { color: c.white },
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
        borderColor: c.border.muted,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: c.surfaceAlt.light,
    },
    soundDropdownButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: c.secondary,
    },
    volumeButton: {
        width: 40,
        height: 40,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: c.secondary,
    },
    playButton: {
        backgroundColor: c.secondary,
        width: 40,
        height: 40,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    playButtonDisabled: {
        backgroundColor: c.border.muted,
    },
});
