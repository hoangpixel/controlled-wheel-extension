# Fixed Winner Demo — bản 1.5.0

Extension Manifest V3 điều khiển lượt quay đầu của wheelofnames.com theo tên đã lưu, sau đó dùng ngẫu nhiên gốc. Cấu hình và trạng thái lượt đầu lưu bằng `chrome.storage.local`. Không có Canvas thứ hai, không thay chữ trong thông báo thắng cuộc.

Profile **v440** được viết theo các tệp production người dùng cung cấp: `EditWheelPage-v440.js`, `StaticWheel-v440.js`, `ConfettiLauncher-v440.js`, `dist-v4402.js`. Đây là thay đổi cơ chế kết nối, không chỉ tăng phạm vi quét Vue như các bản 1.2.x.

Trạng thái kết nối và lỗi hiển thị trong popup. Không chèn nhãn hoặc bảng tên/chỉ số/tọa độ/debug trên trang vòng quay. Quảng cáo, FAQ và nội dung bên dưới website giữ nguyên.

## Mới trong 1.5.0 — lượt đầu cố định, các lượt sau ngẫu nhiên

- Lượt hoàn tất đầu tiên của phiên chọn tên đã lưu; từ lượt thứ hai, các phương thức gốc và RNG gốc thực hiện lượt quay. Tên mục tiêu vẫn nằm trong danh sách và có thể ngẫu nhiên trúng lại; extension không loại tên đó.
- F5, mở tab mới hoặc service worker khởi động lại không đặt lại lượt đầu đã dùng. Trạng thái này dùng chung giữa các tab của extension trong cùng hồ sơ trình duyệt.
- Tắt rồi bật lại **toggle trong popup**, hoặc lưu tên mục tiêu khác, tạo phiên mới có một lượt cố định. Lưu lại cùng tên, Sort, Shuffle và sửa Entries không tự đặt lại lượt đầu.
- Hủy lượt đầu khi đang quay (Sort/Shuffle, đổi cấu hình, tắt hoặc tải lại trang) không tính là một kết quả cố định hoàn tất. Nếu chưa thay phiên, lần thử tiếp theo vẫn là lượt cố định. Đổi mục tiêu/tắt rồi bật tạo phiên mới.
- Service worker cục bộ tuần tự hóa yêu cầu và giữ quyền dùng lượt đầu cho một tài liệu. Tab khác phải đợi lượt đó kết thúc; nếu tài liệu cũ đã đóng/tải lại, quyền chờ được thu hồi. Kết quả chỉ được công bố sau khi ghi trạng thái hoàn tất thành công. Không có backend hay quyền trình duyệt mới.
- Popup phân biệt **Lượt đầu cố định · Sau đó ngẫu nhiên** và **Đã xong lượt đầu · Ngẫu nhiên gốc**. Khi đã chuyển ngẫu nhiên, tên mục tiêu vắng/trùng hoặc cấu hình trọng số không còn chặn các lượt gốc.
- Khi nhận diện module v440 nhưng còn đợi capture, giữ tối đa một click/Ctrl+Enter rồi gọi entry point quay gốc khi adapter sẵn sàng. Không tự chạy một lượt ngẫu nhiên trong lúc chờ kết nối. Cần đợi popup xác nhận kết nối trước khi thử trên các cấu trúc chưa hỗ trợ.

## Mới trong 1.4.4 — nạp âm thanh trước và dùng physics v440

