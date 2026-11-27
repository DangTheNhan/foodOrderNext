export const ValidationRules = {
  email: {
    required: 'Email is required',
    pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email format' }
  },
  password: {
    required: 'Password is required',
    minLength: { value: 8, message: 'Password must be at least 8 characters' }
  },
  name: {
    required: 'Full name is required',
    minLength: { value: 2, message: 'Name must be at least 2 characters' }
  },
  otp: {
    required: 'Verification code is required',
    length: 6,
    pattern: { value: /^\d{6}$/, message: 'Code must be exactly 6 digits' }
  }
};