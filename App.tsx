import React, { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import UpdateModal from './src/components/UpdateModal';
import ErrorBoundary from './src/components/ErrorBoundary';
import { checkAppVersion } from './src/utils/versionCheck';

type VersionResult = Awaited<ReturnType<typeof checkAppVersion>>;

export default function App() {
  const [versionInfo, setVersionInfo] = useState<VersionResult>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    checkAppVersion().then((result) => {
      if (result?.updateAvailable) {
        setVersionInfo(result);
        setShowModal(true);
      }
    });
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <AppNavigator />
        </ErrorBoundary>

        {versionInfo && (
          <UpdateModal
            visible={showModal}
            forceUpdate={versionInfo.forceUpdate}
            storeUrl={versionInfo.storeUrl}
            releaseNotes={versionInfo.releaseNotes}
            onDismiss={() => setShowModal(false)}
          />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}