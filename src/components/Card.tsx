import type { PropsWithChildren, ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { theme } from '../styles/theme';

type CardProps = PropsWithChildren<{
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  style?: StyleProp<ViewStyle>;
}>;

export function Card({ action, children, eyebrow, style, title }: CardProps) {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.header}>
        <View style={styles.heading}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
        </View>
        {action}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.border,
    borderRadius: theme.radius.large,
    borderWidth: 1,
    gap: theme.space.medium,
    padding: theme.space.large,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: theme.space.medium,
    justifyContent: 'space-between',
  },
  heading: {
    flex: 1,
    gap: theme.space.xsmall,
  },
  eyebrow: {
    color: theme.color.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  title: {
    color: theme.color.text,
    fontSize: 21,
    fontWeight: '700',
  },
});
