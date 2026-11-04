import { Suspense, useEffect, useState, type ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Notification } from "@/components/admin/notification";
import { Error } from "@/components/admin/error";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

import { DataImportProvider } from "../dataImport/DataImportProvider";
import { useConfigurationLoader } from "../root/useConfigurationLoader";
import { CrmSidebar } from "./CrmSidebar";
import Header from "./Header";

// Below this width the sidebar collapses to icons to give the content room.
const COMPACT_SIDEBAR_QUERY = "(max-width: 1023px)";

const useResponsiveSidebar = () => {
  const [isOpen, setOpen] = useState(
    () => !window.matchMedia(COMPACT_SIDEBAR_QUERY).matches,
  );
  useEffect(() => {
    const query = window.matchMedia(COMPACT_SIDEBAR_QUERY);
    const onChange = (event: MediaQueryListEvent) => setOpen(!event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return [isOpen, setOpen] as const;
};

export const Layout = ({ children }: { children: ReactNode }) => {
  useConfigurationLoader();
  const [isSidebarOpen, setSidebarOpen] = useResponsiveSidebar();
  return (
    <DataImportProvider>
      <SidebarProvider
        open={isSidebarOpen}
        onOpenChange={setSidebarOpen}
        className="bg-canvas"
      >
        <CrmSidebar />
        <SidebarInset className="min-w-0 bg-background md:my-2 md:mr-2 md:rounded-[2rem]">
          <Header />
          <div
            className="mx-auto w-full max-w-screen-2xl p-4 lg:px-8 lg:py-6"
            id="main-content"
          >
            <ErrorBoundary FallbackComponent={Error}>
              <Suspense
                fallback={<Skeleton className="h-12 w-12 rounded-full" />}
              >
                {children}
              </Suspense>
            </ErrorBoundary>
          </div>
        </SidebarInset>
      </SidebarProvider>
      <Notification />
    </DataImportProvider>
  );
};
