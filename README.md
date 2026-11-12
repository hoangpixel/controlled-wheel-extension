# Fixed Winner Demo — bản 1.4.1

Extension Manifest V3 điều khiển vòng quay gốc của wheelofnames.com với kết quả định trước. Cấu hình lưu bằng `chrome.storage.local`. Không có Canvas thứ hai, không thay chữ trong thông báo thắng cuộc.

Profile **v440** được viết theo các tệp production người dùng cung cấp: `EditWheelPage-v440.js`, `StaticWheel-v440.js`, `ConfettiLauncher-v440.js`, `dist-v4402.js`. Đây là thay đổi cơ chế kết nối, không chỉ tăng phạm vi quét Vue như các bản 1.2.x.

Trạng thái kết nối và lỗi hiển thị trong popup. Không chèn nhãn hoặc bảng tên/chỉ số/tọa độ/debug trên trang vòng quay. Quảng cáo, FAQ và nội dung bên dưới website giữ nguyên.

## Mới trong 1.4.1

Bỏ nhãn **CONTROLLED DEMO – Kết quả định trước** trên trang và dòng tương ứng ở chân popup. Các chức năng khớp tên ngắn, điểm dừng ngẫu nhiên trong ô mục tiêu, bật/tắt và chẩn đoán kết nối vẫn hoạt động như bản 1.4.0.

## Mới trong 1.4.0

- Entries có thể chứa đầy đủ họ tên; popup chỉ cần nhập tên cuối hoặc tên đệm + tên. Ví dụ: `An` khớp `Nguyễn Văn An`; `Minh Hoàng` khớp `Phạm Minh Hoàng`.
- Ưu tiên khớp toàn bộ mục nhập, sau đó mới tìm phần cuối họ tên theo ranh giới từ. Không phân biệt hoa/thường, vẫn phân biệt dấu; chuẩn hóa Unicode và khoảng trắng khi so sánh. Văn bản trong Entries và kết quả của website được giữ nguyên.
- Nếu tên ngắn khớp nhiều mục nhập, chặn lượt điều khiển và yêu cầu nhập thêm tên đệm hoặc đầy đủ họ tên. Ví dụ: có cả `Nguyễn Văn An` và `Trần Đức An` thì nhập `Văn An` hoặc họ tên đầy đủ. Nếu có các mục nhập giống hệt nhau, nhập toàn bộ tên sẽ chọn ô đầu tiên như trước.
- Popup hiển thị **Khớp Entries: [họ tên đầy đủ]** khi xác định được mục tiêu.
- Mỗi lượt chọn ngẫu nhiên điểm dừng trong ô mục tiêu, cách tâm 10–40% bề rộng ô về một trong hai phía. Bỏ vùng chính giữa và chừa ít nhất 10% bề rộng ô trước mỗi biên. Mỗi phía có xác suất 50%; vị trí bên trong mỗi vùng được lấy đều.
- Chỉ lấy một mẫu vị trí khi bắt đầu lượt; việc đọc trạng thái hoặc kiểm tra trước lượt không thay đổi vị trí đã chọn. Sort/Shuffle sẽ tìm lại họ tên và chỉ số trên danh sách thực tế.

Đây vẫn là chế độ kết quả định trước. Sự ngẫu nhiên chỉ áp dụng cho điểm dừng bên trong ô đã chọn.

## Cập nhật trên Brave

1. Mở `brave://extensions`.
2. Nếu đã cài, bấm **Reload** trên thẻ extension. Nếu chưa cài, bật **Developer mode** → **Load unpacked** → chọn thư mục project.
3. **Tải lại hoàn toàn tab wheelofnames.com sau khi reload extension.** Việc này gỡ các wrapper cũ trong tab và nạp các tệp mới.
4. Giữ tab website đang hiển thị. Nhập danh sách tên trên website.
5. Mở popup, nhập tên mục tiêu (có thể chỉ nhập tên cuối), bấm **Save Winner**, bật **Điều khiển vòng quay gốc**. Kiểm tra họ tên tại dòng **Khớp Entries**.
6. Đợi khoảng 1–3 giây để adapter nhận một khung hình của Canvas. Popup tự cập nhật trạng thái mỗi giây.
7. Khi popup báo **Đã kết nối vòng quay gốc** và không có cảnh báo, bấm trực tiếp Canvas gốc hoặc dùng Ctrl+Enter trên website.
8. Kim trên vòng quay gốc và thông báo thắng cuộc gốc phải cùng chỉ đúng tên đã lưu.

