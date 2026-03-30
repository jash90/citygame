import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NarrativeSettings } from '@/services/api';

interface GamePrologueModalProps {
  visible: boolean;
  narrative: NarrativeSettings;
  gameName: string;
  onStart: () => void;
}

export const GamePrologueModal = ({
  visible,
  narrative,
  gameName,
  onStart,
}: GamePrologueModalProps): React.JSX.Element => {
  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent>
      <View className="flex-1" style={{ backgroundColor: '#0d0d1a' }}>
        <ScrollView
          className="flex-1 px-6"
          contentContainerStyle={{ paddingTop: 80, paddingBottom: 120 }}
        >
          {narrative.theme ? (
            <View className="flex-row items-center gap-2 mb-4">
              <Ionicons name="book" size={16} color="#D4A574" />
              <Text className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#D4A574' }}>
                {narrative.theme}
              </Text>
            </View>
          ) : null}

          <Text className="text-2xl font-bold text-white mb-6">{gameName}</Text>

          {narrative.prologue ? (
            <Text className="text-base leading-7" style={{ color: '#E8D5B7' }}>
              {narrative.prologue}
            </Text>
          ) : null}
        </ScrollView>

        <View className="absolute bottom-0 left-0 right-0 px-6 pb-12 pt-4" style={{ backgroundColor: '#0d0d1a' }}>
          <TouchableOpacity
            className="bg-primary rounded-2xl py-4 items-center"
            activeOpacity={0.8}
            onPress={onStart}
          >
            <Text className="text-white font-bold text-base">Rozpocznij przygodę</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};
