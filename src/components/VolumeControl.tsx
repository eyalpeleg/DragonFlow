import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View, PanResponder } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../styles/theme';

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
                            <Ionicons name="volume-high" size={24} color={COLORS.primary} />
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
                            <Ionicons name="volume-mute" size={24} color={COLORS.primary} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.volumeInfoRow}>
                        <Text style={styles.volumeText}>
                            Volume: {Math.round(tempVolume * 100)}%
                        </Text>
                        {onPlayPreview && (
                            <TouchableOpacity style={styles.playButton} onPress={() => onPlayPreview(tempVolume)}>
                                <Ionicons name="musical-notes" size={20} color={COLORS.white} />
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

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: COLORS.overlay.scrimSoft,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: COLORS.white,
        borderRadius: 16,
        padding: 24,
        width: '85%',
        maxWidth: 400,
        elevation: 8,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.text.primary,
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
        backgroundColor: COLORS.border.muted,
        borderRadius: 4,
        overflow: 'hidden',
        justifyContent: 'flex-end',
    },
    sliderFill: {
        width: '100%',
        backgroundColor: COLORS.primary,
    },
    sliderThumb: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: COLORS.primary,
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
        color: COLORS.text.subtle,
        fontWeight: '600',
    },
    playButton: {
        backgroundColor: COLORS.primary,
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
        color: COLORS.text.weak,
        fontWeight: '600',
        fontSize: 14,
    },
    applyBtn: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
    },
    applyBtnText: {
        color: COLORS.white,
        fontWeight: '600',
        fontSize: 14,
    },
});
