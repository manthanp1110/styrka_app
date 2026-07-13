import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { ThemeColors, ThemeTypography, ThemeLayout, ThemeSpacing } from '../theme/theme';
import { Employee } from '../store/mockData';

interface Props {
  employees: Employee[];
}

const DirectoryList: React.FC<Props> = ({ employees }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Team Directory</Text>
      
      <FlatList
        data={employees}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.listItem}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
            </View>
            <View style={styles.info}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.department}>{item.department}</Text>
            </View>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{item.role}</Text>
            </View>
          </View>
        )}
      />
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
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: ThemeSpacing.small,
    borderBottomWidth: 1,
    borderBottomColor: ThemeColors.background,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ThemeColors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: ThemeSpacing.medium,
  },
  avatarText: {
    color: ThemeColors.surface,
    fontWeight: 'bold',
    fontSize: 18,
  },
  info: {
    flex: 1,
  },
  name: {
    ...ThemeTypography.body,
    fontWeight: 'bold',
  },
  department: {
    ...ThemeTypography.caption,
  },
  roleBadge: {
    backgroundColor: ThemeColors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ThemeColors.primary,
  },
  roleText: {
    ...ThemeTypography.caption,
    color: ThemeColors.primaryDark,
    textTransform: 'capitalize',
  },
});

export default DirectoryList;
