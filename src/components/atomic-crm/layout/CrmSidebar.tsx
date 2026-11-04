import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  FileText,
  Handshake,
  LayoutDashboard,
  ListTodo,
  Settings,
  Users,
} from "lucide-react";
import { useGetList, useTranslate } from "ra-core";
import { Link, matchPath, useLocation } from "react-router";
import {
  Sidebar,
  SidebarContent,
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
import type { Brochure } from "../types";

export const CrmSidebar = () => {
  const { darkModeLogo, lightModeLogo, title } = useConfigurationContext();
  const translate = useTranslate();

  return (
    <Sidebar collapsible="icon" variant="floating">
      <SidebarHeader className="h-16 justify-center px-3">
        <Link
          to="/"
          className="flex items-center gap-2 px-2 text-sidebar-foreground no-underline"
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
      <SidebarContent className="px-1">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <NavItem
                to="/"
                pattern="/"
                icon={LayoutDashboard}
                label={translate("ra.page.dashboard")}
              />
              <NavItem
                to="/deals"
                pattern="/deals/*"
                icon={Handshake}
                label={translate("resources.deals.name", { smart_count: 2 })}
              />
              <NavItem
                to="/call_assignments"
                pattern="/call_assignments/*"
                icon={ListTodo}
                label={translate("resources.call_assignments.name", {
                  smart_count: 2,
                  _: "Tasks",
                })}
              />
              <NavItem
                to="/brochures"
                pattern="/brochures/*"
                icon={FileText}
                label={translate("resources.brochures.name", {
                  smart_count: 2,
                })}
                badge={<PendingBrochuresBadge />}
              />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <AdminGroup />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
};

const AdminGroup = () => {
  const translate = useTranslate();
  return (
    <SidebarGroup className="mt-auto">
      <SidebarGroupLabel>{translate("crm.sidebar.admin")}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <NavItem
            to="/sales"
            pattern="/sales/*"
            icon={Users}
            label={translate("resources.sales.name", { smart_count: 2 })}
          />
          <NavItem
            to="/settings"
            pattern="/settings"
            icon={Settings}
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
  icon: LucideIcon;
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
          className="absolute top-1/2 -left-3 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-foreground"
        />
      ) : null}
      <SidebarMenuButton
        isActive={isActive}
        tooltip={label}
        render={<Link to={to} aria-current={isActive ? "page" : undefined} />}
        className="h-9 rounded-full px-3 font-medium data-active:font-semibold"
      >
        <Icon />
        <span>{label}</span>
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
    <SidebarMenuBadge className="top-2! right-2 rounded-full bg-foreground px-1.5 text-background! peer-hover/menu-button:text-background">
      {total > 99 ? "99+" : total}
    </SidebarMenuBadge>
  );
};
