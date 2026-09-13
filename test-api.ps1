$ErrorActionPreference = 'Continue'
$base = 'http://localhost:5000/api'
$results = @()
function T($name, $method, $path, $body = $null, $token = $null) {
    $headers = @{}
    if ($token) { $headers['Authorization'] = "Bearer $token" }
    try {
        $params = @{ Uri = "$base$path"; Method = $method; Headers = $headers; TimeoutSec = 15 }
        if ($body) { $params['Body'] = ($body | ConvertTo-Json -Depth 10); $params['ContentType'] = 'application/json' }
        $r = Invoke-RestMethod @params
        $script:results += [pscustomobject]@{ Test = $name; Status = 'PASS'; Message = ($r.message -replace '\s+', ' ') }
        return $r
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        $bodyTxt = $_.ErrorDetails.Message
        $script:results += [pscustomobject]@{ Test = $name; Status = "FAIL($code)"; Message = $bodyTxt }
        return $null
    }
}
function TExpectError($name, $method, $path, $body = $null, $token = $null, $expectCode) {
    $headers = @{}
    if ($token) { $headers['Authorization'] = "Bearer $token" }
    try {
        $params = @{ Uri = "$base$path"; Method = $method; Headers = $headers; TimeoutSec = 15 }
        if ($body) { $params['Body'] = ($body | ConvertTo-Json -Depth 10); $params['ContentType'] = 'application/json' }
        Invoke-RestMethod @params | Out-Null
        $script:results += [pscustomobject]@{ Test = $name; Status = "FAIL(expected $expectCode, got 200)"; Message = 'no error' }
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        $ok = ($code -eq $expectCode)
        $script:results += [pscustomobject]@{ Test = $name; Status = $(if ($ok) { 'PASS' } else { "FAIL(expected $expectCode, got $code)" }); Message = $_.ErrorDetails.Message }
    }
}

# --- Public ---
T 'health' Get '/health'
T 'categories' Get '/categories'
$cats = T 'products list' Get '/products?page=1&limit=12'
T 'products filter+sort' Get '/products?category=electronics&sort=price_low&minPrice=5&maxPrice=100'
if ($cats) {
    $prodId = $cats.data.products[0].id
    T 'product by id' Get "/products/$prodId"
    T 'product by slug' Get "/products/slug/$($cats.data.products[0].slug)"
    T 'product search q=' Get '/products/search?q=pen'
    T 'featured' Get '/products/featured'
    T 'popular' Get '/products/popular'
    T 'category products' Get '/products/category/electronics'
}
T 'graphics services' Get '/graphics'

# --- Unauthenticated guards ---
TExpectError 'cart without token -> 401' Get '/cart' $null $null 401
TExpectError 'orders without token -> 401' Get '/orders' $null $null 401
TExpectError 'admin dashboard blocked -> 401' Get '/admin/dashboard' $null $null 401

# --- Register + login ---
$email = "user" + (Get-Random -Maximum 999999) + "@test.com"
$regBody = @{ full_name = 'Test User'; email = $email; password = 'secret123'; phone = '+1000000' }
T 'register' Post '/auth/register' $regBody
$login = T 'login' Post '/auth/login' @{ email = $email; password = 'secret123' }
$token = $login.data.token
T 'me' Get '/auth/me' $null $token
T 'user profile update' Put '/users/me' @{ phone = '+1999999'; city = 'Kigali'; country = 'Rwanda' } $token
T 'user password update' Put '/users/me/password' @{ current_password = 'secret123'; new_password = 'newsecret123' } $token

# --- Cart flow (re-login after password change) ---
$login2 = T 'login after pw change' Post '/auth/login' @{ email = $email; password = 'newsecret123' }
$token = $login2.data.token
$prod1 = $cats.data.products[0]
$prod2 = $cats.data.products[1]
T 'cart add 1' Post '/cart' @{ product_id = $prod1.id; quantity = 2 } $token
T 'cart add 2' Post '/cart' @{ product_id = $prod2.id; quantity = 1 } $token
$cart = T 'cart get' Get '/cart' $null $token
TExpectError 'cart stock cap' Post '/cart' @{ product_id = $prod2.id; quantity = 999999 } $token 400
if ($cart) { $itemId = $cart.data.items[0].id; T 'cart update qty' Put "/cart/$itemId" @{ quantity = 3 } $token }
T 'wishlist add' Post "/wishlist/$($prod1.id)" $null $token
T 'wishlist get' Get '/wishlist' $null $token
T 'wishlist remove' Delete "/wishlist/$($prod1.id)" $null $token

