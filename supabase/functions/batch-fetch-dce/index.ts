import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const BATCH_SIZE = 5 // Conservative to stay within 60s timeout

function detectPlatform(url: string): string {
  if (/marches-publics\.gouv\.fr|place\.marches/i.test(url)) return 'place'
  if (/marches-publics\.info|aws-achat/i.test(url)) return 'mpi'
  if (/achatpublic\.com/i.test(url)) return 'achatpublic'
  if (/e-marchespublics\.com/i.test(url)) return 'emarchespublics'
  if (/marches-securises\.fr/i.test(url)) return 'marches-securises'
  if (/maximilien\.fr/i.test(url)) return 'maximilien'
  return 'generic'
}

async function scrapePage(url: string, firecrawlKey: string): Promise<{
  files: ArrayBuffer[] | null
  enriched: Record<string, any> | null
  error?: string
}> {
  try {
    const scrapeRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown', 'links'],
        onlyMainContent: false,
        waitFor: 3000,
      }),
    })

    const scrapeData = await scrapeRes.json()
    if (!scrapeRes.ok) {
      return { files: null, enriched: null, error: `Firecrawl ${scrapeData.error || scrapeRes.status}` }
    }

    const markdown = scrapeData.data?.markdown || scrapeData.markdown || ''
    const links = scrapeData.data?.links || scrapeData.links || []
    const metadata = scrapeData.data?.metadata || scrapeData.metadata || {}

    // Find download links
    const downloadLinks = links.filter((link: string) =>
      /download|telecharg|\.pdf$|\.zip$|dce|reglement|cctp|cahier/i.test(link)
    )

    // Try to download files
    let files: ArrayBuffer[] | null = null
    for (const dlLink of downloadLinks.slice(0, 2)) {
      try {
        const fileRes = await fetch(dlLink, { redirect: 'follow' })
        const contentType = fileRes.headers.get('content-type') || ''
        if (contentType.includes('pdf') || contentType.includes('zip') || contentType.includes('octet-stream')) {
          const buffer = await fileRes.arrayBuffer()
          if (buffer.byteLength > 1000) {
            files = files || []
            files.push(buffer)
            break // One file is enough for batch
          }
        }
        await fileRes.text() // consume body
      } catch {
        // Skip
      }
    }

    return {
      files,
      enriched: {
        scraped_description: markdown.slice(0, 5000),
        download_links: downloadLinks,
        page_title: metadata.title || null,
        scraped_at: new Date().toISOString(),
      },
    }
  } catch (err) {
    return { files: null, enriched: null, error: `Scrape failed: ${err.message}` }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY')
    const supabase = createClient(supabaseUrl, supabaseKey)

    if (!firecrawlKey) {
      return new Response(JSON.stringify({ error: 'FIRECRAWL_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Parse optional filters from body
    let platformFilter: string | null = null
    let limit = BATCH_SIZE
    try {
      const body = await req.json()
      platformFilter = body.platform_filter || null
      limit = Math.min(body.limit || BATCH_SIZE, 10)
    } catch {
      // No body = defaults
    }

    // Use RPC to get unprocessed tenders efficiently (LEFT JOIN in SQL)
    const { data: toProcess, error: queryError } = await supabase
      .rpc('get_unprocessed_tenders', { _limit: limit, _platform_filter: platformFilter })

    if (queryError) {
      console.error('Query error:', queryError)
      return new Response(JSON.stringify({ error: 'Query failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Filter by platform if needed (RPC doesn't filter by platform yet)
    const filtered = platformFilter
      ? (toProcess || []).filter((t: any) => detectPlatform(t.dce_url) === platformFilter)
      : (toProcess || [])

    if (filtered.length === 0) {
      return new Response(JSON.stringify({
        message: 'No unprocessed tenders found',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`Processing ${filtered.length} tenders...`)

    const results: any[] = []
    const systemUserId = '00000000-0000-0000-0000-000000000000'

    for (const tender of filtered) {
      const platform = detectPlatform(tender.dce_url)
      console.log(`[${platform}] ${tender.id} — ${tender.title?.slice(0, 60)}`)

      const result = await scrapePage(tender.dce_url, firecrawlKey)

      // Upload files if found
      const uploadedFiles: string[] = []
      if (result.files) {
        for (let i = 0; i < result.files.length; i++) {
          const filePath = `${systemUserId}/${tender.id}/auto_${Date.now()}_${i}.pdf`
          const { error: uploadError } = await supabase.storage
            .from('dce-documents')
            .upload(filePath, result.files[i], {
              contentType: 'application/pdf',
              upsert: true,
            })
          if (!uploadError) {
            uploadedFiles.push(filePath)
            await supabase.from('dce_uploads').insert({
              tender_id: tender.id,
              user_id: systemUserId,
              file_name: `DCE_auto_${i + 1}.pdf`,
              file_path: filePath,
              file_size: result.files[i].byteLength,
            })
          }
        }
      }

      // Update enriched data on tender
      if (result.enriched) {
        await supabase
          .from('tenders')
          .update({ enriched_data: result.enriched })
          .eq('id', tender.id)
      }

      // Track download
      const status = uploadedFiles.length > 0 ? 'success' : (result.enriched ? 'enriched_only' : 'failed')
      await supabase.from('dce_downloads').insert({
        tender_id: tender.id,
        user_id: systemUserId,
        platform,
        status,
        file_path: uploadedFiles[0] || null,
        enriched_data: result.enriched,
        error_message: result.error || null,
      })

      results.push({
        tender_id: tender.id,
        platform,
        status,
        files: uploadedFiles.length,
        error: result.error || null,
      })
    }

    const summary = {
      processed: results.length,
      success: results.filter(r => r.status === 'success').length,
      enriched_only: results.filter(r => r.status === 'enriched_only').length,
      failed: results.filter(r => r.status === 'failed').length,
      total_in_db: processedIds.size + results.length,
      results,
    }

    console.log(`Batch done: ${summary.success} success, ${summary.enriched_only} enriched, ${summary.failed} failed`)

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Batch error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
