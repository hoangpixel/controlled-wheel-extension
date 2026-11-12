# Fixed Winner Demo — điều khiển vòng quay gốc

Manifest V3 v1.2.0. Bản này bỏ Canvas riêng của extension và thêm adapter điều khiển **engine, Canvas, thao tác quay và callback kết quả của website** khi nhận diện được cấu trúc tương thích. Khi bật luôn có nhãn **CONTROLLED DEMO – Kết quả định trước**. Dùng cho trình diễn có công bố kết quả định trước.

**Giới hạn quan trọng:** adapter dựa trên hợp đồng của `Wheel` trong repo `momander/wheel-spinner`. Chưa xác nhận engine/DOM của website đang chạy trên Brave giống hợp đồng này. Nếu trang không lộ đối tượng tương thích hoặc đã đổi cấu trúc, extension hiển thị **không kết nối được engine gốc**, không báo đã áp dụng thành công. Không có vòng quay mô phỏng khác để thay thế ngầm.

## Cập nhật và dùng trên Brave

1. Mở `brave://extensions`, bật **Developer mode**.
2. Nếu đã cài: bấm **Reload** trên thẻ extension. Nếu chưa cài: **Load unpacked** → chọn thư mục project này.
3. **Tải lại hoàn toàn tab `https://wheelofnames.com/` sau khi reload extension.** Bản này thêm script chạy trong MAIN world; mã cũ trong tab không tự được cập nhật.
4. Nhập danh sách tên trên website, mở popup, nhập đúng tên, bấm **Save Winner** rồi bật **Điều khiển vòng quay gốc**.
5. Bấm **Đến vòng quay gốc / trạng thái ↓**. Chỉ tiếp tục khi bảng trạng thái cho biết **Đã kết nối vòng quay gốc**, danh sách engine đúng và không có cảnh báo.
6. **Bấm trực tiếp Canvas hoặc nút quay gốc của website.** Không còn nút Spin/Canvas demo thứ hai. Với engine tham khảo, phím Ctrl+Enter cũng đi qua luồng điều khiển.
7. Đối chiếu kim trên Canvas gốc, thông báo thắng cuộc của website và **Kết quả thực tế** trong debug: cả ba phải khớp tên mục tiêu.
8. Tắt bằng toggle trong popup hoặc **Tắt điều khiển** trên trang. Wrapper được gỡ, các hàm quay ban đầu được khôi phục. Lượt đang điều khiển bị hủy, không công bố kết quả giả. Nếu không xác nhận được việc gỡ adapter, nhãn sẽ còn kèm thông báo yêu cầu tải lại trang.

Nếu báo không tương thích: tải lại website sau khi reload extension; nếu lỗi vẫn còn, ghi lại nguyên văn dòng trạng thái để điều chỉnh adapter cho engine thực tế. Không coi việc lưu tên thành công là bằng chứng engine đã kết nối.

## Cách hoạt động

- Script `MAIN` truy tìm đối tượng `myWheel`/`wheel` từ component Vue gắn với Canvas. Chỉ chấp nhận khi đối tượng có đủ phương thức và trạng thái theo hợp đồng tham khảo. Không truy cập tùy ý toàn bộ biến trang.
- Wrapper trên `wheel.click` nhận chính các callback của website. Canvas tiếp tục được vẽ bởi renderer sẵn có; không ghi đè DOM thông báo thắng cuộc.
- Mỗi lượt đọc lại danh sách **đang thực sự hiển thị trong engine**, tìm tên bằng Unicode NFC và bỏ khoảng trắng hai đầu. Giữ dấu, chữ hoa/thường và khoảng trắng bên trong. Trùng tên: dùng ô đầu tiên trong danh sách engine.
- Engine tham khảo có kim bên phải, ô đầu ở góc 0. Với `N` ô, tâm ô `i` tương ứng góc `i × 2π/N`. Trước khi quay, adapter kiểm chứng tâm và hai điểm trong ô bằng `getIndexAtPointer` và `getEntryAtPointer` thực tế của engine. Không dùng góc kim trên đỉnh của Canvas demo cũ.
- Khi tương thích, thay trạng thái quay của riêng wheel đó bằng chuyển động giảm tốc, tối thiểu sáu vòng, chạy theo vòng lặp tick sẵn có. Thời lượng theo cấu hình website, giới hạn 1–20 giây; chế độ giảm chuyển động dùng 0,9 giây.
- Kết thúc: xác nhận tên **thực tế dưới kim**, rồi gọi `spinIsDone()` để website nhận đúng đối tượng entry của nó. Không chỉ thay chữ người thắng.
- Sort/Shuffle, thay danh sách, đổi mục tiêu và cấu hình được kiểm tra lại. Thay đổi giữa lượt sẽ hủy lượt; không trả kết quả cũ.
- Khi tắt, khôi phục đúng descriptor/phương thức gốc, không sửa prototype toàn cục, `Math.random`, `crypto.getRandomValues`, hay chức năng bảo mật.

