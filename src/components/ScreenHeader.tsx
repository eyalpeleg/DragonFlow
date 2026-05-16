import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '@/src/styles/theme';

const HEADER_HEIGHT = 56;
const appIcon = require('@/assets/images/dragonflow3.png');

interface ScreenHeaderProps {
    title: string;
    rightContent?: React.ReactNode;
}

export default function ScreenHeader({ title, rightContent }: ScreenHeaderProps) {
    return (
        <View style={styles.header}>
            <Image source={appIcon} style={styles.headerIcon} />
            <View style={styles.headerContent}>
                <Text style={styles.headerTitle}>{title}</Text>
            </View>
            {rightContent && <View style={styles.headerActions}>{rightContent}</View>}
        </View>
    );
}

const styles = StyleSheet.create({
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
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
