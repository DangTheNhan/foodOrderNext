import React, { useState } from 'react';
import { TextInput } from './TextInput';
import { Theme } from '../../theme';
import Icon from 'react-native-vector-icons/Ionicons';

export const PasswordInput = (props) => {
  const [isSecure, setIsSecure] = useState(true);

  const toggleSecure = () => {
    setIsSecure((prev) => !prev);
  };

  return (
    <TextInput
      {...props}
      secureTextEntry={isSecure}
      rightIcon={
        <Icon 
          name={isSecure ? 'eye-outline' : 'eye-off-outline'} 
          size={24} 
          color={Theme.colors.text.secondary} 
        />
      }
      onRightIconPress={toggleSecure}
    />
  );
};
