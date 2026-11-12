# Fixed Winner Demo — điều khiển vòng quay gốc

Manifest V3 v1.2.1. Bản này bỏ Canvas riêng của extension và thêm adapter điều khiển **engine, Canvas, thao tác quay và callback kết quả của website** khi nhận diện được cấu trúc tương thích. Khi kết nối thành công có nhãn nhỏ **CONTROLLED DEMO – Kết quả định trước** ở góc dưới; khi chưa áp dụng, nhãn ghi rõ **Chưa áp dụng**. Dùng cho trình diễn có công bố kết quả định trước.

Bản 1.2.1 đã bỏ toàn bộ bảng tọa độ/debug/danh sách phía trên vòng quay. Không chèn khối nội dung vào bố cục ứng dụng nữa. Quảng cáo, FAQ và các nội dung bên dưới của website được giữ nguyên; extension không ẩn, sao chép hoặc tạo lại các mục đó.

**Giới hạn quan trọng:** adapter dựa trên hợp đồng của `Wheel` trong repo `momander/wheel-spinner`. Chưa xác nhận engine/DOM của website đang chạy trên Brave giống hợp đồng này. Nếu trang không lộ đối tượng tương thích hoặc đã đổi cấu trúc, extension hiển thị **không kết nối được engine gốc**, không báo đã áp dụng thành công. Không có vòng quay mô phỏng khác để thay thế ngầm.

## Cập nhật và dùng trên Brave

1. Mở `brave://extensions`, bật **Developer mode**.
2. Nếu đã cài: bấm **Reload** trên thẻ extension. Nếu chưa cài: **Load unpacked** → chọn thư mục project này.
3. **Tải lại hoàn toàn tab `https://wheelofnames.com/` sau khi reload extension.** Bản này thêm script chạy trong MAIN world; mã cũ trong tab không tự được cập nhật.
4. Nhập danh sách tên trên website, mở popup, nhập đúng tên, bấm **Save Winner** rồi bật **Điều khiển vòng quay gốc**.
5. Kiểm tra trạng thái trong popup. Chỉ tiếp tục khi popup cho biết **Đã kết nối vòng quay gốc** và không có cảnh báo. Nút **Đến vòng quay gốc ↓** chỉ cuộn đến khu vực vòng quay.
6. **Bấm trực tiếp Canvas hoặc nút quay gốc của website.** Không còn nút Spin/Canvas demo thứ hai. Với engine tham khảo, phím Ctrl+Enter cũng đi qua luồng điều khiển.
7. Đối chiếu kim trên Canvas gốc và thông báo thắng cuộc của website: cả hai phải khớp tên mục tiêu.
8. Tắt bằng toggle trong popup. Wrapper được gỡ, các hàm quay ban đầu được khôi phục. Lượt đang điều khiển bị hủy, không công bố kết quả giả. Nếu không xác nhận được việc gỡ adapter, nhãn sẽ báo lỗi kết nối và popup báo cần tải lại trang.

Nếu báo không tương thích: tải lại website sau khi reload extension. Nếu lỗi vẫn còn, mở popup → **Chẩn đoán kết nối** → **Đọc thông tin chẩn đoán**, sao chép nội dung trong ô để kiểm tra engine thực tế. Báo cáo gồm số canvas, dấu vết Vue, tên trường/phương thức và các điều kiện còn thiếu; không chứa giá trị tên người tham gia và không tự gửi dữ liệu đi đâu. Không coi việc lưu tên thành công là bằng chứng engine đã kết nối.

## Cách hoạt động

- Script `MAIN` truy tìm engine từ component Vue gắn với Canvas, cả Vue 2 và cây component/VNode Vue 3, kể cả trường engine được đổi tên hoặc nằm trong state lồng nhau. Việc tìm kiếm có giới hạn độ sâu/số node. Chỉ chấp nhận khi đối tượng có đủ phương thức và trạng thái theo hợp đồng tham khảo. Không truy cập tùy ý toàn bộ biến trang.
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
- Khi đã kết nối nhưng thiếu mục tiêu hoặc cấu hình không hỗ trợ, guard chặn các thao tác quay nhận diện được để tránh công bố kết quả sai. Khi không kết nối được engine, không chặn vòng quay gốc; lúc đó nó vẫn quay ngẫu nhiên và nhãn ghi **Chưa áp dụng**.
- Trường hợp website dựng lại component, adapter thử kết nối lại. Nhãn nhỏ được gắn ngoài bố cục ứng dụng, không tăng chiều cao hoặc đổi kích thước vòng quay.

## Chẩn đoán

Không còn hiển thị tọa độ, tên, chỉ số hoặc danh sách debug trên trang. Mục **Chẩn đoán kết nối** trong popup mặc định thu gọn, chỉ đọc thông tin khi bấm nút. Mục này giúp phân biệt không tìm thấy component, tìm thấy state nhưng không thấy wheel, hoặc engine thiếu phương thức theo hợp đồng. Các trường/phương thức được liệt kê để điều chỉnh adapter; không giả định bản production 440 giống mã tham khảo.

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