## Phạm vi hỗ trợ hiện tại

- Một wheel tương thích tại một thời điểm; danh sách văn bản hiển thị đầy đủ, các ô có trọng số bằng 1 hoặc không khai báo trọng số.
- Chưa hỗ trợ trọng số khác 1, chế độ chỉ hiện một phần danh sách, hoặc ảnh phủ thay các ô tên. Các trường hợp này hiển thị lỗi và không công bố người thắng cố định.
- Nếu đối tượng wheel không được framework công khai trên DOM, adapter không thể kết nối. Không có cam kết hỗ trợ mọi phiên bản wheelofnames.com.
- Nếu bật giữa một lượt quay ngẫu nhiên đang chạy, adapter đợi engine hết bận; lượt đã bắt đầu trước khi kết nối không được thay kết quả.
- Khi bật nhưng chưa kết nối/thiếu mục tiêu, capture guard chặn các click Canvas và nút Spin/Quay nhận diện được, cùng Ctrl+Enter. Không bảo đảm chặn mọi cơ chế khởi động riêng của phiên bản không tương thích. Muốn quay ngẫu nhiên như bình thường, tắt điều khiển.
- Trường hợp website dựng lại component, adapter thử kết nối lại. Vị trí bảng trạng thái dựa trên DOM heuristic; cần kiểm tra bố cục thực tế trên Brave.

## Debug

Bảng trên trang hiển thị kết nối engine, tên mục tiêu, chỉ số mục tiêu từ 0 (`−1` khi không có), góc radian/độ, chỉ số/tên ô thực tế dưới kim, và kết quả callback gần nhất. Có thể mở danh sách entry thực tế của engine để đối chiếu sau Sort/Shuffle. Debug cập nhật khoảng 10 lần/giây khi quay, cộng cập nhật cuối lượt và polling trạng thái.

## Quyền và dữ liệu

Chỉ có quyền `storage`, phạm vi `https://wheelofnames.com/*`, không backend, không remote code, không gửi dữ liệu ra máy chủ ngoài. Vẫn lưu `fixedWinnerDemo: { enabled, target }` trong `chrome.storage.local`. Cấu hình dùng chung giữa các tab. Danh sách thủ công của bản cũ nếu có vẫn nằm trong local storage nhưng không được dùng trong chế độ gốc.

Hai execution world trao đổi cấu hình/kết quả không bí mật qua `postMessage` cùng origin; MAIN không có quyền gọi storage. Đây không phải ranh giới bảo mật với website: JavaScript của trang có thể quan sát hoặc can thiệp MAIN world. Không chuyển API storage hay dữ liệu tài khoản qua bridge.

## Kiểm thử tự động

Không cần cài dependency. Node.js 20+:

```powershell
node --test tests/demo.test.cjs
node --check content.js
node --check native-controller.js
node --check page-bridge.js
node --check popup.js
```

12 test hiện tại bao gồm:

