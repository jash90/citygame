import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  type TouchableOpacityProps,
} from 'react-native';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends TouchableOpacityProps {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  fullWidth?: boolean;
}

const CONTAINER_VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-primary',
  secondary: 'bg-secondary',
  outline: 'bg-transparent border-2 border-primary',
  ghost: 'bg-transparent',
};

const CONTAINER_SIZE: Record<ButtonSize, string> = {
  sm: 'px-3 py-2 rounded-lg',
  md: 'px-5 py-3 rounded-xl',
  lg: 'px-6 py-4 rounded-xl',
};

const TEXT_VARIANT: Record<ButtonVariant, string> = {
  primary: 'text-white',
  secondary: 'text-white',
  outline: 'text-primary',
  ghost: 'text-primary',
};

const TEXT_SIZE: Record<ButtonSize, string> = {
  sm: 'text-sm font-semibold',
  md: 'text-base font-semibold',
  lg: 'text-lg font-bold',
};

export const Button = ({
  label,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  fullWidth = false,
  disabled,
  ...props
}: ButtonProps): React.JSX.Element => {
  const isDisabled = disabled || isLoading;

  const containerClass = [
    'flex-row items-center justify-center',
    CONTAINER_VARIANT[variant],
    CONTAINER_SIZE[size],
    fullWidth ? 'w-full' : 'self-start',
    isDisabled ? 'opacity-50' : '',
  ].join(' ');

  return (
    <TouchableOpacity
      className={containerClass}
      disabled={isDisabled}
      activeOpacity={0.8}
      {...props}
    >
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' || variant === 'secondary' ? '#FFFFFF' : '#FF6B35'}
          style={{ marginRight: 8 }}
        />
      ) : null}
      <Text className={`${TEXT_SIZE[size]} ${TEXT_VARIANT[variant]}`}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};
