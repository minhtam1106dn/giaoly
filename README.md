# Giaoly

Trang trình chiếu câu hỏi giáo lý và quản trị trực tuyến.

- Website: https://minhtam1106dn.github.io/giaoly/
- Admin: https://minhtam1106dn.github.io/giaoly/admin.html
- HTML, CSS, JavaScript ES modules; không cần bước build hoặc thư viện giao diện.
- Supabase Auth + PostgreSQL; frontend triển khai bằng GitHub Pages.

## Sử dụng

1. Mở **Quản trị**, đăng nhập bằng email đã được cấp quyền. Lần đầu: nhập email và mật khẩu mới (tối thiểu 10 ký tự), chọn **Tạo tài khoản lần đầu**, rồi xác nhận email theo hướng dẫn.
2. Chọn một trong 7 tab dạng câu hỏi. Bấm **Thêm câu hỏi** hoặc **Sửa** để mở cửa sổ biên soạn; lưu xong cửa sổ tự đóng. Nhập nội dung, thời gian 1–3.600 giây và đáp án theo từng dạng.
3. Bật **Đưa lên trình chiếu** cho các câu muốn sử dụng. Các câu tắt vẫn nằm trong kho riêng của admin.
4. Mở **Câu hỏi trình chiếu** để xem tất cả câu đã chọn, tổng thời gian và thứ tự thực tế. Dùng nút ↑ ↓ hoặc ô vị trí trong danh sách này để sắp xếp. Nhấn **Lưu câu hỏi** sau khi biên soạn. Các thao tác chọn câu và đổi thứ tự được lưu ngay.
5. Mở trang trình chiếu. Mỗi lần tải trang lấy bộ câu hỏi mới nhất từ cơ sở dữ liệu. Một buổi đang mở giữ nguyên nội dung để tránh thay đổi giữa lúc thi; tải lại khi muốn nhận bản mới.
6. Nhấn **Bắt đầu đếm**, **Tạm dừng**, **Đặt lại** hoặc **Hiện đáp án**. Hiện đáp án dừng đồng hồ; hết giờ không tự hiện đáp án và không tự chuyển câu.
7. Phím tắt ngoài các ô nhập/nút: ← → chuyển câu, Space đếm/tạm dừng, A hiện/ẩn đáp án, R đặt lại đồng hồ.

## Bảy kiểu hiển thị

| Dạng | Biên soạn | Khi hiện đáp án |
|---|---|---|
| ABCD | Bốn lựa chọn, một đáp án đúng | Tô xanh và đánh dấu lựa chọn đúng |
| Đúng / Sai | Chọn nhận định đúng hoặc sai | Tô xanh lựa chọn đúng |
| Điền từ | Dùng `{{…}}`; mỗi dòng đáp án ứng với một chỗ trống | Điền và tô nổi bật từng từ |
| Nhiều đáp án | 2–12 lựa chọn, đánh dấu các đáp án đúng | Tô xanh tất cả lựa chọn đúng |
| Nối hai cột | Mỗi dòng cột A ghép với dòng cùng vị trí cột B | Tô số và chữ cùng màu cho từng cặp, kèm ký hiệu số ↔ chữ; giữ nguyên bố cục |
| Sắp xếp | 2–12 dòng theo thứ tự đúng | Giữ nguyên vị trí câu hỏi, thêm số thứ tự đúng bên cạnh |
| Trả lời ngắn | Nhập đáp án mẫu | Hiện đáp án trong khung nổi bật |

Giao diện quản trị sử dụng các dạng câu hỏi đã có; không còn mục thêm dạng mới.

Dữ liệu mẫu nhằm minh họa chức năng. Người biên soạn nên kiểm tra nội dung theo chương trình giáo lý của buổi thi.

## Dữ liệu và phân quyền

- `quiz_workspace`: toàn bộ kho câu hỏi, chỉ admin được đọc.
- `quiz_public`: bản công bố chỉ gồm các câu được bật, theo thứ tự admin đã lưu.
- `quiz_admins`: danh sách ID tài khoản được phép quản trị.
- `quiz_admin_emails`: danh sách email được phép tạo tài khoản; không công khai qua API.
- `save_quiz`: hàm kiểm tra quyền và dữ liệu, lưu kho và bản công bố trong cùng giao dịch.
- Mỗi lần lưu kèm `revision`; bản cũ nhận HTTP 409. Admin có thể xuất bản đang mở để giữ dữ liệu, rồi tải lại trước khi hợp nhất thay đổi.
- Khóa trong `config.js` là **publishable key**, chỉ có quyền do RLS cho phép. Không đưa secret key/service_role vào frontend.
- Phiên đăng nhập lưu trong `sessionStorage`, không có mật khẩu trong mã nguồn hoặc file xuất.
- Đây là công cụ trình chiếu cho người điều hành, không phải hệ thống thí sinh làm bài hoặc chấm điểm. Đáp án của các câu đã công bố được tải về trình duyệt để người điều hành mở khi cần.

## Thiết lập Supabase

1. Tạo dự án riêng, bật Data API và RLS.
2. Chạy `supabase/schema.sql`, sau đó `supabase/seed.sql` một lần. Seed không ghi đè dữ liệu đã có.
3. Thêm email admin trong SQL Editor (thay email ví dụ):

   ```sql
   insert into public.quiz_admin_emails(email)
   values (lower('admin@example.com')) on conflict do nothing;
   ```

4. Auth URL Configuration: Site URL đặt là URL đầy đủ của `admin.html`. Giữ xác nhận email bật. Email xác nhận và khôi phục phụ thuộc cấu hình email của Supabase.
5. Điền Project URL và publishable key vào `config.js`.
6. Admin tạo tài khoản tại trang quản trị và xác nhận email. Trigger chỉ cấp quyền sau khi email xác nhận thành công.

Tài khoản mới không được cấp quyền theo thứ tự đăng ký. Không có chức năng tự nhận quyền admin.

## Phát triển và kiểm tra

```sh
python3 -m http.server 8085 --bind 127.0.0.1
```

Mở `http://127.0.0.1:8085/`. Có thể dùng `?demo=1` trên trang trình chiếu và admin để thử dữ liệu riêng trong trình duyệt, không thay đổi dữ liệu cloud.

Chạy `supabase/check.sql` trong SQL Editor để kiểm tra quyền khách, tài khoản không phải admin, quyền admin, công bố câu được chọn, dữ liệu không hợp lệ và xung đột phiên bản. Script luôn kết thúc bằng rollback khi thành công; nếu chỉnh script và gặp lỗi, chạy `rollback;` trước lần thử tiếp theo.

Các file `supabase/*.sql` là mã migration và kiểm thử, không chứa thông tin đăng nhập. Hướng dẫn trình duyệt và đường dẫn máy cá nhân chỉ giữ local.

## Triển khai

GitHub Pages dùng nhánh `main`, thư mục gốc. Push thay đổi để triển khai. Thay đổi nội dung qua admin được lưu trực tiếp vào Supabase, không cần push GitHub.

## Tài liệu tham khảo

- [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
