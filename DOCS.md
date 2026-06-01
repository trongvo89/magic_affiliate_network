# Magic Affiliate Network — Tài liệu vận hành

**API:** `https://magicaffiliatenetwork-production-6926.up.railway.app`  
**Web:** `https://magicaffiliatenetwork-production-a45f.up.railway.app`

---

## Mục lục

1. [Tổng quan hệ thống](#1-tổng-quan-hệ-thống)
2. [Admin — Quản lý Offer](#2-admin--quản-lý-offer)
3. [Admin — Quản lý Publisher](#3-admin--quản-lý-publisher)
4. [Thiết lập Postback từ MMP (AppsFlyer / Adjust)](#4-thiết-lập-postback-từ-mmp-appsflyer--adjust)
5. [Publisher — Đăng ký và thiết lập](#5-publisher--đăng-ký-và-thiết-lập)
6. [Conversions — Upload thủ công và cập nhật trạng thái](#6-conversions--upload-thủ-công-và-cập-nhật-trạng-thái)
7. [Trạng thái Conversion](#7-trạng-thái-conversion)
8. [API Reference](#8-api-reference)

---

## 1. Tổng quan hệ thống

```
Advertiser (MMP)
     │  bắn postback khi có event (install, purchase...)
     ▼
API /postback/{source}           ← nhận từ AppsFlyer hoặc Adjust
     │
     ├─ match Offer theo app_id + mmpSource
     ├─ match Publisher theo publisher_id trong query
     ├─ tạo Conversion (status = APPROVED)
     └─ gửi outbound postback → Publisher tracker URL
                                      │
                              Publisher theo dõi
                              đơn + hoa hồng
```

**Các role:**
- **ADMIN** — quản lý toàn hệ thống, duyệt publisher, tạo offer, upload conversion thủ công
- **PUBLISHER** — xem đơn của mình, cấu hình postback tracker URL

---

## 2. Admin — Quản lý Offer

### Tạo Offer mới

Vào **Admin → Offers → + New Offer**, điền:

| Trường | Mô tả | Ví dụ |
|--------|-------|-------|
| Offer Name | Tên nội bộ | `Shopee VN CPA` |
| App Name | Tên app | `Shopee` |
| App ID | Bundle ID — **phải khớp chính xác với cấu hình trong MMP** | `com.shopee.vn` |
| MMP Source | `APPSFLYER` hoặc `ADJUST` | `APPSFLYER` |
| Commission Type | `FLAT_CPA` (cố định) hoặc `PERCENT_REVENUE` (%) | `FLAT_CPA` |
| Commission Value | Số tiền hoặc % | `2.00` |
| Currency | `USD` hoặc `VND` | `USD` |

> **Lưu ý:** `App ID` là trường duy nhất hệ thống dùng để match đơn từ MMP về. Nếu sai, conversion không gắn được vào offer nào.

---

## 3. Admin — Quản lý Publisher

### Duyệt Publisher

Vào **Admin → Publishers** — publisher mới đăng ký sẽ ở trạng thái `PENDING`.  
Nhấn **Approve** để kích hoạt tài khoản, hoặc **Suspend** để vô hiệu hóa.

### Lấy Publisher ID

Cột **Publisher ID** hiển thị 8 ký tự đầu của ID. Nhấn **⎘** để copy full ID.

Full Publisher ID dùng để:
- Gắn vào postback URL của advertiser (tham số `af_sub1` với AppsFlyer, `partner_parameter_1` với Adjust)
- Upload conversion thủ công (cột `publisher_id` trong CSV)

---

## 4. Thiết lập Postback từ MMP (AppsFlyer / Adjust)

Đây là luồng chính khi advertiser đã tích hợp MMP. Hệ thống nhận postback **tự động**.

### 4.1 AppsFlyer

**Endpoint nhận postback:**
```
GET/POST https://magicaffiliatenetwork-production-6926.up.railway.app/postback/appsflyer
```

**Cấu hình trong AppsFlyer Dashboard → Partner Configuration → Postback:**

| Tham số AppsFlyer | Mục đích | Bắt buộc |
|-------------------|----------|----------|
| `af_tranid` | ID giao dịch duy nhất — dùng để dedup | ✅ |
| `app_id` | Bundle ID app — phải khớp với App ID trong Offer | ✅ |
| `event_name` | Tên event (install, purchase...) | ✅ |
| `event_revenue` | Doanh thu (cho % commission) | ✅ nếu dùng PERCENT_REVENUE |
| `event_revenue_currency` | Currency | tuỳ |
| `af_sub1` | **Publisher ID** — quan trọng nhất | ✅ để ghi nhận đúng publisher |
| `install_time` | Thời điểm event | tuỳ |

**Ví dụ URL postback gửi về:**
```
https://magicaffiliatenetwork-production-6926.up.railway.app/postback/appsflyer
  ?af_tranid=TXN12345
  &app_id=com.shopee.vn
  &event_name=purchase
  &event_revenue=25.00
  &event_revenue_currency=USD
  &af_sub1=PUB_ID_CUA_PUBLISHER
```

### 4.2 Adjust

**Endpoint nhận postback:**
```
GET/POST https://magicaffiliatenetwork-production-6926.up.railway.app/postback/adjust
```

**Cấu hình trong Adjust Dashboard → Partner Setup → Callback URL:**

| Tham số Adjust | Mục đích | Bắt buộc |
|----------------|----------|----------|
| `transaction_id` | ID giao dịch duy nhất | ✅ |
| `app_token` | Token app trong Adjust — match với App ID trong Offer | ✅ |
| `event_token` | Tên/loại event | ✅ |
| `revenue` | Doanh thu | ✅ nếu dùng PERCENT_REVENUE |
| `currency` | Currency | tuỳ |
| `created_at` | Thời điểm event | tuỳ |
| `partner_parameter_1` | **Publisher ID** | ✅ để ghi nhận đúng publisher |

**Ví dụ URL postback gửi về:**
```
https://magicaffiliatenetwork-production-6926.up.railway.app/postback/adjust
  ?transaction_id=ADJ99999
  &app_token=abc123token
  &event_token=purchase
  &revenue=30.00
  &currency=USD
  &partner_parameter_1=PUB_ID_CUA_PUBLISHER
```

### 4.3 Logic xử lý khi nhận postback

1. Tìm Offer theo `app_id` (hoặc `app_token`) + MMP source → nếu không tìm thấy, bỏ qua (trả về `{"ok": true, "reason": "offer not found"}`)
2. Tìm Publisher theo ID trong `af_sub1` / `partner_parameter_1` → nếu không tìm thấy, vẫn tạo conversion nhưng không gắn publisher
3. Tính hoa hồng: FLAT_CPA = giá trị cố định; PERCENT_REVENUE = revenue × rate / 100
4. Tạo Conversion với status = `APPROVED`
5. Nếu publisher có postback URL → gửi outbound postback ngay lập tức
6. **Dedup:** nếu `(sourceType, sourceRefId)` đã tồn tại → bỏ qua, không tạo trùng

---

## 5. Publisher — Đăng ký và thiết lập

### 5.1 Đăng ký tài khoản

1. Vào web → **Register** → điền email, mật khẩu, tên
2. Chờ Admin **Approve** tài khoản (status chuyển từ PENDING → ACTIVE)
3. Sau khi được duyệt, có thể đăng nhập và xem dashboard

### 5.2 Lấy Publisher ID

Vào **Settings** → mục **Your Publisher ID** → copy full ID.  
Gửi ID này cho Admin hoặc Advertiser để được gắn vào postback URL.

### 5.3 Cấu hình Postback Tracker URL

Vào **Settings → Postback URL** — đây là URL trên tracker của bạn mà hệ thống sẽ gọi khi có conversion được duyệt.

**Macros có thể dùng:**

| Macro | Giá trị |
|-------|---------|
| `{payout}` | Số tiền hoa hồng |
| `{event}` | Tên event (install, purchase...) |
| `{order_id}` | sourceRefId của conversion |
| `{status}` | `approved` |
| `{click_id}` | Publisher ID |

**Ví dụ:**
```
https://tracker.example.com/postback?payout={payout}&event={event}&order={order_id}&pub={click_id}
```

---

## 6. Conversions — Upload thủ công và cập nhật trạng thái

Dùng khi advertiser **không bắn được postback tự động** (vấn đề kỹ thuật, hay chỉ gửi file báo cáo).

### 6.1 Upload thủ công — đơn mới (Pending)

Vào **Admin → Conversions → Upload CSV → tab "Tạo mới"**

**Format CSV:**
```csv
publisher_id,offer_id,event_type,revenue,event_at,source_ref_id
clxabc123,clxoffer456,purchase,25.50,2026-05-28,REF-001
clxabc123,clxoffer456,install,0,2026-05-29,REF-002
```

| Cột | Mô tả | Bắt buộc |
|-----|-------|----------|
| `publisher_id` | Full Publisher ID (copy từ trang Publishers) | ✅ |
| `offer_id` | Full Offer ID (copy từ trang Offers) | ✅ |
| `event_type` | `install`, `purchase`, `registration`... | ✅ |
| `revenue` | Doanh thu (để tính % commission, để 0 nếu FLAT_CPA) | tuỳ |
| `event_at` | Ngày event, format `YYYY-MM-DD` | ✅ |
| `source_ref_id` | ID đơn của advertiser — để dedup và update sau | nên có |

Tất cả đơn upload qua tab này sẽ có status = **PENDING**.

Cũng có thể tạo từng đơn một bằng nút **+ Add Manual**.

### 6.2 Cập nhật trạng thái theo lô — từ file báo cáo advertiser

Vào **Admin → Conversions → Upload CSV → tab "Cập nhật trạng thái"**

Khi advertiser gửi file kết quả duyệt đơn, dùng tab này để bulk update:

**Format CSV:**
```csv
source_ref_id,status
REF-001,APPROVED
REF-002,REJECTED
REF-003,PENDING
```

Hoặc dùng internal ID nếu không có source_ref_id:
```csv
id,status
clxconv789,APPROVED
```

Hệ thống match theo `source_ref_id` (ưu tiên) hoặc `id`, update status tương ứng.

### 6.3 Approve/Reject từng đơn

Trên bảng Conversions, mỗi dòng có 3 nút:
- **✓** → chuyển sang APPROVED
- **~** → chuyển về PENDING
- **✕** → chuyển sang REJECTED

Chỉ hiện nút của trạng thái khác trạng thái hiện tại.

---

## 7. Trạng thái Conversion

| Status | Ý nghĩa |
|--------|---------|
| `PENDING` | Mới nhận / chưa được advertiser xác nhận |
| `APPROVED` | Đã duyệt — hoa hồng được tính vào "Total Approved" của publisher |
| `REJECTED` | Đơn bị từ chối (fraud, điều kiện không đạt...) |

Postback tự động từ MMP → vào thẳng `APPROVED`.  
Upload thủ công → vào `PENDING`, cần update sau khi có kết quả từ advertiser.

---

## 8. API Reference

### Auth

```
POST /auth/login
Body: { email, password }
Response: { token, user }
```

```
POST /auth/register
Body: { email, password, name }
Response: { token, user }
```

### Admin Endpoints (yêu cầu Bearer token của ADMIN)

```
GET  /admin/stats
GET  /admin/offers
POST /admin/offers
PUT  /admin/offers/:id

GET  /admin/publishers
GET  /admin/publishers/pending
PUT  /admin/publishers/:id         Body: { status: ACTIVE | SUSPENDED | PENDING }

GET  /admin/conversions            ?page=1&limit=20&offerId=&publisherId=&status=&from=&to=
POST /admin/conversions            Body: { publisherId, offerId, eventType, revenue?, eventAt, sourceRefId?, status? }
PUT  /admin/conversions/:id        Body: { status: PENDING | APPROVED | REJECTED }
POST /admin/conversions/bulk       Body: { rows: [...] }
PUT  /admin/conversions/bulk-status Body: { rows: [{ sourceRefId, status } | { id, status }] }
```

### Publisher Endpoints (yêu cầu Bearer token của PUBLISHER)

```
GET /publisher/stats
GET /publisher/conversions         ?page=1&limit=30
GET /publisher/profile
PUT /publisher/profile             Body: { name?, postbackUrl?, password?, currentPassword? }
```

### Postback Endpoints (public — gọi từ MMP)

```
GET/POST /postback/appsflyer       Query: af_tranid, app_id, event_name, event_revenue, af_sub1...
GET/POST /postback/adjust          Query: transaction_id, app_token, event_token, revenue, partner_parameter_1...
```

---

## Checklist triển khai mới

- [ ] Admin tạo Offer với đúng `App ID` khớp với MMP
- [ ] Publisher đăng ký → Admin approve
- [ ] Publisher copy Publisher ID → gửi cho advertiser để gắn vào postback URL (`af_sub1` / `partner_parameter_1`)
- [ ] Advertiser cấu hình postback URL trong MMP Dashboard, trỏ đến `/postback/appsflyer` hoặc `/postback/adjust`
- [ ] Publisher cấu hình Postback Tracker URL trong Settings (để nhận notification khi có đơn)
- [ ] Test bằng cách bắn 1 event thử → kiểm tra conversion xuất hiện trong Admin
- [ ] Nếu không bắn được tự động → dùng Upload CSV thủ công
