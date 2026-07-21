import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import PageLoader from "./components/PageLoader";
import ProtectedRoute from "./components/ProtectedRoute";
import { useAuthStore } from "./store/authStore";

const LoginPage = lazy(() => import("./pages/LoginPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const PosPage = lazy(() => import("./pages/PosPage"));
const ServicesPage = lazy(() => import("./pages/ServicesPage"));
const BookingsPage = lazy(() => import("./pages/BookingsPage"));
const CustomersPage = lazy(() => import("./pages/CustomersPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const AddBookingPage = lazy(() => import("./pages/AddBookingPage"));
const EditBookingPage = lazy(() => import("./pages/EditBookingPage"));
const SimplePage = lazy(() => import("./pages/SimplePage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const LeavesPage = lazy(() => import("./pages/LeavesPage"));
const OffersPage = lazy(() => import("./pages/OffersPage"));
const TimeSlotsPage = lazy(() => import("./pages/TimeSlotsPage"));
const InvoicesPage = lazy(() => import("./pages/InvoicesPage"));
const InvoicePrintPage = lazy(() => import("./pages/InvoicePrintPage"));

function LazyPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

export default function App() {
  const init = useAuthStore((s) => s.init);
  useEffect(() => {
    void init();
  }, []);

  return (
    <Routes>
      <Route
        path="/login"
        element={
          <LazyPage>
            <LoginPage />
          </LazyPage>
        }
      />
      <Route
        path="/pos"
        element={
          <ProtectedRoute>
            <LazyPage>
              <PosPage />
            </LazyPage>
          </ProtectedRoute>
        }
      />
      <Route
        path="/invoice/:id/print"
        element={
          <ProtectedRoute>
            <LazyPage>
              <InvoicePrintPage />
            </LazyPage>
          </ProtectedRoute>
        }
      />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route
          path="/dashboard"
          element={
            <LazyPage>
              <DashboardPage />
            </LazyPage>
          }
        />
        <Route
          path="/add-booking"
          element={
            <LazyPage>
              <AddBookingPage />
            </LazyPage>
          }
        />
        <Route
          path="/bookings/edit/:id"
          element={
            <LazyPage>
              <EditBookingPage />
            </LazyPage>
          }
        />
        <Route
          path="/branches"
          element={
            <LazyPage>
              <SimplePage title="Branches" description="Branch management page is ready for API integration." />
            </LazyPage>
          }
        />
        <Route
          path="/expired-bookings"
          element={
            <LazyPage>
              <SimplePage title="Expired Booking" description="Track and manage expired bookings here." />
            </LazyPage>
          }
        />
        <Route
          path="/services"
          element={
            <LazyPage>
              <ServicesPage />
            </LazyPage>
          }
        />
        <Route
          path="/bookings"
          element={
            <LazyPage>
              <BookingsPage />
            </LazyPage>
          }
        />
        <Route
          path="/customers"
          element={
            <LazyPage>
              <CustomersPage />
            </LazyPage>
          }
        />
        <Route
          path="/users"
          element={
            <LazyPage>
              <UsersPage />
            </LazyPage>
          }
        />
        <Route
          path="/leaves"
          element={
            <LazyPage>
              <LeavesPage />
            </LazyPage>
          }
        />
        <Route
          path="/offers"
          element={
            <LazyPage>
              <OffersPage />
            </LazyPage>
          }
        />
        <Route
          path="/time-slots"
          element={
            <LazyPage>
              <TimeSlotsPage />
            </LazyPage>
          }
        />
        <Route
          path="/invoice"
          element={
            <LazyPage>
              <InvoicesPage />
            </LazyPage>
          }
        />
        <Route
          path="/settings"
          element={
            <LazyPage>
              <SettingsPage />
            </LazyPage>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