15 test hiện tại bao gồm:

- Chuẩn hóa tiếng Việt và hơn 5.000 trường hợp hình học của core dùng chung.
- 72 lượt quay qua adapter gốc: 6 hoán vị × 3 tên mục tiêu × 4 lượt, xác nhận góc/kim bên phải, entry thực tế và callback gọi đúng một lần; nhánh quay ngẫu nhiên không được gọi trong lúc điều khiển.
- Thiếu tên, số ô bị giới hạn, trọng số không hỗ trợ và hệ tọa độ không tương thích không công bố người thắng giả.
- Kiểm tra lại ô dưới kim sau toàn bộ tick gốc (kể cả advance), chặn công bố nếu engine dịch chuyển góc ngoài hợp đồng.
- Cài adapter thất bại giữa chừng do phương thức chỉ đọc: hoàn tác những hàm đã thay đổi.
- Đổi danh sách/mục tiêu hoặc tắt giữa lượt: hủy; khôi phục đúng phương thức gốc và quay bình thường sau khi tắt.
- Bridge giữa hai VM world tách biệt, callback kết quả website, không tạo Canvas thứ hai, trạng thái không tương thích và popup lưu/cảnh báo.
- Nhãn ngoài bố cục, không có debug trên trang; không chặn vòng quay khi engine chưa hỗ trợ; tìm engine từ cây Vue 3/state đổi tên; chẩn đoán chỉ đọc theo yêu cầu và không chứa tên người tham gia.

Fixture mô hình hóa hợp đồng mã tham khảo, **không phải engine tải trực tiếp từ website hiện tại**. Đã chạy test Node và kiểm tra cú pháp; chưa kiểm thử thực tế Load unpacked, engine/DOM hiện tại, animation hiển thị, âm thanh/confetti, thông báo thắng cuộc, bố cục và thao tác trên Brave. Lần kiểm tra trình duyệt trước bị công cụ từ chối quyền điều khiển.

## Checklist trên Brave

1. Reload extension rồi tải lại tab website; lưu tên, bật và xác nhận trạng thái **Đã kết nối vòng quay gốc** trong popup. Nếu lỗi, dừng kiểm tra kết quả cố định và đọc chẩn đoán trong popup.
2. Dùng danh sách ba tên bất kỳ. Chọn lần lượt từng tên, bấm **Canvas gốc** ít nhất 5 lượt/tên. Đối chiếu kim gốc và thông báo website.
3. Shuffle ít nhất 5 lần và Sort; mỗi lần quay 3 lượt. Tên mục tiêu giữ nguyên, chỉ số thay theo thứ tự, kết quả vẫn khớp.
4. Xóa mục tiêu, thử quay: cảnh báo và không có kết quả cố định giả. Thêm lại rồi thử tiếp.
5. Đổi mục tiêu hoặc danh sách trong lúc quay: lượt cũ hủy; lượt tiếp theo dùng cấu hình mới.
6. Tắt trong lúc quay, kiểm tra nhãn gỡ sau xác nhận và vòng quay gốc dùng được bình thường. Bật lại, rồi thử reload ở cả hai trạng thái để kiểm tra lưu cấu hình.
7. Thử Ctrl+Enter/nút quay gốc khác mà phiên bản trang cung cấp, thử popup và chuyển tab. Xác nhận mọi thao tác đều dẫn đến cùng engine đã kết nối.

## Tệp

- `manifest.json`: hai content-script world, MV3, quyền storage.
- `native-controller.js`: kiểm tra hợp đồng, điều khiển wheel gốc và khôi phục.
- `page-bridge.js`: phát hiện component, bridge MAIN, guard và kết nối lại.
- `content.js`: storage, giao thức, nhãn chế độ nhỏ ngoài bố cục trang.
- `wheel-core.js`: chuẩn hóa tên/hình học dùng chung.
- `page-reader.js`: đọc DOM và xác định khu vực vòng quay cho nút cuộn đến; kết quả gốc lấy từ engine.
- `popup.html`, `popup.css`, `popup.js`: chọn tên, bật/tắt, phản hồi tương thích.
- `tests/`: fixture hợp đồng tham khảo và test không dependency.

## Nguồn tham khảo

- [spinningwheel.vue](https://github.com/momander/wheel-spinner/blob/master/static/spinningwheel.vue): component `myWheel`, tick, callback kết quả và phím Ctrl+Enter.
- [Wheel.js](https://github.com/momander/wheel-spinner/blob/master/static/Wheel.js), [Util.js](https://github.com/momander/wheel-spinner/blob/master/static/Util.js), [WheelPainter.js](https://github.com/momander/wheel-spinner/blob/master/static/WheelPainter.js): hợp đồng trạng thái và hệ tọa độ kim gốc.
- [Chrome: content scripts và MAIN world](https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts): khai báo execution world, không cần thêm quyền scripting.

Các nguồn trên mô tả hợp đồng dùng để phát triển; không chứng minh bản production hiện tại còn giữ cấu trúc đó.
