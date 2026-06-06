# Hướng dẫn tích hợp MMP với hệ thống Magic Affiliate Network

> Tài liệu dành cho admin. Không cần kỹ thuật — chỉ cần làm theo từng bước.

---

## Mục lục

1. [Tổng quan hoạt động](#1-tổng-quan-hoạt-động)
2. [Trước khi bắt đầu — thông tin cần có](#2-trước-khi-bắt-đầu)
3. [Tích hợp CityAds](#3-tích-hợp-cityads)
4. [Tích hợp AppsFlyer](#4-tích-hợp-appsflyer)
5. [Tích hợp Adjust](#5-tích-hợp-adjust)
6. [Cấp tracking link cho publisher](#6-cấp-tracking-link-cho-publisher)
7. [Kiểm tra hệ thống có hoạt động không](#7-kiểm-tra-hệ-thống-có-hoạt-động-không)
8. [Xử lý sự cố thường gặp](#8-xử-lý-sự-cố-thường-gặp)

---

## 1. Tổng quan hoạt động

```
Publisher click tracking link
        ↓
Hệ thống Magic ghi nhận click (có Publisher ID)
        ↓
User thực hiện hành động (mua hàng, cài app...)
        ↓
CityAds / AppsFlyer / Adjust gửi postback về Magic
        ↓
Magic tạo conversion, tính hoa hồng cho publisher
        ↓
Admin xem báo cáo, duyệt/từ chối conversion
```

**Postback** là một URL mà CityAds/AppsFlyer/Adjust sẽ tự động gọi mỗi khi có conversion. Magic nhận URL đó và ghi nhận vào hệ thống.

---

## 2. Trước khi bắt đầu

Bạn cần biết **domain frontend** của hệ thống Magic (ví dụ: `https://affiliate.yourcompany.com` hoặc domain Railway mặc định).

Tất cả postback URL đều có dạng:
```
https://[DOMAIN_CỦA_BẠN]/postback/[tên-nền-tảng]?...
```

> **Lưu ý quan trọng:** Dùng domain **frontend** (domain mà publisher dùng để đăng nhập), không phải domain API backend.

---

## 3. Tích hợp CityAds

### Bước 1 — Tạo Offer trong Magic

1. Đăng nhập Magic với tài khoản Admin
2. Vào **Admin Panel → Offers → Manage**
3. Nhấn **+ New Offer**
4. Điền thông tin:

| Trường | Nhập gì | Ví dụ |
|--------|---------|-------|
| Offer Name | Tên tự đặt, hiển thị trong hệ thống | `Shopee VN CPS` |
| App Name | Tên thương hiệu/app | `Shopee` |
| **CityAds Offer ID** | Lấy từ URL offer trên CityAds (xem bên dưới) | `38407` |
| MMP Source | Chọn **CityAds** | |
| Pub Share (%) | % hoa hồng chia cho publisher | `70` |
| Currency | Đơn vị tiền | `VND` |
| Destination URL | Link offer trên CityAds | `https://cityads.com/...` |
| Publisher Commission Display | Chữ hiển thị với publisher | `8% per order` |

**Cách lấy CityAds Offer ID:**
- Vào CityAds → Offers → chọn offer
- Nhìn URL: `cityads.com/publisher/offers/detail/id/38407` → ID là `38407`

5. Nhấn **Create Offer**

---

### Bước 2 — Đăng ký Postback URL trên CityAds

Postback URL chuẩn để dán vào CityAds:

```
https://[DOMAIN_CỦA_BẠN]/postback/cityads?xid={xid}&offer_id={offer_id}&payout={payout}&payout_currency={currency}&sa={sa}&status={status}&action_type={action_type}&conversion_time={conversion_time}
```

**Ví dụ thực tế** (thay domain của bạn vào):
```
https://affiliate.yourcompany.com/postback/cityads?xid={xid}&offer_id={offer_id}&payout={payout}&payout_currency={currency}&sa={sa}&status={status}&action_type={action_type}&conversion_time={conversion_time}
```

**Các bước trên CityAds:**

1. Đăng nhập CityAds với tài khoản **Publisher** (hoặc nhờ Account Manager)
2. Vào **Account Settings → Postback / S2S Tracking**
3. Dán URL trên vào ô Postback URL
4. Lưu lại

> **Quan trọng:** CityAds dùng `{xid}` là click ID riêng của họ — đây là tham số bắt buộc để hệ thống nhận biết conversion đến từ click nào. Không thay đổi tên tham số, chỉ thay domain.

---

### Giải thích từng tham số CityAds

| Tham số trong URL | Macro CityAds | Ý nghĩa |
|---|---|---|
| `xid={xid}` | CityAds tự điền | Click ID — định danh duy nhất cho mỗi click |
| `offer_id={offer_id}` | CityAds tự điền | ID offer → Magic dùng để tìm offer trong hệ thống |
| `payout={payout}` | CityAds tự điền | Hoa hồng CityAds trả cho Magic (dùng để tính hoa hồng publisher) |
| `payout_currency={currency}` | CityAds tự điền | Đơn vị tiền |
| `sa={sa}` | **Cần cấu hình** | Publisher ID trong Magic (xem phần 6) |
| `status={status}` | CityAds tự điền | Trạng thái: `approved`, `pending`, `rejected` |
| `action_type={action_type}` | CityAds tự điền | Loại hành động: `sale`, `lead`... |
| `conversion_time={conversion_time}` | CityAds tự điền | Thời điểm xảy ra conversion |

---

## 4. Tích hợp AppsFlyer

### Bước 1 — Tạo Offer trong Magic

1. Vào **Admin Panel → Offers → Manage → + New Offer**
2. Điền thông tin:

| Trường | Nhập gì | Ví dụ |
|--------|---------|-------|
| Offer Name | Tên tự đặt | `Shopee App VN` |
| App Name | Tên app | `Shopee` |
| **App ID / App Token** | App ID trên AppsFlyer (xem bên dưới) | `com.shopee.vn` |
| MMP Source | Chọn **AppsFlyer** | |
| Commission Type | `Flat CPA` (trả cố định) hoặc `% Revenue` | |
| Value | Số tiền CPA hoặc % | `2.00` |
| Currency | | `USD` |

**Cách lấy App ID AppsFlyer:**
- Vào AppsFlyer Dashboard → chọn app
- App ID thường là bundle ID của app: `com.shopee.vn` (Android) hoặc `id123456789` (iOS)

---

### Bước 2 — Cấu hình Postback trên AppsFlyer

Postback URL cho AppsFlyer:

```
https://[DOMAIN_CỦA_BẠN]/postback/appsflyer?af_tranid={af_tranid}&app_id={app_id}&event_name={event_name}&event_revenue={event_revenue}&event_revenue_currency={event_revenue_currency}&af_sub1={af_sub1}&install_time={install_time}
```

**Các bước trên AppsFlyer:**

1. Vào AppsFlyer Dashboard → chọn app của bạn
2. Vào **Configuration → Integrated Partners** (hoặc **Partner Marketplace**)
3. Tìm kiếm và chọn **"Custom Postback"** (hoặc tên partner của bạn)
4. Trong tab **Postback URLs** hoặc **S2S Postback**:
   - Dán URL trên vào
5. Cấu hình mapping tham số:

| Tham số Magic cần | AppsFlyer Macro |
|---|---|
| `af_tranid` | `{af_tranid}` — Transaction ID, bắt buộc |
| `app_id` | `{app_id}` — App ID |
| `event_name` | `{event_name}` — Tên event |
| `event_revenue` | `{event_revenue}` — Doanh thu |
| `event_revenue_currency` | `{event_revenue_currency}` |
| `af_sub1` | `{af_sub1}` — **Publisher ID trong Magic** |
| `install_time` | `{install_time}` |

> **Quan trọng:** `af_sub1` là nơi chứa Publisher ID. Publisher cần truyền Magic User ID của họ vào `af_sub1` khi tạo link tracking.

---

### Bước 3 — Yêu cầu publisher truyền ID vào link

Khi publisher tạo link AppsFlyer (OneLink), họ cần thêm:
```
&af_sub1=[MAGIC_PUBLISHER_ID]
```

Ví dụ:
```
https://app.appsflyer.com/com.shopee.vn?af_sub1=abc123xyz
```

Trong đó `abc123xyz` là User ID của publisher trong hệ thống Magic (xem phần 6).

---

## 5. Tích hợp Adjust

### Bước 1 — Tạo Offer trong Magic

1. Vào **Admin Panel → Offers → Manage → + New Offer**
2. Điền thông tin:

| Trường | Nhập gì | Ví dụ |
|--------|---------|-------|
| Offer Name | Tên tự đặt | `App Game VN` |
| App Name | Tên app | `Game XYZ` |
| **App ID / App Token** | **App Token** trên Adjust | `abc1de2fg3` |
| MMP Source | Chọn **Adjust** | |
| Commission Type | `Flat CPA` hoặc `% Revenue` | |
| Value | Số tiền hoặc % | `1.50` |

**Cách lấy App Token Adjust:**
- Vào Adjust Dashboard → All Apps → chọn app
- Vào **App Settings** → App Token hiển thị ở đây (dạng `abc1de2fg3`)

---

### Bước 2 — Cấu hình Callback trên Adjust

Callback URL cho Adjust:

```
https://[DOMAIN_CỦA_BẠN]/postback/adjust?transaction_id={transaction_id}&app_token={app_token}&event_token={event_token}&revenue={revenue}&currency={currency}&created_at={created_at}&partner_parameter_1={partner_parameter_1}
```

**Các bước trên Adjust:**

1. Vào Adjust Dashboard → chọn app
2. Vào **Partner Setup** hoặc **Callbacks**
3. Thêm **Custom Callback / S2S Callback**
4. Dán URL trên vào ô callback

Mapping tham số:

| Tham số Magic cần | Adjust Placeholder |
|---|---|
| `transaction_id` | `{transaction_id}` — Bắt buộc |
| `app_token` | `{app_token}` |
| `event_token` | `{event_token}` |
| `revenue` | `{revenue}` |
| `currency` | `{currency}` |
| `created_at` | `{created_at}` |
| `partner_parameter_1` | `{partner_parameter_1}` — **Publisher ID trong Magic** |

> **Quan trọng:** `partner_parameter_1` là nơi chứa Publisher ID. Publisher cần truyền Magic User ID vào `partner_parameter_1` khi setup link Adjust.

---

### Bước 3 — Yêu cầu publisher truyền ID vào link

Publisher tạo Adjust link cần thêm Partner Parameter:
- Key: `partner_parameter_1`
- Value: Magic User ID của publisher

---

## 6. Cấp tracking link cho publisher

### Cách publisher lấy Magic User ID của họ

1. Publisher đăng nhập vào Magic
2. Vào **Settings** (biểu tượng bánh răng)
3. Mục **Account Info** → copy **User ID**

Hoặc admin lấy giúp:
1. Vào **Admin Panel → Team**
2. Tìm publisher → User ID hiển thị trong bảng (hoặc admin chạy query DB)

---

### Tracking link tự động (CityAds)

Với CityAds, hệ thống **tự động tạo tracking link** cho publisher:

1. Publisher đăng nhập → vào **Offers**
2. Phần **Tracking Links** → copy link dạng:
   ```
   https://[DOMAIN]/api-proxy/click/cityads/[offer-id]?pub=[publisher-id]
   ```
3. Publisher dùng link này để chạy traffic — click sẽ được ghi nhận tự động

---

### Tracking link thủ công (AppsFlyer / Adjust)

Với AppsFlyer và Adjust, không có link tự động. Admin cần:

1. Lấy Publisher ID của publisher (xem trên)
2. Hướng dẫn publisher tự tạo link trên AppsFlyer/Adjust và truyền ID vào đúng tham số:
   - AppsFlyer: `af_sub1=[PUBLISHER_ID]`
   - Adjust: `partner_parameter_1=[PUBLISHER_ID]`

---

## 7. Kiểm tra hệ thống có hoạt động không

### Test postback thủ công (CityAds)

Dán link sau vào trình duyệt (thay domain và publisher ID thực):

```
https://[DOMAIN]/postback/cityads?xid=test_click_001&offer_id=[CITYADS_OFFER_ID]&payout=50000&payout_currency=VND&sa=[PUBLISHER_ID]&status=approved&action_type=sale&conversion_time=2024-01-01T10:00:00Z
```

Sau đó:
1. Vào **Admin Panel → Conversions**
2. Nếu có 1 conversion mới xuất hiện với status **APPROVED** → hệ thống đang hoạt động ✅
3. Nếu không thấy gì → xem phần Xử lý sự cố

### Test postback thủ công (AppsFlyer)

```
https://[DOMAIN]/postback/appsflyer?af_tranid=test_af_001&app_id=[APP_ID]&event_name=purchase&event_revenue=100&event_revenue_currency=USD&af_sub1=[PUBLISHER_ID]
```

### Test postback thủ công (Adjust)

```
https://[DOMAIN]/postback/adjust?transaction_id=test_adj_001&app_token=[APP_TOKEN]&event_token=purchase&revenue=100&currency=USD&partner_parameter_1=[PUBLISHER_ID]
```

### Kiểm tra click tracking (CityAds)

1. Copy tracking link của 1 publisher
2. Mở link trên trình duyệt → sẽ redirect sang trang offer
3. Vào **Admin Panel → Publishers** → tìm publisher đó → cột **Clicks** tăng lên 1 ✅

---

## 8. Xử lý sự cố thường gặp

### Conversion không hiện trong hệ thống

| Nguyên nhân | Cách kiểm tra | Cách fix |
|---|---|---|
| Sai domain trong postback URL | Test URL bằng trình duyệt — nếu thấy `{"ok":true}` là đúng domain | Sửa domain trong CityAds/AppsFlyer/Adjust |
| Offer ID không khớp | Kiểm tra `offer_id` trong URL có đúng với CityAds Offer ID trong Offer chưa | Sửa lại App ID trong Offer |
| Offer bị PAUSED | Vào Offers → kiểm tra status | Nhấn Activate |
| Publisher ID truyền sai | Conversion sẽ hiện nhưng status = PENDING, publisherId trống | Publisher copy đúng ID của họ |

### Conversion hiện nhưng status = PENDING mãi không APPROVED

Nguyên nhân thường gặp:
- **Publisher ID sai hoặc trống** → conversion không biết gán cho ai → PENDING
- **Revenue = 0 với offer % Revenue** → dữ liệu thiếu → PENDING
- **CityAds chưa duyệt** (status = `pending` từ phía CityAds) → chờ CityAds duyệt

Kiểm tra:
- Vào **Conversions** → xem cột Publisher — nếu trống là thiếu Publisher ID
- Vào **Conversions** → xem cột Revenue — nếu `$0.00` là thiếu revenue

### Publisher không thấy conversion

- Kiểm tra publisher đã đăng nhập đúng tài khoản chưa
- Kiểm tra conversion trong Admin đã có `publisherId` đúng chưa
- Kiểm tra status tài khoản publisher là `ACTIVE` (không phải PENDING/SUSPENDED)

### Postback URL trả về 404

- Sai domain — đang dùng domain API backend thay vì domain frontend
- Domain frontend đúng là domain mà publisher dùng để đăng nhập vào hệ thống

### Muốn xem raw data của 1 conversion

Vào **Admin Panel → Conversions** → tìm conversion → xem chi tiết (raw payload từ MMP được lưu đầy đủ).

---

## Tóm tắt nhanh cho từng nền tảng

| | CityAds | AppsFlyer | Adjust |
|---|---|---|---|
| **App ID dùng để tạo Offer** | CityAds Offer ID (số) | Bundle ID app | App Token |
| **Publisher ID truyền qua** | `sa=` | `af_sub1=` | `partner_parameter_1=` |
| **Click ID nhận được** | `xid=` | `af_tranid=` | `transaction_id=` |
| **Hoa hồng lấy từ** | `payout=` | `event_revenue=` | `revenue=` |
| **Tracking link tự động** | ✅ Có (publisher copy từ hệ thống) | ❌ Không (tạo thủ công trên AppsFlyer) | ❌ Không (tạo thủ công trên Adjust) |
| **Status từ nền tảng** | ✅ Nhận status từ CityAds | ❌ Tự động APPROVED nếu có đủ data | ❌ Tự động APPROVED nếu có đủ data |

---

*Cần hỗ trợ thêm: liên hệ team kỹ thuật hoặc xem logs trên Railway Dashboard.*
