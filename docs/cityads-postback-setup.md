# Hướng dẫn cấu hình Postback — CityAds → Magic Media

**Hệ thống:** Magic Media Affiliate Network
**Liên hệ kỹ thuật:** vovantrong.89@gmail.com

---

## 1. Postback URL

Dán URL sau vào cấu hình postback của offer trên CityAds:

```
https://www.magicmedia.asia/postback/cityads?offer_id={offer_id}&sa={sa}&open_commission={open_commission}&order_amount={order_amount}&order_total_currency={order_total_currency}&status={status}&action_type={action_type}&xid={click_id}&conversion_time={conversion_time}
```

---

## 2. Bảng mapping tham số

| Tham số (Magic) | Macro CityAds | Bắt buộc | Mô tả |
|-----------------|---------------|----------|-------|
| `offer_id` | `{offer_id}` | **Có** | ID offer trên CityAds |
| `sa` | `{sa}` | **Có** | Sub-affiliate / publisher ID |
| `open_commission` | `{open_commission}` | **Có** | Hoa hồng (commission). **Phải > 0 cho CPS** |
| `order_amount` | `{order_amount}` | Khuyến khích | Giá trị đơn hàng |
| `order_total_currency` | `{order_total_currency}` | Có | Đơn vị tiền tệ |
| `status` | `{status}` | **Có** | Trạng thái đơn hàng (xem bảng bên dưới) |
| `action_type` | `{action_type}` | Có | Loại hành động: `sale`, `lead`, `install`... |
| `xid` | `{click_id}` | **Có** | Click/transaction ID duy nhất, dùng để chống trùng |
| `conversion_time` | `{conversion_time}` | Có | Thời gian xảy ra conversion |

---

## 3. Giá trị trạng thái (status)

| Giá trị `{status}` | Magic hiểu là | Mô tả |
|--------------------|----------------|-------|
| `1` hoặc `approved` | **APPROVED** | Đơn hàng được duyệt |
| `3` hoặc `rejected` hoặc `declined` | **REJECTED** | Đơn hàng bị từ chối |
| Giá trị khác hoặc trống | **PENDING** | Đang chờ xử lý |

---

## 4. Yêu cầu quan trọng

### Gửi đầy đủ trạng thái
Hệ thống cần nhận **tất cả trạng thái** conversion:
- **approved** — đơn được duyệt
- **pending** — đơn đang chờ
- **rejected** — đơn bị huỷ/trả hàng

### Commission phải có giá trị
- Với offer **CPS**: `open_commission` phải > 0
- Nếu = 0, hệ thống ghi nhận nhưng đánh **PENDING**

### Chống trùng
- Hệ thống chống trùng theo `xid` (click_id)
- Gửi trùng `xid` → lần 2 bị bỏ qua

---

## 5. Ví dụ

### Đơn được duyệt (CPS Shopee):
```
GET https://www.magicmedia.asia/postback/cityads?offer_id=38407&sa=cmq0zoz6w0001134qbpj6a5ga&open_commission=50000&order_amount=625000&order_total_currency=VND&status=approved&action_type=sale&xid=38407-1-1782011539-5510950&conversion_time=2026-06-20T10:30:00
```

### Đơn bị từ chối:
```
GET https://www.magicmedia.asia/postback/cityads?offer_id=38407&sa=cmq0zoz6w0001134qbpj6a5ga&open_commission=0&order_amount=0&order_total_currency=VND&status=rejected&action_type=sale&xid=38407-1-1782011539-5510950
```

---

## 6. Kiểm tra

Test bằng curl:
```
curl "https://www.magicmedia.asia/postback/cityads?offer_id=38407&sa=test&open_commission=1.00&order_total_currency=VND&status=approved&action_type=sale&xid=test_$(date +%s)"
```

Response thành công: `{"ok": true}`

Kiểm tra log: Admin Panel → Postback Logs

---

**Method:** GET hoặc POST
**Retry:** Có thể gửi lại — hệ thống tự chống trùng
**Liên hệ:** vovantrong.89@gmail.com
