import { useState } from 'react';
export const usePasswordVisibility = () => {
  const [isSecure, setIsSecure] = useState(true);
  const toggleVisibility = () => setIsSecure(prev => !prev);
  return { isSecure, toggleVisibility };
};