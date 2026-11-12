# Fixed Winner Demo — bản 1.3.0

Extension Manifest V3 điều khiển vòng quay gốc của wheelofnames.com trong chế độ **CONTROLLED DEMO – Kết quả định trước**. Cấu hình lưu bằng `chrome.storage.local`. Không có Canvas thứ hai, không thay chữ trong thông báo thắng cuộc.

Profile **v440** được viết theo các tệp production người dùng cung cấp: `EditWheelPage-v440.js`, `StaticWheel-v440.js`, `ConfettiLauncher-v440.js`, `dist-v4402.js`. Đây là thay đổi cơ chế kết nối, không chỉ tăng phạm vi quét Vue như các bản 1.2.x.

Nhãn chế độ nhỏ ở góc dưới vẫn hiển thị khi bật. Đã bỏ bảng tên/chỉ số/tọa độ/debug phía trên vòng quay. Quảng cáo, FAQ và nội dung bên dưới website giữ nguyên.

## Cập nhật trên Brave

1. Mở `brave://extensions`.
2. Nếu đã cài, bấm **Reload** trên thẻ extension. Nếu chưa cài, bật **Developer mode** → **Load unpacked** → chọn thư mục project.
3. **Tải lại hoàn toàn tab wheelofnames.com sau khi reload extension.** Việc này gỡ các wrapper cũ trong tab và nạp các tệp mới.
4. Giữ tab website đang hiển thị. Nhập danh sách tên trên website.
5. Mở popup, nhập tên mục tiêu, bấm **Save Winner**, bật **Điều khiển vòng quay gốc**.
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
- Chuẩn hóa tên bằng Unicode NFC, bỏ khoảng trắng hai đầu; giữ dấu, chữ hoa/thường và khoảng trắng bên trong. Trùng tên: chọn ô đầu tiên trong danh sách thực tế của engine.
- Kim gốc nằm bên phải. Với `N` ô bằng nhau, tâm ô `i` tương ứng góc `i × 2π/N`.
- Kiểm chứng tâm và hai điểm trong ô bằng các getter thật `getIndexAtPointer(angle)` và `getEntryAtAngle(angle)` của engine.
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
- Khi chưa kết nối, nhãn ghi **Chưa áp dụng** và vòng quay gốc vẫn có thể quay ngẫu nhiên. Lưu tên thành công không chứng minh engine đã kết nối.
- Khi đã kết nối nhưng tên/cấu hình không hợp lệ, guard chặn các thao tác quay nhận diện được. Nếu quay qua API của trang, adapter vẫn không công bố người thắng giả khi thiếu tên.
- Không có fallback âm thầm sang Canvas riêng.

## Chẩn đoán kết nối

Mở popup → **Chẩn đoán kết nối** → **Đọc thông tin chẩn đoán**. Thông tin không hiện phía trên vòng quay.

Bản này phải ghi `extensionVersion: "1.3.0"`. Khi đường module thành công, `connected` là `true` và `moduleLink.phase` là `captured`.

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
node --test tests/demo.test.cjs tests/v440.test.cjs
node --check native-controller-v440.js
node --check native-module-link.js
node --check native-controller.js
node --check native-discovery.js
node --check page-bridge.js
node --check popup.js
node --check content.js
```

24 test đã đạt, gồm:

- 288 lượt với bốn tên: 24 hoán vị × 4 mục tiêu × 3 lượt; đối chiếu entry, góc renderer, phase và callback đúng một lần.
- 72 lượt qua adapter engine tham khảo cũ; hơn 5.000 trường hợp hình học của core.
- Đổi tên/danh sách hoặc tắt giữa lượt: hủy, giải phóng trạng thái bận và khôi phục phương thức gốc; quay ngẫu nhiên sau khi tắt.
- Entry thật của engine được trả về, không gọi nhánh RNG trong lượt điều khiển.
- Kết nối một engine bị giữ kín trong closure thông qua module và đúng Canvas; bỏ qua Canvas xem trước khác dù dùng cùng class.
- Từ chối URL khác origin/phiên bản/query; gỡ hook khi tắt trước lúc nhận khung hình.
- Popup tự chuyển từ chờ kết nối sang đã kết nối; debug không xuất hiện trên trang; quảng cáo/FAQ không bị thay đổi hoặc chặn liên kết.

`tests/engine-v440.cjs` trích nguyên logic physics và class engine từ tệp `dist-v4402.js` người dùng cung cấp, có SHA-256 nguồn trong đầu tệp. Các utility nhập ngoài và renderer trình duyệt được thay bằng shim để chạy Node. Test cầu nối mô phỏng module namespace và DOM/Chrome APIs; không thay thế kiểm thử import/CSP trong Brave thật.

**Chưa kiểm thử trực tiếp Load unpacked, module cache/CSP, DOM thực tế, animation hiển thị, âm thanh/confetti và dialog trên phiên Brave của người dùng.** Lần truy cập trình duyệt trước bị công cụ từ chối quyền đọc.

## Checklist trên Brave

1. Reload extension, tải lại tab, mở popup và xác nhận phiên bản chẩn đoán là 1.3.0. Bật và đợi kết nối; không quay khi nhãn còn **Chưa áp dụng**.
2. Nhập Hoàng/Huy/Đạt/Vinh hoặc bốn tên khác. Chọn từng tên và bấm Canvas gốc 3–5 lượt, đối chiếu kim và dialog gốc.
3. Shuffle ít nhất 5 lần, Sort rồi quay lại. Kết quả phải giữ đúng tên đã lưu.
4. Thử Ctrl+Enter và các nút quay gốc khác. Tất cả phải dùng cùng engine đã kết nối.
5. Xóa mục tiêu: cảnh báo và không có người thắng cố định giả. Thêm lại tên, thử tiếp.
6. Đổi tên mục tiêu, Sort/Shuffle hoặc tắt giữa lượt: lượt cũ hủy; không trả kết quả cũ, trạng thái bận được bỏ.
7. Tắt điều khiển rồi quay gốc: hành vi ngẫu nhiên hoạt động bình thường. Reload ở trạng thái bật và tắt để kiểm tra lưu cấu hình.
8. Kiểm tra không có Canvas thứ hai hoặc bảng tọa độ; quảng cáo/FAQ bên dưới vẫn nguyên vẹn.

## Tệp chính

- `native-controller-v440.js`: profile `wheelState` và callback constructor của bản 440.
- `native-module-link.js`: truy cập module đã khởi tạo và nhận diện đúng instance qua `draw()`.
- `native-controller.js`: adapter tham khảo cũ và dispatch profile.
- `native-discovery.js`: tìm component/engine/SpinningWheel host trong cây Vue.
- `page-bridge.js`: bridge MAIN, kết nối, guard và khôi phục trạng thái bận.
- `content.js`: storage, giao thức và nhãn chế độ nhỏ ngoài bố cục.
- `popup.*`: chọn tên, bật/tắt, trạng thái tự cập nhật, chẩn đoán thu gọn.
- `wheel-core.js`, `page-reader.js`: chuẩn hóa tên, hình học và nhận diện khu vực Canvas.
- `tests/`: class engine trích từ nguồn cung cấp và các test độc lập dependency.
