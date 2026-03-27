'use client';

import React, { Component, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  resetKey?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

class ErrorBoundaryInner extends Component<Props, State> {
  state: State = { hasError: false, error: null, retryCount: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  handleReset = () => {
    this.setState((prev) => ({ hasError: false, error: null, retryCount: prev.retryCount + 1 }));
  };

  render() {
    if (this.state.hasError) {
      const maxRetries = 3;
      const canRetry = this.state.retryCount < maxRetries;

      return (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-gray-600">
          <AlertTriangle size={40} className="text-red-400" />
          <h2 className="text-lg font-semibold text-gray-800">Coś poszło nie tak</h2>
          <p className="text-sm text-gray-500 max-w-md text-center">
            {this.state.error?.message ?? 'Wystąpił nieoczekiwany błąd.'}
          </p>
          {canRetry ? (
            <button
              onClick={this.handleReset}
              className="px-4 py-2 text-sm bg-[#FF6B35] text-white rounded-lg hover:bg-[#e55a26] transition-colors"
            >
              Spróbuj ponownie ({maxRetries - this.state.retryCount} {maxRetries - this.state.retryCount === 1 ? 'próba' : 'próby'})
            </button>
          ) : (
            <p className="text-sm text-gray-400">
              Odśwież stronę, aby spróbować ponownie.
            </p>
          )}
        </div>
      );
    }

    return <React.Fragment key={this.state.retryCount}>{this.props.children}</React.Fragment>;
  }
}

export function ErrorBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <ErrorBoundaryInner resetKey={pathname}>{children}</ErrorBoundaryInner>;
}
