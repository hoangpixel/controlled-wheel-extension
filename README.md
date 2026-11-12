# Fixed Winner Demo — Brave / Chromium

Extension Manifest V3 v1.1.0, JavaScript thuần, có popup dark mode và vòng quay Canvas tích hợp trực tiếp trong bố cục `https://wheelofnames.com/*`. Khi bật, vùng demo xuất hiện ngay trên trang với nhãn **CONTROLLED DEMO – Kết quả định trước**, nút **Spin**, nút **Tắt demo** và bảng debug. Chỉ dùng cho mô phỏng/trình diễn có công bố kết quả định trước.

## Cài trên Brave

1. Mở `brave://extensions`.
2. Bật **Developer mode**.
3. Chọn **Load unpacked**.
4. Chọn thư mục `wheel-controller-extension` chứa `manifest.json`.
5. Truy cập `https://wheelofnames.com/`. Nếu trang đã mở trước khi cài, tải lại trang.
6. Mở popup extension, nhập `Hoàng`, bấm **Save Winner**, bật **Fixed Winner Demo**.
7. Demo tự xuất hiện trong trang. Bấm **Đến vòng quay trên trang ↓** trong popup để cuộn đến demo, rồi bấm **Spin** bên trong vùng có nhãn **CONTROLLED DEMO – Kết quả định trước**.

Khi sửa mã extension: bấm Reload trên thẻ extension trong `brave://extensions`, sau đó tải lại website. Không cần build, npm install, tài khoản hay backend.

## Danh sách và đồng bộ

- Mặc định đọc ô textarea/contenteditable đang hiển thị trên trang; ưu tiên trường có tên/nhãn `names`, `entries`, hoặc trình soạn thảo rich text. Không truy cập Vue store, biến riêng của website hay API bảo mật.
- Mở tab **Entries** của website nếu không nhận diện được danh sách. Nếu có nhiều ô soạn thảo không phân biệt được, extension sẽ báo không thể đọc thay vì tự chọn một ô bất kỳ.
- Theo dõi input/change, MutationObserver có gom sự kiện (160 ms), và kiểm tra mỗi 1,2 giây để nhận các thay đổi `.value` không phát sự kiện. Đọc lại ngay trước mỗi lượt quay. Khi tắt demo, dừng toàn bộ theo dõi và gỡ giao diện.
- Sort/Shuffle trên website được đồng bộ theo thứ tự mới. Tên mục tiêu lưu độc lập với chỉ số, không bị đổi theo vị trí.
- Thay đổi danh sách hoặc tên mục tiêu trong lúc quay sẽ hủy lượt quay. **Tắt demo** trong trang hoặc toggle trong popup hủy animation, gỡ vùng demo và dừng theo dõi. Bật lại từ popup để hiển thị lại.
- Nếu DOM của website thay đổi, danh sách chỉ có ảnh, hoặc dùng chế độ nâng cao không đọc được: chọn **Nhập thủ công cho demo**, dán mỗi dòng một tên và bấm **Áp dụng danh sách demo**. Đây là danh sách độc lập, không sửa danh sách gốc. Danh sách thủ công được lưu trên máy; mỗi tab/reload mặc định lại về đồng bộ từ trang, cần chọn thủ công lại để dùng nó.
- Có thể mở **Danh sách hiện tại** để kiểm tra toàn bộ tên trước khi quay. Các tên dài hoặc rất nhiều ô có thể khó đọc trên Canvas; danh sách văn bản giữ đầy đủ tên.

## Cơ chế chọn kết quả

Tên được chuẩn hóa Unicode NFC, bỏ khoảng trắng hai đầu, giữ dấu, chữ hoa/thường và khoảng trắng bên trong. `Hoàng` khác `Hoang` và `hoàng`. Nếu trùng tên, chọn ô xuất hiện đầu tiên theo thứ tự hiện tại; không gộp các ô trùng nhau.

Với `N` ô bằng nhau, góc mỗi ô là `2π/N`. Tìm chỉ số `i` của tên mục tiêu trong danh sách mới nhất. Kim cố định ở phía trên (`−π/2`), nên góc dừng là `−π/2 − (i + 0,5) × 2π/N`, cộng ít nhất sáu vòng theo chiều quay. Animation dùng requestAnimationFrame, giảm tốc trong 4,8 giây (0,9 giây nếu trình duyệt yêu cầu giảm chuyển động). Kết thúc, lấy kết quả từ **ô thực sự ở dưới kim** bằng cùng hệ tọa độ; không thay chữ thông báo của website.

