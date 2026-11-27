import { useState } from 'react';
export const useFormValidation = () => {
  const [errors, setErrors] = useState({});
  
  const validateField = (field, value, rules) => {
    let error = null;
    if (rules.required && !value) {
      error = rules.required;
    } else if (rules.pattern && !rules.pattern.value.test(value)) {
      error = rules.pattern.message;
    } else if (rules.minLength && value.length < rules.minLength.value) {
      error = rules.minLength.message;
    } else if (rules.length && value.length !== rules.length) {
      error = rules.lengthMessage || `Must be ${rules.length} characters`;
    }
    
    setErrors(prev => ({ ...prev, [field]: error }));
    return !error;
  };

  const clearErrors = () => setErrors({});

  return { errors, setErrors, validateField, clearErrors };
};