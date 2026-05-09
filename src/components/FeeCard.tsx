import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { FeeItem } from '../types';

interface Props { fee: FeeItem; onPress?: () => void }

export const FeeCard: React.FC<Props> = ({ fee, onPress }) => {
  const isPaid = fee.status === 'paid';
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.icon, { backgroundColor: isPaid ? '#e8f5e9' : '#e8eaf6' }]}>
        <Text style={styles.iconText}>{isPaid ? '✓' : '📋'}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.title}>{fee.title}</Text>
        <Text style={styles.date}>Due by {fee.dueDate}</Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.amount, { color: isPaid ? '#2e7d32' : '#c62828' }]}>
          ${fee.amount.toFixed(2)}
        </Text>
        {!isPaid && (
          <Text style={styles.viewDetails}>VIEW DETAILS</Text>
        )}
        {isPaid && <Text style={styles.success}>SUCCESS</Text>}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12,
    padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  icon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  iconText: { fontSize: 18 },
  info: { flex: 1 },
  title: { fontSize: 14, fontWeight: '600', color: '#1a1a2e' },
  date: { fontSize: 12, color: '#888', marginTop: 2 },
  right: { alignItems: 'flex-end' },
  amount: { fontSize: 15, fontWeight: '700' },
  viewDetails: { fontSize: 10, color: '#1a2e8a', fontWeight: '700', marginTop: 4 },
  success: { fontSize: 10, color: '#2e7d32', fontWeight: '700', marginTop: 4 },
});