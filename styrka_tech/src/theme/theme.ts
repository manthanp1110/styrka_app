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

export const GlassStyles = {
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.65)',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 6,
  },
  darkCard: {
    backgroundColor: 'rgba(15, 76, 58, 0.82)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  pill: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    borderRadius: 999,
  },
  darkPill: {
    backgroundColor: 'rgba(15, 76, 58, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  floatingOverlay: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 7,
  },
  input: {
    backgroundColor: 'rgba(243, 244, 246, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(209, 213, 219, 0.7)',
    borderRadius: 14,
  }
};
