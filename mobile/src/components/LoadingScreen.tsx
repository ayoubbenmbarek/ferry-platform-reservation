import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import RunningBear from './RunningBear';

interface LoadingScreenProps {
  message?: string;
  fullScreen?: boolean;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'Loading...',
  fullScreen = true,
}) => {
  if (fullScreen) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <RunningBear message={message} fullScreen={true} />
      </SafeAreaView>
    );
  }

  return <RunningBear message={message} fullScreen={false} />;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E0F2FE',
  },
});

export default LoadingScreen;
