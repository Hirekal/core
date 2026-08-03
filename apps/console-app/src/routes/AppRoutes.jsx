import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute, { PublicRoute, HomeRedirect } from './ProtectedRoute';
import Navbar from '../components/layout/Navbar';

import LoginPage from '../pages/auth/LoginPage';
import SignUpPage from '../pages/auth/SignUpPage';
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage';
import ResetPasswordPage from '../pages/auth/ResetPasswordPage';
import VerifyEmailPage from '../pages/auth/VerifyEmailPage';

import JobListingPage from '../pages/jobs/JobListingPage';
import JobDetailPage from '../pages/jobs/JobDetailPage';
import AddEditJobPage from '../pages/jobs/AddEditJobPage';
import ApplicationPreviewPage from '../pages/jobs/ApplicationPreviewPage';
import PublicApplyPage from '../pages/jobs/PublicApplyPage';
import JobSettingsPage from '../pages/jobs/JobSettingsPage';
import JobSettingsThankYouPage from '../pages/jobs/JobSettingsThankYouPage';
import JobSettingsStagesPage from '../pages/jobs/JobSettingsStagesPage';
import JobSettingsWebhookPage from '../pages/jobs/JobSettingsWebhookPage';
import JobSettingsEmailAutomationPage from '../pages/jobs/JobSettingsEmailAutomationPage';
import NotificationsPage from '../pages/notifications/NotificationsPage';
import OrganizationPage from '../pages/organization/OrganizationPage';
import ProfileSettingsPage from '../pages/profile/ProfileSettingsPage';

function AppLayout({ children }) {
  return (
    <div className="min-h-screen bg-surface">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/signup" element={<PublicRoute><SignUpPage /></PublicRoute>} />
      <Route path="/verify-email" element={<PublicRoute><VerifyEmailPage /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
      <Route path="/reset-password" element={<PublicRoute><ResetPasswordPage /></PublicRoute>} />

      <Route
        path="/jobs"
        element={
          <ProtectedRoute>
            <AppLayout><JobListingPage /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/jobs/new"
        element={
          <ProtectedRoute>
            <AppLayout><AddEditJobPage /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route path="/jobs/:id/preview" element={<ApplicationPreviewPage />} />
      <Route path="/j/:slug" element={<PublicApplyPage />} />
      <Route
        path="/jobs/:id/edit"
        element={
          <ProtectedRoute>
            <AppLayout><AddEditJobPage /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/jobs/:id/settings"
        element={
          <ProtectedRoute>
            <AppLayout><JobSettingsPage /></AppLayout>
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="thank-you" replace />} />
        <Route path="thank-you" element={<JobSettingsThankYouPage />} />
        <Route path="stages" element={<JobSettingsStagesPage />} />
        <Route path="email-automation" element={<JobSettingsEmailAutomationPage />} />
        <Route path="webhook" element={<JobSettingsWebhookPage />} />
      </Route>
      <Route
        path="/jobs/:id"
        element={
          <ProtectedRoute>
            <AppLayout><JobDetailPage /></AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/candidates"
        element={<Navigate to="/jobs" replace />}
      />
      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <AppLayout><NotificationsPage /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/organization"
        element={
          <ProtectedRoute>
            <AppLayout><OrganizationPage /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <AppLayout><ProfileSettingsPage /></AppLayout>
          </ProtectedRoute>
        }
      />

      <Route path="/" element={<HomeRedirect />} />
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}
