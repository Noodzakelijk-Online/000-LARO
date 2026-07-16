/**
 * Full LARO dashboard for the packaged desktop and supported server renderer.
 */
import { lazy, Suspense } from "react";
import { Router, Route, Switch } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { useAuth } from "@/_core/hooks/useAuth";
import AuthPage from "@/components/AuthPage";
import { DashboardSkeleton } from "@/components/SkeletonLoaders";
import { WebSocketProvider } from "@/contexts/WebSocketContext";

const Home = lazy(() => import("@/components/Home"));
const Cases = lazy(() => import("@/components/Cases"));
const Lawyers = lazy(() => import("@/components/Lawyers"));
const LawyerProfile = lazy(() => import("@/components/LawyerProfile"));
const OutreachAnalytics = lazy(() => import("@/components/OutreachAnalytics"));
const Help = lazy(() => import("@/components/Help"));
const Settings = lazy(() => import("@/components/Settings"));
const Privacy = lazy(() => import("@/components/Privacy"));
const Admin = lazy(() => import("@/components/Admin"));
const Messages = lazy(() => import("@/components/Messages"));

const fileProtocol =
  typeof window !== "undefined" && window.location.protocol === "file:";

export default function DashboardApp() {
  const { user, loading } = useAuth();

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <WebSocketProvider>
    <Router {...(fileProtocol ? { hook: useHashLocation } : {})}>
    <Suspense fallback={<DashboardSkeleton />}>
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/cases" component={Cases} />
      <Route path="/lawyers/:id" component={LawyerProfile} />
      <Route path="/lawyers" component={Lawyers} />
      <Route path="/outreach" component={OutreachAnalytics} />
      <Route path="/help" component={Help} />

      <Route path="/settings" component={Settings} />
      {/* EmailSettings.tsx is incomplete in repo; use main Settings until restored */}
      <Route path="/email-settings" component={Settings} />
      <Route path="/email-preferences" component={Settings} />
      <Route path="/privacy" component={Privacy} />

      <Route path="/admin" component={Admin} />
      <Route path="/admin-analytics" component={Admin} />

      <Route path="/messages" component={Messages} />
      <Route path="/email" component={Messages} />
      <Route path="/analytics">
        <OutreachAnalytics />
      </Route>

      <Route>
        <div className="p-8 text-center text-muted-foreground">
          <p className="font-medium text-foreground">Page not found</p>
          <p className="mt-2 text-sm">Use the sidebar to navigate.</p>
        </div>
      </Route>
    </Switch>
    </Suspense>
    </Router>
    </WebSocketProvider>
  );
}
