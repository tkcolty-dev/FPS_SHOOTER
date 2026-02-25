import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BoothProvider } from './context/BoothContext';
import Login from './pages/Login';
import Register from './pages/Register';
import BoothList from './pages/BoothList';
import NewBooth from './pages/NewBooth';
import Dashboard from './pages/Dashboard';
import LogOrder from './pages/LogOrder';
import OrderHistory from './pages/OrderHistory';
import Settings from './pages/Settings';

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AuthRoute({ children }) {
  const { user } = useAuth();
  if (user) return <Navigate to="/booths" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<AuthRoute><Login /></AuthRoute>} />
      <Route path="/register" element={<AuthRoute><Register /></AuthRoute>} />
      <Route path="/booths" element={<ProtectedRoute><BoothList /></ProtectedRoute>} />
      <Route path="/booths/new" element={<ProtectedRoute><NewBooth /></ProtectedRoute>} />
      <Route path="/booth/:boothId" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/booth/:boothId/order" element={<ProtectedRoute><LogOrder /></ProtectedRoute>} />
      <Route path="/booth/:boothId/order/:orderId" element={<ProtectedRoute><LogOrder /></ProtectedRoute>} />
      <Route path="/booth/:boothId/orders" element={<ProtectedRoute><OrderHistory /></ProtectedRoute>} />
      <Route path="/booth/:boothId/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/booths" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <BoothProvider>
          <div className="app">
            <AppRoutes />
          </div>
        </BoothProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
