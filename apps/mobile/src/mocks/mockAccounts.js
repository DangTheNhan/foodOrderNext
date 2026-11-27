// Mock accounts for testing login flow without a real backend.
// Xoá file này khi backend thật đã sẵn sàng.

export const MOCK_ACCOUNTS = [
  {
    email: 'test@example.com',
    password: '123456',
    token: 'mock-token-user-001',
    user: { id: 1, name: 'Test User', email: 'test@example.com' },
  },
  {
    email: 'admin@example.com',
    password: 'admin123',
    token: 'mock-token-admin-001',
    user: { id: 2, name: 'Admin User', email: 'admin@example.com' },
  },
];

export const mockLogin = (email, password) => {
  const account = MOCK_ACCOUNTS.find(
    acc => acc.email.toLowerCase() === email.toLowerCase() && acc.password === password
  );

  if (!account) {
    // Simulate the same error shape a real API would return
    const error = new Error('Invalid email or password');
    throw error;
  }

  return {
    data: {
      token: account.token,
      user: account.user,
    },
  };
};