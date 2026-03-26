import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { withAlpha } from '@/lib/unistyles';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';

export default function LoginScreen(): React.JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error } = useAuth();
  const router = useRouter();

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
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo / title */}
          <View style={styles.logoContainer}>
            <View style={styles.logoBox}>
              <Text style={styles.logoEmoji}>🏙️</Text>
            </View>
            <Text style={styles.title}>
              CityGame
            </Text>
            <Text style={styles.subtitle}>
              Odkryj miasto. Zdobywaj punkty.
            </Text>
          </View>

          {/* Form */}
          <View style={styles.formGap}>
            <View>
              <Text style={styles.label}>
                Adres e-mail
              </Text>
              <TextInput
                style={styles.input}
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
              <Text style={styles.label}>
                Hasło
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Twoje hasło"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Button
              label="Zaloguj się"
              variant="primary"
              size="lg"
              fullWidth
              isLoading={isLoading}
              onPress={handleLogin}
              style={styles.buttonMargin}
            />
          </View>

          {/* Register link */}
          <View style={styles.linkRow}>
            <Text style={styles.linkText}>Nie masz konta? </Text>
            <Link href="/(auth)/register" asChild>
              <TouchableOpacity>
                <Text style={styles.linkAction}>
                  Zarejestruj się
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create((theme) => ({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },
  flex1: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    ...theme.shadows.lg,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.4,
  },
  logoEmoji: {
    fontSize: 36,
  },
  title: {
    fontSize: 30,
    fontWeight: theme.fontWeight.extrabold,
    color: theme.colors.secondary,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.gray[500],
    marginTop: 4,
  },
  formGap: {
    gap: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.gray[700],
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.gray[200],
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.colors.gray[900],
    backgroundColor: theme.colors.gray[50],
  },
  errorBox: {
    backgroundColor: theme.colors.red[50],
    borderWidth: 1,
    borderColor: theme.colors.red[200],
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  errorText: {
    fontSize: 14,
    color: theme.colors.red[700],
  },
  buttonMargin: {
    marginTop: 8,
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  linkText: {
    color: theme.colors.gray[500],
    fontSize: 14,
  },
  linkAction: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: theme.fontWeight.semibold,
  },
}));
