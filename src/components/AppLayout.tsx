import { useCallback, useState } from "react";
import toast from "react-hot-toast";
import type { IconType } from "react-icons";
import {
  FiBell,
  FiCalendar,
  FiClock,
  FiCreditCard,
  FiDollarSign,
  FiFileText,
  FiHome,
  FiLayers,
  FiMapPin,
  FiScissors,
  FiSettings,
  FiUser,
  FiUsers,
  FiUserPlus
} from "react-icons/fi";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useBookingRealtime } from "../realtime/useBookingRealtime";

interface SidebarLink {
  to: string;
  label: string;
  icon: IconType;
}

const links = [
  { to: "/dashboard", label: "Dashboard", icon: FiHome },
  { to: "/branches", label: "Branches", icon: FiMapPin },
  { to: "/customers", label: "Clients", icon: FiUsers },
  { to: "/services", label: "Services", icon: FiScissors },
  { to: "/invoice", label: "Invoice", icon: FiFileText },
  { to: "/pos", label: "POS", icon: FiCreditCard },
  { to: "/users", label: "Users", icon: FiUsers },
  { to: "/leaves", label: "Leaves", icon: FiLayers },
  { to: "/offers", label: "Offers", icon: FiDollarSign },
  { to: "/time-slots", label: "Time Slots", icon: FiClock },
  { to: "/settings", label: "Profile", icon: FiSettings }
] satisfies SidebarLink[];

const dashboardLink = links[0];
const primaryLinks = links.slice(1);

const bookingDropdownLinks = [
  { to: "/bookings", label: "Booking", icon: FiCalendar },
  { to: "/add-booking", label: "Add Booking", icon: FiUserPlus },
  { to: "/expired-bookings", label: "Expired Booking", icon: FiClock }
] satisfies SidebarLink[];

function pageTitle(pathname: string) {
  if (pathname.startsWith("/dashboard")) return "Dashboard";
  if (pathname.startsWith("/add-booking")) return "Add Booking";
  if (pathname.startsWith("/bookings/edit")) return "Edit Booking";
  if (pathname.startsWith("/bookings")) return "Bookings";
  if (pathname.startsWith("/expired-bookings")) return "Expired Bookings";
  if (pathname.startsWith("/customers")) return "Clients";
  if (pathname.startsWith("/services")) return "Services";
  if (pathname.startsWith("/pos")) return "Point of Sale";
  if (pathname.startsWith("/users")) return "Users";
  if (pathname.startsWith("/leaves")) return "Leaves";
  if (pathname.startsWith("/offers")) return "Offers";
  if (pathname.startsWith("/time-slots")) return "Time Slots";
  if (pathname.startsWith("/invoice")) return "Invoice";
  if (pathname.startsWith("/settings")) return "Profile";
  if (pathname.startsWith("/branches")) return "Branches";
  return "Neeri's Cleopatra";
}

