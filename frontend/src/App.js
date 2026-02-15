import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { CreditsProvider } from "./contexts/CreditsContext";
import InsufficientCreditsModal from "./components/modals/InsufficientCreditsModal";

// Pages
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import InviteRegisterPage from "./pages/InviteRegisterPage";
import MeetingsPage from "./pages/MeetingsPage";
import ProjectPage from "./pages/ProjectPage";
import DocumentsPage from "./pages/DocumentsPage";
import DocProjectPage from "./pages/DocProjectPage";
import ConstructorPage from "./pages/ConstructorPage";
import PipelineEditorPage from "./pages/PipelineEditorPage";
import SpeakerDirectoryPage from "./pages/SpeakerDirectoryPage";
import AdminPage from "./pages/AdminPage";
import OrgDetailPage from "./pages/OrgDetailPage";
import OrgAdminDashboard from "./pages/OrgAdminDashboard";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import BillingPage from "./pages/BillingPage";

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" /></div>;
  if (!user) return <Navigate to="/" replace />;
  return children;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" /></div>;
  if (user) return <Navigate to="/meetings" replace />;
  return children;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<PublicRoute><LandingPage /></PublicRoute>} />
      <Route path="/login" element={<PublicRoute><AuthPage /></PublicRoute>} />
      <Route path="/invite/:token" element={<InviteRegisterPage />} />
      <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
      <Route path="/meetings" element={<ProtectedRoute><MeetingsPage /></ProtectedRoute>} />
      <Route path="/meetings/speakers" element={<ProtectedRoute><SpeakerDirectoryPage /></ProtectedRoute>} />
      <Route path="/projects/:projectId" element={<ProtectedRoute><ProjectPage /></ProtectedRoute>} />
      <Route path="/documents" element={<ProtectedRoute><DocumentsPage /></ProtectedRoute>} />
      <Route path="/documents/:projectId" element={<ProtectedRoute><DocProjectPage /></ProtectedRoute>} />
      <Route path="/constructor" element={<ProtectedRoute><ConstructorPage /></ProtectedRoute>} />
      <Route path="/pipelines/new" element={<ProtectedRoute><PipelineEditorPage /></ProtectedRoute>} />
      <Route path="/pipelines/:pipelineId" element={<ProtectedRoute><PipelineEditorPage /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
      <Route path="/admin/org/:orgId" element={<ProtectedRoute><OrgDetailPage /></ProtectedRoute>} />
      <Route path="/admin/analytics" element={<ProtectedRoute><OrgAdminDashboard /></ProtectedRoute>} />
      <Route path="/billing" element={<ProtectedRoute><BillingPage /></ProtectedRoute>} />
      {/* Redirects for old routes */}
      <Route path="/dashboard" element={<Navigate to="/meetings" replace />} />
      <Route path="/prompts" element={<Navigate to="/constructor?tab=prompts" replace />} />
      <Route path="/speakers" element={<Navigate to="/meetings/speakers" replace />} />
      <Route path="/pipelines" element={<Navigate to="/constructor?tab=pipelines" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <CreditsProvider>
          <AppRoutes />
          <InsufficientCreditsModal />
          <Toaster position="top-right" richColors />
        </CreditsProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
