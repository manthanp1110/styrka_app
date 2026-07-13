import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ThemeColors, ThemeTypography, ThemeLayout, ThemeSpacing } from '../theme/theme';
import { TimeRecord } from '../store/mockData';

interface Props {
  activeRecord: TimeRecord | null;
}

const AttendanceWidget: React.FC<Props> = ({ activeRecord }) => {
  const isClockedIn = !!activeRecord && !activeRecord.clockOut;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Attendance</Text>
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>
          Status: <Text style={isClockedIn ? styles.active : styles.inactive}>{isClockedIn ? 'Clocked In' : 'Clocked Out'}</Text>
        </Text>
        {isClockedIn && (
          <Text style={styles.timeText}>Since {activeRecord.clockIn}</Text>
        )}
      </View>
      <TouchableOpacity style={[styles.button, isClockedIn ? styles.buttonOut : styles.buttonIn]}>
        <Text style={styles.buttonText}>{isClockedIn ? 'Clock Out' : 'Clock In'}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: ThemeColors.surface,
    padding: ThemeSpacing.medium,
    borderRadius: ThemeLayout.borderRadius,
    marginBottom: ThemeSpacing.large,
    alignItems: 'center',
    borderColor: ThemeColors.border,
    borderWidth: 1,
    ...ThemeLayout.cardShadow,
  },
  title: {
    ...ThemeTypography.title,
    marginBottom: ThemeSpacing.medium,
  },
  statusContainer: {
    marginBottom: ThemeSpacing.medium,
    alignItems: 'center',
  },
  statusText: {
    ...ThemeTypography.body,
    fontWeight: 'bold',
  },
  timeText: {
    ...ThemeTypography.caption,
    marginTop: ThemeSpacing.small,
  },
  active: {
    color: ThemeColors.primary,
  },
  inactive: {
    color: ThemeColors.error,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 24,
  },
  buttonIn: {
    backgroundColor: ThemeColors.primary,
  },
  buttonOut: {
    backgroundColor: ThemeColors.error,
  },
  buttonText: {
    color: ThemeColors.surface,
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default AttendanceWidget;