Chưa chọn tên, tên bị xóa, danh sách trống hoặc không đọc được danh sách đều có cảnh báo và khóa nút Spin của demo. Có thể lưu tên trước khi tên đó có trong danh sách; popup báo đã lưu kèm cảnh báo, không tự thêm tên vào danh sách.

## Tích hợp vào giao diện trang và debug

- Không mở modal hoặc che toàn trang. Demo là một phần tử trong luồng bố cục, có Shadow DOM để tách CSS. Trang và ô Entries vẫn tương tác được trong lúc demo quay.
- Adapter tìm canvas hình gần vuông đang hiển thị, ưu tiên theo diện tích; chèn demo ngay trước khu vực chứa canvas đó. Nếu không xác định được canvas, chèn đầu `main`, `[role=main]`, `#app` hoặc `body`, và ghi rõ vị trí fallback trong debug. Đây là nhận diện DOM theo heuristic, chưa được xác minh với trang Brave thực tế.
- Nếu ứng dụng dựng lại DOM và làm mất vùng demo, lần đồng bộ tiếp theo sẽ gắn lại cùng giao diện. Khi canvas xuất hiện muộn, demo sẽ được chuyển đến khu vực vòng quay.
- Không di chuyển, ẩn, thay thế canvas hoặc nút Spin gốc; không đăng ký sự kiện lên nút gốc, không sửa thuật toán ngẫu nhiên. Khi tắt, chỉ phần tử do extension thêm bị gỡ; bố cục gốc được trả lại.
- Bảng **Debug** mở sẵn: tên mục tiêu, chỉ số mục tiêu (bắt đầu từ 0; `−1` nếu không có), góc hiện tại (radian và độ, chuẩn hóa trong một vòng), chỉ số/tên ô thực tế dưới kim, kết quả lượt hoàn tất và vị trí tích hợp.
- Góc và ô dưới kim cập nhật tối đa khoảng 10 lần/giây trong animation và cập nhật chính xác ở cuối lượt. Trong lúc quay, ô dưới kim có thể khác mục tiêu; khi hoàn tất, tên mục tiêu, ô dưới kim và kết quả phải khớp nhau.
- **Danh sách hiện tại** giữ toàn bộ tên theo thứ tự đang dùng. Hai tên trùng nhau vẫn là hai ô; chỉ số debug giúp xác định ô đã chọn.

## Phạm vi và nghiên cứu tích hợp

Đã tham khảo ngày 12/11/2026:

