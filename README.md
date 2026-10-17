# 25C02001_DataViz_Midterm

Đồ án giữa kỳ môn Trực quan hoá dữ liệu: trang web tương tác phân tích bộ dữ liệu **Urban Retail Sales – HCMC 2025** (240 giao dịch, từ 04/01/2025 đến 30/12/2025).

- Học viên: **Lê Thị Hồng Đào**, MSHV **25C02001**
- Câu hỏi xuyên suốt: điều gì thực sự tạo ra lợi nhuận và sự hài lòng của khách hàng?
- Mỗi nhận định đi theo các bước: Quan sát → So sánh → Điều tra → Nhận định

Công nghệ: HTML/CSS/JavaScript thuần, [Apache ECharts 5.5](https://echarts.apache.org/) (biểu đồ), [Leaflet 1.9](https://leafletjs.com/) (bản đồ). ECharts và Leaflet được tải từ CDN; ô bản đồ dùng tile OpenStreetMap. Dữ liệu giao dịch nằm sẵn trong `js/data.js`, không cần máy chủ cho file số liệu.

## Cấu trúc

```
index.html          Trang chính: giới thiệu, bộ lọc, 8 nhận định, kết luận, bảng dữ liệu
css/style.css       Giao diện, biến màu sáng/tối, bố cục responsive
js/data.js          240 giao dịch, chuyển từ CSV sang JS
js/app.js           Bộ lọc chung, tính toán, vẽ biểu đồ, đoạn chữ khi đang lọc
data/*.csv          File CSV gốc (có nút tải trên trang)
```

`js/app.js` giữ một trạng thái lọc (`state.filters`). Mọi biểu đồ, KPI, bảng và đoạn chữ cạnh biểu đồ đọc cùng trạng thái đó và vẽ lại khi lọc đổi.

## Dữ liệu

Bốn chi nhánh: Quận 1, Quận 3, Quận 7, Thủ Đức. Năm nhóm hàng: Electronics, Fashion, Food & Beverage, Home, Sports (20 sản phẩm). Mỗi dòng có thời gian, chi nhánh, sản phẩm, loại khách, phương thức thanh toán, số lượng, đơn giá, % giảm giá, doanh thu, giá vốn, lợi nhuận, điểm đánh giá (1–5) và số ngày giao hàng.

Quy ước dùng trên toàn trang:

- Đã kiểm tra `Doanh thu = Số lượng × Đơn giá × (1 − Giảm giá)` và `Lợi nhuận = Doanh thu − Giá vốn`. Cả 240 dòng khớp.
- Thiếu 6 giá trị `Customer_Rating` và 4 giá trị `Delivery_Days`. Những dòng này vẫn tính doanh thu và lợi nhuận; chúng chỉ bị loại khỏi trung bình của cột bị thiếu.
- **Biên lợi nhuận** = tổng lợi nhuận ÷ tổng doanh thu. Không lấy trung bình của biên từng giao dịch.
- **Giảm giá trung bình** là trung bình cộng từng giao dịch (mỗi đơn một phiếu), không nhân theo doanh thu.
- Đơn vị tiền là VNĐ. Trên biểu đồ, “tr” nghĩa là triệu đồng.

## Chạy thử trên máy

Đứng trong thư mục dự án:

```bash
python3 -m http.server 8000
```

Rồi mở http://localhost:8000.

Cần có mạng để tải ECharts, Leaflet và nền bản đồ. Nếu ECharts hoặc file dữ liệu không tải được, đầu trang hiện một dòng hướng dẫn tải lại. Nếu chỉ Leaflet không tải được, khung bản đồ hiện dòng báo; các biểu đồ còn lại vẫn chạy.

Giao diện sáng/tối theo hệ điều hành lúc mở trang. Nút **Giao diện** ghi lựa chọn vào `localStorage` và không bị hệ điều hành ghi đè cho đến khi xoá lựa chọn đó.

## Bố cục trang

1. **Giới thiệu** — phạm vi dữ liệu và cách làm sạch.
2. **Tổng quan** — bảy chỉ số (doanh thu, lợi nhuận, biên, số giao dịch, giảm giá trung bình, điểm đánh giá, ngày giao) và bản đồ bốn chi nhánh. Phần trăm trên thẻ chỉ số là so với cả năm, kể cả khi đang lọc.
3. **Nhận định 1–8** — mỗi mục có biểu đồ và ba đoạn giải thích.
4. **Kết luận** — tám ý và năm khuyến nghị. Phần này giữ kết quả cả năm, không đổi theo bộ lọc.
5. **Bảng dữ liệu** — mọi giao dịch đang nằm trong bộ lọc. Nhấn tiêu đề cột để sắp xếp. Ô thiếu điểm hoặc ngày giao nằm cuối khi sắp tăng dần, và lên đầu khi sắp giảm dần.

## Tám nhận định

1. Electronics có doanh thu cao nhất nhưng biên thấp nhất. Fashion sinh lời tốt hơn.
2. Quận 1 doanh thu cao nhất, biên thấp nhất, vì hơn một nửa doanh thu đến từ Electronics (hiệu ứng cơ cấu).
3. Biên giảm theo mức giảm giá chủ yếu vì giá vốn không giảm theo. Cả 6 giao dịch lỗ đều thuộc Electronics hoặc Food & Beverage và đều giảm từ 25%. Mức 30% và 35% chỉ có 5 và 3 đơn.
4. Tháng 6 có biên thấp nhất vì cơ cấu Electronics; tháng 12 giảm giá mạnh nhất. Quý 4 bán nhiều nhất, nhưng biên quý chỉ thấp hơn quý 2 khoảng 0,4 điểm.
5. Điểm đánh giá đi cùng tốc độ giao (tương quan, chưa phải nhân quả). Thủ Đức giao chậm nhất và điểm thấp nhất.
6. Ví điện tử là cách thanh toán chính của mọi nhóm khách.
7. Trung bình tổng cả năm của một ngày thường cao hơn một ngày cuối tuần 30,5%. Mỗi cột là tổng cả năm của thứ đó. Chủ nhật có tổng thấp nhất.
8. Một vài đơn lớn đổi được thứ hạng chi nhánh. Ba trong sáu giao dịch lỗ nằm ở Quận 1.

Tiêu đề các nhận định luôn là câu cả năm. Khi thanh lọc không còn là cả năm, ba đoạn chữ cạnh biểu đồ được tính lại từ đúng phần dữ liệu đang xem. Xoá lọc thì các đoạn đó trở lại bài viết gốc.

## Tương tác

Bộ lọc dính ở đầu trang (trên màn hẹp thì không dính): từ tháng, đến tháng, chi nhánh, nhóm hàng, loại khách, thanh toán, ngày trong tuần, mức giảm giá, sản phẩm. Ô đang khác “Tất cả” được viền xanh. **Xoá lọc** đưa mọi thứ về cả năm, kể cả vùng chọn trên biểu đồ toạ độ song song.

Nhấn một cột, lát cắt, thanh sản phẩm, bong bóng hoặc chấm trên bản đồ để lọc theo giá trị đó. Nhấn lại cùng giá trị để bỏ lọc đó. Biểu đồ của chính chiều đang chọn vẫn giữ đủ các mục và làm mờ mục không được chọn, để còn thấy phần còn lại.

Một số quy ước riêng:

- Danh sách sản phẩm chỉ hiện món thuộc nhóm hàng đang chọn. Đổi nhóm hàng sang nhóm không chứa sản phẩm hiện tại thì ô sản phẩm về “Tất cả”.
- Bản đồ nhiệt khách × ngày: nhấn một ô lọc theo **ngày**, không lọc theo loại khách, cùng cách với biểu đồ cột ngày trong tuần bên cạnh. Mỗi cột ngày trong tuần là tổng của thứ đó trong phần đang xem, không phải doanh thu một ngày lịch.
- Hai biểu đồ theo tháng luôn có đủ 12 tháng và liên kết tooltip cùng zoom. Tháng ngoài khoảng lọc vẫn hiện nhưng mờ; nhấn một tháng để thu bộ lọc về tháng đó, nhấn lại để về cả năm. Vùng tô “Th11–Th12” chỉ hiện khi khoảng tháng đang chọn gồm cả tháng 11 và tháng 12.
- Biểu đồ phân tán giảm giá: kéo chuột để chọn một vùng điểm. Ô phía dưới chỉ thống kê vùng đó, không đổi bộ lọc toàn trang.
- Biểu đồ toạ độ song song: rê một đường để xem mã giao dịch. Kéo trên một trục để giới hạn vùng. Có nút **Giao dịch lỗ**, **Đơn lớn (SL ≥ 6)**, **Giao 4 ngày** và **Bỏ chọn**. Vùng chọn trên trục được giữ khi đổi bộ lọc khác; **Xoá lọc** thì bỏ. Bảng nhỏ bên dưới liệt kê giao dịch trong vùng chọn. Đường đứt là giao dịch thiếu điểm hoặc số ngày giao; câu thống kê ghi rõ số này thuộc vùng chọn hay cả biểu đồ. Đơn lỗ mà biên làm tròn một chữ số thành 0 vẫn được giữ ở −0,1% trên trục biên, để nút **Giao dịch lỗ** không bỏ sót.

Chú giải ECharts bấm được để ẩn hoặc hiện một chuỗi. Tooltip nằm trong khung biểu đồ và có số liệu của đúng điểm đang trỏ.
