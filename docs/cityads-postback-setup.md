# Hướng dẫn cấu hình Postback — CityAds → Magic Media

**Hệ thống:** Magic Media Affiliate Network
**Liên hệ kỹ thuật:** vovantrong.89@gmail.com

---

## 1. Postback URL

Dán URL sau vào cấu hình postback của offer trên CityAds:

```
https://www.magicmedia.asia/postback/cityads?offer_id={offer_id}&sa={sa}&open_commission={open_commission}&order_amount={order_amount}&order_total={order_total}&order_total_currency={order_total_currency}&status={status}&action_type={action_type}&xid={xid}&conversion_time={conversion_time}&payout={payout}&payout_currency={payout_currency}&order_id={order_id}
```

---

## 2. Macro cần bật trong CityAds

Vào cấu hình postback trên CityAds và **tick chọn** các macro sau:

| Macro | Mô tả | Bắt buộc |
|-------|--------|----------|
| `offer_id` | Offer ID | **Có** |
| `sa` | Subaccount 1 (publisher ID) | **Có** |
| `xid` | Click ID — dùng chống trùng | **Có** |
| `open_commission` | Hoa hồng (RUR) | **Có** |
| `order_amount` | Giá trị đơn hàng | Khuyến khích |
| `order_total` | Order Total | Khuyến khích |
| `order_total_currency` | Đơn vị tiền tệ đơn hàng | Có |
| `status` | Trạng thái đơn hàng | **Có** |
| `action_type` | Loại hành động (sale/lead/CPL) | Có |
| `conversion_time` | Thời gian conversion | Có |
| `payout` | Hoa hồng đã duyệt | Khuyến khích |
| `payout_currency` | Currency của payout | Khuyến khích |
| `order_id` | Mã đơn hàng (đối soát) | Khuyến khích |

**Lưu ý:** `payout` chỉ có giá trị khi đơn được duyệt. Với đơn pending, hệ thống dùng `open_commission` × tỷ giá để tính.

---

## 3. Giá trị trạng thái (status)

| Giá trị `{status}` | Magic hiểu là | Mô tả |
|--------------------|----------------|-------|
| `1` hoặc `approved` | **APPROVED** | Đơn hàng được duyệt |
| `3` hoặc `rejected` hoặc `declined` | **REJECTED** | Đơn hàng bị từ chối |
| Giá trị khác (`open`, trống...) | **PENDING** | Đang chờ xử lý |

---

## 4. Cách hệ thống tính commission

1. CityAds gửi `open_commission` (bằng RUR)
2. Hệ thống quy đổi: `open_commission × tỷ giá` → VND (revenue)
3. Commission publisher = tính theo cấu hình offer (% hoặc cố định)
4. Nếu `payout > 0` (đơn đã duyệt): dùng `payout` thay vì quy đổi

---

## 5. Yêu cầu quan trọng

### Gửi đầy đủ trạng thái
Hệ thống cần nhận **tất cả trạng thái** conversion:
- **approved** — đơn được duyệt
- **pending/open** — đơn đang chờ
- **rejected** — đơn bị huỷ/trả hàng

### Chống trùng
- Hệ thống chống trùng theo `xid`
- **Phải bật macro `xid`** trong CityAds
- Gửi trùng `xid` → lần 2 bị bỏ qua

---

## 6. Ví dụ

### Đơn pending (CPL):
```
GET https://www.magicmedia.asia/postback/cityads?offer_id=38407&sa=cmq0zoz6w0001134qbpj6a5ga&open_commission=49.8751&order_amount=0&order_total=0&order_total_currency=VND&status=open&action_type=CPL&xid=12345678&conversion_time=2026-06-23T10:30:00&payout=0&payout_currency=VND&order_id=ORD001
```

### Đơn được duyệt (CPS):
```
GET https://www.magicmedia.asia/postback/cityads?offer_id=38407&sa=cmq0zoz6w0001134qbpj6a5ga&open_commission=49.8751&order_amount=640223&order_total=640223&order_total_currency=VND&status=approved&action_type=sale&xid=12345679&conversion_time=2026-06-23T11:00:00&payout=17926&payout_currency=VND&order_id=ORD002
```

---

## 7. Kiểm tra

Test bằng curl:
```
curl "https://www.magicmedia.asia/postback/cityads?offer_id=38407&sa=test&open_commission=49.87&order_total_currency=VND&status=open&action_type=CPL&xid=test_$(date +%s)"
```

Response thành công: `{"ok": true}`

Kiểm tra log: Admin Panel → Postback Logs

---

**Method:** GET hoặc POST
**Retry:** Có thể gửi lại — hệ thống tự chống trùng
**Liên hệ:** vovantrong.89@gmail.com
