import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FileText, Handshake, Home, ListTodo } from "lucide-react";
import { useTranslate } from "ra-core";
import { Link, matchPath, useLocation } from "react-router";

export const MobileNavigation = () => {
  const location = useLocation();
  const translate = useTranslate();

  let currentPath: string | boolean = "/";
  if (matchPath("/", location.pathname)) {
    currentPath = "/";
  } else if (matchPath("/deals/*", location.pathname)) {
    currentPath = "/deals";
  } else if (matchPath("/call_assignments/*", location.pathname)) {
    currentPath = "/call_assignments";
  } else if (matchPath("/brochures/*", location.pathname)) {
    currentPath = "/brochures";
  } else {
    currentPath = false;
  }

  // Check if the app is running as a PWA (standalone mode)
  const isPwa = window.matchMedia("(display-mode: standalone)").matches;
  // Check if it's iOS on the web
  const isWebiOS = /iPad|iPod|iPhone/.test(window.navigator.userAgent);

  return (
    <nav
      aria-label={translate("crm.navigation.label")}
      className="fixed bottom-0 left-0 right-0 z-50 h-14 border-t bg-background"
      style={{
        // iOS bug: even though viewport is set correctly, the bottom safe area inset is not accounted for
        // So we manually add some padding to avoid the navigation being too close to the home bar
        paddingBottom: isPwa && isWebiOS ? 15 : undefined,
        // We use box-sizing: border-box, so the height contains the padding.
        // To actually increase the padding, we need to increase the height as well
        height:
          "calc(var(--spacing)) * 6" + (isPwa && isWebiOS ? " + 15px" : ""),
      }}
    >
      <div className="flex justify-center gap-1 px-2">
        <NavigationButton
          href="/"
          Icon={Home}
          label={translate("ra.page.dashboard")}
          isActive={currentPath === "/"}
        />
        <NavigationButton
          href="/deals"
          Icon={Handshake}
          label={translate("resources.deals.name", { smart_count: 2 })}
          isActive={currentPath === "/deals"}
        />
        <NavigationButton
          href="/call_assignments"
          Icon={ListTodo}
          label={translate("resources.call_assignments.name", {
            smart_count: 2,
            _: "Tasks",
          })}
          isActive={currentPath === "/call_assignments"}
        />
        <NavigationButton
          href="/brochures"
          Icon={FileText}
          label={translate("resources.brochures.name", { smart_count: 1 })}
          isActive={currentPath === "/brochures"}
        />
      </div>
    </nav>
  );
};

const NavigationButton = ({
  href,
  Icon,
  label,
  isActive,
}: {
  href: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  isActive: boolean;
}) => (
  <Link
    to={href}
    aria-current={isActive ? "page" : undefined}
    className={cn(
      buttonVariants({ variant: "ghost" }),
      "h-auto w-18 flex-col gap-1 rounded-2xl px-1 py-1.5",
      isActive ? "bg-muted text-foreground" : "text-muted-foreground",
    )}
  >
    <Icon className="size-5" aria-hidden />
    <span className="text-[0.6rem] font-medium">{label}</span>
  </Link>
);
