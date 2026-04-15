import React, { useState, useRef, useEffect } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface CountdownTimerProps {
  seconds: number;
  onExpire: () => void;
}

export const CountdownTimer = ({
  seconds,
  onExpire,
}: CountdownTimerProps): React.JSX.Element => {
  const [remaining, setRemaining] = useState(seconds);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    const timer = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onExpireRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const isUrgent = remaining <= 30;

  return (
    <View
      className={`flex-row items-center gap-1.5 rounded-xl px-3 py-1.5 ${isUrgent ? 'bg-red-100' : 'bg-amber-100'}`}
    >
      <Ionicons
        name="timer-outline"
        size={16}
        color={isUrgent ? '#DC2626' : '#B45309'}
      />
      <Text
        className={`text-sm font-bold tabular-nums ${isUrgent ? 'text-red-600' : 'text-amber-700'}`}
      >
        {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </Text>
    </View>
  );
};
