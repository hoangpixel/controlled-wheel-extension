# Fixed Winner Demo — Brave / Chromium

Extension Manifest V3, JavaScript thuần, có popup dark mode và vòng quay Canvas độc lập trên `https://wheelofnames.com/*`. Luôn hiển thị **Fixed Winner Demo** và thông tin kết quả định trước khi bật. Chỉ dùng cho mô phỏng/trình diễn có công bố kết quả định trước.

## Cài trên Brave

1. Mở `brave://extensions`.
2. Bật **Developer mode**.
3. Chọn **Load unpacked**.
4. Chọn thư mục `wheel-controller-extension` chứa `manifest.json`.
5. Truy cập `https://wheelofnames.com/`. Nếu trang đã mở trước khi cài, tải lại trang.
6. Mở popup extension, nhập `Hoàng`, bấm **Save Winner**, bật **Fixed Winner Demo**.
7. Bấm **Mở vòng quay demo** trong popup hoặc nút **Fixed Winner Demo** ở góc dưới bên phải trang, rồi bấm **Spin Demo**.

Khi sửa mã extension: bấm Reload trên thẻ extension trong `brave://extensions`, sau đó tải lại website. Không cần build, npm install, tài khoản hay backend.

## Danh sách và đồng bộ

- Mặc định đọc ô textarea/contenteditable đang hiển thị trên trang; ưu tiên trường có tên/nhãn `names`, `entries`, hoặc trình soạn thảo rich text. Không truy cập Vue store, biến riêng của website hay API bảo mật.
- Mở tab **Entries** của website nếu không nhận diện được danh sách. Nếu có nhiều ô soạn thảo không phân biệt được, extension sẽ báo không thể đọc thay vì tự chọn một ô bất kỳ.
- Theo dõi input/change, MutationObserver có gom sự kiện (160 ms), và kiểm tra mỗi 1,2 giây để nhận các thay đổi `.value` không phát sự kiện. Đọc lại ngay trước mỗi lượt quay. Khi tắt demo, dừng toàn bộ theo dõi và gỡ giao diện.
- Sort/Shuffle trên website được đồng bộ theo thứ tự mới. Tên mục tiêu lưu độc lập với chỉ số, không bị đổi theo vị trí.
- Thay đổi danh sách hoặc tên mục tiêu trong lúc quay sẽ hủy lượt quay. Đóng overlay cũng hủy lượt quay; có thể mở lại bằng nút góc trang.
- Nếu DOM của website thay đổi, danh sách chỉ có ảnh, hoặc dùng chế độ nâng cao không đọc được: chọn **Nhập thủ công cho demo**, dán mỗi dòng một tên và bấm **Áp dụng danh sách demo**. Đây là danh sách độc lập, không sửa danh sách gốc. Danh sách thủ công được lưu trên máy; mỗi tab/reload mặc định lại về đồng bộ từ trang, cần chọn thủ công lại để dùng nó.
- Có thể mở **Danh sách hiện tại** để kiểm tra toàn bộ tên trước khi quay. Các tên dài hoặc rất nhiều ô có thể khó đọc trên Canvas; danh sách văn bản giữ đầy đủ tên.

## Cơ chế chọn kết quả

Tên được chuẩn hóa Unicode NFC, bỏ khoảng trắng hai đầu, giữ dấu, chữ hoa/thường và khoảng trắng bên trong. `Hoàng` khác `Hoang` và `hoàng`. Nếu trùng tên, chọn ô xuất hiện đầu tiên theo thứ tự hiện tại; không gộp các ô trùng nhau.

Với `N` ô bằng nhau, góc mỗi ô là `2π/N`. Tìm chỉ số `i` của tên mục tiêu trong danh sách mới nhất. Kim cố định ở phía trên (`−π/2`), nên góc dừng là `−π/2 − (i + 0,5) × 2π/N`, cộng ít nhất sáu vòng theo chiều quay. Animation dùng requestAnimationFrame, giảm tốc trong 4,8 giây (0,9 giây nếu trình duyệt yêu cầu giảm chuyển động). Kết thúc, lấy kết quả từ **ô thực sự ở dưới kim** bằng cùng hệ tọa độ; không thay chữ thông báo của website.

Chưa chọn tên, tên bị xóa, danh sách trống hoặc không đọc được danh sách đều có cảnh báo và khóa Spin Demo. Có thể lưu tên trước khi tên đó có trong danh sách; popup báo đã lưu kèm cảnh báo, không tự thêm tên vào danh sách.

## Phạm vi và nghiên cứu tích hợp

Đã tham khảo ngày 12/11/2026:

