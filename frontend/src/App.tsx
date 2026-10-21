import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ResourcesPage } from "./pages/member/ResourcesPage";
import { MyBookingsPage } from "./pages/member/MyBookingsPage";
import { ResourcesAdminPage } from "./pages/admin/ResourcesAdminPage";
import { ResourceTypesAdminPage } from "./pages/admin/ResourceTypesAdminPage";
import { BookingsAdminPage } from "./pages/admin/BookingsAdminPage";
import { OccupancyPage } from "./pages/admin/OccupancyPage";
import { UsersAdminPage } from "./pages/admin/UsersAdminPage";
import { SensorsAdminPage } from "./pages/admin/SensorsAdminPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route
              path="/resources"
              element={
                <ProtectedRoute requireAdmin={false}>
                  <ResourcesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-bookings"
              element={
                <ProtectedRoute requireAdmin={false}>
                  <MyBookingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/resources"
              element={
                <ProtectedRoute requireAdmin>
                  <ResourcesAdminPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/resource-types"
              element={
                <ProtectedRoute requireAdmin>
                  <ResourceTypesAdminPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/bookings"
              element={
                <ProtectedRoute requireAdmin>
                  <BookingsAdminPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/occupancy"
              element={
                <ProtectedRoute requireAdmin>
                  <OccupancyPage />
                </ProtectedRoute>
              }
            />
             <Route
              path="/admin/sensors"
              element={
                <ProtectedRoute requireAdmin>
                  <SensorsAdminPage />
                </ProtectedRoute>
              }
              />
            <Route path="/admin/users" element={<ProtectedRoute requireAdmin><UsersAdminPage /></ProtectedRoute>} />
          </Route>

          <Route path="*" element={<Navigate to="/resources" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
