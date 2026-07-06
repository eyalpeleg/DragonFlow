import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { AppColors } from '@/src/styles/theme';
import { useColors } from '@/src/styles/useColors';

const HEADER_HEIGHT = 56;
const appIcon = require('@/assets/images/dragonflow3.png');

interface ScreenHeaderProps {
    title: string;
    rightContent?: React.ReactNode;
}

export default function ScreenHeader({ title, rightContent }: ScreenHeaderProps) {
    const colors = useColors();
    const styles = makeStyles(colors);
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

const makeStyles = (c: AppColors) => StyleSheet.create({
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
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
