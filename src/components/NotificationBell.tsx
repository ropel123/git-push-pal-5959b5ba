import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Notification {
  id: string;
  title: string;
  publication_date: string | null;
  matchedKeyword: string;
}

const NotificationBell = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;

    const fetchNotifications = async () => {
      // Get user alerts with keywords
      const { data: alerts } = await supabase
        .from("alerts")
        .select("filters, enabled")
        .eq("user_id", user.id)
        .eq("enabled", true);

      if (!alerts || alerts.length === 0) return;

      // Extract keywords from all alerts
      const keywords: string[] = [];
      alerts.forEach((a) => {
        const f = a.filters as any;
        if (f?.keywords) {
          if (Array.isArray(f.keywords)) keywords.push(...f.keywords);
          else if (typeof f.keywords === "string") keywords.push(f.keywords);
        }
      });

      if (keywords.length === 0) return;

      // Get recent tenders (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: tenders } = await supabase
        .from("tenders")
        .select("id, title, publication_date")
        .gte("created_at", sevenDaysAgo.toISOString())
        .order("created_at", { ascending: false })
        .limit(100);

      if (!tenders) return;

      // Match tenders against keywords
      const matches: Notification[] = [];
      for (const tender of tenders) {
        const titleLower = tender.title.toLowerCase();
        for (const kw of keywords) {
          if (titleLower.includes(kw.toLowerCase())) {
            matches.push({ id: tender.id, title: tender.title, publication_date: tender.publication_date, matchedKeyword: kw });
            break;
          }
        }
      }
      setNotifications(matches.slice(0, 10));
    };

    fetchNotifications();
  }, [user]);

  const unreadCount = notifications.filter((n) => !dismissed.has(n.id)).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b border-border">
          <p className="text-sm font-semibold text-foreground">Notifications</p>
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground text-center">Aucune notification récente</p>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`p-3 border-b border-border last:border-0 cursor-pointer hover:bg-secondary/50 transition-colors ${dismissed.has(n.id) ? "opacity-50" : ""}`}
                onClick={() => {
                  setDismissed((prev) => new Set(prev).add(n.id));
                  navigate(`/tenders/${n.id}`);
                }}
              >
                <p className="text-sm text-foreground line-clamp-2">{n.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-primary font-medium">#{n.matchedKeyword}</span>
                  {n.publication_date && (
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(n.publication_date), "dd MMM", { locale: fr })}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
