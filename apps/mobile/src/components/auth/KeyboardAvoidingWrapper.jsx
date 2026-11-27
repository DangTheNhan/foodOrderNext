import React from 'react';
import { KeyboardAvoidingView, ScrollView, Platform, StyleSheet, TouchableWithoutFeedback, Keyboard } from 'react-native';

export const KeyboardAvoidingWrapper = ({ children }) => (
  <KeyboardAvoidingView
    style={styles.container}
    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
  >
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {children}
      </ScrollView>
    </TouchableWithoutFeedback>
  </KeyboardAvoidingView>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: 40 }
});