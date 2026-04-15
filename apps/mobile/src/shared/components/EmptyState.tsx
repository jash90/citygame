import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface Props {
  icon?: IoniconsName;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon = 'folder-open-outline',
  title,
  subtitle,
  actionLabel,
  onAction,
}: Props): React.JSX.Element {
  return (
    <View className="flex-1 items-center justify-center py-20 px-8">
      <Ionicons name={icon} size={48} color="#9CA3AF" />
      <Text className="text-lg font-semibold text-gray-900 text-center mb-2 mt-4">
        {title}
      </Text>
      {subtitle ? (
        <Text className="text-sm text-gray-500 text-center leading-5">
          {subtitle}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <TouchableOpacity
          onPress={onAction}
          activeOpacity={0.8}
          className="mt-6 bg-primary rounded-xl px-6 py-3"
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text className="text-white font-semibold text-sm">{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
