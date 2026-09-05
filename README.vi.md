# Bắt đầu với Custom Backend Module

[English](README.md) | [Tiếng Việt](README.vi.md)

Sample TypeScript hoàn chỉnh nhận `leadId`, đọc một Lead trên Cogover theo quyền
của caller hiện tại và trả về `{ lead }`. Cùng một `src/main.ts` chạy được cả
local lẫn trên Cogover. Repo không chứa thông tin xác thực hay dữ liệu
Workspace/Lead thật.

## Yêu cầu

- Node.js 20+ và npm (khuyến nghị Node.js 22.12+ cho cả hai sample project).
- Workspace Cogover có Object với slug `lead` và một Lead đã tồn tại để đọc.
- Project Custom Backend Module, thường có slug `get_lead`.
- Chính sách Project và quyền của caller cho phép đọc `lead` cùng các field
  `name`, `first_name`, `last_name`, `status`, `emails`.
- **Project key** để phát triển local.
- **Workspace API key** riêng để publish, activate và sinh session bằng CLI.

Schema của Workspace phải khớp với `src/workspace.d.ts`; khai báo kiểu dữ liệu
không tạo Object hay cấp quyền. Nhờ quản trị viên cung cấp Project ID, Project key,
schema và một Lead ID mà caller được phép đọc. Sample này không tạo Lead.

## 1. Cài đặt và kiểm tra không cần thông tin xác thực

Tải hoặc clone repo này, sau đó mở thư mục chứa `package.json`:

```bash
npm ci
npm run check
npm install --global @cogover/dev-cli
cogover-dev --version
```

`npm run check` kiểm tra kiểu dữ liệu của source, runner và test, sau đó chạy unit
test và HTTP integration test không cần thông tin xác thực. Các test này dùng dữ
liệu giả lập, không chứng minh bạn có quyền truy cập Workspace. Lệnh cài CLI sử
dụng phiên bản mới nhất được publish lên npm.

## 2. Cấu hình Project của bạn

Trong giao diện **Custom Backend Module** của Cogover, tạo Project nếu chưa có:
name `Get lead`, slug `get_lead`. Lưu lại Project ID (`TSP...`) và slug thực tế.
Nếu đã có Project, dùng Project đó; CLI không tạo Project.

```bash
cp cogover.example.json cogover.json
```

Sửa file `cogover.json` đã được Git ignore:

```json
{
  "version": 1,
  "runtimeUrl": "https://example.cogover.com",
  "projectId": "TSPXXXXXXXXXXXX",
  "projectSlug": "get_lead",
  "projectType": "backend"
}
```

Thay origin và ID mẫu bằng giá trị của bạn. `runtimeUrl` là HTTPS origin đầy đủ
của Workspace, không kèm đường dẫn API. Dùng đúng slug của Project.
Không đặt bất kỳ loại key nào trong hai loại trên vào file này.

## 3. Xác thực và chạy API local

Tại thư mục Project này, đăng nhập bằng **Project key** tại lời nhắc nhập ẩn:

```bash
cogover-dev login --profile get_lead
cogover-dev doctor --profile get_lead
COGOVER_LOCAL_PORT=3100 cogover-dev run --profile get_lead -- npm run dev
```

Dùng cùng tên profile cho login, doctor và run. Lệnh trên dùng cú pháp POSIX
shell; với PowerShell, đặt `$env:COGOVER_LOCAL_PORT = "3100"` trước,
sau đó chạy phần `cogover-dev run ...`.

Server local chỉ lắng nghe trên `127.0.0.1`. Giữ server chạy và mở terminal khác
để gọi curl. Khi file thay đổi, server khởi động lại sau khi kiểm tra kiểu dữ liệu.
Không chạy riêng `npm run dev`: SDK cần Development Session do
`cogover-dev run` cung cấp. Session dùng caller gắn với Project key,
không phải một người dùng tùy ý.

Thay `LEAD_ID` bằng ID của một Lead đã tồn tại mà caller được phép đọc:

```bash
curl --fail-with-body -X POST 'http://127.0.0.1:3100/api/v1/ts-projects/get_lead' \
  -H 'Content-Type: application/json' \
  --data '{"leadId":"LEAD_ID"}'
```

Dùng slug thực tế trong URL. Response local thành công có dạng `{ "lead": ... }`.
Bản ghi gồm `id`, `fields` và `system`; metadata hệ thống và giá trị field tùy
thuộc Workspace. Input không hợp lệ hoặc trống trả HTTP 400. Router SDK trả 404
cho method/path chưa đăng ký (kể cả GET tại route chỉ đăng ký POST này).

Bạn cũng có thể chạy smoke test với dữ liệu thật khi server local đang chạy:

```bash
COGOVER_TEST_LEAD_ID=LEAD_ID npm run test:live
```

Nếu dùng port/slug khác, đặt thêm `COGOVER_TEST_URL` thành URL đầy đủ của endpoint
local. Test chỉ đọc này kiểm tra ID trả về và năm field; chỉ in kết quả pass/fail,
không in nội dung bản ghi.

## 4. Publish và activate

`npm run build` chỉ kiểm tra kiểu dữ liệu: không sinh JavaScript hay ZIP.
Chỉ deploy `src/`. Không upload toàn bộ repo hoặc `local/`.

