import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import AppSidebar from "./AppSidebar";
import NotificationBell from "./NotificationBell";
import ThemeToggle from "./ThemeToggle";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Tableau de bord",
  "/tenders": "Appels d'offres",
  "/pipeline": "Pipeline",
  "/awards": "Attributions",
  "/settings": "Paramètres",
  "/activity": "Mon activité",
};

const AppLayout = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [onboardingCompleted, setOnboardingCompleted] = useState(true);

  useEffect(() => {
    if (!user) {
      setCheckingOnboarding(false);
      return;
    }
    supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        setOnboardingCompleted(data?.onboarding_completed ?? false);
        setCheckingOnboarding(false);
      });
  }, [user]);

  if (loading || checkingOnboarding) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!onboardingCompleted) return <Navigate to="/onboarding" replace />;

  const pageTitle = PAGE_TITLES[location.pathname] ?? "";

  return (
    <SidebarProvider className="h-screen overflow-hidden">
      <AppSidebar />
      <SidebarInset className="h-full flex flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            {pageTitle && <span className="text-sm font-medium text-foreground hidden sm:block">{pageTitle}</span>}
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <ThemeToggle />
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default AppLayout;