- Chẩn đoán người dùng cung cấp cho lượt đầu: callback đổi tên mất 59,7 ms, khoảng cách tick lớn nhất 61,2 ms; lượt hai lần lượt là 0,4 ms và 21,6 ms. Độ trễ tick đầu chỉ khoảng 6 ms. Điểm gây khựng đo được nằm trong callback, nên thay mốc thời gian ở 1.4.3 chưa đủ.
- Callback này gọi tiếng tick qua [module âm thanh gốc](https://wheelofnames.com/assets/WheelConfigUtil-v440.js). Trong bản đã kiểm tra, tài nguyên Howl/AudioContext có thể được tạo ở lần gọi đầu. Khi URL module này đã xuất hiện trong Resource Timing, extension truy cập đúng namespace module đã tải và gọi export `l` để yêu cầu preload, trước khi nhận engine. Hàm này không phát âm thanh và không phát sự kiện đổi tên giả. Đây là thay đổi nhắm vào việc khởi tạo lạnh; cần đo lại trên Brave để xác nhận hết khựng.
- Quỹ đạo mới lấy gia tốc, hệ số giảm tốc, `slowSpin` và số tick từng pha từ physics v440 đã cung cấp. Bỏ số vòng cố định 6–7 và giới hạn 20 giây. Ví dụ cấu hình 10 giây: physics gốc đi khoảng 9,4 vòng, với thời lượng 10,05 giây tính cả tick chuyển pha.
- Chọn tổng góc đi về phía trước gần quỹ đạo gốc nhất mà vẫn dừng đúng entry đã chọn. Khi quỹ đạo gốc đi ít nhất nửa vòng, chênh lệch tổng góc tối đa nửa vòng; với lượt rất ngắn/chậm có thể cần thêm một vòng để tới mục tiêu. Tỷ lệ tốc độ được lưu trong `motion.speedScale`, vì không thể vừa cố định người thắng vừa giữ mọi góc và vận tốc của lượt ngẫu nhiên nguyên vẹn.
- Chế độ giảm chuyển động của trình duyệt vẫn dùng lượt rút gọn 0,9 giây. Adapter legacy vẫn giữ quỹ đạo riêng; thay đổi physics này dành cho v440.

## Mới trong 1.4.3 — giữ tốc độ 1.4.1, sửa mốc thời gian khung đầu

Bản vá này dựa trên 1.4.1, sau khi người dùng chủ động lùi bản 1.4.2 vì đoạn tăng tốc quá chậm.

- Giữ nguyên công thức giảm tốc `1 - (1 - progress)^4`, số vòng và thời lượng của 1.4.1. Không thêm đoạn tăng tốc chậm.
- Bắt đầu đồng hồ ở tick render đầu tiên, giữ nguyên góc hiện tại tại tick đó. Khoảng chờ từ click đến tick đầu không được cộng thành một cú nhảy góc. Thời lượng cấu hình tính từ tick đầu; độ trễ ban đầu vẫn cộng vào thời gian từ click đến kết quả.
- Thêm số đo `motion` trong chẩn đoán popup của profile v440: số lượt, độ trễ tới tick đầu, khoảng cách lớn nhất giữa các tick và thời gian callback đổi tên gốc. Không chứa tên người, không chèn thông tin lên trang.

Trong mô phỏng đã kết nối và đợi 5 giây, code cũ vẫn nhảy góc nếu tick đầu đến muộn. Thay đổi này sửa trường hợp đó mà giữ nguyên đường quay nhanh sau khi render bắt đầu. Chưa đo trên Brave để kết luận độ trễ thực tế đến từ khởi tạo âm thanh, renderer, tải trang hay tác vụ khác; chẩn đoán mới giúp phân biệt các trường hợp này.

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
8. Lượt đầu: kim và thông báo thắng cuộc phải cùng chỉ đúng tên đã lưu. Sau đó popup báo ngẫu nhiên gốc; các lượt tiếp theo dùng kết quả ngẫu nhiên của website.

Tắt bằng toggle trong popup để khôi phục các phương thức quay ban đầu. Lượt cố định đang chạy bị hủy và không công bố người thắng; lượt đã chạy bằng ngẫu nhiên gốc tiếp tục bình thường. Bật lại chuẩn bị một lượt cố định mới. Không cần build, cài dependency, backend hay tài khoản.

## Vì sao các bản trước không kết nối được với v440

Mã tham khảo cũ dùng đối tượng wheel có `angle`, `speed`, `state` và `entryPicker`. Bản 440 dùng `wheelState`, các phase dạng chuỗi và callback được truyền vào constructor.

Trong `ConfettiLauncher-v440.js`, component `SpinningWheel` tạo engine bằng `new b(...)` trong closure của `setup()`. Vue chỉ expose `spin` và `resetRotation`, nên quét `data`/`setupState` không lấy được engine đó.

Class `b` chính là export `t` của `dist-v4402.js`. Bản 1.3.0 dùng đường kết nối dưới đây để lấy đúng instance đã tồn tại.

## Cách kết nối v440

1. Tìm component đã mount có tên `SpinningWheel`, prop `wheelConfig` và phương thức `spin` được expose.
2. Xác nhận trang đã tải cả `ConfettiLauncher-v440.js` và `dist-v4402.js` từ cùng thư mục, cùng origin. URL có query/hash hoặc khác phiên bản bị từ chối.
3. Trong MAIN world, gọi `import()` với **đúng URL module gốc đã được website khởi tạo**, để truy cập namespace của chính module đó. Không tạo URL cache-busting, không fetch rồi eval source, không tải bản vá từ CDN. Các import lặp lại trong cùng môi trường dùng lại module đã được đánh giá; xem [tài liệu về module caching](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import#module_namespace_object).
   Nếu URL `WheelConfigUtil-v440.js` cùng thư mục đã được quan sát, gọi hàm preload của module này trước khi cài hook nhận engine. Nếu module vắng mặt/khác URL hoặc không có export phù hợp, bỏ qua preload và ghi rõ phase chẩn đoán; không nới lỏng chính sách URL.
4. Tạm bọc `draw()` trên prototype của class engine. Renderer gốc vẫn được gọi nguyên vẹn. Chỉ nhận instance khi context Canvas và `wheelConfig` khớp component đã tìm thấy.
5. Gỡ wrapper prototype ngay khi nhận diện xong, hoặc sau tối đa bốn giây, hoặc khi tắt. Không sửa prototype của API trình duyệt.
6. Kết nối Pinia store chứa đúng wheel để có thể bỏ trạng thái bận khi hủy lượt.
7. Cài adapter trên riêng instance engine đó. Giữ nguyên renderer, Canvas, callback âm thanh đổi ô và callback thắng cuộc của website.

Mã điều khiển extension nằm trong các tệp cục bộ của project. Việc truy cập module ở bước 3 sử dụng code gốc của website đã chạy; không phải cơ chế cập nhật/tải logic extension từ xa. Chỉ thực hiện với profile v440 đã kiểm tra và URL gốc quan sát được trong Resource Timing.

MAIN world chịu CSP của website, theo [tài liệu Chrome](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts#content-security-policy). Nếu trình duyệt hoặc CSP không cho truy cập module, adapter sẽ báo lỗi; không nới lỏng CSP hay cơ chế bảo mật để vượt qua lỗi đó.

Đường kết nối theo state Vue cũ vẫn được giữ cho engine tham khảo tương thích.

## Cách chọn kết quả

Cơ chế chọn điểm dừng dưới đây áp dụng cho lượt cố định đầu tiên. Những lượt sau dùng engine ngẫu nhiên gốc, không kiểm tra hoặc chỉnh kết quả theo tên đã lưu.

- Đọc lại `wheelState.visibleEntries` của engine trước mỗi lượt; không dùng vị trí cố định hoặc danh sách nhập thủ công riêng.
- So sánh tên bằng Unicode NFC, gộp khoảng trắng và không phân biệt hoa/thường; vẫn phân biệt dấu. Ưu tiên toàn bộ tên rồi đến phần cuối họ tên theo ranh giới từ. Chỉ dùng tên ngắn khi xác định được duy nhất một mục nhập. Không sửa văn bản entry thật.
- Kim gốc nằm bên phải. Với `N` ô bằng nhau, tâm ô `i` tương ứng góc `i × 2π/N`.
- Kiểm chứng tâm, hai điểm lệch 40% bề rộng ô và điểm dừng đã chọn bằng các getter thật `getIndexAtPointer(angle)` và `getEntryAtAngle(angle)` của engine.
- Điểm dừng được lấy ngẫu nhiên trong hai dải `[-0,4; -0,1)` và `[0,1; 0,4)` lần bề rộng ô tính từ tâm; không dừng ở tâm hoặc sát biên. `Math.random()` chỉ được gọi để lấy điểm dừng, không ghi đè RNG toàn cục của website.
- Với v440 thông thường, tính quỹ đạo liên tục từ physics gốc và chọn số vòng gần nhất để tới điểm dừng đã chọn. Giữ thời lượng và pha tăng/giảm tốc của mô hình gốc, điều chỉnh tỷ lệ tốc độ để tới đúng entry, không đặt lại góc ngẫu nhiên giữa lượt. Wrapper `tick()` cập nhật cùng `wheelState` mà renderer gốc đọc: `angle`, `speed`, `phase`, `indexAtPointer`, `entryAtPointer`, v.v.
- Thời lượng v440 dùng số tick của engine và scheduler 60 tick/giây của component gốc, không giới hạn 20 giây. Chế độ giảm chuyển động vẫn là 0,9 giây. Tính từ tick render đầu tiên; khoảng chờ trước tick đầu không làm thay đổi tiến độ/góc của khung đầu.
- Khi kết thúc, trạng thái đã được cập nhật thành `StoppedPhase`, ô thực tế dưới kim được kiểm tra, rồi callback constructor `doneSpinningCallback(entry)` của website được gọi đúng một lần với đúng entry thật.
- Sort/Shuffle hoặc thay đổi danh sách được xử lý qua `configure()` của engine. Đổi mục tiêu, cấu hình hoặc danh sách giữa lượt sẽ hủy lượt cũ.
- Khi tắt, khôi phục descriptor/phương thức gốc. `Math.random`, `crypto.getRandomValues` và các API bảo mật không bị thay đổi. Sau khi tắt, engine tiếp tục quay ngẫu nhiên bằng luồng gốc.

## Phạm vi và giới hạn

- Hỗ trợ profile cấu trúc v440 được cung cấp, và hợp đồng engine tham khảo cũ. Không tự áp dụng profile này cho module v441 hoặc các phiên bản chưa kiểm tra.
- Một wheel tương thích được điều khiển tại một thời điểm. Chưa kiểm thử nhiều wheel đồng thời.
- Danh sách văn bản hiển thị đầy đủ; trọng số bằng 1 hoặc không khai báo trọng số. Chưa hỗ trợ trọng số khác 1, chế độ chỉ hiển thị một phần danh sách, hoặc ảnh phủ thay các ô tên.
- Nếu bật giữa một lượt quay ngẫu nhiên đang chạy, adapter đợi lượt đó kết thúc trước khi kết nối; không sửa kết quả lượt đã bắt đầu.
- Khi chưa kết nối, popup báo **Chưa kết nối vòng quay gốc** và vòng quay gốc vẫn có thể quay ngẫu nhiên. Lưu tên thành công không chứng minh engine đã kết nối.
- Trước khi dùng lượt cố định, nếu tên/cấu hình không hợp lệ, guard chặn các thao tác quay nhận diện được. Sau khi lượt cố định hoàn tất, các giới hạn của adapter không chặn quay ngẫu nhiên gốc.
- Không có fallback âm thầm sang Canvas riêng.

## Chẩn đoán kết nối

Mở popup → **Chẩn đoán kết nối** → **Đọc thông tin chẩn đoán**. Thông tin không hiện phía trên vòng quay.

Bản này phải ghi `extensionVersion: "1.5.0"`. Khi đường module thành công, `connected` là `true` và `moduleLink.phase` là `captured`. `mode` là `first-fixed` trước lượt đầu và `random` sau khi hoàn tất; `firstSpinDone` ghi trạng thái lượt đầu.

Nếu vẫn khựng, bấm đọc chẩn đoán **ngay sau lượt cố định đầu tiên**. Phần `motion` chỉ đo lượt điều khiển; khi đang ngẫu nhiên nó giữ số đo lượt điều khiển gần nhất, không đo lại lượt ngẫu nhiên:

| Trường | Số đo |
| --- | --- |
| `spin` | Số lượt điều khiển đã bắt đầu từ lần kết nối adapter này, không đếm lượt ngẫu nhiên |
| `firstTickDelayMs` | Thời gian từ click đến tick điều khiển đầu tiên |
| `maxTickGapMs` | Khoảng thời gian lớn nhất giữa hai tick điều khiển |
| `maxNameCallbackMs` | Thời gian đồng bộ lớn nhất trong callback đổi tên của website |
| `durationMs` | Thời lượng quỹ đạo đã lập, tính từ tick đầu |
| `nativeTurns`, `plannedTurns` | Số vòng theo mô hình gốc và số vòng thực tế đã chọn |
| `speedScale` | Tỷ lệ điều chỉnh tốc độ để tới điểm dừng |
| `configuredSeconds`, `slowSpin` | Cấu hình engine được dùng cho lượt này |

`motion` là `null` trước lượt đầu hoặc khi không kết nối profile v440. Các số đo phản ánh tick của engine, không phải phép đo đầy đủ thời gian paint/GPU. Giá trị lớn chỉ gợi ý bước cần kiểm tra, không tự chứng minh một nguyên nhân cụ thể.

Kiểm tra thêm `moduleLink.audioWarmup`: `preload_requested` nghĩa là đã gọi hàm preload (chưa chứng minh mọi tệp âm thanh đã tải/giải mã xong); `durationMs` đo thời gian đồng bộ của lời gọi. `not_observed`, `unsupported` hoặc `error` cho biết preload chưa áp dụng.

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

Lưu `fixedWinnerDemo: { enabled, target, runId }` và `fixedWinnerDemoSession: { runId, used, lease }` trong `chrome.storage.local`, dùng chung giữa các tab. `session-worker.js` là service worker MV3 cục bộ, chỉ phối hợp storage và tin nhắn extension, không gửi dữ liệu tới server. Mỗi quyền lượt đầu gắn với tab và document ID để nhận ra tài liệu cũ sau F5. Các danh sách thủ công từ bản demo cũ nếu còn lưu không được dùng cho vòng quay gốc.

Hai execution world trao đổi cấu hình/kết quả qua `postMessage` cùng origin. MAIN không có quyền storage. Website có thể quan sát/can thiệp MAIN world; không chuyển API storage, thông tin đăng nhập hoặc dữ liệu tài khoản qua bridge.

## Kiểm thử tự động

Node.js 20+, không cần cài package:

```powershell
node --test tests/demo.test.cjs tests/v440.test.cjs tests/targeting.test.cjs tests/first-frame.test.cjs tests/native-motion.test.cjs tests/audio-warmup.test.cjs tests/session.test.cjs tests/once-integration.test.cjs
node --check session-worker.js
node --check first-spin-controller.js
node --check native-motion-v440.js
node --check native-controller-v440.js
node --check native-module-link.js
node --check native-controller.js
node --check native-discovery.js
node --check page-bridge.js
node --check popup.js
node --check content.js
```

48 test đã đạt, gồm:

- 288 lượt với bốn tên: 24 hoán vị × 4 mục tiêu × 3 lượt; đối chiếu entry, góc renderer, phase và callback đúng một lần.
- 72 lượt qua adapter engine tham khảo cũ; hơn 5.000 trường hợp hình học của core.
- 144 lượt mới với họ tên đầy đủ, tên nhập rút gọn, sáu thứ tự danh sách, bốn mẫu điểm dừng mỗi mục tiêu trên cả hai adapter. Đối chiếu chính entry dưới kim, đủ bốn vị trí khác nhau trong ô và không có mẫu RNG từ việc đọc trạng thái.
- 8.015 trường hợp góc bổ sung: hai phía của tâm, khoảng cách an toàn với biên và đúng chỉ số ở các ô đầu/cuối. Kiểm tra tên trùng, tên đệm, Unicode, hoa/thường, dấu và tránh khớp nhầm một phần từ.
- Popup hiển thị họ tên đã khớp; khi danh sách thay đổi thành nhiều người cùng tên, báo lỗi và chặn quay cho đến khi nhập rõ hơn.
- 216 lượt mô phỏng cho lượt đầu và lượt thứ hai trên cả hai adapter: đã kết nối và đợi 0/5 giây, khung đầu trễ 0/120/500 ms, 30/60/144 FPS và các cấu hình thời lượng. Đối chiếu từng mốc góc với quỹ đạo được chọn; khung đầu giữ nguyên góc, callback đúng entry một lần.
- Quỹ đạo physics đối chiếu từng tick với engine fixture ở 0,9/1/5/10/30 giây, bật/tắt slow-spin, trạng thái đầu lạnh hoặc đã dừng. Đối chiếu pha, số tick trong pha, vận tốc và quãng góc trước khi áp dụng tỷ lệ tới mục tiêu.
- Kiểm tra tích hợp lượt 30 giây không dừng sớm ở giây 20; các lượt quay chậm và người thắng vẫn đúng entry thật.
- Preload âm thanh diễn ra trước capture, không phát callback giả; từ chối URL âm thanh khác origin/query hoặc chưa quan sát và hủy khi tắt trước lúc import xong. Test mô phỏng chi phí khởi tạo 60 ms chuyển ra trước lượt quay; không thay thế đo AudioContext thật trên Brave.
- Chẩn đoán phân biệt độ trễ tick đầu, khoảng cách tick và thời gian callback; kiểm tra số liệu được trả về qua popup mà không chứa tên người.
- Đổi tên/danh sách hoặc tắt giữa lượt: hủy, giải phóng trạng thái bận và khôi phục phương thức gốc; quay ngẫu nhiên sau khi tắt.
- Entry thật của engine được trả về, không gọi nhánh RNG trong lượt điều khiển.
- Kết nối một engine bị giữ kín trong closure thông qua module và đúng Canvas; bỏ qua Canvas xem trước khác dù dùng cùng class.
- Từ chối URL khác origin/phiên bản/query; gỡ hook khi tắt trước lúc nhận khung hình.
- Popup tự chuyển từ chờ kết nối sang đã kết nối; không có nhãn/debug được chèn trên trang hoặc dòng CONTROLLED DEMO ở chân popup; quảng cáo/FAQ không bị thay đổi hoặc chặn liên kết.
- Lượt đầu đúng tên trên cả hai adapter; lượt hai/ba đi qua nhánh RNG gốc và giữ đầy đủ danh sách. Hủy, lưu thất bại hoặc reply quyền dùng lượt đến sau khi tắt không công bố kết quả cũ.
- F5 sau lượt đầu, worker khởi động lại và các tab cạnh tranh giữ đúng một lượt cố định; quyền của tài liệu đã tải lại được thu hồi. Đổi tên/toggle popup đặt lại, lưu cùng tên không đặt lại.
- F5 trong lượt đầu cho phép thử lại; bấm sớm khi module v440 chưa capture chờ rồi bắt đầu đúng một lượt. Khi đang ngẫu nhiên, tên mục tiêu bị xóa không gây chặn quay hoặc cảnh báo sai trong popup.

`tests/engine-v440.cjs` trích nguyên logic physics và class engine từ tệp `dist-v4402.js` người dùng cung cấp, có SHA-256 nguồn trong đầu tệp. Các utility nhập ngoài và renderer trình duyệt được thay bằng shim để chạy Node. Test cầu nối mô phỏng module namespace và DOM/Chrome APIs; không thay thế kiểm thử import/CSP trong Brave thật.

**Bản nâng cấp 1.5.0 chưa được kiểm thử trực tiếp trên Brave**: cần kiểm tra service worker và messaging/document ID thật, reload/F5, import/CSP, DOM thực tế, vị trí kim và animation, preload/AudioContext thật, âm thanh/confetti, dialog. Test tự động dùng DOM/Chrome API mô phỏng và engine fixture, không thay thế kiểm thử trình duyệt.

## Checklist trên Brave

1. Reload extension tại `brave://extensions`, tải lại tab website, mở popup và xác nhận phiên bản chẩn đoán là 1.5.0. Bật và đợi popup báo **Đã kết nối vòng quay gốc** trước khi quay. Kiểm tra không có lỗi service worker trong thẻ extension.
2. Trong Entries nhập `Nguyễn Văn An`, `Lê Minh Huy`, `Phạm Minh Hoàng`, `Trần Quốc Đạt` trên bốn dòng. Popup nhập `An`, lưu và kiểm tra **Khớp Entries: Nguyễn Văn An**. Lượt đầu phải dừng đúng An; lượt hai/ba dùng ngẫu nhiên gốc (có thể vẫn trúng An). F5 rồi quay tiếp: vẫn ngẫu nhiên. Để thử nhiều điểm dừng cố định, tắt/bật toggle trước mỗi lượt; không chỉ lưu lại cùng tên.
3. Thử `an`, `VĂN AN` và toàn bộ `Nguyễn Văn An`; cả ba phải chọn đúng entry. `Anh` hoặc `Hoang` không được khớp `An` hoặc `Hoàng`. Chọn tên ngắn của từng người còn lại để thử tiếp.
4. Trước lượt cố định, Shuffle/Sort rồi quay: vẫn đúng họ tên đã khớp. Sau khi lượt đầu đã dùng, Shuffle/Sort không đặt lại trạng thái, lượt sau vẫn ngẫu nhiên.
5. Tắt/bật để chuẩn bị lượt đầu mới, thêm `Trần Đức An` vào Entries trong khi mục tiêu là `An`: popup phải báo khớp nhiều mục nhập. Đổi thành `Văn An`: lượt đầu mới phải ra `Nguyễn Văn An`. Sau khi đã chuyển ngẫu nhiên, xóa tên mục tiêu: các lượt gốc vẫn quay được.
6. Thử Ctrl+Enter và các nút quay gốc khác. Tất cả phải dùng cùng engine đã kết nối.
7. F5 giữa lượt cố định: lượt cũ không công bố kết quả; lần thử tiếp vẫn là lượt cố định. Mở hai tab để kiểm tra chỉ một tab dùng quyền lượt đầu tại một thời điểm.
8. Đổi tên mục tiêu, Sort/Shuffle hoặc tắt giữa lượt cố định: lượt cũ hủy; không trả kết quả cũ, trạng thái bận được bỏ. Thử lại khi mục tiêu hợp lệ.
9. Tắt/bật toggle sau khi đã ngẫu nhiên: lượt kế tiếp lại cố định, rồi quay ngẫu nhiên tiếp. Tắt trong một lượt đã chạy bằng ngẫu nhiên gốc: để lượt đó kết thúc bình thường.
10. Kiểm tra không có Canvas thứ hai, bảng tọa độ hoặc nhãn CONTROLLED DEMO trên trang; dòng tương ứng cũng không còn ở chân popup. Quảng cáo/FAQ bên dưới vẫn nguyên vẹn.

## Tệp chính

- `native-controller-v440.js`: profile `wheelState` và callback constructor của bản 440.
- `first-spin-controller.js`: quyền lượt đầu, công bố sau khi lưu và chuyển sang RNG gốc.
- `session-worker.js`: cấu hình/phiên/quyền lượt đầu dùng chung, lưu cục bộ qua F5 và worker restart.
- `native-motion-v440.js`: quỹ đạo liên tục từ gia tốc, giảm tốc và số tick các pha v440.
- `native-module-link.js`: truy cập module đã khởi tạo và nhận diện đúng instance qua `draw()`.
- `native-controller.js`: adapter tham khảo cũ và dispatch profile.
- `native-discovery.js`: tìm component/engine/SpinningWheel host trong cây Vue.
- `page-bridge.js`: bridge MAIN, kết nối, guard và khôi phục trạng thái bận.
- `content.js`: storage, giao thức và trạng thái gửi về popup; không chèn giao diện lên trang.
- `popup.*`: chọn tên, bật/tắt, trạng thái tự cập nhật, chẩn đoán thu gọn.
- `wheel-core.js`, `page-reader.js`: chuẩn hóa tên, hình học và nhận diện khu vực Canvas.
- `tests/`: class engine trích từ nguồn cung cấp và các test độc lập dependency.
