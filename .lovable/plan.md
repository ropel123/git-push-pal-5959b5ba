

## Set Hackify logo as favicon

### Steps

1. **Copy the uploaded image** to `public/favicon.png`
2. **Delete** the existing `public/favicon.ico` if present
3. **Update `index.html`** to reference the new favicon:
   ```html
   <link rel="icon" href="/favicon.png" type="image/png">
   ```

### Technical details
- The uploaded screenshot will be copied from `user-uploads://Capture_d_écran_2026-04-09_à_15.59.26.png` to `public/favicon.png`
- The existing favicon.ico (if any) will be removed to prevent browser override
- The `<link rel="icon">` tag in `index.html` will point to the new PNG file

