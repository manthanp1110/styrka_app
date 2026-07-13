export const ThemeColors = {
  primary: '#2E7D32', // Earthy Green
  primaryLight: '#60AD5E',
  primaryDark: '#005005',
  secondary: '#FFB300', // Amber/Yellow for contrast/warnings
  background: '#F1F8E9', // Very light green-tinted background
  surface: '#FFFFFF', // Cards and panels
  text: '#1B5E20', // Dark green text
  textLight: '#4CAF50',
  error: '#D32F2F',
  border: '#C8E6C9',
};

export const ThemeTypography = {
  header: {
    fontSize: 24,
    fontWeight: 'bold' as const,
    color: ThemeColors.primaryDark,
  },
  title: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: ThemeColors.text,
  },
  body: {
    fontSize: 14,
    color: ThemeColors.text,
  },
  caption: {
    fontSize: 12,
    color: ThemeColors.textLight,
  },
};

export const ThemeSpacing = {
  small: 8,
  medium: 16,
  large: 24,
};

export const ThemeLayout = {
  borderRadius: 8,
  cardShadow: {
    shadowColor: ThemeColors.primaryDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
};
