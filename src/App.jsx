import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import LandingPage from './pages/LandingPage';
import TemarioPage from './pages/TemarioPage';
import VentajasPage from './pages/VentajasPage';
import InscripcionPage from './pages/InscripcionPage';
import LoginPage from './pages/LoginPage';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import EstudiantesPage from './pages/admin/EstudiantesPage';
import FinanzasPage from './pages/admin/FinanzasPage';
import TablreroKanban from './pages/admin/TablreroKanban';
import StudentPortal from './pages/student/StudentPortal';

function PublicLayout({ children }) {
  return (
    <>
      <Navbar />
      <div className="pb-20 md:pb-0">{children}</div>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<PublicLayout><LandingPage /></PublicLayout>} />
          <Route path="/temario" element={<PublicLayout><TemarioPage /></PublicLayout>} />
          <Route path="/ventajas" element={<PublicLayout><VentajasPage /></PublicLayout>} />
          <Route path="/inscripcion" element={<PublicLayout><InscripcionPage /></PublicLayout>} />
          <Route path="/login" element={<PublicLayout><LoginPage /></PublicLayout>} />

          {/* Student portal */}
          <Route path="/portal" element={<StudentPortal />} />

          {/* Admin routes */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="estudiantes" element={<EstudiantesPage />} />
            <Route path="finanzas" element={<FinanzasPage />} />
            <Route path="tablero" element={<TablreroKanban />} />
          </Route>

          {/* Catch-all → home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
