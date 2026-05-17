import React, { useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View, PanResponder } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../styles/theme';
import { useColors } from '../styles/useColors';
import { useTaskStore } from '../store/appStore';

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
    const debugMode = useTaskStore((s) => s.debugModeEnabled);
    const styles = useMemo(() => makeStyles(colors, debugMode), [colors, debugMode]);
    const [tempVolume, setTempVolume] = useState(volume);
    const startYRef = React.useRef(0);

    const panResponder = React.useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: (event) => {
                startYRef.current = event.nativeEvent.locationY;
                const newVolume = Math.max(0, Math.min(1, 1 - startYRef.current / SLIDER_HEIGHT));
                setTempVolume(newVolume);
            },
            onPanResponderMove: (_, gestureState) => {
                const currentY = startYRef.current + gestureState.dy;
                const newVolume = Math.max(0, Math.min(1, 1 - currentY / SLIDER_HEIGHT));
                setTempVolume(newVolume);
            },
        })
    ).current;

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
                        <TouchableOpacity onPress={() => setTempVolume(1)}>
                            <Ionicons name="volume-high" size={24} color={colors.primary} />
                        </TouchableOpacity>

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

                        <TouchableOpacity onPress={() => setTempVolume(0)}>
                            <Ionicons name="volume-mute" size={24} color={colors.primary} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.volumeInfoRow}>
                        <Text style={styles.volumeText}>
                            Volume: {Math.round(tempVolume * 100)}%
                        </Text>
                        {onPlayPreview && (
                            <TouchableOpacity style={styles.playButton} onPress={() => onPlayPreview(tempVolume)}>
                                <Ionicons name="musical-notes" size={20} color={colors.white} />
                            </TouchableOpacity>
                        )}
                    </View>

                    <View style={styles.buttonRow}>
                        <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
                            <Text style={styles.cancelBtnText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.applyBtn} onPress={handleApply}>
                            <Text style={styles.applyBtnText}>Apply</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const makeStyles = (c: AppColors, debug: boolean) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: debug ? c.overlay.debug.volumeControl : c.overlay.scrimSoft,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: c.surface,
        borderRadius: 16,
        padding: 24,
        width: '85%',
        maxWidth: 400,
        elevation: 8,
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
