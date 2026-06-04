import React, { useState } from 'react';
import { Modal, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../styles/theme';
import { useColors } from '../styles/useColors';

const BUTTON_SIZE = 40;
const SLIDER_HEIGHT = 200;

interface Props {
    visible: boolean;
    volume: number;
    onVolumeChange: (volume: number) => void;
    onClose: () => void;
    onPlayPreview?: (volume: number) => void;
}

export default function VolumeControl({ visible, volume, onVolumeChange, onClose, onPlayPreview }: Props) {
    const colors = useColors();
    const styles = makeStyles(colors);
    const [tempVolume, setTempVolume] = useState(volume);

    const [panResponder] = useState(() => {
        let startY = 0;
        return PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: (event) => {
                startY = event.nativeEvent.locationY;
                const newVolume = Math.max(0, Math.min(1, 1 - startY / SLIDER_HEIGHT));
                setTempVolume(newVolume);
            },
            onPanResponderMove: (_, gestureState) => {
                const currentY = startY + gestureState.dy;
                const newVolume = Math.max(0, Math.min(1, 1 - currentY / SLIDER_HEIGHT));
                setTempVolume(newVolume);
            },
        });
    });

    const handleApply = () => {
        onVolumeChange(tempVolume);
        onClose();
    };

    const handleCancel = () => {
        setTempVolume(volume);
        onClose();
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
            <View style={styles.overlay}>
                <View style={styles.modalContent}>
                    <Text style={styles.title}>Volume Control</Text>

                    <View style={styles.sliderWrapper}>
                        <Pressable
                            onPress={() => setTempVolume(1)}
                            style={({ pressed }) => pressed && { opacity: 0.7 }}
                        >
                            <Ionicons name="volume-high" size={24} color={colors.primary} />
                        </Pressable>

                        <View style={styles.sliderContainer} {...panResponder.panHandlers}>
                            <View style={styles.sliderTrack}>
                                <View style={[styles.sliderFill, { height: `${tempVolume * 100}%` }]} />
                            </View>
                            {/* pointerEvents="none" prevents the thumb from hijacking
                                the touch locationY, which causes the jumping bug */}
                            <View
                                pointerEvents="none"
                                style={[styles.sliderThumb, { bottom: `${tempVolume * 100}%` }]}
                            />
                        </View>

                        <Pressable
                            onPress={() => setTempVolume(0)}
                            style={({ pressed }) => pressed && { opacity: 0.7 }}
                        >
                            <Ionicons name="volume-mute" size={24} color={colors.primary} />
                        </Pressable>
                    </View>

                    <View style={styles.volumeInfoRow}>
                        <Text style={styles.volumeText}>
                            Volume: {Math.round(tempVolume * 100)}%
                        </Text>
                        {onPlayPreview && (
                            <Pressable
                                style={({ pressed }) => [styles.playButton, pressed && { opacity: 0.7 }]}
                                onPress={() => onPlayPreview(tempVolume)}
                            >
                                <Ionicons name="musical-notes" size={20} color={colors.white} />
                            </Pressable>
                        )}
                    </View>

                    <View style={styles.buttonRow}>
                        <Pressable
                            style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}
                            onPress={handleCancel}
                        >
                            <Text style={styles.cancelBtnText}>Cancel</Text>
                        </Pressable>
                        <Pressable
                            style={({ pressed }) => [styles.applyBtn, pressed && { opacity: 0.7 }]}
                            onPress={handleApply}
                        >
                            <Text style={styles.applyBtnText}>Apply</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: c.overlay.scrimSoft,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: c.surfaceElevated,
        borderRadius: 16,
        padding: 24,
        width: '85%',
        maxWidth: 400,
        boxShadow: '0px 4px 8px rgba(0,0,0,0.15)',
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: c.text.primary,
        marginBottom: 20,
        textAlign: 'center',
    },
    sliderWrapper: {
        alignItems: 'center',
        gap: 12,
        marginBottom: 20,
    },
    sliderContainer: {
        width: '100%',
        height: SLIDER_HEIGHT,
        alignItems: 'center',
    },
    sliderTrack: {
        width: 8,
        height: '100%',
        backgroundColor: c.border.muted,
        borderRadius: 4,
        overflow: 'hidden',
        justifyContent: 'flex-end',
    },
    sliderFill: {
        width: '100%',
        backgroundColor: c.primary,
    },
    sliderThumb: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: c.primary,
        position: 'absolute',
        alignSelf: 'center',
        marginBottom: -10,
    },
    volumeInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    volumeText: {
        fontSize: 14,
        color: c.text.subtle,
        fontWeight: '600',
    },
    playButton: {
        backgroundColor: c.secondary,
        width: BUTTON_SIZE,
        height: BUTTON_SIZE,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
        justifyContent: 'flex-end',
    },
    cancelBtn: {
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    cancelBtnText: {
        color: c.text.weak,
        fontWeight: '600',
        fontSize: 14,
    },
    applyBtn: {
        backgroundColor: c.primary,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
    },
    applyBtnText: {
        color: c.white,
        fontWeight: '600',
        fontSize: 14,
    },
});
