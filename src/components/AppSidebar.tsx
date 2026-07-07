import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  LayoutDashboard,
  Search,
  Briefcase,
  FileText,
  Award,
  BarChart3,
  Settings,
  LogOut,
  Bot,
  Globe,
  Kanban,
  Bell,
  FileArchive,
  BookOpen,
  Calculator,
  ChevronRight,
  ShieldCheck,
  Users2,
  UserCog,
} from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import HackaoLogo from "@/components/brand/HackaoLogo";

type Leaf = { title: string; to: string; icon: React.ComponentType<{ className?: string }> };
type Group = { title: string; icon: React.ComponentType<{ className?: string }>; children: Leaf[] };
type Entry = Leaf | Group;

const isGroup = (e: Entry): e is Group => "children" in e;

const NAV: Entry[] = [
  { title: "Accueil", to: "/dashboard", icon: LayoutDashboard },
  { title: "Recherche", to: "/tenders", icon: Search },
  {
    title: "Mes appels d'offres",
    icon: Briefcase,
    children: [
      { title: "Marchés suivis", to: "/pipeline", icon: Briefcase },
      { title: "Alertes", to: "/alerts", icon: Bell },
      { title: "DCE", to: "/dce", icon: FileArchive },
      { title: "Archivés", to: "/archived", icon: FileArchive },
    ],
  },
  { title: "Mémoires techniques", to: "/memoirs", icon: BookOpen },
  { title: "Attributions", to: "/awards", icon: Award },
  { title: "Statistiques", to: "/activity", icon: BarChart3 },
];

const ADMIN: Entry[] = [
  { title: "Agent IA", to: "/agent-monitor", icon: Bot },
  { title: "Sourcing", to: "/sourcing", icon: Globe },
  { title: "Groupes", to: "/groups", icon: Users2 },
  { title: "Utilisateurs", to: "/users", icon: UserCog },
  { title: "Prompts IA", to: "/admin/prompts", icon: Bot },
  { title: "Paramètres", to: "/settings", icon: Settings },
];

const AppSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";

  const currentUrl = location.pathname + location.search + location.hash;
  const isActive = (to: string) =>
    to === currentUrl || (to.indexOf("?") === -1 && to.indexOf("#") === -1 && location.pathname === to);

  const renderEntry = (entry: Entry) => {
    if (!isGroup(entry)) {
      return (
        <SidebarMenuItem key={entry.title}>
          <SidebarMenuButton
            isActive={isActive(entry.to)}
            onClick={() => navigate(entry.to)}
            tooltip={entry.title}
          >
            <entry.icon className="h-4 w-4" />
            <span>{entry.title}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    }

    const childActive = entry.children.some((c) => isActive(c.to));
    return (
      <Collapsible key={entry.title} defaultOpen={childActive} className="group/collapsible">
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton tooltip={entry.title} isActive={childActive}>
              <entry.icon className="h-4 w-4" />
              <span>{entry.title}</span>
              <ChevronRight className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              {entry.children.map((child) => (
                <SidebarMenuSubItem key={child.title}>
                  <SidebarMenuSubButton
                    isActive={isActive(child.to)}
                    onClick={() => navigate(child.to)}
                    className="cursor-pointer"
                  >
                    <child.icon className="h-3.5 w-3.5" />
                    <span>{child.title}</span>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    );
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-3 border-b border-sidebar-border">
        <div
          className="flex items-center justify-center cursor-pointer overflow-hidden"
          onClick={() => (collapsed ? toggleSidebar() : navigate("/dashboard"))}
          title={collapsed ? "Déplier" : "Accueil"}
        >
          <HackaoLogo variant={collapsed ? "symbol" : "full"} size={26} />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{NAV.map(renderEntry)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50 flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" />
              Admin
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{ADMIN.map(renderEntry)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => { signOut(); navigate("/"); }}>
              <LogOut className="h-4 w-4" />
              <span>Déconnexion</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
