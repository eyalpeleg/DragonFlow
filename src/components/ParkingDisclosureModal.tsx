import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppColors } from '../styles/theme';
import { useColors } from '../styles/useColors';

interface Props {
    visible: boolean;
    onCancel: () => void;
    onContinue: () => void;
}

// AC13 — prominent disclosure shown before enabling parking-app detection.
// Shared by Settings (manual toggle) and the root layout (first-launch, AC13a).
export default function ParkingDisclosureModal({ visible, onCancel, onContinue }: Props) {
    const colors = useColors();
    const styles = makeStyles(colors);

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
            <View style={styles.overlay}>
                <View style={styles.sheet}>
                    <Text style={styles.title}>Before you enable this</Text>
                    <Text style={styles.body}>
                        To notice when you’ve used your parking app, DragonFlow checks Android’s “Usage access”. It only detects
                        <Text style={styles.bold}> that it ran</Text> — never what you do in it, and never any other app’s contents.
                        {'\n\n'}This stays entirely on your device: nothing about your app usage is logged, sent, or included in cloud backup.
                    </Text>
                    <View style={styles.buttons}>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Cancel"
                            style={({ pressed }) => [styles.cancel, pressed && { opacity: 0.7 }]}
                            onPress={onCancel}
                        >
                            <Text style={styles.cancelText}>Cancel</Text>
                        </Pressable>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Continue and grant usage access"
                            style={({ pressed }) => [styles.continue, pressed && { opacity: 0.7 }]}
                            onPress={onContinue}
                        >
                            <Text style={styles.continueText}>Continue</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
    overlay: { flex: 1, backgroundColor: c.overlay.scrimDeep, justifyContent: 'center', alignItems: 'center' },
    sheet: { backgroundColor: c.surfaceElevated, borderRadius: 16, padding: 20, width: '85%' },
    title: { fontSize: 18, fontWeight: '700', color: c.text.primary, marginBottom: 12 },
    body: { fontSize: 14, color: c.text.muted, lineHeight: 20 },
    bold: { fontWeight: '700', color: c.text.primary },
    buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
    cancel: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
    cancelText: { color: c.text.weak, fontSize: 14 },
    continue: { minHeight: 44, justifyContent: 'center', backgroundColor: c.primary, paddingHorizontal: 20, borderRadius: 10 },
    continueText: { color: c.surface, fontWeight: '700', fontSize: 14 },
});
