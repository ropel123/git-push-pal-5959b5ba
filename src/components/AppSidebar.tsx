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
  {
    title: "Recherche",
    icon: Search,
    children: [
      { title: "Moteur de recherche", to: "/tenders", icon: Search },
      { title: "Mots-clés", to: "/tenders?view=keywords", icon: Search },
      { title: "Profils de veille", to: "/tenders?view=profiles", icon: Search },
    ],
  },
  {
    title: "Mes affaires",
    icon: Briefcase,
    children: [
      { title: "Pipeline", to: "/pipeline", icon: Kanban },
      { title: "Marchés suivis", to: "/tracked", icon: Briefcase },
      { title: "Alertes", to: "/alerts", icon: Bell },
      { title: "DCE", to: "/dce", icon: FileArchive },
      { title: "Archivés", to: "/archived", icon: FileArchive },
    ],
  },
  {
    title: "Mes réponses",
    icon: FileText,
    children: [
      { title: "Mémoires techniques", to: "/memoirs", icon: BookOpen },
      { title: "Chiffrages (DIE)", to: "/pricing", icon: Calculator },
    ],
  },
  { title: "Attributions", to: "/awards", icon: Award },
  { title: "Statistiques", to: "/activity", icon: BarChart3 },
];

const ADMIN: Entry[] = [
  { title: "Agent IA", to: "/agent-monitor", icon: Bot },
  { title: "Sourcing", to: "/sourcing", icon: Globe },
  { title: "Groupes", to: "/groups", icon: Users2 },
  { title: "Utilisateurs", to: "/users", icon: UserCog },
  { title: "Paramètres", to: "/settings", icon: Settings },
];

const AppSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const { isAdmin } = useIsAdmin();

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
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center cursor-pointer" onClick={() => navigate("/dashboard")}>
          <HackaoLogo variant="full" size={26} />
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