- [Wheel of Names](https://wheelofnames.com/): mô tả cơ chế quay ngẫu nhiên dựa trên vật lý và `crypto.getRandomValues`.
- [Mã Wheel.js của repo tham khảo](https://github.com/momander/wheel-spinner/blob/master/static/Wheel.js): quản lý trạng thái tăng/giảm tốc nội bộ, xác định kết quả theo ô dưới kim và callback.
- [textboxbuttons.vue](https://github.com/momander/wheel-spinner/blob/master/static/textboxbuttons.vue): Sort/Shuffle cập nhật Vue store.

Repo tham khảo không phải bằng chứng DOM/bản triển khai hiện tại giống hệt mã đó. Trong lần triển khai trước, không xác minh được một API công khai ổn định để ép kết quả vòng quay gốc, một số tệp nguồn không tải được và công cụ từ chối kiểm tra trực tiếp trên Brave. Bản nâng cấp này tái sử dụng Canvas riêng và adapter DOM, chuyển từ overlay sang vùng nội dung trong trang; không phụ thuộc vào API quay nội bộ.

Demo không nhập trọng số, màu, ảnh, âm thanh, tùy chỉnh số ô hoặc kết quả của vòng quay gốc. Các ô demo luôn bằng nhau. Khi bật demo, nút quay gốc vẫn quay ngẫu nhiên theo website; muốn dùng kết quả định trước phải bấm **Spin** trong vùng **CONTROLLED DEMO**.

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

12 bài test tự động dùng Node và DOM/Chrome API mô phỏng: kiểm tra hình học kim/ô cho hơn 5.000 trường hợp, tiếng Việt, danh sách trùng/trống, adapter textarea/contenteditable, Shuffle/Sort, đổi mục tiêu, xóa mục tiêu, hủy lượt quay, bật/tắt, reload cấu hình, popup lưu/cảnh báo và nhập thủ công. Có 72 lượt quay liên tiếp (6 hoán vị × 3 tên mục tiêu × 4 lần), kiểm tra góc, chỉ số debug và kết quả dưới kim. Test tích hợp còn kiểm tra thứ tự/identity/style/handler của nút và canvas gốc sau bật/tắt, gắn lại host bị tách và vị trí fallback khi không có canvas gốc.

**Chưa kiểm thử thực tế việc Load unpacked, vị trí chèn với DOM hiện tại, bố cục trên desktop/mobile, animation hiển thị và tính tương thích với ứng dụng thật trên Brave.** Lần kiểm tra trước bị công cụ từ chối quyền điều khiển; lần nâng cấp này chỉ chạy test mô phỏng và kiểm tra cú pháp. Test mô phỏng không thay thế kiểm tra trình duyệt.

Checklist kiểm tra sau khi cài:

1. Reload extension tại `brave://extensions`, rồi tải lại website. Bật demo trong popup. Kiểm tra demo nằm trong nội dung trang, không có modal, nhãn **CONTROLLED DEMO – Kết quả định trước** hiển thị rõ.
2. Nhập `Hoàng`, `Huy`, `Đạt` trên website. Chọn Hoàng trong popup. Bấm Spin trong demo 3–5 lần: kim, kết quả và ô dưới kim trong debug phải cùng chỉ Hoàng; chỉ số mục tiêu là `0`.
3. Shuffle danh sách ít nhất 5 lần, mỗi lần quay 2–3 lượt. Kiểm tra thứ tự ở **Danh sách hiện tại** khớp website, chỉ số mục tiêu đổi theo vị trí mới, kết quả vẫn Hoàng.
4. Sort rồi quay 3–5 lần. Đổi mục tiêu thành Huy, rồi Đạt; thực hiện lại bước Sort/Shuffle. Không cần sửa mã cho bất kỳ tên nào.
5. Thêm tên có dấu và nhiều từ, thử một tên mới làm mục tiêu; thử tên trùng nhau (ô trùng đầu tiên được chọn), danh sách một tên và danh sách trống.
6. Xóa tên mục tiêu: cảnh báo, debug báo chỉ số `−1` và Spin bị khóa. Thêm lại tên: Spin dùng được.
7. Trong lúc quay, sửa thứ tự hoặc đổi mục tiêu: lượt cũ phải hủy; lượt mới dùng danh sách/mục tiêu mới. Vẫn có thể nhập Entries trong lúc demo quay.
8. Bấm **Tắt demo** ngay trong trang, cả khi đứng yên và khi đang quay. Demo biến mất, popup phản ánh trạng thái Disabled khi mở lại, bố cục gốc phục hồi và nút quay gốc vẫn dùng bình thường. Bật lại bằng popup và thử lần nữa.
9. Thử nút Spin/click của vòng quay gốc khi demo đang bật: nó vẫn dùng hành vi ngẫu nhiên của website, không bị chuyển thành nút demo.
10. Reload trang ở cả trạng thái bật và tắt: cấu hình mục tiêu và trạng thái còn được lưu. Thu nhỏ cửa sổ và kiểm tra bố cục demo không tràn ngang. Nút **Đến vòng quay trên trang ↓** phải cuộn đến đúng vùng demo.
11. Nếu không đọc được Entries, thử nguồn **Nhập thủ công cho demo** và xác nhận debug ghi đúng danh sách/ô dưới kim; danh sách website không bị sửa.

## Tệp chính

- `manifest.json`: Manifest V3 và phạm vi quyền.
- `popup.html`, `popup.css`, `popup.js`: giao diện và lưu cấu hình.
- `wheel-core.js`: chuẩn hóa tên và hình học góc quay.
- `page-reader.js`: adapter DOM chỉ đọc và xác định vị trí chèn.
- `content.js`: đồng bộ, vùng demo trong trang, bật/tắt, debug, Canvas và animation.
- `tests/`: kiểm thử bằng Node, không phụ thuộc package ngoài.
