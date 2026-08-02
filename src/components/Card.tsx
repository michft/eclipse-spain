import type { PropsWithChildren, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/styles/theme';

type CardProps = PropsWithChildren<{
  title: string;
  eyebrow?: string;
  action?: ReactNode;
}>;

/**
 * Presents content in a themed card with a heading and optional action.
 *
 * The title is rendered with header accessibility semantics. The optional
 * eyebrow appears above the title, while the action is placed beside the
 * heading.
 *
 * @param title - The card heading
 * @param eyebrow - Optional label displayed above the heading
 * @param action - Optional element displayed beside the heading
 * @param children - Content displayed below the heading
 *
 * @example
 * <Card eyebrow="Account" title="Profile" action={<Button title="Edit" />}>
 *   <Text>Profile details</Text>
 * </Card>
 */
export function Card({ action, children, eyebrow, title }: CardProps) {
  return (
    <View style={styles.card}>
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
