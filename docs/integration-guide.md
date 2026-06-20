# Magic Affiliate Network — Integration Guide

**Website:** `https://www.magicmedia.asia`
**Tracking domain:** `https://go.magicmedia.asia`
**API:** `https://magicaffiliatenetwork-production-6926.up.railway.app`

---

## Mục lục

1. [Tổng quan luồng hoạt động](#1-tổng-quan-luồng-hoạt-động)
2. [Tích hợp với hệ thống hiện có (không cần code)](#2-tích-hợp-với-hệ-thống-hiện-có-không-cần-code)
3. [Tích hợp hệ thống mới (cần code)](#3-tích-hợp-hệ-thống-mới-cần-code)
4. [Tham số postback chi tiết](#4-tham-số-postback-chi-tiết)
5. [Outbound Postback (Magic → Publisher Tracker)](#5-outbound-postback-magic--publisher-tracker)
6. [Ví dụ tích hợp thực tế](#6-ví-dụ-tích-hợp-thực-tế)
7. [FAQ & Troubleshooting](#7-faq--troubleshooting)

---

## 1. Tổng quan luồng hoạt động

```
Publisher click link                  Advertiser/MMP bắn postback
        │                                      │
        ▼                                      ▼
GET go.magicmedia.asia               GET/POST /postback/{source}
  /click/t/{offerId}              ?xid=...&offer_id=...
  ?pub={publisherId}                    &payout=...&sa={pubId}
        │                                      │
        ▼                                      ▼
  Log Click → 302 redirect            Match Offer + Publisher
  đến trang advertiser                 Tính commission → Lưu DB
                                               │
                                               ▼
                                      Nếu APPROVED + pub có postbackUrl
                                        → Gửi postback đến publisher tracker
```

### Hệ thống hiện hỗ trợ 3 nguồn (MMP):

| MMP | Endpoint | Trạng thái |
|-----|----------|-----------|
| **CityAds** | `POST/GET /postback/cityads` | Production |
| **AppsFlyer** | `POST/GET /postback/appsflyer` | Production |
| **Adjust** | `POST/GET /postback/adjust` | Production |

---

## 2. Tích hợp với hệ thống hiện có (không cần code)

Nếu đối tác sử dụng **CityAds, AppsFlyer, hoặc Adjust** thì chỉ cần cấu hình — không cần code.

### Bước 1: Tạo Offer trên Magic

Vào Admin → Offers → New Offer:

| Field | Mô tả | Ví dụ |
|-------|--------|-------|
| Name | Tên offer | `Shopee VN CPS` |
| MMP Source | Chọn nguồn MMP | `CITYADS` / `APPSFLYER` / `ADJUST` |
| App ID | ID app/offer **trên MMP** | `12345` (CityAds offer ID) |
| Commission Type | Loại hoa hồng | `FLAT_CPA` hoặc `PERCENT_REVENUE` |
| Commission Value | Giá trị | `5` (5 USD hoặc 5%) |
| Currency | Tiền tệ | `USD` / `VND` / `RUB` |
| Destination URL | Link gốc advertiser | `https://shopee.vn/campaign?...` |

### Bước 2: Đăng ký Postback URL trên MMP

Lấy postback URL từ Admin → Settings → Postback Endpoints, rồi đăng ký trên MMP:

#### CityAds
```
https://magicaffiliatenetwork-production-6926.up.railway.app/postback/cityads?xid={click_id}&offer_id={offer_id}&payout={payout}&payout_currency={payout_currency}&sa={sub_id}&status={action_status}&action_type={action_type}&conversion_time={action_date}&order_total={order_sum}&order_total_currency={order_currency}
```

#### AppsFlyer
```
https://magicaffiliatenetwork-production-6926.up.railway.app/postback/appsflyer?af_tranid={transaction_id}&app_id={app_id}&event_name={event_name}&event_revenue={event_revenue}&event_revenue_currency={event_revenue_currency}&af_sub1={sub_param_1}&install_time={install_time}
```

#### Adjust
```
https://magicaffiliatenetwork-production-6926.up.railway.app/postback/adjust?transaction_id={transaction_id}&app_token={app_token}&event_token={event_token}&revenue={revenue}&currency={currency}&partner_parameter_1={partner_parameter_1}&created_at={created_at}
```

### Bước 3: Gán Publisher tracking link

Publisher vào Portal → Offers → Copy tracking link:
```
https://go.magicmedia.asia/click/t/{offerId}?pub={publisherId}
```

**Xong! Không cần code gì thêm.**

---

## 3. Tích hợp hệ thống mới (cần code)

Khi đối tác sử dụng MMP/hệ thống **chưa được hỗ trợ** (ví dụ: HasOffers, Everflow, Impact, Cake, hệ thống tự build...), cần thêm code.

### Cần cung cấp cho developer:

| Thông tin | Mô tả | Ví dụ |
|-----------|--------|-------|
| Tên hệ thống | Tên MMP/platform | `HasOffers` |
| Postback URL format | URL mà hệ thống sẽ gọi đến Magic khi có conversion | `GET /postback/hasoffers?...` |
| Các tham số (params) | Danh sách query params hệ thống gửi kèm | `transaction_id`, `offer_id`, `payout`, `affiliate_id` |
| Param chứa Publisher ID | Tham số nào chứa publisher_id để match | `affiliate_id` hoặc `sub1` |
| Param chứa Offer/App ID | Tham số nào chứa offer ID để match | `offer_id` |
| Param chứa Dedup ID | Tham số nào là unique transaction ID | `transaction_id` |
| Param chứa Revenue | Tham số nào chứa giá trị đơn hàng | `payout` hoặc `revenue` |
| Param chứa Status | Tham số nào chứa trạng thái conversion | `status` (approved/rejected/pending) |

### Quy trình thêm MMP mới:

**File cần sửa:**

1. **`api/prisma/schema.prisma`** — Thêm giá trị enum:
```prisma
enum MmpSource {
  APPSFLYER
  ADJUST
  CITYADS
  HASOFFERS    // ← thêm mới
}
```

2. **`api/src/routes/postback.ts`** — Thêm endpoint mới:
```typescript
// Thêm route handler mới, pattern giống các MMP hiện có:
server.get('/postback/hasoffers', async (req, reply) => {
  const q = req.query as Record<string, string>

  // 1. Parse params từ hệ thống mới
  const sourceRefId = q.transaction_id        // Dedup ID
  const appId = q.offer_id                    // Match Offer
  const publisherIdRaw = q.affiliate_id       // Match Publisher
  const revenue = parseFloat(q.payout) || 0
  const currency = q.currency || 'USD'
  const eventType = q.event_type || 'conversion'
  const statusRaw = q.status || 'approved'

  // 2. Lookup Offer
  const offer = await prisma.offer.findFirst({
    where: { appId, mmpSource: 'HASOFFERS', status: 'ACTIVE' }
  })

  // 3. Lookup Publisher, calculate commission, create Conversion
  // ... (copy logic từ CityAds/AppsFlyer handler)
})
```

3. **`api/prisma/migrations/`** — Tạo migration cho enum mới:
```sql
ALTER TYPE "MmpSource" ADD VALUE 'HASOFFERS';
```

4. **`api/src/routes/click.ts`** — Click route đã generic, dùng `/click/t/:offerId` cho tất cả MMP. Không cần thêm route mới.
```

### Thời gian ước tính:
- MMP có postback format đơn giản: **30 phút - 1 giờ**
- Hệ thống phức tạp (OAuth, callback xác thực): **2-4 giờ**

---

## 4. Tham số postback chi tiết

### Bảng mapping params theo từng MMP:

| Mục đích | CityAds | AppsFlyer | Adjust |
|----------|---------|-----------|--------|
| **Dedup ID** | `xid` | `af_tranid` | `transaction_id` |
| **Offer/App ID** | `offer_id` | `app_id` | `app_token` |
| **Publisher ID** | `sa` | `af_sub1` | `partner_parameter_1` |
| **Revenue** | `payout` | `event_revenue` | `revenue` |
| **Currency** | `payout_currency` | `event_revenue_currency` | `currency` |
| **Event type** | `action_type` | `event_name` | `event_token` |
| **Status** | `status` | *(auto)* | *(auto)* |
| **Timestamp** | `conversion_time` | `install_time` | `created_at` |

### Logic tính Commission:

```
Nếu commissionType = FLAT_CPA:
    commission = commissionValue
    (ví dụ: $5 cho mỗi conversion)

Nếu commissionType = PERCENT_REVENUE:
    commission = revenue × commissionValue / 100
    (ví dụ: 10% × $50 = $5)
```

### Logic xác định Status:

| Điều kiện | Status |
|-----------|--------|
| Publisher tìm thấy + có revenue (nếu PERCENT) | `APPROVED` |
| Publisher không tìm thấy | `PENDING` |
| PERCENT_REVENUE nhưng revenue = 0 | `PENDING` |
| CityAds status = rejected/declined | `REJECTED` |

### Dedup (chống trùng):

Mỗi conversion unique theo `(sourceType, sourceRefId)`. Nếu trùng → bỏ qua, trả `{ok: true, reason: 'duplicate'}`.

---

## 5. Outbound Postback (Magic → Publisher Tracker)

Khi conversion được APPROVED và publisher có cấu hình `postbackUrl`, hệ thống tự động gửi postback đến tracker của publisher.

### Publisher cấu hình URL template:

```
https://tracker.publisher.com/postback?payout={payout}&event={event}&order={order_id}&status={status}
```

### Các macro hỗ trợ:

| Macro | Giá trị | Ví dụ |
|-------|---------|-------|
| `{payout}` | Commission amount | `5.00` |
| `{event}` | Event type | `purchase` |
| `{order_id}` | MMP transaction ID | `abc123` |
| `{status}` | Trạng thái | `approved` |
| `{click_id}` | Publisher ID | `pub_xyz` |
| `{offer_id}` | Offer ID | `offer_abc` |
| `{offer_name}` | Tên offer | `Shopee VN CPS` |

### Bảo mật:

- Chỉ cho phép `http://` và `https://`
- Chặn private IP (localhost, 127.*, 10.*, 192.168.*, 172.16-31.*)
- Timeout: 10 giây
- Fire-and-forget (không retry)

---

## 6. Ví dụ tích hợp thực tế

### Ví dụ: Tích hợp CityAds cho Shopee VN

**1. Tạo Offer:**
- Name: `Shopee VN CPS`
- MMP Source: `CITYADS`
- App ID: `12345` (offer ID trên CityAds)
- Commission: `PERCENT_REVENUE` — `80%`
- Currency: `VND`
- Destination URL: `https://shopee.vn/...`

**2. Đăng ký postback trên CityAds:**
```
https://magicaffiliatenetwork-production-6926.up.railway.app/postback/cityads?xid={click_id}&offer_id=12345&payout={payout}&payout_currency=VND&sa={sub_id}&status={action_status}&action_type={action_type}
```

**3. Publisher tracking link:**
```
https://go.magicmedia.asia/click/t/{offerId}?pub={publisherId}
```

**4. Khi có conversion:**
```
CityAds → Magic: /postback/cityads?xid=abc&offer_id=12345&payout=50000&sa=pub1&status=approved
Magic → DB: Conversion { revenue: 50000 VND, commission: 40000 VND (80%), status: APPROVED }
Magic → Publisher tracker: GET https://tracker.pub.com/postback?payout=40000&event=sale&status=approved
```

### Ví dụ: Tích hợp AppsFlyer cho App Game

**1. Tạo Offer:**
- Name: `Game XYZ Install`
- MMP Source: `APPSFLYER`
- App ID: `com.game.xyz` (bundle ID)
- Commission: `FLAT_CPA` — `$2`
- Currency: `USD`

**2. Đăng ký postback trên AppsFlyer:**
```
https://magicaffiliatenetwork-production-6926.up.railway.app/postback/appsflyer?af_tranid={transaction_id}&app_id=com.game.xyz&event_name={event_name}&event_revenue={event_revenue}&af_sub1={sub_param_1}
```

**3. Khi user install:**
```
AppsFlyer → Magic: /postback/appsflyer?af_tranid=txn123&app_id=com.game.xyz&event_name=install&af_sub1=pub1
Magic → DB: Conversion { revenue: 0, commission: $2 (FLAT), status: APPROVED }
```

---

## 7. FAQ & Troubleshooting

### Q: Tích hợp hệ thống mới có cần code không?
**A:** Phụ thuộc:
- **Không cần code** nếu hệ thống là CityAds, AppsFlyer, hoặc Adjust — chỉ cần cấu hình Offer + postback URL
- **Cần code** nếu hệ thống là MMP khác hoặc hệ thống tự build — cần thêm endpoint mới trong `api/src/routes/postback.ts`

### Q: Conversion bị PENDING là sao?
**A:** Kiểm tra:
1. Publisher ID trong postback có đúng không? (param `sa`, `af_sub1`, `partner_parameter_1`)
2. Publisher đó có tồn tại trong hệ thống không?
3. Nếu PERCENT_REVENUE: revenue có > 0 không?

### Q: Postback bị duplicate?
**A:** Hệ thống tự chống trùng theo `(sourceType, sourceRefId)`. Conversion trùng sẽ bị bỏ qua, không tạo bản ghi mới.

### Q: Làm sao debug postback?
**A:** Vào Admin → Postback Logs để xem:
- Raw query params nhận được
- Kết quả xử lý (ok/error)
- Lý do lỗi (offer not found, duplicate, etc.)

### Q: Publisher không nhận được postback?
**A:** Kiểm tra:
1. Publisher có cấu hình `postbackUrl` trong profile không?
2. Conversion status có phải APPROVED không? (chỉ APPROVED mới gửi outbound)
3. Xem `postbackStatus` của conversion — `0` = URL bị chặn (private IP), `4xx/5xx` = lỗi phía publisher

### Q: Tracking link không hoạt động?
**A:** Kiểm tra:
1. Env var `TRACKING_DOMAIN` trên Web service đã set chưa?
2. DNS `go.magicmedia.asia` đã trỏ đúng CNAME về API service chưa?
3. Offer có status `ACTIVE` không?

---

## Tóm tắt nhanh

| Muốn làm gì | Cần code? | Thao tác |
|-------------|-----------|----------|
| Thêm offer CityAds/AppsFlyer/Adjust | Không | Tạo Offer + đăng ký postback URL trên MMP |
| Thêm MMP mới (HasOffers, Everflow...) | Có | Thêm enum + endpoint trong postback.ts |
| Thêm publisher mới | Không | Publisher tự đăng ký, admin approve |
| Đổi tracking domain | Không | Sửa env var TRACKING_DOMAIN + DNS |
| Thêm loại commission mới | Có | Sửa enum CommType + logic tính |
