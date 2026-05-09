import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface Props {
  percent: number;
  size?: number;
  color?: string;
  label?: string;
}

export const CircularProgress: React.FC<Props> = ({
  percent, size = 140, color = '#1a2e8a', label = 'PAID'
}) => {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (percent / 100) * circumference;
  const centerPoint = size / 2;

  return (
    <View style={styles.container}>
      <Svg width={size} height={size}>
        <Circle
          cx={centerPoint} cy={centerPoint} r={r}
          stroke="#e8eaf6" strokeWidth={stroke} fill="none"
        />
        <Circle
          cx={centerPoint} cy={centerPoint} r={r}
          stroke={color} strokeWidth={stroke} fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </Svg>
      <View style={[styles.center, { width: size, height: size }]}>
        <Text style={[styles.percent, { color }]}>{percent}%</Text>
        <Text style={styles.label}>{label}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  center: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  percent: { fontSize: 28, fontWeight: '700' },
  label: { fontSize: 12, color: '#888', letterSpacing: 1 },
});