import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { useCanAccess, useGetList, useTranslate } from "ra-core";
import { Link, matchPath, useLocation } from "react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

import { useConfigurationContext } from "../root/ConfigurationContext";
import { AXICORE_APP } from "../axicore/axicore";
import type { Brochure } from "../types";
import {
  BrochuresIcon,
  DashboardIcon,
  LeadsIcon,
  type NavIcon,
  SettingsIcon,
  TasksIcon,
  UsersIcon,
} from "./NavIcons";

export const CrmSidebar = () => {
  const { darkModeLogo, lightModeLogo, title } = useConfigurationContext();
  const translate = useTranslate();
  const { canAccess: canSeeBrochures } = useCanAccess({
    resource: "brochures",
    action: "list",
  });

  return (
    <Sidebar
      collapsible="icon"
      variant="sidebar"
      className="group-data-[side=left]:border-r-0"
    >
      <SidebarHeader className="h-16 justify-center px-3 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0">
        <Link
          to="/"
          className="flex items-center gap-2 px-2 text-sidebar-foreground no-underline group-data-[collapsible=icon]:px-0"
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
          <span className="truncate text-lg font-semibold tracking-tight text-foreground group-data-[collapsible=icon]:hidden">
            {title}
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent className="px-1 group-data-[collapsible=icon]:px-0">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:gap-1 group-data-[collapsible=icon]:rounded-2xl group-data-[collapsible=icon]:border group-data-[collapsible=icon]:border-sidebar-border group-data-[collapsible=icon]:bg-sidebar-accent/60 group-data-[collapsible=icon]:p-1.5">
              <NavItem
                to="/"
                pattern="/"
                icon={DashboardIcon}
                label={translate("ra.page.dashboard")}
              />
              <NavItem
                to="/deals"
                pattern="/deals/*"
                icon={LeadsIcon}
                label={translate("resources.deals.name", { smart_count: 2 })}
              />
              <NavItem
                to="/call_assignments"
                pattern="/call_assignments/*"
                icon={TasksIcon}
                label={translate("resources.call_assignments.name", {
                  smart_count: 2,
                  _: "Tasks",
                })}
              />
              {canSeeBrochures ? (
                <NavItem
                  to="/brochures"
                  pattern="/brochures/*"
                  icon={BrochuresIcon}
                  label={translate("resources.brochures.name", {
                    smart_count: 2,
                  })}
                  badge={<PendingBrochuresBadge />}
                />
              ) : null}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <AdminGroup />
      </SidebarContent>
      <AxiCoreFooter />
      <SidebarRail />
    </Sidebar>
  );
};

/**
 * AxiCore 2.0: Codeace's tools (SWOT pitch, brochure, proposal) and their settings, for admins and managers.
 * At the very bottom of the sidebar; it opens the tools as their own full page (a plain link).
 */
const AxiCoreFooter = () => {
  const translate = useTranslate();
  const { canAccess } = useCanAccess({ resource: "axicore", action: "access" });
  if (!canAccess) return null;
  const label = translate("crm.sidebar.axicore", { _: "AxiCore 2.0" });
  return (
    <SidebarFooter className="p-0 gap-0">
      <a
        href={AXICORE_APP}
        title={label}
        className="axc-tile group/axc relative flex items-center gap-2.5 px-4 py-2.5 text-sidebar-foreground no-underline group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
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
        <span className="grow min-w-0 group-data-[collapsible=icon]:hidden">
          <span className="flex items-center gap-1.5 text-[13px] font-semibold leading-tight tracking-tight">
            AxiCore
            <span className="axc-chip rounded-full px-1.5 py-px text-[9px] font-semibold leading-none">
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

const AdminGroup = () => {
  const translate = useTranslate();
  return (
    <SidebarGroup className="mt-auto">
      <SidebarGroupLabel>{translate("crm.sidebar.admin")}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:gap-1 group-data-[collapsible=icon]:rounded-2xl group-data-[collapsible=icon]:border group-data-[collapsible=icon]:border-sidebar-border group-data-[collapsible=icon]:bg-sidebar-accent/60 group-data-[collapsible=icon]:p-1.5">
          <NavItem
            to="/sales"
            pattern="/sales/*"
            icon={UsersIcon}
            label={translate("resources.sales.name", { smart_count: 2 })}
          />
          <NavItem
            to="/settings"
            pattern="/settings"
            icon={SettingsIcon}
            label={translate("crm.settings.title")}
          />
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
};

const NavItem = ({
  to,
  pattern,
  icon: Icon,
  label,
  badge,
}: {
  to: string;
  pattern: string;
  icon: NavIcon;
  label: string;
  badge?: ReactNode;
}) => {
  const location = useLocation();
  const isActive = !!matchPath(pattern, location.pathname);
  return (
    <SidebarMenuItem>
      {isActive ? (
        <span
          aria-hidden
          className="absolute top-1/2 -left-3 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-foreground group-data-[collapsible=icon]:hidden"
        />
      ) : null}
      <SidebarMenuButton
        isActive={isActive}
        tooltip={label}
        render={<Link to={to} aria-current={isActive ? "page" : undefined} />}
        className="nav-btn h-9 rounded-full px-3 font-medium data-active:font-semibold [&_svg]:size-[18px]! group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:text-sidebar-accent-foreground/85 group-data-[collapsible=icon]:[&_svg]:size-[21px]! group-data-[collapsible=icon]:[&_svg]:stroke-[1.8] group-data-[collapsible=icon]:rounded-xl! group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:data-active:bg-sidebar-primary group-data-[collapsible=icon]:data-active:text-sidebar-primary-foreground group-data-[collapsible=icon]:data-active:shadow-sm"
      >
        <Icon />
        <span className="group-data-[collapsible=icon]:hidden">{label}</span>
      </SidebarMenuButton>
      {badge}
    </SidebarMenuItem>
  );
};

/** Dark count bubble; shares its query with the brochures page so both stay in sync. */
const PendingBrochuresBadge = () => {
  const { total } = useGetList<Brochure>("brochures", {
    pagination: { page: 1, perPage: 1 },
    sort: { field: "created_at", order: "DESC" },
    filter: { status: "pending" },
  });
  if (!total) return null;
  return (
    <>
      <span
        aria-hidden
        className="pointer-events-none absolute top-1 right-1 hidden size-2.5 rounded-full bg-red-500 ring-2 ring-sidebar group-data-[collapsible=icon]:block"
      />
      <SidebarMenuBadge className="top-2! right-2 rounded-full bg-foreground px-1.5 text-background! peer-hover/menu-button:text-background">
        {total > 99 ? "99+" : total}
      </SidebarMenuBadge>
    </>
  );
};
