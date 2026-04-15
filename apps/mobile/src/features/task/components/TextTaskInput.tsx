import React, { useState } from 'react';
import { View, Text, TextInput } from 'react-native';

interface TextTaskInputProps {
  onReady: (answer: string) => void;
}

export const TextTaskInput = ({
  onReady,
}: TextTaskInputProps): React.JSX.Element => {
  const [value, setValue] = useState('');
  return (
    <View className="gap-3">
      <Text className="text-sm font-medium text-gray-700">Twoja odpowiedź:</Text>
      <TextInput
        className="border border-gray-200 rounded-xl p-3 text-base text-gray-900 min-h-[100px]"
        placeholder="Wpisz odpowiedź..."
        multiline
        textAlignVertical="top"
        value={value}
        onChangeText={(t) => {
          setValue(t);
          onReady(t);
        }}
      />
    </View>
  );
};
