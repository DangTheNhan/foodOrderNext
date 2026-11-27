import React from 'react';
import { View, TextInput as RNTextInput, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Theme } from '../../theme';

export const SearchBar = ({
  value,
  onChangeText,
  onFilterPress,
  placeholder = 'Search...',
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <Icon name="search" size={24} color={Theme.colors.text.secondary} style={styles.searchIcon} />
        <RNTextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Theme.colors.text.secondary}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
      {onFilterPress && (
        <TouchableOpacity style={styles.filterButton} onPress={onFilterPress} activeOpacity={0.8}>
          <Icon name="options-outline" size={24} color={Theme.colors.surface.light} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing.xl,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surface.light,
    borderRadius: Theme.radius.pill,
    paddingHorizontal: Theme.spacing.l,
    height: 60,
    ...Theme.shadows.medium,
  },
  searchIcon: {
    marginRight: Theme.spacing.m,
  },
  input: {
    flex: 1,
    ...Theme.typography.body1,
    color: Theme.colors.text.primaryLight,
    fontWeight: '500',
    height: '100%',
  },
  filterButton: {
    marginLeft: Theme.spacing.m,
    backgroundColor: Theme.colors.primary,
    height: 60,
    width: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    ...Theme.shadows.medium,
  },
});