Tắt bằng toggle trong popup để khôi phục các phương thức quay ban đầu. Lượt đang điều khiển bị hủy và không công bố người thắng. Không cần build, cài dependency, backend hay tài khoản.

## Vì sao các bản trước không kết nối được với v440

Mã tham khảo cũ dùng đối tượng wheel có `angle`, `speed`, `state` và `entryPicker`. Bản 440 dùng `wheelState`, các phase dạng chuỗi và callback được truyền vào constructor.

Trong `ConfettiLauncher-v440.js`, component `SpinningWheel` tạo engine bằng `new b(...)` trong closure của `setup()`. Vue chỉ expose `spin` và `resetRotation`, nên quét `data`/`setupState` không lấy được engine đó.

Class `b` chính là export `t` của `dist-v4402.js`. Bản 1.3.0 dùng đường kết nối dưới đây để lấy đúng instance đã tồn tại.

## Cách kết nối v440

1. Tìm component đã mount có tên `SpinningWheel`, prop `wheelConfig` và phương thức `spin` được expose.
2. Xác nhận trang đã tải cả `ConfettiLauncher-v440.js` và `dist-v4402.js` từ cùng thư mục, cùng origin. URL có query/hash hoặc khác phiên bản bị từ chối.
3. Trong MAIN world, gọi `import()` với **đúng URL module gốc đã được website khởi tạo**, để truy cập namespace của chính module đó. Không tạo URL cache-busting, không fetch rồi eval source, không tải bản vá từ CDN. Các import lặp lại trong cùng môi trường dùng lại module đã được đánh giá; xem [tài liệu về module caching](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import#module_namespace_object).
4. Tạm bọc `draw()` trên prototype của class engine. Renderer gốc vẫn được gọi nguyên vẹn. Chỉ nhận instance khi context Canvas và `wheelConfig` khớp component đã tìm thấy.
5. Gỡ wrapper prototype ngay khi nhận diện xong, hoặc sau tối đa bốn giây, hoặc khi tắt. Không sửa prototype của API trình duyệt.
6. Kết nối Pinia store chứa đúng wheel để có thể bỏ trạng thái bận khi hủy lượt.
7. Cài adapter trên riêng instance engine đó. Giữ nguyên renderer, Canvas, callback âm thanh đổi ô và callback thắng cuộc của website.

Mã điều khiển extension nằm trong các tệp cục bộ của project. Việc truy cập module ở bước 3 sử dụng code gốc của website đã chạy; không phải cơ chế cập nhật/tải logic extension từ xa. Chỉ thực hiện với profile v440 đã kiểm tra và URL gốc quan sát được trong Resource Timing.

MAIN world chịu CSP của website, theo [tài liệu Chrome](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts#content-security-policy). Nếu trình duyệt hoặc CSP không cho truy cập module, adapter sẽ báo lỗi; không nới lỏng CSP hay cơ chế bảo mật để vượt qua lỗi đó.

Đường kết nối theo state Vue cũ vẫn được giữ cho engine tham khảo tương thích.

## Cách chọn kết quả

- Đọc lại `wheelState.visibleEntries` của engine trước mỗi lượt; không dùng vị trí cố định hoặc danh sách nhập thủ công riêng.
- So sánh tên bằng Unicode NFC, gộp khoảng trắng và không phân biệt hoa/thường; vẫn phân biệt dấu. Ưu tiên toàn bộ tên rồi đến phần cuối họ tên theo ranh giới từ. Chỉ dùng tên ngắn khi xác định được duy nhất một mục nhập. Không sửa văn bản entry thật.
- Kim gốc nằm bên phải. Với `N` ô bằng nhau, tâm ô `i` tương ứng góc `i × 2π/N`.
- Kiểm chứng tâm, hai điểm lệch 40% bề rộng ô và điểm dừng đã chọn bằng các getter thật `getIndexAtPointer(angle)` và `getEntryAtAngle(angle)` của engine.
- Điểm dừng được lấy ngẫu nhiên trong hai dải `[-0,4; -0,1)` và `[0,1; 0,4)` lần bề rộng ô tính từ tâm; không dừng ở tâm hoặc sát biên. `Math.random()` chỉ được gọi để lấy điểm dừng, không ghi đè RNG toàn cục của website.
- Wrapper `click()` bắt đầu lượt quay có giảm tốc, ít nhất sáu vòng. Wrapper `tick()` cập nhật cùng `wheelState` mà renderer gốc đọc: `angle`, `phase`, `indexAtPointer`, `entryAtPointer`, v.v.
- Thời lượng theo cấu hình website, giới hạn 1–20 giây; chế độ giảm chuyển động dùng 0,9 giây.
- Khi kết thúc, trạng thái đã được cập nhật thành `StoppedPhase`, ô thực tế dưới kim được kiểm tra, rồi callback constructor `doneSpinningCallback(entry)` của website được gọi đúng một lần với đúng entry thật.
- Sort/Shuffle hoặc thay đổi danh sách được xử lý qua `configure()` của engine. Đổi mục tiêu, cấu hình hoặc danh sách giữa lượt sẽ hủy lượt cũ.
- Khi tắt, khôi phục descriptor/phương thức gốc. `Math.random`, `crypto.getRandomValues` và các API bảo mật không bị thay đổi. Sau khi tắt, engine tiếp tục quay ngẫu nhiên bằng luồng gốc.

## Phạm vi và giới hạn

- Hỗ trợ profile cấu trúc v440 được cung cấp, và hợp đồng engine tham khảo cũ. Không tự áp dụng profile này cho module v441 hoặc các phiên bản chưa kiểm tra.
- Một wheel tương thích được điều khiển tại một thời điểm. Chưa kiểm thử nhiều wheel đồng thời.
- Danh sách văn bản hiển thị đầy đủ; trọng số bằng 1 hoặc không khai báo trọng số. Chưa hỗ trợ trọng số khác 1, chế độ chỉ hiển thị một phần danh sách, hoặc ảnh phủ thay các ô tên.
- Nếu bật giữa một lượt quay ngẫu nhiên đang chạy, adapter đợi lượt đó kết thúc trước khi kết nối; không sửa kết quả lượt đã bắt đầu.
- Khi chưa kết nối, popup báo **Chưa kết nối vòng quay gốc** và vòng quay gốc vẫn có thể quay ngẫu nhiên. Lưu tên thành công không chứng minh engine đã kết nối.
- Khi đã kết nối nhưng tên/cấu hình không hợp lệ, guard chặn các thao tác quay nhận diện được. Nếu quay qua API của trang, adapter vẫn không công bố người thắng giả khi thiếu tên.
- Không có fallback âm thầm sang Canvas riêng.

## Chẩn đoán kết nối

Mở popup → **Chẩn đoán kết nối** → **Đọc thông tin chẩn đoán**. Thông tin không hiện phía trên vòng quay.

Bản này phải ghi `extensionVersion: "1.4.1"`. Khi đường module thành công, `connected` là `true` và `moduleLink.phase` là `captured`.

Các phase thường gặp:

| Phase | Ý nghĩa |
| --- | --- |
| `loading_module` | Đang lấy namespace module gốc đã tải |
| `waiting_draw` | Đang đợi khung hình Canvas để nhận instance |
| `captured` | Đã nhận instance engine |
| `module_not_observed` | Không thấy đủ URL module v440 trong Resource Timing |
| `module_error` | Trình duyệt/CSP hoặc export module không tương thích |
| `draw_timeout` | Không nhận được khung hình phù hợp; giữ tab ở phía trước rồi thử lại |
| `missing_busy_store` | Đã thấy engine nhưng chưa nối được store để hủy an toàn |

Nếu vẫn lỗi sau khi reload extension và website, nội dung `moduleLink` cho biết bước kết nối nào chưa thành công. Không coi `reason: no_engine_in_accessible_state` của bộ dò Vue riêng là lỗi cuối cùng nếu module link đã kết nối được.

## Quyền và dữ liệu

Chỉ có quyền `storage`, phạm vi `https://wheelofnames.com/*`. Không thêm quyền debugger, scripting, tabs hoặc toàn bộ website. Không gửi danh sách hoặc cấu hình đến máy chủ ngoài.

Vẫn lưu `fixedWinnerDemo: { enabled, target }` trong `chrome.storage.local`, dùng chung giữa các tab. Các danh sách thủ công từ bản demo cũ nếu còn lưu không được dùng cho vòng quay gốc.

Hai execution world trao đổi cấu hình/kết quả qua `postMessage` cùng origin. MAIN không có quyền storage. Website có thể quan sát/can thiệp MAIN world; không chuyển API storage, thông tin đăng nhập hoặc dữ liệu tài khoản qua bridge.

## Kiểm thử tự động

Node.js 20+, không cần cài package:

```powershell
node --test tests/demo.test.cjs tests/v440.test.cjs tests/targeting.test.cjs
node --check native-controller-v440.js
node --check native-module-link.js
node --check native-controller.js
node --check native-discovery.js
node --check page-bridge.js
node --check popup.js
node --check content.js
```

29 test đã đạt, gồm:

- 288 lượt với bốn tên: 24 hoán vị × 4 mục tiêu × 3 lượt; đối chiếu entry, góc renderer, phase và callback đúng một lần.
- 72 lượt qua adapter engine tham khảo cũ; hơn 5.000 trường hợp hình học của core.
- 144 lượt mới với họ tên đầy đủ, tên nhập rút gọn, sáu thứ tự danh sách, bốn mẫu điểm dừng mỗi mục tiêu trên cả hai adapter. Đối chiếu chính entry dưới kim, đủ bốn vị trí khác nhau trong ô và không có mẫu RNG từ việc đọc trạng thái.
- 8.015 trường hợp góc bổ sung: hai phía của tâm, khoảng cách an toàn với biên và đúng chỉ số ở các ô đầu/cuối. Kiểm tra tên trùng, tên đệm, Unicode, hoa/thường, dấu và tránh khớp nhầm một phần từ.
- Popup hiển thị họ tên đã khớp; khi danh sách thay đổi thành nhiều người cùng tên, báo lỗi và chặn quay cho đến khi nhập rõ hơn.
- Đổi tên/danh sách hoặc tắt giữa lượt: hủy, giải phóng trạng thái bận và khôi phục phương thức gốc; quay ngẫu nhiên sau khi tắt.
- Entry thật của engine được trả về, không gọi nhánh RNG trong lượt điều khiển.
- Kết nối một engine bị giữ kín trong closure thông qua module và đúng Canvas; bỏ qua Canvas xem trước khác dù dùng cùng class.
- Từ chối URL khác origin/phiên bản/query; gỡ hook khi tắt trước lúc nhận khung hình.
- Popup tự chuyển từ chờ kết nối sang đã kết nối; không có nhãn/debug được chèn trên trang hoặc dòng CONTROLLED DEMO ở chân popup; quảng cáo/FAQ không bị thay đổi hoặc chặn liên kết.

`tests/engine-v440.cjs` trích nguyên logic physics và class engine từ tệp `dist-v4402.js` người dùng cung cấp, có SHA-256 nguồn trong đầu tệp. Các utility nhập ngoài và renderer trình duyệt được thay bằng shim để chạy Node. Test cầu nối mô phỏng module namespace và DOM/Chrome APIs; không thay thế kiểm thử import/CSP trong Brave thật.

**Bản 1.3.0 đã được người dùng xác nhận chạy trên Brave. Bản nâng cấp 1.4.1 chưa được kiểm thử trực tiếp trên Brave**: cần kiểm tra Load unpacked, import/CSP, DOM thực tế, vị trí kim và animation hiển thị, âm thanh/confetti, dialog. Test tự động dùng DOM/Chrome API mô phỏng và engine fixture, không thay thế kiểm thử trình duyệt.

## Checklist trên Brave

1. Reload extension tại `brave://extensions`, tải lại tab website, mở popup và xác nhận phiên bản chẩn đoán là 1.4.1. Bật và đợi popup báo **Đã kết nối vòng quay gốc** trước khi quay.
2. Trong Entries nhập `Nguyễn Văn An`, `Lê Minh Huy`, `Phạm Minh Hoàng`, `Trần Quốc Đạt` trên bốn dòng. Popup nhập `An`, lưu và kiểm tra **Khớp Entries: Nguyễn Văn An**. Quay 10 lượt: kim phải dừng tại các điểm khác nhau trong ô An, cách tâm và biên; dialog luôn hiển thị đầy đủ `Nguyễn Văn An`. Các vị trí ngẫu nhiên có thể ở gần nhau giữa hai lượt.
3. Thử `an`, `VĂN AN` và toàn bộ `Nguyễn Văn An`; cả ba phải chọn đúng entry. `Anh` hoặc `Hoang` không được khớp `An` hoặc `Hoàng`. Chọn tên ngắn của từng người còn lại để thử tiếp.
4. Shuffle ít nhất 5 lần, Sort rồi quay lại. Kết quả phải giữ đúng họ tên đã khớp, dù chỉ số của ô thay đổi.
5. Thêm `Trần Đức An` vào Entries trong khi mục tiêu là `An`: popup phải báo khớp nhiều mục nhập, không trả kết quả điều khiển. Đổi thành `Văn An`: quay lại đúng `Nguyễn Văn An`. Xóa `Trần Đức An` rồi lưu `An` để thử khớp tên ngắn trở lại.
6. Thử Ctrl+Enter và các nút quay gốc khác. Tất cả phải dùng cùng engine đã kết nối.
7. Xóa mục tiêu khỏi Entries: cảnh báo và không có người thắng cố định giả. Thêm lại tên, thử tiếp.
8. Đổi tên mục tiêu, Sort/Shuffle hoặc tắt giữa lượt: lượt cũ hủy; không trả kết quả cũ, trạng thái bận được bỏ.
9. Tắt điều khiển rồi quay gốc: hành vi ngẫu nhiên hoạt động bình thường. Reload ở trạng thái bật và tắt để kiểm tra lưu cấu hình.
10. Kiểm tra không có Canvas thứ hai, bảng tọa độ hoặc nhãn CONTROLLED DEMO trên trang; dòng tương ứng cũng không còn ở chân popup. Quảng cáo/FAQ bên dưới vẫn nguyên vẹn.

## Tệp chính

- `native-controller-v440.js`: profile `wheelState` và callback constructor của bản 440.
- `native-module-link.js`: truy cập module đã khởi tạo và nhận diện đúng instance qua `draw()`.
- `native-controller.js`: adapter tham khảo cũ và dispatch profile.
- `native-discovery.js`: tìm component/engine/SpinningWheel host trong cây Vue.
- `page-bridge.js`: bridge MAIN, kết nối, guard và khôi phục trạng thái bận.
- `content.js`: storage, giao thức và trạng thái gửi về popup; không chèn giao diện lên trang.
- `popup.*`: chọn tên, bật/tắt, trạng thái tự cập nhật, chẩn đoán thu gọn.
- `wheel-core.js`, `page-reader.js`: chuẩn hóa tên, hình học và nhận diện khu vực Canvas.
- `tests/`: class engine trích từ nguồn cung cấp và các test độc lập dependency.
