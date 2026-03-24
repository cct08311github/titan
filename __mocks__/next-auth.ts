// Mock next-auth for tests
const mockSession = {
  user: {
    id: "user-1",
    name: "Test User",
    email: "test@example.com",
    role: "MEMBER",
  },
  expires: "2099-01-01",
};

export const getServerSession = jest.fn(() => Promise.resolve(mockSession));

export const useSession = jest.fn(() => ({
  data: mockSession,
  status: "authenticated",
}));

export const signIn = jest.fn();
export const signOut = jest.fn();

export default {
  getServerSession,
  useSession,
  signIn,
  signOut,
};
