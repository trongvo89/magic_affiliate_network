# Hướng dẫn cấu hình Postback — CityAds → Magic Media

**Hệ thống:** Magic Media Affiliate Network
**Liên hệ kỹ thuật:** vovantrong.89@gmail.com

---

## 1. Postback URL

Dán URL sau vào cấu hình postback của offer trên CityAds:

```
https://www.magicmedia.asia/postback/cityads?offer_id={offer_id}&sa={sa}&payout={payout}&payout_currency={payout_currency}&status={action_status}&action_type={action_type}&xid={click_id}&conversion_time={action_date}&order_total={order_sum}&order_total_currency={order_currency}
```

---

## 2. Bảng mapping tham số

| Tham số (Magic) | Macro CityAds | Bắt buộc | Mô tả |
|-----------------|---------------|----------|-------|
| `offer_id` | `{offer_id}` | **Có** | ID offer trên CityAds. Dùng để match offer trong hệ thống Magic |
| `sa` | `{sa}` | **Có** | Sub-affiliate ID (publisher ID). Dùng để xác định publisher nào mang đơn |
| `payout` | `{payout}` | **Có** | Hoa hồng / payout cho đơn hàng. **Phải > 0 cho offer CPS** |
| `payout_currency` | `{payout_currency}` | Có | Đơn vị tiền tệ của payout (VND, USD, RUB...) |
| `status` | `{action_status}` | **Có** | Trạng thái đơn hàng (xem bảng bên dưới) |
| `action_type` | `{action_type}` | Có | Loại hành động: `sale`, `lead`, `install`... |
| `xid` | `{click_id}` | **Có** | Transaction/click ID duy nhất, dùng để chống trùng |
| `conversion_time` | `{action_date}` | Có | Thời gian xảy ra conversion |
| `order_total` | `{order_sum}` | Khuyến khích | Tổng giá trị đơn hàng (GMV) |
| `order_total_currency` | `{order_currency}` | Khuyến khích | Đơn vị tiền tệ của đơn hàng |

---

## 3. Giá trị trạng thái (status)

| Giá trị CityAds `{action_status}` | Magic hiểu là | Mô tả |
|------------------------------------|----------------|-------|
| `1` hoặc `approved` | **APPROVED** | Đơn hàng được duyệt |
| `3` hoặc `rejected` hoặc `declined` | **REJECTED** | Đơn hàng bị từ chối |
| Giá trị khác hoặc trống | **PENDING** | Đang chờ xử lý |

---

## 4. Yêu cầu quan trọng

### Gửi đầy đủ trạng thái
Hệ thống cần nhận **tất cả trạng thái** conversion, không chỉ approved:
- **approved** — đơn được duyệt
- **pending** — đơn đang chờ
- **rejected** — đơn bị huỷ/trả hàng

### Payout phải có giá trị
- Với offer **CPS** (Cost Per Sale): `payout` phải > 0
- Nếu `payout = 0`, hệ thống sẽ ghi nhận conversion nhưng đánh trạng thái **PENDING**
- Nếu chưa có payout tại thời điểm gửi, vui lòng gửi lại postback khi có giá trị chính xác

### Chống trùng (Dedup)
- Hệ thống chống trùng theo `xid` (click_id)
- Nếu gửi 2 postback có cùng `xid` → lần thứ 2 sẽ bị bỏ qua
- Mỗi conversion chỉ được ghi nhận **1 lần**

---

## 5. Ví dụ postback thực tế

### Đơn hàng được duyệt (CPS Shopee):
```
GET https://www.magicmedia.asia/postback/cityads?offer_id=38407&sa=cmq0zoz6w0001134qbpj6a5ga&payout=50000&payout_currency=VND&status=approved&action_type=sale&xid=abc123456&conversion_time=2026-06-20T10:30:00&order_total=625000&order_total_currency=VND
```

### Đơn hàng bị từ chối:
```
GET https://www.magicmedia.asia/postback/cityads?offer_id=38407&sa=cmq0zoz6w0001134qbpj6a5ga&payout=0&payout_currency=VND&status=rejected&action_type=sale&xid=abc123456&conversion_time=2026-06-20T10:30:00
```

### Đơn CPL (lead, không có payout):
```
GET https://www.magicmedia.asia/postback/cityads?offer_id=41432&sa=cmq0zoz6w0001134qbpj6a5ga&payout=0&action_type=lead&xid=def789&conversion_time=2026-06-20T11:00:00&status=approved
```

---

## 6. Kiểm tra / Verify

Sau khi cấu hình xong, có thể test bằng cách gửi thử 1 postback:

```
curl "https://www.magicmedia.asia/postback/cityads?offer_id=38407&sa=test&payout=1.00&payout_currency=VND&status=approved&action_type=sale&xid=test_$(date +%s)"
```

**Response thành công:**
```json
{"ok": true}
```

**Response lỗi thường gặp:**
```json
{"ok": true, "reason": "offer not found"}     // offer_id sai
{"ok": true, "reason": "duplicate"}            // xid đã tồn tại
```

Kiểm tra log tại: Admin Panel → Postback Logs

---

## 7. Thông tin hỗ trợ

- **Method:** GET hoặc POST đều được
- **Timeout:** Server phản hồi trong < 1 giây
- **Retry:** Nếu không nhận được response, có thể gửi lại — hệ thống tự chống trùng theo `xid`
- **Encoding:** URL-encode các giá trị có ký tự đặc biệt

Nếu có vấn đề kỹ thuật, liên hệ: **vovantrong.89@gmail.com**
