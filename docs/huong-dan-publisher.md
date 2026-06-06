# Hướng dẫn sử dụng Publisher Portal — Magic Affiliate Network

> Dành cho Publisher. Đọc từ đầu đến cuối lần đầu, sau đó dùng mục lục để tra cứu nhanh.

---

## Mục lục

1. [Đăng ký & đăng nhập](#1-đăng-ký--đăng-nhập)
2. [Tổng quan dashboard (Overview)](#2-tổng-quan-dashboard-overview)
3. [Xem danh sách offer & lấy tracking link](#3-xem-danh-sách-offer--lấy-tracking-link)
4. [Hiểu các chỉ số hiệu suất](#4-hiểu-các-chỉ-số-hiệu-suất)
5. [Theo dõi conversion của bạn](#5-theo-dõi-conversion-của-bạn)
6. [Cài đặt postback URL (nhận thông báo conversion)](#6-cài-đặt-postback-url)
7. [Câu hỏi thường gặp](#7-câu-hỏi-thường-gặp)

---

## 1. Đăng ký & đăng nhập

### Đăng ký tài khoản

1. Truy cập vào website của Magic Affiliate Network
2. Nhấn **Register** hoặc **Đăng ký**
3. Điền đầy đủ: **Full Name**, **Email**, **Password** (tối thiểu 8 ký tự)
4. Nhấn **Create Account**

> **Lưu ý:** Tài khoản mới sẽ ở trạng thái **Pending** — chờ Admin duyệt trước khi sử dụng được. Thời gian duyệt thường trong vòng 1 ngày làm việc.

### Đăng nhập

1. Truy cập trang chủ → nhấn **Login**
2. Nhập Email và Password đã đăng ký
3. Nhấn **Sign In**

Sau khi đăng nhập, bạn sẽ thấy **Publisher Portal** với menu bên trái gồm: **Overview**, **Offers**, **Settings**.

---

## 2. Tổng quan dashboard (Overview)

Trang Overview hiển thị hiệu suất tổng hợp của bạn trong khoảng thời gian đã chọn.

### Bộ lọc thời gian

Ở góc phải trên cùng có bộ lọc ngày:
- **7d / 30d / 90d**: xem nhanh 7 ngày, 30 ngày, 90 ngày gần nhất
- **Ô nhập ngày**: chọn khoảng thời gian tùy ý
- Nhấn **Refresh** để tải lại dữ liệu

### 6 thẻ chỉ số

| Thẻ | Ý nghĩa |
|-----|---------|
| **Clicks** | Số lượt click vào tracking link của bạn trong khoảng thời gian đã chọn |
| **Conversions** | Số conversion được **Approved** trong khoảng thời gian đã chọn |
| **CVR** | Tỷ lệ chuyển đổi = Conversions ÷ Clicks × 100% |
| **EPC** | Thu nhập trung bình mỗi click = Hoa hồng ÷ Clicks |
| **Earned (range)** | Tổng hoa hồng được duyệt trong khoảng thời gian đã chọn |
| **Total Approved (all time)** | Tổng hoa hồng được duyệt từ trước đến nay (không phụ thuộc bộ lọc ngày) |

### Bảng Recent Conversions

Phía dưới hiển thị các conversion gần nhất của bạn, bao gồm:
- **Date**: thời điểm xảy ra conversion
- **Offer**: tên offer
- **Event**: loại hành động (sale, lead, install…)
- **Revenue**: doanh thu gốc từ advertiser
- **Commission**: hoa hồng bạn được nhận
- **Status**: trạng thái conversion (xem phần 5)

---

## 3. Xem danh sách offer & lấy tracking link

Vào menu **Offers** để xem tất cả offer bạn có thể chạy traffic.

### Phần Tracking Links

Đây là phần quan trọng nhất — mỗi offer có một **tracking link riêng cho bạn**. Link này chứa Publisher ID của bạn để hệ thống biết conversion đến từ bạn.

**Cách lấy tracking link:**
1. Vào **Offers**
2. Phần **Tracking Links** → tìm offer muốn chạy
3. Nhấn **Copy** để sao chép link

Tracking link có dạng:
```
https://[domain]/api-proxy/click/cityads/[offer-id]?pub=[publisher-id]
```

> **Quan trọng:** Luôn dùng đúng tracking link này khi chạy traffic. Nếu dùng link trực tiếp (không qua tracking), click và conversion sẽ không được ghi nhận cho tài khoản của bạn.

### Cột Commission

Hiển thị mức hoa hồng admin đã cấu hình để bạn thấy (ví dụ: `8% per order`, `15,000₫/đơn`). Đây là mức tham khảo do admin thiết lập.

### Phần By Offer — Hiệu suất theo offer

Bảng phía dưới thống kê hiệu suất của bạn theo từng offer, **lọc theo khoảng thời gian đã chọn**:

| Cột | Ý nghĩa |
|-----|---------|
| **Offer ID** | ID nội bộ của offer trong hệ thống Magic (dùng để cài đặt postback — xem phần 6) |
| **Offer** | Tên offer |
| **Clicks** | Số click vào tracking link của offer đó |
| **Approved** | Conversion được duyệt |
| **Pending** | Conversion đang chờ xử lý |
| **Rejected** | Conversion bị từ chối |
| **CVR** | Tỷ lệ chuyển đổi của offer này |
| **EPC** | Thu nhập trung bình mỗi click của offer này |
| **Commission Earned** | Tổng hoa hồng được duyệt của offer này |

Nhấn **Copy** ở cột Offer ID để sao chép ID phục vụ cài đặt postback.

---

## 4. Hiểu các chỉ số hiệu suất

### CVR (Conversion Rate — Tỷ lệ chuyển đổi)

```
CVR = Approved Conversions ÷ Clicks × 100%
```

Ví dụ: 100 click, 3 đơn được duyệt → CVR = 3%

CVR cao = traffic của bạn chất lượng, đúng đối tượng. CVR thấp có thể do:
- Traffic không đúng đối tượng mục tiêu
- Landing page không tối ưu
- Offer không phù hợp với nguồn traffic

### EPC (Earnings Per Click — Thu nhập mỗi click)

```
EPC = Tổng hoa hồng được duyệt ÷ Tổng click
```

Ví dụ: 100 click, hoa hồng tổng 500,000₫ → EPC = 5,000₫/click

EPC giúp bạn so sánh hiệu quả giữa các offer hoặc các nguồn traffic khác nhau. EPC cao = offer/traffic đang hoạt động tốt.

### Tại sao Clicks = 0 nhưng có Conversion?

Điều này xảy ra khi conversion đến từ nguồn không qua tracking link (ví dụ: admin nhập tay, hoặc click từ trước khoảng thời gian bạn đang xem). CVR và EPC sẽ hiển thị `—` khi không có click.

---

## 5. Theo dõi conversion của bạn

### Các trạng thái conversion

| Trạng thái | Màu | Ý nghĩa |
|---|---|---|
| **APPROVED** | Xanh lá | Conversion hợp lệ, hoa hồng được tính |
| **PENDING** | Vàng | Đang chờ xác nhận từ advertiser hoặc hệ thống đang xử lý |
| **REJECTED** | Đỏ | Conversion không hợp lệ, không tính hoa hồng |

### Tại sao conversion bị PENDING?

Conversion sẽ ở PENDING khi:
- Advertiser (CityAds, AppsFlyer…) chưa xác nhận đơn hàng
- Hệ thống đang chờ xác thực thêm
- Đơn hàng trong thời gian hold/review của advertiser

Conversion PENDING có thể chuyển thành APPROVED hoặc REJECTED sau khi advertiser xác nhận. Thời gian này tùy thuộc vào từng advertiser, thường từ vài giờ đến vài tuần.

### Tại sao conversion bị REJECTED?

Conversion bị REJECTED khi:
- Đơn hàng bị hủy bởi người dùng
- Phát hiện gian lận (fraud)
- Không đáp ứng điều kiện của offer (ví dụ: user đã từng mua trước đó)
- Advertiser từ chối thanh toán

---

## 6. Cài đặt Postback URL

Postback URL là địa chỉ hệ thống Magic sẽ **tự động gọi** mỗi khi conversion của bạn được **Approved** — giúp tracker của bạn cập nhật dữ liệu realtime mà không cần vào Magic kiểm tra thủ công.

### Cách cài đặt

1. Vào **Settings**
2. Phần **Postback URL** → nhập URL tracker của bạn
3. Nhấn **Save Changes**

### Macros có thể dùng trong URL

Khi Magic gọi URL của bạn, các macro trong `{...}` sẽ được tự động thay bằng giá trị thực:

| Macro | Giá trị thực được thay vào | Ví dụ |
|---|---|---|
| `{payout}` | Hoa hồng bạn nhận được | `50000` |
| `{event}` | Loại hành động | `sale`, `lead`, `install` |
| `{order_id}` | ID click/transaction từ advertiser | `xid_abc123` |
| `{status}` | Trạng thái | `approved` |
| `{click_id}` | Publisher ID của bạn | `clv4abc...` |
| `{offer_id}` | ID offer trong Magic | `clv4xyz...` |
| `{offer_name}` | Tên offer | `Shopee+VN+CPS` |

### Ví dụ URL thực tế

**Ví dụ 1 — Tracker nhận thông báo chung:**
```
https://tracker.example.com/postback?payout={payout}&event={event}&order={order_id}
```

**Ví dụ 2 — Phân biệt theo offer:**
```
https://tracker.example.com/postback?offer={offer_name}&payout={payout}&status={status}
```

**Ví dụ 3 — Dùng Offer ID để route chính xác:**
```
https://tracker.example.com/postback?offer_id={offer_id}&payout={payout}&click={order_id}
```

### Phân biệt offer trong postback

Nếu bạn chạy nhiều offer và muốn tracker của bạn xử lý riêng từng offer:

**Cách 1 — Dùng `{offer_name}`** (dễ đọc):
```
https://mytracker.com/pb?campaign={offer_name}&revenue={payout}
```
→ Tracker nhận: `campaign=Shopee+VN+CPS&revenue=50000`

**Cách 2 — Dùng `{offer_id}`** (chính xác, không đổi dù offer đổi tên):
1. Vào **Offers → By Offer** → nhấn **Copy** ở cột Offer ID để lấy ID
2. Gắn vào URL postback:
```
https://mytracker.com/pb?offer_id={offer_id}&revenue={payout}
```
→ Tracker nhận: `offer_id=clv4abc123xyz&revenue=50000`

### Test Postback URL

Sau khi nhập URL, nhấn **Test Postback URL** — hệ thống sẽ hiển thị URL thực sẽ được gọi (với giá trị test thay vào các macro) để bạn kiểm tra trước khi lưu.

---

## 7. Câu hỏi thường gặp

**Q: Tôi đã chạy traffic nhưng không thấy click nào?**
- Kiểm tra bạn đang dùng đúng tracking link từ hệ thống Magic (có chứa `?pub=` trong URL)
- Link trực tiếp đến offer (không qua Magic) sẽ không được ghi nhận click

**Q: Conversion hiện PENDING mãi không chuyển sang APPROVED?**
- Conversion tự động PENDING khi advertiser chưa xác nhận
- Với CityAds: hệ thống chờ CityAds gửi trạng thái `approved` trong postback
- Thời gian hold tùy advertiser, có thể từ 1 ngày đến 30 ngày

**Q: Tôi thấy conversion nhưng Commission = $0?**
- Có thể offer đó tính hoa hồng theo % doanh thu nhưng revenue = 0
- Liên hệ Admin để kiểm tra cấu hình offer

**Q: Làm sao biết Publisher ID của tôi?**
- Vào **Settings** → phần **Profile** → mục **Your Publisher ID**
- Nhấn **Copy** để sao chép
- Gửi ID này cho Admin khi cần được gắn vào postback của advertiser (với AppsFlyer, Adjust)

**Q: Postback URL của tôi không nhận được gì?**
- Đảm bảo URL đúng định dạng (bắt đầu bằng `https://`)
- Dùng **Test Postback URL** để xem URL thực sẽ được gọi
- Kiểm tra server của bạn có đang hoạt động và public không
- Conversion phải ở trạng thái APPROVED mới kích hoạt postback (PENDING không gửi)

**Q: Tôi có thể xem lịch sử tất cả conversion không?**
- Bảng **Recent Conversions** ở trang Overview hiển thị các conversion gần nhất
- Để xem theo offer cụ thể: vào **Offers → By Offer** và dùng bộ lọc ngày

**Q: CVR và EPC hiển thị `—` là sao?**
- Hệ thống không tính được vì Clicks = 0 trong khoảng thời gian đang xem
- Thử mở rộng khoảng thời gian bộ lọc (30d, 90d) để có dữ liệu

---

*Cần hỗ trợ thêm: liên hệ Admin qua kênh hỗ trợ của team.*
