import { useState,useCallback } from "react";
import toast from "react-hot-toast";
import type { IconType } from "react-icons";
import {
  FiCalendar,
  FiClock,
  FiCreditCard,
  FiDollarSign,
  FiFileText,
  FiHome,
  FiLayers,
  FiScissors,
  FiSettings,
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
  { to: "/customers", label: "Clients", icon: FiUsers },
  { to: "/services", label: "Services", icon: FiScissors },
  { to: "/pos", label: "POS", icon: FiCreditCard },
  { to: "/users", label: "Users", icon: FiUsers },
  { to: "/leaves", label: "Leaves", icon: FiLayers },
  { to: "/offers", label: "Offers", icon: FiDollarSign },
  { to: "/time-slots", label: "Time Slots", icon: FiClock },
  { to: "/invoice", label: "Invoice", icon: FiFileText },
  { to: "/settings", label: "Profile", icon: FiSettings }
] satisfies SidebarLink[];
const dashboardLink = links[0];
const primaryLinks = links.slice(1);

const bookingDropdownLinks = [
  { to: "/bookings", label: "Booking", icon: FiCalendar },
  { to: "/add-booking", label: "Add Booking", icon: FiUserPlus },
  { to: "/expired-bookings", label: "Expired Booking", icon: FiClock }
] satisfies SidebarLink[];

function navItemClass(active: boolean, collapsed: boolean) {
  return `flex w-full items-center rounded-xl px-3 py-2.5 text-sm font-medium transition ${
    active
      ? "bg-white text-[#473e36] shadow-lg"
      : "text-white/95 hover:bg-white/10 hover:text-white"
  } ${collapsed ? "justify-center" : "gap-2"}`;
}

export default function AppLayout() {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const [collapsed, setCollapsed] = useState(false);
  const [bookingMenuOpen, setBookingMenuOpen] = useState(true);
  const isPosRoute = location.pathname === "/pos";
  const isBookingRoute = bookingDropdownLinks.some((link) => location.pathname === link.to);

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

  const realtime = useBookingRealtime({
    token,
    role: user?.role,
    branchId: user?.branch_id,
    onBookingCreated: handleBookingCreated
  });

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <aside
        className={`flex h-full flex-col bg-gradient-to-b from-[#5f4d40] via-[#58473a] to-[#43352c] text-white shadow-2xl transition-all duration-300 ${
          collapsed ? "w-20" : "w-64"
        }`}
      >
        <div className="px-4 pb-4 pt-4">
          <div className="mb-3 flex justify-end">
            <button
              className="rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-xs font-semibold"
              onClick={() => setCollapsed((prev) => !prev)}
            >
              {collapsed ? ">>" : "<<"}
            </button>
          </div>
          <div className="rounded-xl border border-white/15 bg-white/5 px-3 py-3">
            <div className={`flex items-center ${collapsed ? "justify-center" : "gap-3"}`}>
              <img
                src={import.meta.env.VITE_INVOICE_LOGO_URL ?? "assets/images/logo.png"}
                alt="Neeri logo"
                className="h-10 w-10 shrink-0 rounded-lg bg-white/90 p-1 object-contain"
              />
              {!collapsed ? (
                <div className="min-w-0">
                  <p className="truncate text-base font-bold tracking-wide">Neeri Salon POS</p>
                  <p className="truncate text-xs text-white/70">Salon Management Suite</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <div className="sidebar-scroll flex-1 overflow-y-auto px-3 pb-4">
          <nav className="space-y-1.5 pt-1">
            <Link
              to={dashboardLink.to}
              className={navItemClass(location.pathname === dashboardLink.to, collapsed)}
              title={collapsed ? dashboardLink.label : undefined}
            >
              <dashboardLink.icon className="shrink-0 text-base" />
              {!collapsed && <span>{dashboardLink.label}</span>}
            </Link>

            <div>
              <button
                type="button"
                onClick={() => setBookingMenuOpen((prev) => !prev)}
                className={`flex w-full items-center rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  collapsed
                    ? isBookingRoute
                      ? "justify-center bg-white text-[#473e36] shadow-lg"
                      : "justify-center text-white/95 hover:bg-white/10 hover:text-white"
                    : isBookingRoute
                      ? "gap-2 bg-white/15 text-white hover:bg-white/20"
                      : "gap-2 text-white/95 hover:bg-white/10 hover:text-white"
                }`}
                title={collapsed ? "Bookings" : undefined}
              >
                <FiCalendar className="shrink-0 text-base" />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left">Bookings</span>
                    <span className="text-xs opacity-80">{bookingMenuOpen ? "▾" : "▸"}</span>
                  </>
                )}
              </button>

              {!collapsed && bookingMenuOpen ? (
                <div className="mt-1 ml-4 space-y-1 border-l border-white/25 pl-3">
                  {bookingDropdownLinks.map((link) => {
                    const active = location.pathname === link.to;
                    return (
                      <Link
                        key={link.to}
                        to={link.to}
                        className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium transition ${
                          active
                            ? "bg-white text-[#473e36] shadow"
                            : "text-white/85 hover:bg-white/10 hover:text-white"
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
                      className={`${navItemClass(location.pathname === link.to, true)} mt-1`}
                      title={link.label}
                    >
                      <link.icon className="shrink-0 text-base" />
                    </Link>
                  ))
                : null}
            </div>

            {primaryLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={navItemClass(location.pathname === link.to, collapsed)}
                title={collapsed ? link.label : undefined}
              >
                <link.icon className="shrink-0 text-base" />
                {!collapsed && <span>{link.label}</span>}
              </Link>
            ))}
          </nav>
        </div>
        <div className="border-t border-white/10 p-4">
          <button onClick={() => void logout()} className="btn-danger w-full">
            {collapsed ? "Out" : "Logout"}
          </button>
        </div>
      </aside>
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center justify-between border-b bg-white/95 px-6 py-4 backdrop-blur">
          <h2 className="text-lg font-semibold text-slate-800">Neeri Saloon POS</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => void handleCheckUpdates()}
            >
              Check for updates
            </button>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
              {user?.role ?? "User"}
            </span>
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
