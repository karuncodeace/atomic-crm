import type { ReactNode } from "react";
import {
  ArrowUpRight,
  ChevronDown,
  ChevronsUpDown,
  Contact,
  FileText,
  Import,
  LayoutGrid,
  LogOut,
  PhoneCall,
  PhoneForwarded,
  Settings,
  User,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import {
  useCanAccess,
  useGetIdentity,
  useGetList,
  useLogout,
  useStore,
  useTranslate,
} from "ra-core";
import { Link, matchPath, useLocation } from "react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

import { AXICORE_APP } from "../axicore/axicore";
import { PersonAvatar } from "../dashboard/PersonAvatar";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { GlobalSearchButton } from "../search/GlobalSearchButton";
import type { Brochure } from "../types";

export const CrmSidebar = () => {
  const { darkModeLogo, lightModeLogo, title } = useConfigurationContext();

  return (
    <Sidebar
      collapsible="icon"
      variant="sidebar"
      className="group-data-[side=left]:border-r-0"
    >
      <SidebarHeader className="gap-3 px-4 pt-4 pb-2 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0">
        <Link
          to="/"
          className="flex h-8 items-center gap-2 text-sidebar-foreground no-underline"
        >
          <img
            className="[.light_&]:hidden h-6 shrink-0"
            src={darkModeLogo}
            alt={title}
          />
          <img
            className="[.dark_&]:hidden h-6 shrink-0"
            src={lightModeLogo}
            alt={title}
          />
          <span className="truncate text-base font-semibold tracking-tight text-foreground group-data-[collapsible=icon]:hidden">
            {title}
          </span>
        </Link>
        <GlobalSearchButton variant="sidebar" />
      </SidebarHeader>
      <SidebarContent className="gap-5 px-4 py-3 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0">
        <NavigationGrid />
        <WorkspaceSection />
      </SidebarContent>
      <AxiCoreFooter />
      <UserProfile />
      <SidebarRail />
    </Sidebar>
  );
};

// ---------------------------------------------------------------------------
// Navigation grid: two columns of large rounded tiles (one column, icons only,
// when the sidebar is collapsed).

const NavigationGrid = () => {
  const translate = useTranslate();
  const location = useLocation();
  const { canAccess: canSeeBrochures } = useCanAccess({
    resource: "brochures",
    action: "list",
  });
  const onDeals = !!matchPath("/deals/*", location.pathname);
  const onDashboard = location.pathname === "/";

  return (
    <nav
      aria-label={translate("crm.sidebar.navigation", { _: "Navigation" })}
      className="grid grid-cols-2 gap-2 group-data-[collapsible=icon]:grid-cols-1"
    >
      <NavTile
        to="/"
        icon={LayoutGrid}
        label={translate("ra.page.dashboard")}
        isActive={onDashboard}
      />
      <NavTile
        to="/deals"
        icon={UsersRound}
        label={translate("resources.deals.name", { smart_count: 2 })}
        isActive={onDeals}
      />
      <NavTile
        to="/call_assignments"
        icon={PhoneCall}
        label={translate("resources.call_assignments.name", {
          smart_count: 2,
          _: "Tasks",
        })}
        isActive={!!matchPath("/call_assignments/*", location.pathname)}
      />
      <NavTile
        to="/follow-ups"
        icon={PhoneForwarded}
        label={translate("crm.followups.title", { _: "Follow-ups" })}
        isActive={!!matchPath("/follow-ups/*", location.pathname)}
      />
      {canSeeBrochures ? (
        <NavTile
          to="/brochures"
          icon={FileText}
          label={translate("resources.brochures.name", { smart_count: 2 })}
          isActive={!!matchPath("/brochures/*", location.pathname)}
          badge={<PendingBrochuresBadge />}
        />
      ) : null}
    </nav>
  );
};

const NavTile = ({
  to,
  icon: Icon,
  label,
  isActive,
  onClick,
  badge,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  onClick?: () => void;
  badge?: ReactNode;
}) => (
  <Link
    to={to}
    onClick={onClick}
    title={label}
    aria-current={isActive ? "page" : undefined}
    className={cn(
      "relative flex h-[72px] flex-col items-center justify-center gap-1.5 rounded-xl px-2 text-center no-underline transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
      "group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:rounded-lg",
      isActive
        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
        : "bg-sidebar-accent text-sidebar-accent-foreground hover:bg-card",
    )}
  >
    <Icon className="size-5" strokeWidth={1.75} aria-hidden />
    <span className="w-full truncate text-[11px] font-medium leading-tight group-data-[collapsible=icon]:sr-only">
      {label}
    </span>
    {badge}
  </Link>
);

/** Pending brochure count; shares its query with the brochures page. */
const PendingBrochuresBadge = () => {
  const { total } = useGetList<Brochure>("brochures", {
    pagination: { page: 1, perPage: 1 },
    sort: { field: "created_at", order: "DESC" },
    filter: { status: "pending" },
  });
  if (!total) return null;
  return (
    <span className="absolute top-1.5 right-1.5 min-w-5 rounded-full bg-brand px-1.5 text-[10px] leading-5 font-semibold text-brand-foreground group-data-[collapsible=icon]:top-0 group-data-[collapsible=icon]:right-0 group-data-[collapsible=icon]:min-w-4 group-data-[collapsible=icon]:px-1 group-data-[collapsible=icon]:leading-4">
      {total > 99 ? "99+" : total}
    </span>
  );
};

// ---------------------------------------------------------------------------
// Collapsible sections

const SidebarSection = ({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) => {
  const [isOpen, setOpen] = useStore<boolean>(`sidebar.section.${id}`, true);
  const contentId = `sidebar-section-${id}`;
  return (
    <div className="flex flex-col gap-1 group-data-[collapsible=icon]:hidden">
      <button
        type="button"
        onClick={() => setOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls={contentId}
        className="flex items-center justify-between rounded-md px-1 py-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase hover:text-foreground"
      >
        {title}
        <ChevronDown
          className={cn(
            "size-3.5 transition-transform",
            isOpen ? "rotate-0" : "-rotate-90",
          )}
          aria-hidden
        />
      </button>
      {isOpen ? (
        <ul id={contentId} className="flex flex-col gap-0.5">
          {children}
        </ul>
      ) : null}
    </div>
  );
};

const WorkspaceSection = () => {
  const translate = useTranslate();
  const location = useLocation();
  const items: {
    to: string;
    pattern: string;
    icon: LucideIcon;
    label: string;
  }[] = [
    {
      to: "/contacts",
      pattern: "/contacts/*",
      icon: Contact,
      label: translate("resources.contacts.name", { smart_count: 2 }),
    },
    {
      to: "/sales",
      pattern: "/sales/*",
      icon: Users,
      label: translate("resources.sales.name", { smart_count: 2 }),
    },
    {
      to: "/import",
      pattern: "/import",
      icon: Import,
      label: translate("crm.sidebar.import", { _: "Import" }),
    },
    {
      to: "/settings",
      pattern: "/settings",
      icon: Settings,
      label: translate("crm.settings.title"),
    },
  ];
  return (
    <>
      <SidebarSection
        id="workspace"
        title={translate("crm.sidebar.workspace", { _: "Workspace" })}
      >
        {items.map(({ to, pattern, icon: Icon, label }) => {
          const isActive = !!matchPath(pattern, location.pathname);
          return (
            <li key={to}>
              <Link
                to={to}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] no-underline transition-colors",
                  isActive
                    ? "bg-card font-medium text-foreground shadow-sm"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground",
                )}
              >
                <Icon className="size-4" strokeWidth={1.75} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </SidebarSection>
      {/* Collapsed sidebar: the same links as icons with tooltips. */}
      <SidebarMenu className="hidden items-center gap-1 group-data-[collapsible=icon]:flex">
        {items.map(({ to, pattern, icon: Icon, label }) => (
          <SidebarMenuItem key={to}>
            <SidebarMenuButton
              tooltip={label}
              isActive={!!matchPath(pattern, location.pathname)}
              render={<Link to={to} />}
              className="size-10! justify-center rounded-lg! p-0!"
            >
              <Icon strokeWidth={1.75} />
              <span className="sr-only">{label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </>
  );
};

// ---------------------------------------------------------------------------
// Footer: AxiCore tile and the signed-in user

/**
 * AxiCore 2.0: Codeace's tools (SWOT pitch, brochure, proposal) and their
 * settings, for admins and managers. Opens the tools as their own full page.
 */
const AxiCoreFooter = () => {
  const translate = useTranslate();
  const { canAccess } = useCanAccess({ resource: "axicore", action: "access" });
  if (!canAccess) return null;
  const label = translate("crm.sidebar.axicore", { _: "AxiCore 2.0" });
  return (
    <SidebarFooter className="gap-0 px-4 pb-0 group-data-[collapsible=icon]:px-0">
      <a
        href={AXICORE_APP}
        title={label}
        className="axc-tile group/axc relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sidebar-foreground no-underline group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
      >
        <span className="axc-mark relative grid size-8 shrink-0 place-items-center rounded-lg group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:rounded-xl">
          <svg
            viewBox="0 0 24 32"
            className="h-[14px] w-[11px] fill-current"
            aria-hidden="true"
          >
            <path d="M15.4 0 2 18.2h8.1L7.6 32 22 12.6h-8.2L17.7 0Z" />
          </svg>
        </span>
        <span className="min-w-0 grow group-data-[collapsible=icon]:hidden">
          <span className="flex items-center gap-1.5 text-[13px] leading-tight font-semibold tracking-tight">
            AxiCore
            <span className="axc-chip rounded-full px-1.5 py-px text-[9px] leading-none font-semibold">
              2.0
            </span>
          </span>
          <span className="block truncate text-[11px] leading-tight text-muted-foreground">
            AI sales studio
          </span>
        </span>
        <span className="axc-go grid size-6 shrink-0 place-items-center rounded-full group-data-[collapsible=icon]:hidden">
          <ArrowUpRight className="size-3 text-muted-foreground transition-transform duration-200 group-hover/axc:-translate-y-px group-hover/axc:translate-x-px group-hover/axc:text-sidebar-foreground" />
        </span>
      </a>
    </SidebarFooter>
  );
};

const ROLE_FALLBACK: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  bde: "BDE",
};

const UserProfile = () => {
  const translate = useTranslate();
  const logout = useLogout();
  const { identity } = useGetIdentity();
  if (!identity) return null;
  const [firstName = "", ...rest] = (identity.fullName ?? "").split(" ");
  const role = typeof identity.role === "string" ? identity.role : "";

  return (
    <SidebarFooter className="p-3 group-data-[collapsible=icon]:items-center">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className="flex w-full items-center gap-2.5 rounded-xl border border-sidebar-border bg-sidebar-accent p-2 text-left transition-colors outline-none hover:bg-card focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0"
              aria-label={translate("crm.sidebar.account", { _: "Account" })}
            />
          }
        >
          <PersonAvatar
            firstName={firstName}
            lastName={rest.join(" ")}
            avatar={identity.avatar ? { src: identity.avatar } : null}
            className="size-8"
          />
          <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <span className="block truncate text-[13px] font-semibold text-foreground">
              {identity.fullName}
            </span>
            <span className="block truncate text-[11px] text-muted-foreground">
              {translate(`crm.sidebar.role_${role}`, {
                _: ROLE_FALLBACK[role] ?? role,
              })}
            </span>
          </span>
          <ChevronsUpDown
            className="size-4 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden"
            aria-hidden
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-56">
          <DropdownMenuItem render={<Link to="/profile" />} className="gap-2">
            <User className="size-4" aria-hidden />
            {translate("crm.profile.title")}
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link to="/settings" />} className="gap-2">
            <Settings className="size-4" aria-hidden />
            {translate("crm.settings.title")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => logout()} className="gap-2">
            <LogOut className="size-4" aria-hidden />
            {translate("ra.auth.logout")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarFooter>
  );
};
