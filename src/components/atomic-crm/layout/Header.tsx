import { Bell, FileText, Import, Settings, User, Users } from "lucide-react";
import { useCanAccess, useGetList, useTranslate, useUserMenu } from "ra-core";
import { Link } from "react-router";
import { RefreshButton } from "@/components/admin/refresh-button";
import { ThemeModeToggle } from "@/components/admin/theme-mode-toggle";
import { UserMenu } from "@/components/admin/user-menu";
import { buttonVariants } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

import { ImportPage } from "../misc/ImportPage";
import { ChangelogPage } from "../misc/ChangelogPage";
import { GlobalSearchButton } from "../search/GlobalSearchButton";
import type { Brochure } from "../types";
import { NewRecordButton } from "./NewRecordButton";

const Header = () => (
  <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b bg-background/95 md:rounded-tl-[1.25rem] px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:px-6">
    <SidebarTrigger className="-ml-1" />
    <Separator orientation="vertical" className="h-5" />
    <GlobalSearchButton />
    <div className="ml-auto flex items-center gap-1">
      <NewRecordButton />
      <Separator orientation="vertical" className="mx-2 h-5" />
      <BrochureNotifications />
      <ThemeModeToggle />
      <RefreshButton />
      <UserMenu>
        <ProfileMenu />
        <UsersMenu />
        <SettingsMenu />
        <ImportFromJsonMenuItem />
        <ChangelogMenuItem />
      </UserMenu>
    </div>
  </header>
);

/** Bell only for roles that handle brochures (not BDEs). */
const BrochureNotifications = () => {
  const { canAccess } = useCanAccess({ resource: "brochures", action: "list" });
  return canAccess ? <NotificationsButton /> : null;
};

/** Round bell with a red dot while brochures are waiting for review. */
const NotificationsButton = () => {
  const translate = useTranslate();
  // Same query as the sidebar badge and brochures page, so they share a cache.
  const { total } = useGetList<Brochure>("brochures", {
    pagination: { page: 1, perPage: 1 },
    sort: { field: "created_at", order: "DESC" },
    filter: { status: "pending" },
  });
  const label = total
    ? translate("crm.header.pending_brochures", { smart_count: total })
    : translate("crm.header.notifications");
  return (
    <Link
      to="/brochures"
      aria-label={label}
      title={label}
      className={buttonVariants({
        variant: "ghost",
        size: "icon",
        className: "relative",
      })}
    >
      <Bell aria-hidden />
      {total ? (
        <span
          aria-hidden
          className="absolute top-2 right-2 size-2 rounded-full bg-destructive ring-2 ring-background"
        />
      ) : null}
    </Link>
  );
};

const UsersMenu = () => {
  const translate = useTranslate();
  const userMenuContext = useUserMenu();
  if (!userMenuContext) {
    throw new Error("<UsersMenu> must be used inside <UserMenu?");
  }
  return (
    <DropdownMenuItem
      onClick={userMenuContext.onClose}
      render={<Link to="/sales" className="flex items-center gap-2" />}
    >
      <Users />
      {translate("resources.sales.name", { smart_count: 2 })}
    </DropdownMenuItem>
  );
};

const ProfileMenu = () => {
  const translate = useTranslate();
  const userMenuContext = useUserMenu();
  if (!userMenuContext) {
    throw new Error("<ProfileMenu> must be used inside <UserMenu?");
  }
  return (
    <DropdownMenuItem
      onClick={userMenuContext.onClose}
      render={<Link to="/profile" className="flex items-center gap-2" />}
    >
      <User />
      {translate("crm.profile.title")}
    </DropdownMenuItem>
  );
};

const SettingsMenu = () => {
  const translate = useTranslate();
  const userMenuContext = useUserMenu();
  if (!userMenuContext) {
    throw new Error("<SettingsMenu> must be used inside <UserMenu>");
  }
  return (
    <DropdownMenuItem
      onClick={userMenuContext.onClose}
      render={<Link to="/settings" className="flex items-center gap-2" />}
    >
      <Settings />
      {translate("crm.settings.title")}
    </DropdownMenuItem>
  );
};

const ImportFromJsonMenuItem = () => {
  const translate = useTranslate();
  const userMenuContext = useUserMenu();
  if (!userMenuContext) {
    throw new Error("<ImportFromJsonMenuItem> must be used inside <UserMenu>");
  }
  return (
    <DropdownMenuItem
      onClick={userMenuContext.onClose}
      render={<Link to={ImportPage.path} className="flex items-center gap-2" />}
    >
      <Import />
      {translate("crm.header.import_data")}
    </DropdownMenuItem>
  );
};

const ChangelogMenuItem = () => {
  const translate = useTranslate();
  const userMenuContext = useUserMenu();
  if (!userMenuContext) {
    throw new Error("<ChangelogMenuItem> must be used inside <UserMenu>");
  }
  return (
    <DropdownMenuItem
      onClick={userMenuContext.onClose}
      render={
        <Link to={ChangelogPage.path} className="flex items-center gap-2" />
      }
    >
      <FileText />
      {translate("crm.changelog.title")}
    </DropdownMenuItem>
  );
};
export default Header;
