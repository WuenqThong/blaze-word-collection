import { isRouteErrorResponse, useRouteError } from "react-router-dom";

export function ApplicationError() {
  const error = useRouteError();
  const message = error instanceof Error ? error.message : "";
  const missingModule = /dynamically imported module|loading chunk|importing a module script|module script failed/i.test(message);
  const missingPage = isRouteErrorResponse(error) && error.status === 404;
  return <main className="collection-empty" role="alert">
    <h1>{missingModule ? "Cần tải lại giao diện" : missingPage ? "Không tìm thấy trang" : "Chưa mở được trang này"}</h1>
    <p>{missingModule ? "Ứng dụng vừa được cập nhật hoặc kết nối bị gián đoạn. Hãy kiểm tra kết nối rồi tải lại trang để tiếp tục." : "Hãy thử tải lại trang. Nếu vẫn gặp lỗi, liên hệ quản trị viên."}</p>
    <p>Thao tác này không xoá các bản nháp đã lưu trên thiết bị.</p>
    <button className="btn btn-primary" onClick={() => window.location.reload()}>Tải lại trang</button>
  </main>;
}
