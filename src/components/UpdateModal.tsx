import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, BackHandler } from 'react-native';
import { openStore } from '../utils/versionCheck';

interface Props {
  visible: boolean;
  forceUpdate: boolean;
  storeUrl: string;
  releaseNotes: string;
  onDismiss: () => void;
}

export default function UpdateModal({ visible, forceUpdate, storeUrl, releaseNotes, onDismiss }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!forceUpdate) onDismiss();
        // force update: block back button (Android) by doing nothing
      }}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>
            {forceUpdate ? 'Update Required' : 'Update Available'}
          </Text>
          <Text style={styles.message}>
            {forceUpdate
              ? 'A required update is available. Please update to continue using the app.'
              : 'A new version of MagnetPro is available.'}
          </Text>
          {releaseNotes ? <Text style={styles.notes}>{releaseNotes}</Text> : null}

          <TouchableOpacity style={styles.updateBtn} onPress={() => openStore(storeUrl)}>
            <Text style={styles.updateBtnText}>Update Now</Text>
          </TouchableOpacity>

          {!forceUpdate && (
            <TouchableOpacity style={styles.laterBtn} onPress={onDismiss}>
              <Text style={styles.laterBtnText}>Later</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 8, color: '#111' },
  message: { fontSize: 14, color: '#444', textAlign: 'center', marginBottom: 8 },
  notes: { fontSize: 12, color: '#888', textAlign: 'center', marginBottom: 16 },
  updateBtn: {
    backgroundColor: '#2E5BFF',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  updateBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  laterBtn: { marginTop: 12 },
  laterBtnText: { color: '#888', fontSize: 13 },
});