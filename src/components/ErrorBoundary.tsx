import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.warn('App error boundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.wrap}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.sub}>Please restart the app. If this keeps happening, contact support.</Text>
          <TouchableOpacity style={styles.btn} onPress={() => this.setState({ hasError: false })}>
            <Text style={styles.btnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 18, fontWeight: '700', color: '#1A2332', marginBottom: 8 },
  sub: { fontSize: 14, color: '#4A5568', textAlign: 'center', marginBottom: 20 },
  btn: { backgroundColor: '#2ECC9A', paddingVertical: 12, paddingHorizontal: 28, borderRadius: 10 },
  btnText: { color: '#fff', fontWeight: '700' },
});