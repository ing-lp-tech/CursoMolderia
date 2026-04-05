import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import LandingPage from './pages/LandingPage';
import TemarioPage from './pages/TemarioPage';
import VentajasPage from './pages/VentajasPage';
import InscripcionPage from './pages/InscripcionPage';
import LoginPage from './pages/LoginPage';

// Lazy-loaded: admin panel y portal del estudiante (no se descargan hasta que se necesitan)
const AdminLayout      = lazy(() => import('./pages/admin/AdminLayout'));
const AdminDashboard   = lazy(() => import('./pages/admin/AdminDashboard'));
const EstudiantesPage  = lazy(() => import('./pages/admin/EstudiantesPage'));
const FinanzasPage     = lazy(() => import('./pages/admin/FinanzasPage'));
const TablreroKanban   = lazy(() => import('./pages/admin/TablreroKanban'));
const CuponesPage      = lazy(() => import('./pages/admin/CuponesPage'));
const CertificadosPage = lazy(() => import('./pages/admin/CertificadosPage'));
const RecursosPage     = lazy(() => import('./pages/admin/RecursosPage'));
const StudentPortal    = lazy(() => import('./pages/student/StudentPortal'));

function PublicLayout({ children }) {
  return (
    <div className="relative min-h-screen w-full overflow-x-hidden">
      <Navbar />
      <div className="pb-20 md:pb-0">{children}</div>
    </div>
  );
}

function AdminFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0f0f1a]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#b89fff] border-t-transparent rounded-full animate-spin" />
        <p className="text-[#b89fff] text-sm">Cargando...</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes — carga inmediata */}
          <Route path="/" element={<PublicLayout><LandingPage /></PublicLayout>} />
          <Route path="/temario" element={<PublicLayout><TemarioPage /></PublicLayout>} />
          <Route path="/ventajas" element={<PublicLayout><VentajasPage /></PublicLayout>} />
          <Route path="/inscripcion" element={<PublicLayout><InscripcionPage /></PublicLayout>} />
          <Route path="/login" element={<PublicLayout><LoginPage /></PublicLayout>} />

          {/* Student portal — lazy */}
          <Route
            path="/portal"
            element={
              <Suspense fallback={<AdminFallback />}>
                <StudentPortal />
              </Suspense>
            }
          />

          {/* Admin routes — lazy */}
          <Route
            path="/admin"
            element={
              <Suspense fallback={<AdminFallback />}>
                <AdminLayout />
              </Suspense>
            }
          >
            <Route index element={<Suspense fallback={<AdminFallback />}><AdminDashboard /></Suspense>} />
            <Route path="estudiantes" element={<Suspense fallback={<AdminFallback />}><EstudiantesPage /></Suspense>} />
            <Route path="finanzas" element={<Suspense fallback={<AdminFallback />}><FinanzasPage /></Suspense>} />
            <Route path="recursos"     element={<Suspense fallback={<AdminFallback />}><RecursosPage /></Suspense>} />
            <Route path="cupones"      element={<Suspense fallback={<AdminFallback />}><CuponesPage /></Suspense>} />
            <Route path="certificados" element={<Suspense fallback={<AdminFallback />}><CertificadosPage /></Suspense>} />
            <Route path="tablero"      element={<Suspense fallback={<AdminFallback />}><TablreroKanban /></Suspense>} />
          </Route>

          {/* Catch-all → home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
