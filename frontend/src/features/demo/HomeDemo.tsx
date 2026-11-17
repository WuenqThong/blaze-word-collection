import { Link } from "react-router-dom";
import { Heading, Panel } from "./ui";
import { SERVER_ENABLED } from "./server";
export function HomeDemo() {
  return (
    <div className="community-home">
      <section className="community-intro" aria-labelledby="community-title">
        <p className="community-eyebrow">XÂY DỰNG DỮ LIỆU DỊCH PHƯƠNG NGỮ</p>
        <h1 id="community-title">Chia sẻ cách nói địa phương.<br /><span>Giúp bản dịch hiểu đúng hơn.</span></h1>
        <p className="community-lead">Đóng góp từ, câu địa phương cùng ý nghĩa bằng tiếng Việt phổ thông. Dữ liệu sau khi được kiểm duyệt và có sự đồng ý của bạn sẽ được dùng để huấn luyện, cải thiện hệ thống dịch phương ngữ.</p>
      </section>
      <section className="community-paths" aria-label="Chọn cách đóng góp">
        <article className="community-path community-path-primary">
          <span className="community-path-icon" aria-hidden="true"><i className="bi bi-chat-square-text" /></span>
          <p className="community-eyebrow">KHÁM PHÁ & ĐÓNG GÓP</p>
          <h2>Đóng góp qua 10 câu hỏi</h2>
          <p>Giải thích nghĩa của cách nói địa phương qua một lượt chơi 10 câu. Câu trả lời của bạn giúp bổ sung và kiểm tra dữ liệu dịch.</p>
          <Link className="btn btn-primary" to="/demo/play">Chơi trò chơi 10 câu <i className="bi bi-arrow-right" aria-hidden="true" /></Link>
          <small>Bạn có thể xem lại trước khi gửi.</small>
        </article>
        <article className="community-path">
          <span className="community-path-icon" aria-hidden="true"><i className="bi bi-pencil-square" /></span>
          <p className="community-eyebrow">CHIA SẺ ĐIỀU BẠN BIẾT</p>
          <h2>Đóng góp từ, câu địa phương</h2>
          <p>Viết một từ hoặc câu thường dùng ở quê bạn, giải thích nghĩa và cách nói tương ứng bằng tiếng Việt phổ thông.</p>
          <Link className="btn btn-outline-primary" to="/demo/contribute">Đóng góp từ, câu <i className="bi bi-arrow-right" aria-hidden="true" /></Link>
          <small>Ví dụ: “mô” nghĩa là “đâu”, thường dùng ở miền Trung.</small>
        </article>
      </section>
      <section className="community-assurance" aria-label="Đóng góp của bạn được trân trọng">
        <div><i className="bi bi-person-check" aria-hidden="true" /><h2>Không cần là chuyên gia</h2><p>Chia sẻ từ, câu bạn biết, ý nghĩa và vùng thường sử dụng.</p></div>
        <div><i className="bi bi-check2-circle" aria-hidden="true" /><h2>Có người đọc và kiểm tra</h2><p>Người kiểm duyệt kiểm tra ý nghĩa và cách dùng trước khi đưa vào bộ dữ liệu dịch.</p></div>
        <div><i className="bi bi-shield-check" aria-hidden="true" /><h2>Bạn quyết định quyền sử dụng</h2><p>Đọc phạm vi đồng ý và quản lý đóng góp trong lịch sử.</p><Link to="/demo/rights">Tìm hiểu quyền của bạn <span aria-hidden="true">→</span></Link></div>
      </section>
    </div>
  );
}
export function RightsDemo() {
  if (SERVER_ENABLED) return <RightsServer />;
  return (
    <>
      <Heading title="Bạn hiểu rõ dữ liệu được dùng ra sao." />
      <Panel title="Tham gia và phạm vi">
        <p>
          Đăng nhập hoặc đăng ký trước khi chơi. Bạn cần tự tích đồng ý tiếp nhận, kiểm duyệt và huấn luyện. Công khai nội dung và sử dụng âm thanh là các lựa chọn riêng, mặc định tắt.
        </p>
        <p>
          Bản gốc giữ nguyên. Bổ sung tạo phiên bản mới; người duyệt độc lập, không tự
          duyệt. Chỉ bản chuẩn hóa đủ Kiểm tra chất lượng/quyền mới vào từ điển minh họa hoặc bản
          xuất minh họa.
        </p>
      </Panel>
      <Panel title="Rút mẫu, khôi phục và bản lưu">
        <p>
          Lịch sử cho phép rút từng mẫu/lượt hoặc thay riêng phạm vi phạm vi đồng ý.
          Bản xuất mất điều kiện sẽ bị chặn tải. Không thể tự xóa bản đã tải ra
          ngoài.
        </p>
        <p>
          Kho này nằm trên trình duyệt, không có bảo mật nhận dạng người thật.
          Mã khôi phục và chuyển vai trò chỉ để quản lý trải nghiệm luồng. Có
          thể xuất/nhập sao lưu tại Vận hành.
        </p>
      </Panel>
      <Panel title="Lượt sử dụng và AI">
        <p>
          Đăng ký hoặc chơi xong không được tặng lượt sử dụng. Hạn mức AI nội bộ chỉ
          mô phỏng khi tài khoản được xác nhận, mẫu không trùng đủ chất lượng,
          rủi ro đã rà soát và chính sách được bật. Không chuyển nhượng/đổi
          tiền.
        </p>
        <p>
          Dịch, Nhận dạng giọng nói, mô hình và quy trình xử lý ở đây là mô phỏng phục vụ duyệt giao diện.
          Không gọi nhà cung cấp hoặc chạy huấn luyện thật.
        </p>
      </Panel>
    </>
  );
}

