import type { ComponentType, ReactNode, SVGProps } from "react";

/**
 * The sidebar's own icon set: duotone line icons drawn on a 24px grid (1.6px strokes, round joins).
 * Each icon has a soft filled shape (class `nav-duo`) that the sidebar strengthens on the active item
 * (styles `.nav-duo` in src/index.css), so the active page reads at a glance.
 */
export type NavIcon = ComponentType<SVGProps<SVGSVGElement>>;

const Icon = ({
  children,
  ...props
}: SVGProps<SVGSVGElement> & { children: ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    {children}
  </svg>
);

const Duo = (props: SVGProps<SVGPathElement>) => (
  <path className="nav-duo" fill="currentColor" stroke="none" {...props} />
);

/** Dashboard: four tiles of different heights. */
export const DashboardIcon: NavIcon = (props) => (
  <Icon {...props}>
    <Duo d="M5 3.5h4a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 11V5A1.5 1.5 0 0 1 5 3.5Z" />
    <rect x="3.5" y="3.5" width="7" height="9" rx="1.8" />
    <rect x="13.5" y="3.5" width="7" height="5" rx="1.8" />
    <rect x="13.5" y="11.5" width="7" height="9" rx="1.8" />
    <rect x="3.5" y="15.5" width="7" height="5" rx="1.8" />
  </Icon>
);

/** Leads: a funnel with a spark at the top. */
export const LeadsIcon: NavIcon = (props) => (
  <Icon {...props}>
    <Duo d="M4.5 6.5h15l-5.6 6.4v5.3l-3.8 2v-7.3Z" />
    <path d="M4.5 6.5h15l-5.6 6.4v5.3l-3.8 2v-7.3Z" />
    <path d="M18 2.5v2.2M16.9 3.6h2.2" />
  </Icon>
);

/** Tasks: a clipboard with a tick. */
export const TasksIcon: NavIcon = (props) => (
  <Icon {...props}>
    <Duo d="M7 5h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
    <rect x="5" y="5" width="14" height="16" rx="2.4" />
    <path d="M9 3.5h6v3H9z" />
    <path d="m8.8 13.2 2.1 2.1 4.3-4.3" />
  </Icon>
);

/** Brochures: two stacked pages with text lines. */
export const BrochuresIcon: NavIcon = (props) => (
  <Icon {...props}>
    <Duo d="M10 3.5h7.5a2 2 0 0 1 2 2V15a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z" />
    <path d="M10 3.5h7.5a2 2 0 0 1 2 2V15a2 2 0 0 1-2 2" />
    <rect x="4.5" y="7" width="11" height="13.5" rx="2.2" />
    <path d="M7.8 11.5h4.4M7.8 15h3" />
  </Icon>
);

/** Users: two people, the front one filled. */
export const UsersIcon: NavIcon = (props) => (
  <Icon {...props}>
    <Duo d="M9 11.6a3.3 3.3 0 1 0 0-6.6 3.3 3.3 0 0 0 0 6.6Z" />
    <circle cx="9" cy="8.3" r="3.3" />
    <path d="M3.3 19.5c.7-3 2.9-4.7 5.7-4.7s5 1.7 5.7 4.7" />
    <path d="M15.6 5.4a2.9 2.9 0 0 1 0 5.6M17 14.9c2 .4 3.3 1.9 3.8 4.6" />
  </Icon>
);

/** Settings: three sliders. */
export const SettingsIcon: NavIcon = (props) => (
  <Icon {...props}>
    <Duo d="M15 9.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4ZM9 19.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Z" />
    <path d="M4 7h8.8M17.2 7H20M4 17h2.8M11.2 17H20M4 12h2M10.4 12H20" />
    <circle cx="15" cy="7" r="2.2" />
    <circle cx="9" cy="17" r="2.2" />
    <circle cx="8.2" cy="12" r="1.8" />
  </Icon>
);
