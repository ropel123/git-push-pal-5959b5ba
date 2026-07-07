import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import AppLayout from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Tenders from "./pages/Tenders";
import TenderDetail from "./pages/TenderDetail";
import Pipeline from "./pages/Pipeline";
import Awards from "./pages/Awards";
import SettingsPage from "./pages/SettingsPage";
import Onboarding from "./pages/Onboarding";
import BuyerDetail from "./pages/BuyerDetail";
import Activity from "./pages/Activity";
import TrackedTenders from "./pages/TrackedTenders";
import AlertsPage from "./pages/AlertsPage";
import DcePage from "./pages/DcePage";
import ArchivedTenders from "./pages/ArchivedTenders";
import MemoirsPage from "./pages/MemoirsPage";
import PricingPage from "./pages/PricingPage";
import GroupsPage from "./pages/GroupsPage";
import UsersPage from "./pages/UsersPage";
import Sourcing from "./pages/Sourcing";
import SourcingHostDetail from "./pages/SourcingHostDetail";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/tenders" element={<Tenders />} />
                <Route path="/tenders/:id" element={<TenderDetail />} />
                <Route path="/pipeline" element={<Pipeline />} />
                <Route path="/awards" element={<Awards />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/buyers/:id" element={<BuyerDetail />} />
                <Route path="/activity" element={<Activity />} />
                <Route path="/tracked" element={<TrackedTenders />} />
                <Route path="/alerts" element={<AlertsPage />} />
                <Route path="/dce" element={<DcePage />} />
                <Route path="/archived" element={<ArchivedTenders />} />
                <Route path="/memoirs" element={<MemoirsPage />} />
                <Route path="/groups" element={<GroupsPage />} />
                <Route path="/users" element={<UsersPage />} />
                <Route path="/sourcing" element={<Sourcing />} />
                <Route path="/sourcing/:host" element={<SourcingHostDetail />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
