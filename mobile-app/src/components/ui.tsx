import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  );
}

export function ScreenTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.headerBlock}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

export function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function StatCard({
  label,
  value,
  tone = 'blue',
}: {
  label: string;
  value: string;
  tone?: 'blue' | 'amber' | 'green';
}) {
  const palette = {
    blue: ['#dbeafe', '#0f3d5e'],
    amber: ['#ffedd5', '#b45309'],
    green: ['#dcfce7', '#166534'],
  } as const;

  return (
    <View style={[styles.statCard, { backgroundColor: palette[tone][0] }]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color: palette[tone][1] }]}>{value}</Text>
    </View>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secureTextEntry,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'url';
  secureTextEntry?: boolean;
  multiline?: boolean;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        style={[styles.input, multiline ? styles.multiline : null]}
        placeholderTextColor="#94a3b8"
      />
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  loading,
  tone = 'dark',
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  tone?: 'dark' | 'amber' | 'rose';
}) {
  const colors = {
    dark: '#0f172a',
    amber: '#c2410c',
    rose: '#be123c',
  } as const;

  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: colors[tone], opacity: pressed || loading ? 0.85 : 1 },
      ]}>
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{label}</Text>}
    </Pressable>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segmentWrap}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.segment, active ? styles.segmentActive : null]}>
            <Text style={[styles.segmentText, active ? styles.segmentTextActive : null]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Banner({
  text,
  tone = 'info',
}: {
  text: string;
  tone?: 'info' | 'error' | 'success';
}) {
  const palette = {
    info: ['#e0f2fe', '#0369a1'],
    error: ['#fee2e2', '#b91c1c'],
    success: ['#dcfce7', '#166534'],
  } as const;
  return (
    <View style={[styles.banner, { backgroundColor: palette[tone][0] }]}>
      <Text style={[styles.bannerText, { color: palette[tone][1] }]}>{text}</Text>
    </View>
  );
}

export function RecordCard({
  title,
  subtitle,
  meta,
}: {
  title: string;
  subtitle: string;
  meta: string;
}) {
  return (
    <View style={styles.recordCard}>
      <Text style={styles.recordTitle}>{title}</Text>
      <Text style={styles.recordSubtitle}>{subtitle}</Text>
      <Text style={styles.recordMeta}>{meta}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    padding: 18,
    gap: 16,
    backgroundColor: '#f8fafc',
    paddingBottom: 120,
  },
  headerBlock: {
    gap: 6,
    paddingTop: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: '#475569',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 16,
    gap: 14,
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  statCard: {
    borderRadius: 22,
    padding: 18,
    gap: 8,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
  },
  fieldWrap: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  input: {
    borderWidth: 1,
    borderColor: '#dbe4ee',
    borderRadius: 18,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: '#0f172a',
  },
  multiline: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
  button: {
    minHeight: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  segmentWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  segment: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
  },
  segmentActive: {
    backgroundColor: '#0f172a',
  },
  segmentText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: '#fff',
  },
  banner: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
  },
  bannerText: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  recordCard: {
    borderRadius: 18,
    backgroundColor: '#ffffff',
    padding: 14,
    gap: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  recordTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  recordSubtitle: {
    fontSize: 13,
    color: '#475569',
  },
  recordMeta: {
    marginTop: 6,
    fontSize: 12,
    color: '#64748b',
  },
});
