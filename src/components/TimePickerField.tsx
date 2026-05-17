import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AppColors } from '../styles/theme';
import { useColors } from '../styles/useColors';

interface Props {
    value: string; // "HH:MM"
    onChange: (time: string) => void;
    autoOpen?: number; // trigger token — bump to open picker
}

function timeToDate(time: string): Date {
    const [h, m] = time.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
}

function dateToTime(date: Date): string {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export default function TimePickerField({ value, onChange, autoOpen }: Props) {
    const colors = useColors();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [showPicker, setShowPicker] = useState(false);
    const date = timeToDate(value);

    useEffect(() => {
        if (autoOpen && autoOpen > 0 && Platform.OS !== 'ios') {
            setShowPicker(true);
        }
    }, [autoOpen]);

    if (Platform.OS === 'ios') {
        return (
            <View style={styles.iosContainer}>
                <DateTimePicker
                    value={date}
                    mode="time"
                    display="compact"
                    onChange={(_, d) => d && onChange(dateToTime(d))}
                    style={styles.iosPicker}
                    themeVariant="light"
                    accentColor={colors.primary}
                />
            </View>
        );
    }

    return (
        <View>
            <TouchableOpacity style={styles.androidButton} onPress={() => setShowPicker(true)}>
                <Text style={styles.androidText}>{value}</Text>
                <Text style={styles.androidIcon}>🕐</Text>
            </TouchableOpacity>
            {showPicker && (
                <DateTimePicker
                    value={date}
                    mode="time"
                    display="default"
                    onChange={(_, d) => {
                        setShowPicker(false);
                        if (d) onChange(dateToTime(d));
                    }}
                />
            )}
        </View>
    );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
    iosContainer: { alignSelf: 'flex-start' },
    iosPicker: { height: 40 },
    androidButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        borderWidth: 1, borderColor: c.border.medium, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    },
    androidText: { fontSize: 15, color: c.text.secondary },
    androidIcon: { fontSize: 16 },
});
