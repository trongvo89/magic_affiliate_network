'use client'
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

type Locale = 'en' | 'vi'

interface LocaleContextType {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

const LocaleContext = createContext<LocaleContextType | null>(null)

const translations: Record<string, Record<Locale, string>> = {
  // Dashboard presets
  'preset.today': { vi: 'Hôm nay', en: 'Today' },
  'preset.yesterday': { vi: 'Hôm qua', en: 'Yesterday' },
  'preset.week': { vi: 'Tuần này', en: 'This Week' },
  'preset.month': { vi: 'Tháng này', en: 'This Month' },
  'preset.custom': { vi: 'Tùy chỉnh', en: 'Custom' },
  'dashboard.allCampaigns': { vi: 'Tất cả campaign', en: 'All campaigns' },

  // Dashboard offers
  'offers.search': { vi: 'Tìm kiếm offer...', en: 'Search offers...' },
  'offers.notFound': { vi: 'Không tìm thấy offer nào', en: 'No offers found' },
  'offers.empty': { vi: 'Chưa có offer nào', en: 'No offers available' },
  'offers.createDeeplink': { vi: 'Tạo Deeplink', en: 'Create Deeplink' },
  'offers.deeplinkPlaceholder': { vi: 'Nhập URL đích, vd: https://shopee.vn/product/123', en: 'Enter destination URL, e.g. https://shopee.vn/product/123' },

  // Dashboard settings
  'settings.sendIdToAdmin': { vi: 'Gửi ID này cho Admin để được gắn vào postback URL của advertiser.', en: 'Send this ID to Admin to be added to the advertiser postback URL.' },
  'settings.commissionReceived': { vi: 'Hoa hồng được nhận', en: 'Commission received' },
  'settings.eventType': { vi: 'Loại event (sale, lead…)', en: 'Event type (sale, lead...)' },
  'settings.clickTransactionId': { vi: 'Click/transaction ID từ MMP', en: 'Click/transaction ID from MMP' },
  'settings.status': { vi: 'Trạng thái (approved/pending/rejected)', en: 'Status (approved/pending/rejected)' },
  'settings.yourPublisherId': { vi: 'Publisher ID của bạn', en: 'Your Publisher ID' },
  'settings.offerIdInMagic': { vi: 'ID offer trong Magic', en: 'Offer ID in Magic' },
  'settings.offerNameInMagic': { vi: 'Tên offer trong Magic', en: 'Offer name in Magic' },

  // Admin conversions
  'csv.needDataRow': { vi: 'Cần ít nhất 1 dòng dữ liệu sau header', en: 'Need at least 1 data row after header' },
  'csv.missingPublisher': { vi: 'Thiếu cột: publisher_id hoặc publisher_email', en: 'Missing column: publisher_id or publisher_email' },
  'csv.missingOffer': { vi: 'Thiếu cột: offer_id hoặc offer_name (hoặc chọn offer ở ô bên trên)', en: 'Missing column: offer_id or offer_name (or select an offer above)' },
  'csv.missingCols': { vi: 'Thiếu cột: {cols}', en: 'Missing columns: {cols}' },
  'csv.dateBeforeRange': { vi: 'event_at ngoài khoảng (trước {date})', en: 'event_at out of range (before {date})' },
  'csv.dateAfterRange': { vi: 'event_at ngoài khoảng (sau {date})', en: 'event_at out of range (after {date})' },
  'csv.noValidRows': { vi: 'Không có dòng hợp lệ (status phải là PENDING/APPROVED/REJECTED)', en: 'No valid rows (status must be PENDING/APPROVED/REJECTED)' },
  'csv.uploadFailed': { vi: 'Upload thất bại', en: 'Upload failed' },
  'csv.createNew': { vi: 'Tạo conversion mới', en: 'Create new conversions' },
  'csv.updateStatus': { vi: 'Cập nhật trạng thái', en: 'Update status' },
  'csv.requiredCols': { vi: 'Cột bắt buộc:', en: 'Required columns:' },
  'csv.publisherOneOf': { vi: 'Publisher (một trong hai):', en: 'Publisher (one of):' },
  'csv.or': { vi: 'hoặc', en: 'or' },
  'csv.offerOneOf': { vi: 'Offer (một trong hai — bỏ qua nếu chọn offer ở dưới):', en: 'Offer (one of — skip if offer selected below):' },
  'csv.optionalCols': { vi: 'Cột tùy chọn:', en: 'Optional columns:' },
  'csv.statusDefault': { vi: 'status: PENDING (mặc định) · APPROVED · REJECTED', en: 'status: PENDING (default) · APPROVED · REJECTED' },
  'csv.uploadResults': { vi: 'Upload kết quả từ advertiser — cột bắt buộc:', en: 'Upload results from advertiser — required columns:' },
  'csv.orUseId': { vi: 'hoặc dùng {id} thay cho {sourceRefId}', en: 'or use {id} instead of {sourceRefId}' },
  'csv.validStatus': { vi: 'status hợp lệ: APPROVED · REJECTED · PENDING', en: 'Valid status: APPROVED · REJECTED · PENDING' },
  'csv.applyToOffer': { vi: 'Áp dụng cho offer', en: 'Apply to offer' },
  'csv.optionalSkipOffer': { vi: '(tùy chọn — bỏ qua cột offer trong CSV)', en: '(optional — skip offer column in CSV)' },
  'csv.allFromCsv': { vi: '— Tất cả / lấy từ CSV —', en: '— All / from CSV —' },
  'csv.validateDates': { vi: 'Kiểm tra ngày', en: 'Validate dates' },
  'csv.optionalRejectOutside': { vi: '(tùy chọn — từ chối dòng ngoài khoảng)', en: '(optional — reject rows outside range)' },
  'csv.fromDate': { vi: 'Từ ngày', en: 'From date' },
  'csv.toDate': { vi: 'Đến ngày', en: 'To date' },
  'csv.selectFile': { vi: 'Chọn file CSV:', en: 'Select CSV file:' },
  'csv.orPaste': { vi: 'hoặc paste trực tiếp:', en: 'or paste directly:' },
  'csv.rowsReady': { vi: '{count} dòng sẵn sàng upload', en: '{count} rows ready to upload' },
  'csv.result': { vi: 'Kết quả: {success} thành công, {failed} thất bại', en: 'Result: {success} succeeded, {failed} failed' },
  'csv.uploading': { vi: 'Đang upload...', en: 'Uploading...' },
  'csv.uploadRows': { vi: 'Upload {count} dòng', en: 'Upload {count} rows' },
  'csv.needSourceRefId': { vi: 'Cần cột source_ref_id hoặc id', en: 'Need column source_ref_id or id' },

  // Admin settings
  'adminSettings.trackingDomainDesc': { vi: 'Custom domain cho tracking links của publisher — tách biệt khỏi web app', en: 'Custom domain for publisher tracking links — separate from web app' },
  'adminSettings.configured': { vi: 'Đã cấu hình', en: 'Configured' },
  'adminSettings.notConfigured': { vi: 'Chưa cấu hình', en: 'Not configured' },
  'adminSettings.currentDomain': { vi: 'Tracking domain hiện tại:', en: 'Current tracking domain:' },
  'adminSettings.trackingLinksFormat': { vi: 'Tracking links của publisher sẽ có dạng:', en: 'Publisher tracking links will look like:' },
  'adminSettings.noCustomDomain': { vi: 'Chưa có tracking domain riêng', en: 'No custom tracking domain yet' },
  'adminSettings.usingWebDomain': { vi: 'Tracking links đang dùng chung domain web app. Làm theo hướng dẫn bên dưới để cấu hình domain riêng.', en: 'Tracking links are using the web app domain. Follow the instructions below to set up a custom domain.' },
  'adminSettings.setupGuide': { vi: 'Hướng dẫn cấu hình Custom Tracking Domain', en: 'Custom Tracking Domain Setup Guide' },
  'adminSettings.setupGuideDesc': { vi: 'Thiết lập domain riêng trỏ thẳng vào API server, không qua web app', en: 'Set up a custom domain pointing directly to the API server, bypassing the web app' },
  'adminSettings.step1': { vi: 'Mua/chọn domain tracking', en: 'Purchase/select a tracking domain' },
  'adminSettings.step1Desc': { vi: '— ví dụ: <code>trk.yourdomain.com</code>. Nên dùng subdomain của domain chính hoặc một domain hoàn toàn mới. Tránh dùng tên liên quan đến "affiliate", "track", "click" quá rõ ràng.', en: '— e.g. <code>trk.yourdomain.com</code>. Use a subdomain of your main domain or a completely new domain. Avoid names obviously related to "affiliate", "track", "click".' },
  'adminSettings.step2Title': { vi: 'Thêm Custom Domain vào Railway API service', en: 'Add Custom Domain to Railway API service' },
  'adminSettings.step2Note': { vi: '(không phải web service):', en: '(not the web service):' },
  'adminSettings.step2_1': { vi: 'Vào Railway → Project → chọn service <strong>API</strong>', en: 'Go to Railway → Project → select <strong>API</strong> service' },
  'adminSettings.step2_2': { vi: 'Tab <strong>Settings</strong> → phần <strong>Domains</strong>', en: '<strong>Settings</strong> tab → <strong>Domains</strong> section' },
  'adminSettings.step2_3': { vi: 'Click <strong>Add a custom domain</strong>', en: 'Click <strong>Add a custom domain</strong>' },
  'adminSettings.step2_4': { vi: 'Nhập domain tracking của bạn → Railway sẽ cung cấp CNAME target', en: 'Enter your tracking domain → Railway will provide a CNAME target' },
  'adminSettings.step3Title': { vi: 'Trỏ DNS về Railway API', en: 'Point DNS to Railway API' },
  'adminSettings.step3Desc': { vi: 'CNAME target lấy từ bước 2 ở màn hình Railway. Chờ DNS propagate 5–30 phút.', en: 'CNAME target from step 2 on the Railway screen. Wait 5–30 minutes for DNS propagation.' },
  'adminSettings.step4Title': { vi: 'Set env var <code>TRACKING_DOMAIN</code> trên Railway Web service', en: 'Set env var <code>TRACKING_DOMAIN</code> on Railway Web service' },
  'adminSettings.step4Desc1': { vi: 'Vào Railway → Web service → Variables → thêm:', en: 'Go to Railway → Web service → Variables → add:' },
  'adminSettings.step4Desc2': { vi: 'Railway sẽ tự redeploy web app. Sau khi deploy xong, tracking links của publisher sẽ dùng domain mới.', en: 'Railway will auto-redeploy the web app. After deployment, publisher tracking links will use the new domain.' },
  'adminSettings.step5Title': { vi: 'Cập nhật CORS trên Railway API service', en: 'Update CORS on Railway API service' },
  'adminSettings.step5Note': { vi: '(nếu cần):', en: '(if needed):' },
  'adminSettings.step5Desc1': { vi: 'Nếu <code>CORS_ORIGIN</code> đang set giá trị cụ thể, thêm web domain vào:', en: 'If <code>CORS_ORIGIN</code> is set to a specific value, add the web domain:' },
  'adminSettings.step5Desc2': { vi: 'Tracking domain không cần CORS — click redirect là browser request, không phải AJAX.', en: 'Tracking domain does not need CORS — click redirect is a browser request, not AJAX.' },
  'adminSettings.step6Title': { vi: 'Kiểm tra', en: 'Verify' },
  'adminSettings.step6_1': { vi: 'Mở Publisher Portal → Offers → copy tracking link', en: 'Open Publisher Portal → Offers → copy tracking link' },
  'adminSettings.step6_2': { vi: 'Paste vào browser — link phải dùng domain mới, không phải domain web app', en: 'Paste in browser — link must use new domain, not web app domain' },
  'adminSettings.step6_3': { vi: 'Truy cập link → phải redirect đúng về merchant, click được log trong hệ thống', en: 'Visit link → must redirect to merchant, click is logged in the system' },
  'adminSettings.postbackEndpointsDesc': { vi: 'URL đăng ký với MMP — dùng API domain, không dùng tracking domain', en: 'URLs to register with MMP — use API domain, not tracking domain' },
  'adminSettings.referDocs': { vi: 'Tham khảo file docs/huong-dan-tich-hop-mmp.md để biết thêm về các tham số postback.', en: 'Refer to docs/huong-dan-tich-hop-mmp.md for more about postback parameters.' },

  // Admin offers
  'adminOffers.cityadsCps': { vi: 'CityAds CPS — Tự động chia hoa hồng', en: 'CityAds CPS — Automatic commission split' },
  'adminOffers.cityadsDesc': { vi: 'Publisher nhận 70% doanh thu CityAds báo về · Magic giữ 30%', en: 'Publisher receives 70% of CityAds reported revenue · Magic keeps 30%' },
  'adminOffers.cityadsAdjust': { vi: 'Có thể điều chỉnh tỷ lệ ở ô "Pub Share (%)" bên dưới nếu cần', en: 'You can adjust the ratio in the "Pub Share (%)" field below if needed' },
  'adminOffers.cityadsPostback': { vi: 'Postback URL mẫu đăng ký với CityAds:', en: 'Sample postback URL to register with CityAds:' },

  // Admin finance acts
  'finance.conversionsMissingFromCsv': { vi: 'conversion(s) trong hệ thống không có trong CSV advertiser', en: 'conversion(s) in the system not found in advertiser CSV' },
  'finance.conversionsNotReported': { vi: 'conversion(s) có trong hệ thống nhưng advertiser không báo', en: 'conversion(s) in the system but not reported by advertiser' },
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('vi')

  useEffect(() => {
    const saved = localStorage.getItem('locale') as Locale | null
    if (saved === 'en' || saved === 'vi') setLocaleState(saved)
  }, [])

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l)
    localStorage.setItem('locale', l)
  }, [])

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const entry = translations[key]
    let text = entry ? entry[locale] : key
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
      }
    }
    return text
  }, [locale])

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider')
  return ctx
}
