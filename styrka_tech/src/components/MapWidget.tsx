import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ThemeColors, ThemeTypography, ThemeLayout, ThemeSpacing } from '../theme/theme';
import { LocationRecord, Employee } from '../store/mockData';

interface Props {
  locations: LocationRecord[];
  employees: Employee[];
}

const MapWidget: React.FC<Props> = ({ locations, employees }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Live Field Operations</Text>
      
      {/* Mock Map Area */}
      <View style={styles.mapArea}>
        <Text style={styles.mapPlaceholderText}>Interactive Map View</Text>
        {locations.map((loc, index) => {
          const emp = employees.find(e => e.id === loc.employeeId);
          return (
            <View 
              key={loc.id} 
              style={[
                styles.pin, 
                { top: 20 + index * 40, left: 50 + index * 30 } // Mock positioning
              ]}
            >
              <View style={styles.pinDot} />
              <Text style={styles.pinLabel}>{emp?.name}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: ThemeColors.surface,
    padding: ThemeSpacing.medium,
    borderRadius: ThemeLayout.borderRadius,
    marginBottom: ThemeSpacing.large,
    borderColor: ThemeColors.border,
    borderWidth: 1,
    ...ThemeLayout.cardShadow,
  },
  title: {
    ...ThemeTypography.title,
    marginBottom: ThemeSpacing.medium,
  },
  mapArea: {
    height: 200,
    backgroundColor: '#E8F5E9',
    borderRadius: ThemeLayout.borderRadius,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    borderColor: ThemeColors.primaryLight,
    borderWidth: 1,
  },
  mapPlaceholderText: {
    ...ThemeTypography.caption,
    color: ThemeColors.primaryLight,
  },
  pin: {
    position: 'absolute',
    alignItems: 'center',
  },
  pinDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: ThemeColors.error,
    borderWidth: 2,
    borderColor: ThemeColors.surface,
  },
  pinLabel: {
    ...ThemeTypography.caption,
    backgroundColor: 'rgba(255,255,255,0.8)',
    paddingHorizontal: 4,
    borderRadius: 4,
    marginTop: 2,
  },
});

export default MapWidget;
