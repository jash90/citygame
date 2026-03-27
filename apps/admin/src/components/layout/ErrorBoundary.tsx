'use client';

import { Component, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-gray-600">
          <AlertTriangle size={40} className="text-red-400" />
          <h2 className="text-lg font-semibold text-gray-800">Coś poszło nie tak</h2>
          <p className="text-sm text-gray-500 max-w-md text-center">
            {this.state.error?.message ?? 'Wystąpił nieoczekiwany błąd.'}
          </p>
          <button
            onClick={this.handleReset}
            className="px-4 py-2 text-sm bg-[#FF6B35] text-white rounded-lg hover:bg-[#e55a26] transition-colors"
          >
            Spróbuj ponownie
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
