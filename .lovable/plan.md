

# Fix DCE file download — blocked by browser

## Problem

When clicking to download a DCE file, `window.open(signedUrl, "_blank")` opens a new tab to the Supabase storage URL. Chrome (or an ad blocker extension) blocks this as `ERR_BLOCKED_BY_CLIENT` because the URL pattern triggers content-blocking rules.

## Solution

Replace `window.open()` with a programmatic download: fetch the signed URL as a blob, create a temporary `<a>` element with a `download` attribute, and trigger a click. This downloads the file directly without opening a new tab, bypassing browser/extension blocking.

## Implementation

**File: `src/components/DceUploadSection.tsx`**

1. In `downloadFile`, after obtaining the signed URL:
   - `fetch()` the signed URL to get a blob
   - Create an object URL from the blob
   - Create a temporary `<a>` element with `href=objectURL` and `download=filename`
   - Programmatically click it, then revoke the object URL
2. Keep the loading spinner during the entire download process (not just URL generation)