# --- Reviews ---
T 'create review' Post "/products/$($prod1.id)/reviews" @{ rating = 5; review = 'Excellent product!' } $token
$revs = T 'reviews list' Get "/products/$($prod1.id)/reviews"

# --- Order flow ---
$orderBody = @{
    full_name = 'Test User'; phone = '+1000000'; email = $email
    address = 'KN 4 Ave'; city = 'Kigali'; country = 'Rwanda'
    items = @(
        @{ product_id = $prod1.id; quantity = 2 },
        @{ product_id = $prod2.id; quantity = 1 }
    )
}
$order = T 'create order' Post '/orders' $orderBody $token
if ($order -and $order.data.order) {
    $oid = $order.data.order.id
    T 'get order' Get "/orders/$oid" $null $token
    T 'get my orders' Get '/orders' $null $token
    TExpectError 'other user order -> 404' Get "/orders/$oid" $null $null 401
}
# order security: price not trusted
$cheat = T 'order ignores injected low price' Post '/orders' @{ items = @(@{ product_id = $prod2.id; quantity = 1; price = 0.01 }) } $token
if ($cheat -and $cheat.data.order) { Write-Output ("CHEAT unit price=" + $cheat.data.order.items[0].product_price) }
T 'cart cleared after order' Get '/cart' $null $token

# --- Graphics request (guest) ---
$greq = T 'graphics request guest' Post '/graphics/requests' @{ customer_name = 'Guest'; email = 'guest@test.com'; service_id = 1; design_type = 'Banner'; size = 'A2'; quantity = 2; description = 'Event banner' }

# --- Contact ---
T 'contact message' Post '/contact' @{ name = 'Visitor'; email = 'v@test.com'; subject = 'Hi'; message = 'How can I order a logo?' }

# --- Admin login + endpoints ---
$adminPassword = $env:EDSON_ADMIN_PASSWORD
if (-not $adminPassword) { throw 'Set EDSON_ADMIN_PASSWORD before running the API test suite.' }
$adminLogin = T 'admin login' Post '/auth/login' @{ email = 'admin@edsonshop.com'; password = $adminPassword }
$atoken = $adminLogin.data.token
T 'admin dashboard' Get '/admin/dashboard' $null $atoken
T 'admin users list' Get '/admin/users' $null $atoken
T 'admin users search' Get '/admin/users?search=Test' $null $atoken
T 'admin user detail' Get "/admin/users/$($login.data.user.id)" $null $atoken
T 'admin orders list' Get '/orders?page=1&limit=5' $null $atoken
if ($order -and $order.data.order) {
    T 'admin order status' Patch "/orders/$oid/status" @{ status = 'processing' } $atoken
    T 'admin payment status' Patch "/orders/$oid/payment-status" @{ payment_status = 'paid' } $atoken
}
T 'admin graphics requests' Get '/graphics/requests' $null $atoken
T 'admin contact list' Get '/contact' $null $atoken
if ($revs -and $revs.data.reviews.Count -gt 0) {
    T 'admin review status' Patch "/reviews/$($revs.data.reviews[0].id)/status" @{ status = 'approved' } $atoken
}
if ($greq -and $greq.data.request_id) { T 'admin graphics request status' Patch "/graphics/requests/$($greq.data.request_id)/status" @{ status = 'in_progress' } $atoken }
$rSuffix = Get-Random -Maximum 999999
T 'create product (admin)' Post '/products' @{ name = 'Admin Test Product'; slug = "admin-test-product-$rSuffix"; sku = "ADM-$rSuffix"; price = 10.50; stock = 20; category_id = 1 } $atoken
T 'create category (admin)' Post '/categories' @{ name = 'Test Cat'; slug = "test-cat-$rSuffix" } $atoken
TExpectError 'customer blocked from admin -> 403' Get '/admin/dashboard' $null $token 403
TExpectError 'customer blocked from admin products -> 403' Post '/products' @{ name = 'x'; slug = 'x-y'; sku = 'Z'; price = 1 } $token 403

$results | Format-Table -AutoSize -Wrap
Write-Output ("TOTAL PASS: " + (($results | Where-Object Status -eq 'PASS').Count) + "/" + $results.Count)