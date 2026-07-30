# EduQuiz Pro v2.0 - Interactive Quiz Application

EduQuiz Pro là ứng dụng quản lý đề thi, giao bài tập tiếng Anh đa lớp thông minh và chấm điểm tự động.

## Features
- Soạn đề thi tiếng Anh bằng Markdown & tự động phân loại bằng Gemini AI.
- Quản lý danh sách lớp học và danh sách học sinh theo Mã Số Học Viên (`HV001`, `HV002`).
- Chấm điểm chuẩn thang điểm 10 với trọng số điểm tùy chỉnh cho từng câu.
- Hiển thị bài làm với màu sắc xanh/đỏ rõ ràng cho câu đúng/sai.
- Giải thích chi tiết ngữ pháp câu hỏi bằng Gemini AI.
- Bảo vệ dữ liệu lớp học không bị ghi đè khi Vercel khởi động lại.
- Tích hợp khung góp ý / phản hồi trực tiếp đồng bộ Cloud.

## Build Check
To verify code syntax and TypeScript types locally:
```bash
npm run check-build
```

## Deployment
Automated Vercel deployment on `main` branch.