- Chuẩn hóa tiếng Việt và hơn 5.000 trường hợp hình học của core dùng chung.
- 72 lượt quay qua adapter gốc: 6 hoán vị × 3 tên mục tiêu × 4 lượt, xác nhận góc/kim bên phải, entry thực tế và callback gọi đúng một lần; nhánh quay ngẫu nhiên không được gọi trong lúc điều khiển.
- Thiếu tên, số ô bị giới hạn, trọng số không hỗ trợ và hệ tọa độ không tương thích không công bố người thắng giả.
- Kiểm tra lại ô dưới kim sau toàn bộ tick gốc (kể cả advance), chặn công bố nếu engine dịch chuyển góc ngoài hợp đồng.
- Cài adapter thất bại giữa chừng do phương thức chỉ đọc: hoàn tác những hàm đã thay đổi.
- Đổi danh sách/mục tiêu hoặc tắt giữa lượt: hủy; khôi phục đúng phương thức gốc và quay bình thường sau khi tắt.
- Bridge giữa hai VM world tách biệt, callback kết quả website, không tạo Canvas thứ hai, trạng thái không tương thích và popup lưu/cảnh báo.

Fixture mô hình hóa hợp đồng mã tham khảo, **không phải engine tải trực tiếp từ website hiện tại**. Đã chạy test Node và kiểm tra cú pháp; chưa kiểm thử thực tế Load unpacked, engine/DOM hiện tại, animation hiển thị, âm thanh/confetti, thông báo thắng cuộc, bố cục và thao tác trên Brave. Lần kiểm tra trình duyệt trước bị công cụ từ chối quyền điều khiển.

## Checklist trên Brave

1. Reload extension rồi tải lại tab website; lưu tên, bật và xác nhận trạng thái **Đã kết nối vòng quay gốc**. Nếu lỗi, dừng kiểm tra kết quả cố định và ghi lại dòng lỗi.
2. Dùng danh sách ba tên bất kỳ. Chọn lần lượt từng tên, bấm **Canvas gốc** ít nhất 5 lượt/tên. Đối chiếu kim gốc, thông báo website và debug.
3. Shuffle ít nhất 5 lần và Sort; mỗi lần quay 3 lượt. Tên mục tiêu giữ nguyên, chỉ số thay theo thứ tự, kết quả vẫn khớp.
4. Xóa mục tiêu, thử quay: cảnh báo và không có kết quả cố định giả. Thêm lại rồi thử tiếp.
5. Đổi mục tiêu hoặc danh sách trong lúc quay: lượt cũ hủy; lượt tiếp theo dùng cấu hình mới.
6. Tắt trong lúc quay, kiểm tra nhãn/bảng gỡ sau xác nhận và vòng quay gốc dùng được bình thường. Bật lại, rồi thử reload ở cả hai trạng thái để kiểm tra lưu cấu hình.
7. Thử Ctrl+Enter/nút quay gốc khác mà phiên bản trang cung cấp, thử popup và chuyển tab. Xác nhận mọi thao tác đều dẫn đến cùng engine đã kết nối.

## Tệp

- `manifest.json`: hai content-script world, MV3, quyền storage.
- `native-controller.js`: kiểm tra hợp đồng, điều khiển wheel gốc và khôi phục.
- `page-bridge.js`: phát hiện component, bridge MAIN, guard và kết nối lại.
- `content.js`: storage, giao thức, bảng trạng thái/debug có nhãn.
- `wheel-core.js`: chuẩn hóa tên/hình học dùng chung.
- `page-reader.js`: đọc DOM và xác định vị trí bảng trạng thái; kết quả gốc lấy từ engine.
- `popup.html`, `popup.css`, `popup.js`: chọn tên, bật/tắt, phản hồi tương thích.
- `tests/`: fixture hợp đồng tham khảo và test không dependency.

## Nguồn tham khảo

- [spinningwheel.vue](https://github.com/momander/wheel-spinner/blob/master/static/spinningwheel.vue): component `myWheel`, tick, callback kết quả và phím Ctrl+Enter.
- [Wheel.js](https://github.com/momander/wheel-spinner/blob/master/static/Wheel.js), [Util.js](https://github.com/momander/wheel-spinner/blob/master/static/Util.js), [WheelPainter.js](https://github.com/momander/wheel-spinner/blob/master/static/WheelPainter.js): hợp đồng trạng thái và hệ tọa độ kim gốc.
- [Chrome: content scripts và MAIN world](https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts): khai báo execution world, không cần thêm quyền scripting.

Các nguồn trên mô tả hợp đồng dùng để phát triển; không chứng minh bản production hiện tại còn giữ cấu trúc đó.
