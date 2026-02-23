import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import MealLog from './pages/MealLog';
import Goals from './pages/Goals';
import Preferences from './pages/Preferences';
import Sharing from './pages/Sharing';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/onboarding" element={<Onboarding />} />
            <Route element={<Navbar />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/log" element={<MealLog />} />
              <Route path="/goals" element={<Goals />} />
              <Route path="/preferences" element={<Preferences />} />
              <Route path="/sharing" element={<Sharing />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