### Cách A: CLI

```bash
npm run check
cogover-dev publish
```

CLI nén `src/` thành ZIP, upload ở chế độ private, tạo version và chờ
`READY` hoặc `FAILED`. ZIP tạm được xóa sau đó. Nếu truyền ZIP rõ ràng qua
`cogover-dev publish get-lead.zip`, CLI dùng nguyên file đó và không xóa nó.

Publish và activate dùng **Workspace API key**, không phải Project key.
CLI tìm `COGOVER_API_KEY` trong `.env` của Project trước, rồi đến kho lưu thông
tin xác thực của hệ điều hành; nếu không có thì yêu cầu nhập ẩn. Với Docker/CI
không tương tác, cấp sẵn file `.env` riêng tư một cách an toàn, không đưa file đó
vào gói upload. Không dán secret vào đối số dòng lệnh.

Khi version sẵn sàng, chạy lệnh activate do publish in ra:

```bash
cogover-dev activate VERSION_ID
```

Thay `VERSION_ID` bằng **version ID dạng TSV...** được trả về, không phải
Project ID dạng TSP... Thao tác activate thay đổi version đang hoạt động của Workspace.
Không activate version lỗi; sửa vấn đề được báo rồi publish version mới.

### Cách B: Giao diện

Tại thư mục gốc của repo (cần tiện ích `zip`):

```bash
npm run check
zip -r get-lead.zip src -x '*/.*' '__MACOSX/*'
```

Dùng tên ZIP mới (hoặc xóa ZIP đã sinh trước đó) để tránh giữ lại file cũ trong
archive. Các quy tắc loại trừ bỏ qua file ẩn và metadata macOS.
Archive phải chứa `src/main.ts`, `src/lead-script.ts` và
`src/workspace.d.ts`. Mở Project trong Custom Backend Module, tạo version,
upload ZIP này ở chế độ private, chờ `READY` rồi activate.

## 5. Test version đã deploy như một production caller

Tại thư mục này, sinh file cấu hình curl riêng tư bằng **Workspace API key**:

```bash
cogover-dev auth session --format curl --output .cogover-session.curl
```

Lệnh này tạo **session Web App thật**, gồm ba cookie
`HttpSessionId`, `XSRF-TOKEN`, `AuthToken` và các header tương ứng
`x-csrf-token`, `x-xsrf-token`. Request đi qua luồng gọi production,
không phải local development hay Preview. Lệnh không chọn một end-user tùy ý
và không nâng quyền: danh tính là danh tính Cogover gán cho Workspace API key.
Để kiểm tra quyền của một người cụ thể, hãy dùng session hợp lệ của người đó.

Thay domain mẫu, slug nếu cần và Lead ID bên dưới. Chỉ gửi session đến Workspace
đã dùng để sinh ra nó; không thêm `-L` để chuyển tiếp header session qua redirect.

```bash
curl --fail-with-body --config .cogover-session.curl \
  -X POST 'https://example.cogover.com/api/v1/ts-projects/get_lead' \
  -H 'Content-Type: application/json' \
  -H 'x-req-type: 6' \
  -H 'x-req-service: 3' \
  --data '{"leadId":"LEAD_ID"}'
```

Response production bọc kết quả trong `body`, vì vậy cần kiểm tra `body.lead`,
không chỉ HTTP status. Response cũng có metadata giao thức như `service`,
`serviceVersion`, `type` và `id`. Local chạy thành công chưa chứng minh
session production có cùng quyền.

## Bảo mật và xử lý sự cố

- `src/`: code nghiệp vụ được deploy; `local/`: bộ chạy phát triển chỉ lắng nghe
  trên loopback; `test/`: test dùng dữ liệu giả lập, không được deploy.
- Key, file session/cookie, cấu hình thật, ZIP và log được Git ignore.
  Ignore không bảo vệ file đã được track: kiểm tra `git status` và
  `git diff --cached` trước khi public.
- Handler không ghi Lead ID hay giá trị field vào log. Lỗi runner không dự kiến
  dùng thông báo tổng quát; kiểm tra lỗi nhạy cảm riêng tư bằng debugger.
- Ưu tiên kho lưu thông tin xác thực của hệ điều hành. Nếu không có, CLI login
  dùng file `.env` riêng tư và cập nhật `.gitignore`. Hãy bảo vệ file đó.
- Xóa file session đã sinh khi dùng xong; sinh lại nếu hết hạn. Không chia sẻ
  ảnh chụp/nội dung terminal chứa response API, header hay thông tin xác thực.
- 401: kiểm tra đúng loại key và Workspace; khởi động lại Development Session
  đã bị vô hiệu hóa. 403: kiểm tra chính sách Project, Project key và quyền caller.
- Field không tồn tại: đối chiếu schema Object với `workspace.d.ts` và
  `READ_FIELDS`. Khai báo TypeScript không thể tự sửa schema trên server.
- Port đã được dùng: chọn `COGOVER_LOCAL_PORT` khác và cập nhật URL curl.
- Dependency backend chỉ dành cho runner phải nằm ngoài `src/`; code deploy
  lên Cogover phải dùng các API mà runtime hỗ trợ.

Được cấp phép theo MIT; xem [LICENSE](LICENSE).
