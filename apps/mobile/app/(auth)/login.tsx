import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Pressable,
} from 'react-native';
import { API_URL, WS_URL } from '@/lib/constants';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { StyledSafeAreaView } from '@/lib/styled';

export default function LoginScreen(): React.JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error } = useAuth();
  const router = useRouter();
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleIconTap = () => {
    tapCountRef.current += 1;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    if (tapCountRef.current >= 5) {
      tapCountRef.current = 0;
      Alert.alert(
        'Environment',
        `API_URL: ${API_URL || '(empty)'}\nWS_URL: ${WS_URL || '(empty)'}`,
      );
      return;
    }
    tapTimerRef.current = setTimeout(() => {
      tapCountRef.current = 0;
    }, 1500);
  };

  const handleLogin = async (): Promise<void> => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Błąd', 'Podaj adres e-mail i hasło.');
      return;
    }
    try {
      await login(email.trim(), password);
      router.replace('/(tabs)/map');
    } catch {
      // error is already set in hook
    }
  };

  return (
    <StyledSafeAreaView className="flex-1 bg-surface">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerClassName="flex-grow justify-center px-6 py-8"
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo / title */}
          <View className="items-center mb-10">
            <Pressable onPress={handleIconTap}>
              <View className="w-20 h-20 rounded-3xl bg-primary items-center justify-center mb-4 shadow-lg shadow-primary/40">
                <Ionicons name="business" size={40} color="#FFFFFF" />
              </View>
            </Pressable>
            <Text className="text-3xl font-extrabold text-secondary">
              CityGame
            </Text>
            <Text className="text-base text-gray-500 mt-1">
              Odkryj miasto. Zdobywaj punkty.
            </Text>
          </View>

          {/* Form */}
          <View className="gap-4">
            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1.5">
                Adres e-mail
              </Text>
              <TextInput
                className="border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900 bg-gray-50"
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
                className="border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900 bg-gray-50"
                placeholder="Twoje hasło"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>

            {error ? (
              <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <Text className="text-sm text-red-700">{error}</Text>
              </View>
            ) : null}

            <Button
              label="Zaloguj się"
              variant="primary"
              size="lg"
              fullWidth
              isLoading={isLoading}
              onPress={handleLogin}
              style={{ marginTop: 8 }}
            />
          </View>

          {/* Register link */}
          <View className="flex-row justify-center mt-6">
            <Text className="text-gray-500 text-sm">Nie masz konta? </Text>
            <Link href="/(auth)/register" asChild>
              <TouchableOpacity>
                <Text className="text-primary text-sm font-semibold">
                  Zarejestruj się
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </StyledSafeAreaView>
  );
}
