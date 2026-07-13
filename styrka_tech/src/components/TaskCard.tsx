import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Task } from '../store/mockData';
import { ThemeColors, ThemeTypography, ThemeLayout, ThemeSpacing } from '../theme/theme';

interface Props {
  task: Task;
}

const TaskCard: React.FC<Props> = ({ task }) => {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{task.title}</Text>
      <Text style={styles.description}>{task.description}</Text>
      <View style={styles.footer}>
        <Text style={styles.status}>Status: {task.status}</Text>
        <Text style={styles.dueDate}>Due: {task.dueDate}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: ThemeColors.surface,
    padding: ThemeSpacing.medium,
    borderRadius: ThemeLayout.borderRadius,
    marginBottom: ThemeSpacing.medium,
    borderColor: ThemeColors.border,
    borderWidth: 1,
    ...ThemeLayout.cardShadow,
  },
  title: {
    ...ThemeTypography.title,
    marginBottom: ThemeSpacing.small,
  },
  description: {
    ...ThemeTypography.body,
    marginBottom: ThemeSpacing.medium,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  status: {
    ...ThemeTypography.caption,
    color: ThemeColors.secondary,
    fontWeight: 'bold',
  },
  dueDate: {
    ...ThemeTypography.caption,
  },
});

export default TaskCard;
