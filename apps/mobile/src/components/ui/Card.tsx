import React, { type ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  children: ReactNode;
  elevated?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const PADDING: Record<string, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5',
};

export const Card = ({
  children,
  elevated = false,
  padding = 'md',
  style,
  ...props
}: CardProps): React.JSX.Element => {
  const className = [
    'bg-surface rounded-xl',
    elevated ? 'shadow-md' : 'border border-gray-100',
    PADDING[padding],
  ].join(' ');

  return (
    <View className={className} style={style} {...props}>
      {children}
    </View>
  );
};