export default function AppLayout() {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const [collapsed, setCollapsed] = useState(false);
  const [bookingMenuOpen, setBookingMenuOpen] = useState(true);
  const isPosRoute = location.pathname === "/pos";
  const isBookingRoute = bookingDropdownLinks.some((link) => location.pathname === link.to) || location.pathname.startsWith("/bookings/edit");

  const handleCheckUpdates = async () => {
    if (!window.desktopApi?.checkForUpdates) {
      toast.error("Updates are managed by the desktop app.");
      return;
    }
    const result = await window.desktopApi.checkForUpdates();
    if (result.ok) {
      toast.success("Checking for updates…");
    } else {
      toast.error(result.message ?? "Could not check for updates");
    }
  };

  const handleBookingCreated = useCallback(async () => {
    const AudioCtx =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      const context = new AudioCtx();
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = 920;
      gainNode.gain.value = 0.08;
      oscillator.connect(gainNode);
      gainNode.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.18);
      oscillator.onended = () => {
        void context.close();
      };
    }

    toast.success("New booking arrived");
    if (typeof window.desktopApi?.notify === "function") {
      await window.desktopApi.notify({
        title: "New booking arrived",
        body: "Please check the Bookings page."
      });
    }
  }, []);

  useBookingRealtime({
    token,
    role: user?.role,
    branchId: user?.branch_id,
    onBookingCreated: handleBookingCreated
  });

  const roleLabel = (user?.role ?? "User").replace(/_/g, " ");

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--neeri-cream)]">
      <aside
        className={`flex h-full flex-col border-r border-[#ebe4da] bg-gradient-to-b from-white via-[#fffaf5] to-[#f5e6d4] shadow-[4px_0_24px_rgba(42,31,24,0.04)] transition-all duration-300 ${
          collapsed ? "w-20" : "w-64"
        }`}
      >
        <div className="px-4 pb-3 pt-4">
          <div className="mb-3 flex justify-end">
            <button
              type="button"
              className="rounded-lg border border-[#e5d9cb] bg-white/80 px-2 py-1 text-xs font-semibold text-[#5c5046]"
              onClick={() => setCollapsed((prev) => !prev)}
            >
              {collapsed ? ">>" : "<<"}
            </button>
          </div>
          <div className={`flex items-center ${collapsed ? "justify-center" : "gap-3"}`}>
            <img
              src={import.meta.env.VITE_INVOICE_LOGO_URL ?? "assets/images/logo.png"}
              alt="Neeri logo"
              className="h-11 w-11 shrink-0 rounded-full border border-[#e8d48b] bg-white object-contain p-1 shadow-sm"
            />
            {!collapsed ? (
              <div className="min-w-0">
                <p className="font-display truncate text-lg font-semibold leading-tight text-[#2a1f18]">
                  Neeri&apos;s Cleopatra
                </p>
                <p className="truncate text-[11px] font-medium uppercase tracking-wide text-[#8a7b6d]">
                  Hair & Beauty
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="sidebar-scroll flex-1 overflow-y-auto px-3 pb-4">
          <nav className="space-y-1.5 pt-1">
            <Link
              to={dashboardLink.to}
              className={`nav-item ${location.pathname === dashboardLink.to ? "nav-item-active" : ""} ${
                collapsed ? "justify-center" : "gap-2.5"
              }`}
              title={collapsed ? dashboardLink.label : undefined}
            >
              <dashboardLink.icon className="shrink-0 text-base" />
              {!collapsed && <span>{dashboardLink.label}</span>}
            </Link>

            <div>
              <button
                type="button"
                onClick={() => setBookingMenuOpen((prev) => !prev)}
                className={`nav-item ${isBookingRoute ? "nav-item-active" : ""} ${
                  collapsed ? "justify-center" : "gap-2.5"
                }`}
                title={collapsed ? "Bookings" : undefined}
              >
                <FiCalendar className="shrink-0 text-base" />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left">Booking</span>
                    <span className="text-xs opacity-70">{bookingMenuOpen ? "▾" : "▸"}</span>
                  </>
                )}
              </button>

              {!collapsed && bookingMenuOpen ? (
                <div className="mt-1 ml-3 space-y-1 border-l border-[#e5d9cb] pl-3">
                  {bookingDropdownLinks.map((link) => {
                    const active = location.pathname === link.to;
                    return (
                      <Link
                        key={link.to}
                        to={link.to}
                        className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium transition ${
                          active
                            ? "bg-white text-[#2a1f18] shadow-sm ring-1 ring-[#c9a227]/30"
                            : "text-[#6b5e52] hover:bg-white/70 hover:text-[#2a1f18]"
                        }`}
                      >
                        <link.icon className="shrink-0 text-sm" />
                        <span>{link.label}</span>
                      </Link>
                    );
                  })}
                </div>
              ) : null}

              {collapsed && isBookingRoute
                ? bookingDropdownLinks.map((link) => (
                    <Link
                      key={link.to}
                      to={link.to}
                      className={`nav-item mt-1 justify-center ${
                        location.pathname === link.to ? "nav-item-active" : ""
                      }`}
                      title={link.label}
                    >
                      <link.icon className="shrink-0 text-base" />
                    </Link>
                  ))
                : null}
            </div>

            {primaryLinks.map((link) => {
              const active = location.pathname === link.to || location.pathname.startsWith(`${link.to}/`);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`nav-item ${active ? "nav-item-active" : ""} ${
                    collapsed ? "justify-center" : "gap-2.5"
                  }`}
                  title={collapsed ? link.label : undefined}
                >
                  <link.icon className="shrink-0 text-base" />
                  {!collapsed && <span>{link.label}</span>}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-[#ebe4da] p-4">
          <button onClick={() => void logout()} className="btn-danger w-full">
            {collapsed ? "Out" : "Logout"}
          </button>
        </div>
      </aside>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center justify-between border-b border-[#ebe4da] bg-white/90 px-6 py-3.5 backdrop-blur">
          <div>
            <h2 className="text-lg font-semibold text-[#2a1f18]">{pageTitle(location.pathname)}</h2>
            <p className="text-xs text-[#8a7b6d]">Neeri&apos;s Cleopatra Hair & Beauty</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#ebe4da] bg-white text-[#5c5046] hover:bg-[#faf7f2]"
              onClick={() => void handleCheckUpdates()}
              title="Check for updates"
            >
              <FiBell />
            </button>
            <div className="flex items-center gap-2 rounded-full border border-[#ebe4da] bg-[#faf7f2] py-1.5 pl-1.5 pr-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#c9a227]/20 text-[#8a6b12]">
                <FiUser />
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide text-[#5c5046]">{roleLabel}</span>
            </div>
          </div>
        </div>
        <div
          className={
            isPosRoute
              ? "min-h-0 flex-1 overflow-hidden p-2 md:p-3"
              : "min-h-0 flex-1 overflow-y-auto p-3 pb-4 md:p-6 md:pb-8"
          }
        >
          <Outlet />
        </div>
      </main>
    </div>
  );
}
