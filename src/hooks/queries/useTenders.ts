import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Hooks TanStack Query pour la lecture des appels d'offres (chantier 4). */

export type TenderStatus = "open" | "closed" | "awarded" | "cancelled";

export type SmartProfile = {
  regions?: string[] | null;
  keywords?: string[] | null;
} | null;

export type TendersFilters = {
  page?: number;
  pageSize?: number;
  search?: string;
  region?: string;
  status?: TenderStatus;
  procedure?: string;
  /** Optional explicit list of procedure_type values (synonyms expansion). Takes precedence over `procedure`. */
  procedures?: string[] | null;
  platform?: string;
  listingHost?: string;
  dceOnly?: boolean;
  /** Restrict results to this set of tender IDs (server-side `.in('id', ...)`). When provided as empty array, returns no rows. */
  idsIn?: string[] | null;
  /** Bornes de date de publication au format 'YYYY-MM-DD'. */
  publicationFrom?: string | null;
  publicationTo?: string | null;
  /** Inclure les AO dont publication_date est NULL (~95% des AO scrapés). Défaut true. */
  includeUndatedPublication?: boolean;
  smart?: SmartProfile;
  /** Désactive temporairement la query (ex: profil pas encore chargé). */
  enabled?: boolean;
};

export function useTenders(filters: TendersFilters = {}) {
  const {
    page = 0,
    pageSize = 20,
    search = "",
    region = "",
    status = "",
    procedure = "",
    procedures = null,
    platform = "",
    listingHost = "",
    dceOnly = false,
    idsIn = null,
    publicationFrom = null,
    publicationTo = null,
    includeUndatedPublication = true,
    smart = null,
    enabled = true,
  } = filters;

  return useQuery({
    enabled,
    placeholderData: keepPreviousData,
    queryKey: ["tenders", { page, pageSize, search, region, status, procedure, procedures, platform, listingHost, dceOnly, idsIn, publicationFrom, publicationTo, includeUndatedPublication, smart }],
    queryFn: async () => {
      // Short-circuit: caller requested filtering by an empty ID set.
      if (idsIn && idsIn.length === 0) {
        return { items: [], count: 0 };
      }

      const from = page * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from("tenders")
        .select("*", { count: "exact" })
        .order("publication_date", { ascending: false })
        .range(from, to);

      if (idsIn && idsIn.length > 0) query = query.in("id", idsIn);

      // PostgREST `.or()` parses commas/parentheses as separators and doesn't accept
      // quotes around ilike values. Sanitize each user-provided term so terms like
      // "informatique, cloud" or "agence (75)" don't silently break the request.
      const sanitize = (s: string) =>
        s.trim().replace(/[,()*"']/g, " ").replace(/\s+/g, " ").trim();

      if (smart) {
        const regions = (smart.regions ?? []).filter(Boolean);
        const keywords = (smart.keywords ?? []).map(sanitize).filter(Boolean);
        if (regions.length > 0) query = query.in("region", regions);
        if (keywords.length > 0) {
          const orClauses = keywords.flatMap((kw) => [
            `title.ilike.%${kw}%`,
            `object.ilike.%${kw}%`,
          ]);
          query = query.or(orClauses.join(","));
        }
      }

      if (dceOnly) query = query.not("dce_url", "is", null).neq("dce_url", "");

      // Filtre date de publication. Une comparaison SQL sur une colonne NULL est
      // toujours fausse : un .gte/.lte strict exclurait les ~95% d'AO scrapés sans
      // date. Par défaut on les inclut via une clause OR (…is.null).
      if (publicationFrom || publicationTo) {
        if (includeUndatedPublication) {
          const parts: string[] = [];
          if (publicationFrom && publicationTo) {
            parts.push(`and(publication_date.gte.${publicationFrom},publication_date.lte.${publicationTo})`);
          } else if (publicationFrom) {
            parts.push(`publication_date.gte.${publicationFrom}`);
          } else if (publicationTo) {
            parts.push(`publication_date.lte.${publicationTo}`);
          }
          parts.push("publication_date.is.null");
          query = query.or(parts.join(","));
        } else {
          if (publicationFrom) query = query.gte("publication_date", publicationFrom);
          if (publicationTo) query = query.lte("publication_date", publicationTo);
        }
      }

      const term = sanitize(search);
      if (term) {
        query = query.or(
          `title.ilike.%${term}%,buyer_name.ilike.%${term}%,object.ilike.%${term}%`,
        );
      }
      if (region && region !== "all") query = query.eq("region", region);
      if (status && status !== ("all" as TenderStatus)) {
        query = query.eq("status", status as TenderStatus);
      }
      if (procedures && procedures.length > 0) {
        query = query.in("procedure_type", procedures);
      } else if (procedure && procedure !== "all") {
        query = query.eq("procedure_type", procedure);
      }
      if (platform && platform !== "all") query = query.eq("source", platform);
      if (listingHost && listingHost !== "all") {
        query = query.ilike("enriched_data->raw->>_source_url", `%${listingHost}%`);
      }

      const { data, count, error } = await query;
      if (error) throw error;
      return { items: data ?? [], count: count ?? 0 };
    },
  });
}

export function useTender(id: string | undefined) {
  return useQuery({
    queryKey: ["tender", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenders")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useTenderAwards(tenderId: string | undefined) {
  return useQuery({
    queryKey: ["tender-awards", tenderId],
    enabled: !!tenderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("award_notices")
        .select("*")
        .eq("tender_id", tenderId!);
      if (error) throw error;
      return data ?? [];
    },
  });
}
