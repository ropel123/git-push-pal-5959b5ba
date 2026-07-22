import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
// Landing chargée en dur : première peinture immédiate pour les visiteurs.
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AppLayout from "./components/AppLayout";

// Code-splitting : chaque page applicative devient son propre chunk — un
// visiteur de la landing ne télécharge plus l'app entière (jspdf, pptxgenjs…).
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Tenders = lazy(() => import("./pages/Tenders"));
const TenderDetail = lazy(() => import("./pages/TenderDetail"));
const Pipeline = lazy(() => import("./pages/Pipeline"));
const Awards = lazy(() => import("./pages/Awards"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const BuyerDetail = lazy(() => import("./pages/BuyerDetail"));
const Activity = lazy(() => import("./pages/Activity"));
const TrackedTenders = lazy(() => import("./pages/TrackedTenders"));
const AlertsPage = lazy(() => import("./pages/AlertsPage"));
const DcePage = lazy(() => import("./pages/DcePage"));
const ArchivedTenders = lazy(() => import("./pages/ArchivedTenders"));
const MemoirsPage = lazy(() => import("./pages/MemoirsPage"));
const PricingPage = lazy(() => import("./pages/PricingPage"));
const GroupsPage = lazy(() => import("./pages/GroupsPage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const Sourcing = lazy(() => import("./pages/Sourcing"));
const SourcingHostDetail = lazy(() => import("./pages/SourcingHostDetail"));
const AdminPromptsPage = lazy(() => import("./pages/AdminPromptsPage"));

const PageFallback = () => (
  <div className="flex min-h-screen items-center justify-center text-muted-foreground">Chargement…</div>
);

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
            <Suspense fallback={<PageFallback />}>
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
                <Route path="/admin/prompts" element={<AdminPromptsPage />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
