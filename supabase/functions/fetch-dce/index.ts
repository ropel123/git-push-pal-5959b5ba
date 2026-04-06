import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

interface FetchDceRequest {
  tender_id: string
  dce_url: string
}

// Detect platform from URL
function detectPlatform(url: string): string {
  if (/marches-publics\.gouv\.fr|place\.marches/i.test(url)) return 'place'
  if (/marches-publics\.info|aws-achat/i.test(url)) return 'mpi'
  if (/achatpublic\.com/i.test(url)) return 'achatpublic'
  if (/e-marchespublics\.com/i.test(url)) return 'emarchespublics'
  if (/marches-securises\.fr/i.test(url)) return 'marches-securises'
  if (/maximilien\.fr/i.test(url)) return 'maximilien'
  return 'generic'
}

// PLACE adapter: try to construct direct RC download link
async function fetchPlace(url: string): Promise<{ files: ArrayBuffer[] | null; enriched: Record<string, any> | null; error?: string }> {
  // Try to scrape the page for download links and metadata
  const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY')
  if (!firecrawlKey) {
    return { files: null, enriched: null, error: 'FIRECRAWL_API_KEY not configured' }
  }

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
      return { files: null, enriched: null, error: `Firecrawl error: ${scrapeData.error || scrapeRes.status}` }
    }

    const markdown = scrapeData.data?.markdown || scrapeData.markdown || ''
    const links = scrapeData.data?.links || scrapeData.links || []
    const metadata = scrapeData.data?.metadata || scrapeData.metadata || {}

    // Look for direct download links (RC, CCTP, etc.)
    const downloadLinks = links.filter((link: string) =>
      /download|reglement|telecharg|\.pdf$|\.zip$/i.test(link)
    )

    // Try to download the first PDF/ZIP link found
    let files: ArrayBuffer[] | null = null
    for (const dlLink of downloadLinks.slice(0, 3)) {
      try {
        const fileRes = await fetch(dlLink, { redirect: 'follow' })
        const contentType = fileRes.headers.get('content-type') || ''
        if (contentType.includes('pdf') || contentType.includes('zip') || contentType.includes('octet-stream')) {
          const buffer = await fileRes.arrayBuffer()
          if (buffer.byteLength > 1000) { // Skip tiny error pages
            files = [buffer]
            break
          }
        }
        await fileRes.text() // consume body
      } catch {
        // Skip failed downloads
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
    return { files: null, enriched: null, error: `PLACE scrape failed: ${err.message}` }
  }
}

// Generic adapter using Firecrawl
async function fetchGeneric(url: string): Promise<{ files: ArrayBuffer[] | null; enriched: Record<string, any> | null; error?: string }> {
  const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY')
  if (!firecrawlKey) {
    return { files: null, enriched: null, error: 'FIRECRAWL_API_KEY not configured' }
  }

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
      return { files: null, enriched: null, error: `Firecrawl error: ${scrapeData.error || scrapeRes.status}` }
    }

    const markdown = scrapeData.data?.markdown || scrapeData.markdown || ''
    const links = scrapeData.data?.links || scrapeData.links || []
    const metadata = scrapeData.data?.metadata || scrapeData.metadata || {}

    // Look for download links
    const downloadLinks = links.filter((link: string) =>
      /download|telecharg|\.pdf$|\.zip$|dce|reglement|cctp|cahier/i.test(link)
    )

    // Try to download files
    let files: ArrayBuffer[] | null = null
    for (const dlLink of downloadLinks.slice(0, 3)) {
      try {
        const fileRes = await fetch(dlLink, { redirect: 'follow' })
        const contentType = fileRes.headers.get('content-type') || ''
        if (contentType.includes('pdf') || contentType.includes('zip') || contentType.includes('octet-stream')) {
          const buffer = await fileRes.arrayBuffer()
          if (buffer.byteLength > 1000) {
            files = files || []
            files.push(buffer)
            if (files.length >= 3) break
          }
        }
        await fileRes.text()
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
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey)

    // Auth check — support service_role and batch mode
    const authHeader = req.headers.get('Authorization')
    let userId: string

    if (!authHeader) {
      // No auth = batch/test mode (function has verify_jwt=false)
      console.log('Batch mode — no auth header, using system user')
      userId = '00000000-0000-0000-0000-000000000000'
    } else {
      const token = authHeader.replace('Bearer ', '')
      const isServiceRole = token === supabaseKey
      if (isServiceRole) {
        console.log('Service role mode — bypassing user auth')
        userId = '00000000-0000-0000-0000-000000000000'
      } else {
        const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
          global: { headers: { Authorization: authHeader } },
        })
        const { data: { user }, error: authError } = await anonClient.auth.getUser()
        if (authError || !user) {
          return new Response(JSON.stringify({ error: 'Non autorisé' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        userId = user.id
      }
    }

    const { tender_id, dce_url }: FetchDceRequest = await req.json()
    if (!tender_id || !dce_url) {
      return new Response(JSON.stringify({ error: 'tender_id et dce_url requis' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const platform = detectPlatform(dce_url)
    console.log(`Fetching DCE for tender ${tender_id} from ${platform} (${dce_url})`)

    // Create tracking record
    const { data: download, error: insertError } = await supabaseAdmin
      .from('dce_downloads')
      .insert({
        tender_id,
        user_id: userId,
        platform,
        status: 'processing',
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('Insert error:', insertError)
      return new Response(JSON.stringify({ error: 'Erreur interne' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Route to the right adapter
    let result: { files: ArrayBuffer[] | null; enriched: Record<string, any> | null; error?: string }

    switch (platform) {
      case 'place':
        result = await fetchPlace(dce_url)
        break
      default:
        result = await fetchGeneric(dce_url)
        break
    }

    // If we got files, upload them to storage
    const uploadedFiles: string[] = []
    if (result.files && result.files.length > 0) {
      for (let i = 0; i < result.files.length; i++) {
        const filePath = `${userId}/${tender_id}/auto_${Date.now()}_${i}.pdf`
        const { error: uploadError } = await supabaseAdmin.storage
          .from('dce-documents')
          .upload(filePath, result.files[i], {
            contentType: 'application/pdf',
            upsert: true,
          })

        if (!uploadError) {
          uploadedFiles.push(filePath)
          // Also create a dce_uploads record
          await supabaseAdmin.from('dce_uploads').insert({
            tender_id,
            user_id: userId,
            file_name: `DCE_auto_${i + 1}.pdf`,
            file_path: filePath,
            file_size: result.files[i].byteLength,
          })
        } else {
          console.error('Upload error:', uploadError)
        }
      }
    }

    // Update enriched data on the tender if we got some
    if (result.enriched) {
      await supabaseAdmin
        .from('tenders')
        .update({ enriched_data: result.enriched })
        .eq('id', tender_id)
    }

    // Update download tracking
    const finalStatus = uploadedFiles.length > 0 ? 'success' : (result.enriched ? 'enriched_only' : 'failed')
    await supabaseAdmin
      .from('dce_downloads')
      .update({
        status: finalStatus,
        file_path: uploadedFiles[0] || null,
        enriched_data: result.enriched,
        error_message: result.error || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', download.id)

    return new Response(JSON.stringify({
      status: finalStatus,
      platform,
      files_uploaded: uploadedFiles.length,
      enriched: !!result.enriched,
      error: result.error || null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Unhandled error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
