import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../styles/theme';

interface Props {
    value: Date;
    onChange: (date: Date) => void;
}

export default function DatePickerField({ value, onChange }: Props) {
    const [showPicker, setShowPicker] = useState(false);

    const formatted = value.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    if (Platform.OS === 'ios') {
        return (
            <View style={styles.iosContainer}>
                <DateTimePicker
                    value={value}
                    mode="date"
                    display="compact"
                    minimumDate={new Date()}
                    onChange={(_, date) => date && onChange(date)}
                    style={styles.iosPicker}
                    themeVariant="light"
                    accentColor={COLORS.primary}
                />
            </View>
        );
    }

    return (
        <View>
            <TouchableOpacity style={styles.androidButton} onPress={() => setShowPicker(true)}>
                <Text style={styles.androidText}>{formatted}</Text>
                <Text style={styles.androidIcon}>📅</Text>
            </TouchableOpacity>
            {showPicker && (
                <DateTimePicker
                    value={value}
                    mode="date"
                    display="default"
                    minimumDate={new Date()}
                    onChange={(_, date) => {
                        setShowPicker(false);
                        if (date) onChange(date);
                    }}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    iosContainer: { alignSelf: 'flex-start' },
    iosPicker: { height: 40 },
    androidButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    },
    androidText: { fontSize: 15, color: '#333' },
    androidIcon: { fontSize: 16 },
});
