import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Subject } from '../types';

interface Props { subject: Subject }

export const GradeBar: React.FC<Props> = ({ subject }) => {
  const gradeColor = subject.percentage >= 90 ? '#2e7d32' : subject.percentage >= 80 ? '#1565c0' : '#f57c00';
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.name}>{subject.name}</Text>
        <View style={[styles.badge, { backgroundColor: gradeColor + '20' }]}>
          <Text style={[styles.grade, { color: gradeColor }]}>GRADE {subject.grade}</Text>
        </View>
      </View>
      <Text style={styles.teacher}>{subject.teacher}</Text>
      <View style={styles.barBg}>
        <View style={{ height: 6, borderRadius: 3, flex: subject.percentage / 100, backgroundColor: gradeColor }} />
      </View>
      <Text style={styles.pct}>{subject.percentage}%</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '600', color: '#1a1a2e', flex: 1 },
  teacher: { fontSize: 13, color: '#888', marginTop: 2, marginBottom: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  grade: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  barBg: { alignSelf: 'stretch', height: 6, backgroundColor: '#e8eaf6', borderRadius: 3, marginVertical: 4, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  pct: { fontSize: 13, color: '#555', textAlign: 'right' },
});