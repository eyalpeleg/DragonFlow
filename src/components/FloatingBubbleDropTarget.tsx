import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
    isVisible: boolean;
}

export default function FloatingBubbleDropTarget({ isVisible }: Props) {
    if (!isVisible) return null;

    return (
        <View style={styles.container} pointerEvents="none">
            <View style={styles.target}>
                <Ionicons name="close" size={32} color="white" />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        top: 0,
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: 80,
    },
    target: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#E53935',
        justifyContent: 'center',
        alignItems: 'center',
    },
});
