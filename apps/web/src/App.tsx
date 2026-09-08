import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './routes/login';
import AppLayout from './routes/app/layout';
import DashboardPage from './routes/app/dashboard';
import { ProtectedRoute } from './components/auth/protected-route';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
        </Route>
        <Route path="/" element={<Navigate to="/app" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
