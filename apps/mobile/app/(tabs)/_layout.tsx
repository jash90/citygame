import React from 'react';
import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { colors } from '@/lib/theme';

// Simple text-based tab icons using emoji to avoid icon library dependency at skeleton stage
const TAB_ICONS = {
  map: '🗺️',
  tasks: '📋',
  ranking: '🏆',
  profile: '👤',
} as const;

interface TabIconProps {
  emoji: string;
  focused: boolean;
}

const TabIcon = ({ emoji, focused }: TabIconProps): React.JSX.Element => (
  <Text style={{ fontSize: focused ? 22 : 20, opacity: focused ? 1 : 0.6 }}>
    {emoji}
  </Text>
);

export default function TabLayout(): React.JSX.Element {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabBarInactive,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingBottom: 4,
          paddingTop: 4,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="map/index"
        options={{
          title: 'Mapa',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji={TAB_ICONS.map} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="tasks/index"
        options={{
          title: 'Zadania',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji={TAB_ICONS.tasks} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="ranking/index"
        options={{
          title: 'Ranking',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji={TAB_ICONS.ranking} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile/index"
        options={{
          title: 'Profil',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji={TAB_ICONS.profile} focused={focused} />
          ),
        }}
      />
      {/* Hide task detail from tab bar */}
      <Tabs.Screen
        name="tasks/[taskId]"
        options={{ href: null }}
      />
    </Tabs>
  );
}
