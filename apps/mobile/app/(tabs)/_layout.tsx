import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/lib/theme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<string, { active: IoniconsName; inactive: IoniconsName }> = {
  map: { active: 'map', inactive: 'map-outline' },
  tasks: { active: 'clipboard', inactive: 'clipboard-outline' },
  ranking: { active: 'trophy', inactive: 'trophy-outline' },
  profile: { active: 'person', inactive: 'person-outline' },
};

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
          height: 80,
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
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? TAB_ICONS.map.active : TAB_ICONS.map.inactive}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="tasks/index"
        options={{
          title: 'Zadania',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? TAB_ICONS.tasks.active : TAB_ICONS.tasks.inactive}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="ranking/index"
        options={{
          title: 'Ranking',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? TAB_ICONS.ranking.active : TAB_ICONS.ranking.inactive}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile/index"
        options={{
          title: 'Profil',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? TAB_ICONS.profile.active : TAB_ICONS.profile.inactive}
              size={size}
              color={color}
            />
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
