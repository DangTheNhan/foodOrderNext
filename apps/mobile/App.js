import React from 'react';
import { StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider } from './src/auth/SessionContext';
import { getFirebaseRuntime } from './src/firebase/runtime';
import { PhaseOneNavigator } from './src/navigation/PhaseOneNavigator';

const App = () => {
  let configError;
  try { getFirebaseRuntime(); } catch (error) { configError = error.message; }
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      {configError ? <View style={styles.configurationError}>
        <Text accessibilityRole="header">Chưa cấu hình được FoodOrderNext</Text>
        <Text>{configError}</Text>
      </View> : <SessionProvider><PhaseOneNavigator /></SessionProvider>}
    </SafeAreaProvider>
  );
};
const styles = StyleSheet.create({ configurationError: { padding: 32, paddingTop: 80 } });
export default App;