/** Copy for the server-backed build: what is stored where, who reads it, how to take it back. */
function RightsServer() {
  return (
    <>
      <Heading title="Bạn hiểu rõ dữ liệu được dùng ra sao." />
      <Panel title="Dữ liệu lưu ở đâu">
        <p>
          Cần đăng nhập để chơi. Câu trả lời, lựa chọn đồng ý, phiếu duyệt và
          lịch sử được lưu trên máy chủ, gắn với tài khoản của bạn. Pilot hiện chỉ thu văn bản; chưa tiếp nhận bản ghi âm, ảnh hoặc đoạn phim.
        </p>
        <p>
          Người kiểm duyệt đọc được nội dung mẫu để kiểm
          tra. Họ không thấy mật khẩu của bạn. Người kiểm duyệt không duyệt mẫu của
          chính mình.
        </p>
      </Panel>
      <Panel title="Bạn đồng ý cho việc gì">
        <p>
          Bạn phải tự tích đồng ý tiếp nhận, kiểm duyệt và sử dụng dữ liệu để
          huấn luyện trước khi tham gia. Công khai và dùng âm thanh là các phạm vi
          riêng. Các ô không được chọn sẵn; khi xuất dữ liệu không hỏi đồng ý lại.
        </p>
        <p>
          Bản gốc bạn gửi được giữ nguyên. Chỉ mẫu đã qua duyệt, đã chuẩn hóa,
          có đồng ý huấn luyện và có nguồn hợp lệ mới được đưa vào bộ dữ liệu
          huấn luyện.
        </p>
      </Panel>
      <Panel title="Rút mẫu">
        <p>
          Trong Lịch sử, bạn có thể rút từng mẫu, rút cả lượt chơi hoặc tắt
          riêng từng lựa chọn đồng ý. Mẫu đã rút bị loại khỏi các lần xuất sau
          và các bản xuất cũ chứa mẫu đó bị chặn tải. Bản đã được tải ra ngoài
          trước đó thì không thể thu hồi.
        </p>
      </Panel>
      <Panel title="Hạn mức AI">
        <p>
          Đăng ký hoặc chơi xong không được tặng hạn mức. Người kiểm duyệt chỉ cấp
          hạn mức AI nội bộ khi tài khoản đã được xác nhận, mẫu đạt chất lượng
          và không trùng, và chính sách hạn mức đang bật. Hạn mức không đổi
          được thành tiền và không chuyển cho người khác.
        </p>
      </Panel>
    </>
  );
}
