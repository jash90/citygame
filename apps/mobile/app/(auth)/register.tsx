import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/shared/components/ui/Button';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { StyledSafeAreaView } from '@/shared/lib/styled';

export default function RegisterScreen(): React.JSX.Element {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { register, isLoading, error } = useAuth();
  const router = useRouter();

  const handleRegister = async (): Promise<void> => {
    if (!displayName.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Błąd', 'Wypełnij wszystkie pola.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Błąd', 'Hasła nie są zgodne.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Błąd', 'Hasło musi mieć co najmniej 8 znaków.');
      return;
    }
    try {
      await register(email.trim(), password, displayName.trim());
      router.replace('/(tabs)/map');
    } catch {
      // error is already set in hook
    }
  };

  return (
    <StyledSafeAreaView className="flex-1 bg-surface">
      <KeyboardAwareScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 32 }}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        extraScrollHeight={20}
      >
          {/* Logo / title */}
          <View className="items-center mb-8">
            <View className="w-20 h-20 rounded-3xl bg-primary items-center justify-center mb-4 shadow-lg shadow-primary/40">
              <Ionicons name="business" size={40} color="#FFFFFF" />
            </View>
            <Text className="text-3xl font-extrabold text-secondary">
              Dołącz do gry
            </Text>
            <Text className="text-base text-gray-500 mt-1">
              Utwórz konto i zacznij grać
            </Text>
          </View>

          {/* Form */}
          <View className="gap-4">
            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1.5">
                Nazwa gracza
              </Text>
              <TextInput
                className="border border-gray-200 rounded-xl px-4 h-12 text-base text-gray-900 bg-gray-50"
                placeholder="TwójNickGracz"
                placeholderTextColor="#9CA3AF"
                autoCorrect={false}
                value={displayName}
                onChangeText={setDisplayName}
              />
            </View>

            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1.5">
                Adres e-mail
              </Text>
              <TextInput
                className="border border-gray-200 rounded-xl px-4 h-12 text-base text-gray-900 bg-gray-50"
                placeholder="jan.kowalski@email.pl"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1.5">
                Hasło
              </Text>
              <TextInput
                className="border border-gray-200 rounded-xl px-4 h-12 text-base text-gray-900 bg-gray-50"
                placeholder="Min. 8 znaków"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>

            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1.5">
                Potwierdź hasło
              </Text>
              <TextInput
                className="border border-gray-200 rounded-xl px-4 h-12 text-base text-gray-900 bg-gray-50"
                placeholder="Powtórz hasło"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
            </View>

            {error ? (
              <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <Text className="text-sm text-red-700">{error}</Text>
              </View>
            ) : null}

            <Button
              label="Zarejestruj się"
              variant="primary"
              size="lg"
              fullWidth
              isLoading={isLoading}
              onPress={handleRegister}
              style={{ marginTop: 8 }}
            />
          </View>

          {/* Login link */}
          <View className="flex-row justify-center mt-6">
            <Text className="text-gray-500 text-sm">Masz już konto? </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text className="text-primary text-sm font-semibold">
                  Zaloguj się
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
      </KeyboardAwareScrollView>
    </StyledSafeAreaView>
  );
}
