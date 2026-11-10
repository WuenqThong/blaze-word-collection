import { Link } from "react-router-dom";
import { Heading, Panel } from "./ui";
import { SERVER_ENABLED } from "./server";
export function HomeDemo() {
  return (
    <>
      <section className="demo-home-hero">
        <div>
          <p className="page-eyebrow">QUẢNG NAM — ĐÀ NẴNG / APPDICHTHUAT</p>
          <h1>
            Tiếng quê mình,
            <br />
            <span>chơi để cùng góp.</span>
          </h1>
          <p>
            Mười câu hỏi từ cách nói quen thuộc đến câu chuyện của bạn. Đăng
            nhập để bắt đầu; mỗi đóng góp đều được giữ nguồn và ngữ
            cảnh.
          </p>
          <div className="demo-actions">
            <Link className="btn btn-primary" to="/demo/play">
              Chơi game 10 câu{" "}
              <i className="bi bi-arrow-right" aria-hidden="true" />
            </Link>
          </div>
        </div>
        <Panel title="10 câu, nhiều cách đóng góp">
          <ol className="demo-home-steps">
            <li>
              <strong>01—03</strong>
              <span>
                Hiểu cách nói quen thuộc
                <br />
                <small>Hiệu chỉnh, chấp nhận biến thể.</small>
              </span>
            </li>
            <li>
              <strong>04—08</strong>
              <span>
                Giải nghĩa & diễn đạt
                <br />
                <small>Hai câu kiểm tra xen kẽ.</small>
              </span>
            </li>
            <li>
              <strong>09—10</strong>
              <span>
                Góp từ và câu mới
                <br />
                <small>Giữ nguyên lời và bối cảnh.</small>
              </span>
            </li>
          </ol>
        </Panel>
      </section>
    </>
  );
}
export function RightsDemo() {
  if (SERVER_ENABLED) return <RightsServer />;
  return (
    <>
      <Heading title="Bạn hiểu rõ dữ liệu được dùng ra sao." />
      <Panel title="Tham gia và phạm vi">
        <p>
          Đăng nhập hoặc đăng ký tài khoản trước khi chơi. Tiếp nhận là điều kiện
          lưu mẫu; training/công khai/audio là lựa chọn độc lập, mặc định tắt.
        </p>
        <p>
          RAW giữ nguyên. Bổ sung tạo phiên bản mới; reviewer độc lập, không tự
          duyệt. Chỉ bản chuẩn hóa đủ QA/quyền mới vào từ điển demo hoặc bản
          xuất demo.
        </p>
      </Panel>
      <Panel title="Rút mẫu, khôi phục và bản lưu">
        <p>
          Lịch sử cho phép rút từng mẫu/lượt hoặc thay riêng phạm vi consent.
          Bản xuất mất điều kiện sẽ bị chặn tải. Không thể tự xóa bản đã tải ra
          ngoài.
        </p>
        <p>
          Kho này nằm trên trình duyệt, không có bảo mật nhận dạng người thật.
          Mã khôi phục và chuyển vai trò chỉ để quản lý trải nghiệm luồng. Có
          thể xuất/nhập backup tại Vận hành.
        </p>
      </Panel>
      <Panel title="Credit và AI">
        <p>
          Đăng ký hoặc chơi xong không được tặng credit. Hạn mức AI nội bộ chỉ
          mô phỏng khi tài khoản được xác nhận, mẫu không trùng đủ chất lượng,
          rủi ro đã rà soát và chính sách được bật. Không chuyển nhượng/đổi
          tiền.
        </p>
        <p>
          Dịch, ASR, model và pipeline ở đây là mô phỏng phục vụ duyệt frontend.
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
          lịch sử được lưu trên máy chủ, gắn với tài khoản của bạn. Tệp âm
          thanh hoặc ảnh bạn đính kèm hiện chỉ lưu trên trình duyệt này.
        </p>
        <p>
          Người duyệt (reviewer) và quản trị viên đọc được nội dung mẫu để kiểm
          tra. Họ không thấy mật khẩu của bạn. Người duyệt không duyệt mẫu của
          chính mình.
        </p>
      </Panel>
      <Panel title="Bạn đồng ý cho việc gì">
        <p>
          Đồng ý tiếp nhận là bắt buộc để lưu mẫu. Ba lựa chọn còn lại (dùng để
          huấn luyện, công khai, dùng âm thanh) tách riêng và mặc định tắt.
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
          Đăng ký hoặc chơi xong không được tặng hạn mức. Quản trị viên chỉ cấp
          hạn mức AI nội bộ khi tài khoản đã được xác nhận, mẫu đạt chất lượng
          và không trùng, và chính sách hạn mức đang bật. Hạn mức không đổi
          được thành tiền và không chuyển cho người khác.
        </p>
      </Panel>
    </>
  );
}
