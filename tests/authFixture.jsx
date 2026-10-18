import { AuthContext } from '../src/context/AuthContext'
// Explicit authenticated fixture for isolated application UI suites.
export default function AuthFixture({ children }) {
  return <AuthContext.Provider value={{ user: { id: 'fixture-user', name: 'Fixture', email: 'fixture@example.com' }, accessToken: 'fixture-token', isAuthenticated: true, isAuthLoading: false, logout: () => {} }}>{children}</AuthContext.Provider>
}