- [Wheel of Names](https://wheelofnames.com/): mô tả cơ chế quay ngẫu nhiên dựa trên vật lý và `crypto.getRandomValues`.
- [Mã Wheel.js của repo tham khảo](https://github.com/momander/wheel-spinner/blob/master/static/Wheel.js): quản lý trạng thái tăng/giảm tốc nội bộ, xác định kết quả theo ô dưới kim và callback.
- [textboxbuttons.vue](https://github.com/momander/wheel-spinner/blob/master/static/textboxbuttons.vue): Sort/Shuffle cập nhật Vue store.

Repo tham khảo không phải bằng chứng DOM/bản triển khai hiện tại giống hệt mã đó. Không xác minh được một API công khai ổn định để ép kết quả vòng quay gốc. Một số tệp nguồn không tải được; việc kiểm tra DOM trực tiếp trên Brave bị công cụ từ chối. Vì vậy dùng phương án Canvas overlay theo yêu cầu, với adapter DOM có giới hạn được công bố và đường nhập thủ công.

Demo không nhập trọng số, màu, ảnh, âm thanh, tùy chỉnh số ô hoặc kết quả của vòng quay gốc. Các ô demo luôn bằng nhau. Đóng overlay trả quyền tương tác cho trang. Khi bật demo, nút quay gốc vẫn quay ngẫu nhiên theo website; muốn dùng kết quả định trước phải bấm **Spin Demo** trong overlay.

## Quyền và dữ liệu

Chỉ yêu cầu `storage`. Content script chỉ được khai báo cho `https://wheelofnames.com/*`, không cho subdomain, iframe hay website khác. Popup dùng tab hiện tại để trao đổi với content script; không cần quyền `tabs`, `scripting`, clipboard hoặc quyền toàn bộ website.

Lưu `fixedWinnerDemo: { enabled, target }` và tùy chọn `fixedWinnerDemoManualNames` trong `chrome.storage.local`. Cấu hình dùng chung giữa các tab; nguồn danh sách là riêng từng tab. Không gửi dữ liệu ra ngoài, không remote code, thư viện ngoài hay ghi đè `crypto.getRandomValues`, `Math.random` hoặc hàm quay của website. Giao diện tách bằng Shadow DOM; dữ liệu tên chỉ được gán qua textContent/value hoặc vẽ Canvas.

## Kiểm thử

Yêu cầu Node.js có `node:test` (khuyến nghị Node 20+). Chạy:

```powershell
node --test tests/demo.test.cjs
node --check content.js
node --check popup.js
node --check page-reader.js
node --check wheel-core.js
```

Test tự động dùng Node và DOM/Chrome API mô phỏng: kiểm tra hình học kim/ô cho hơn 5.000 trường hợp, tiếng Việt, danh sách trùng/trống, adapter textarea/contenteditable, Shuffle/Sort, Hoàng → Huy → Đạt, xóa mục tiêu, hủy lượt quay, bật/tắt, reload cấu hình, popup lưu/cảnh báo và nhập thủ công.

**Chưa kiểm thử thực tế việc Load unpacked, giao diện hiển thị, animation và adapter với DOM hiện tại trên Brave.** Môi trường có Brave nhưng công cụ không được cấp quyền điều khiển. Test mô phỏng không thay thế kiểm tra trình duyệt.

Checklist kiểm tra sau khi cài:

1. Nhập `Hoàng`, `Huy`, `Đạt` trên website. Chọn `Hoàng`; kim và kết quả phải cùng chỉ Hoàng.
2. Shuffle rồi quay, Sort rồi quay: vẫn Hoàng.
3. Đổi mục tiêu thành Huy, sau đó Đạt: kim và kết quả theo tên mới.
4. Xóa tên mục tiêu: xuất hiện cảnh báo và Spin Demo bị khóa.
5. Đổi danh sách trong lúc quay: lượt quay hủy, không công bố kết quả cũ.
6. Đóng/mở overlay, thử Escape; nhập thủ công nếu không đọc được Entries.
7. Tắt demo: nút/overlay biến mất, vòng quay gốc vẫn dùng bình thường.
8. Reload trang: mục tiêu và trạng thái bật/tắt còn được lưu.

## Tệp chính

- `manifest.json`: Manifest V3 và phạm vi quyền.
- `popup.html`, `popup.css`, `popup.js`: giao diện và lưu cấu hình.
- `wheel-core.js`: chuẩn hóa tên và hình học góc quay.
- `page-reader.js`: adapter DOM chỉ đọc.
- `content.js`: đồng bộ, overlay, Canvas và animation.
- `tests/`: kiểm thử bằng Node, không phụ thuộc package ngoài.
