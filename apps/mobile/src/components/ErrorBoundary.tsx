import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
            backgroundColor: '#FFFFFF',
          }}
        >
          <Text style={{ fontSize: 48, marginBottom: 16 }}>😵</Text>
          <Text
            style={{
              fontSize: 20,
              fontWeight: '700',
              color: '#1a1a1a',
              textAlign: 'center',
              marginBottom: 8,
            }}
          >
            Coś poszło nie tak
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: '#666',
              textAlign: 'center',
              marginBottom: 24,
              lineHeight: 20,
            }}
          >
            Wystąpił nieoczekiwany błąd. Spróbuj ponownie.
          </Text>

          <TouchableOpacity
            onPress={this.handleReset}
            accessibilityRole="button"
            accessibilityLabel="Spróbuj ponownie"
            style={{
              backgroundColor: '#6366f1',
              paddingHorizontal: 32,
              paddingVertical: 14,
              borderRadius: 12,
              marginBottom: 24,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
              Spróbuj ponownie
            </Text>
          </TouchableOpacity>

          {__DEV__ && this.state.error && (
            <ScrollView
              style={{
                maxHeight: 200,
                width: '100%',
                backgroundColor: '#f5f5f5',
                borderRadius: 8,
                padding: 12,
              }}
            >
              <Text style={{ fontSize: 12, color: '#cc0000', fontFamily: 'monospace' }}>
                {this.state.error.message}
              </Text>
              {this.state.error.stack && (
                <Text
                  style={{
                    fontSize: 10,
                    color: '#888',
                    fontFamily: 'monospace',
                    marginTop: 8,
                  }}
                >
                  {this.state.error.stack}
                </Text>
              )}
            </ScrollView>
          )}
        </View>
      );
    }

    return this.props.children;
  }
}
