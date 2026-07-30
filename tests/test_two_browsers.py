import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
import os

options = Options()
options.add_argument('--headless')
options.add_argument('--no-sandbox')
options.add_argument('--disable-dev-shm-usage')

file_path = "file://" + os.path.abspath("index.html")

# TEACHER BROWSER
print("Starting Teacher Browser...")
teacher_driver = webdriver.Chrome(options=options)
teacher_driver.get(file_path)
time.sleep(2)

teacher_driver.execute_script("""
    appData.classes = [{ name: 'Lớp 10A1', teacher: 'Thầy Lợi' }];
    appData.quizTargetClass = 'Lớp 10A1';
    appData.quizTitle = 'Bài Thi Mới Từ Teacher';
    appData.currentQuestions = [{ id: 1, title: 'Câu hỏi T1', type: 'short_answer', answer: 'A' }];
    publishQuizToStudents();
""")
print("Teacher published quiz.")
time.sleep(2) # wait for cloud upload

# STUDENT BROWSER
print("Starting Student Browser...")
student_driver = webdriver.Chrome(options=options)
student_driver.get(file_path)
time.sleep(2)

student_result = student_driver.execute_script("""
    return new Promise(async (resolve) => {
        activeStudentInfo = { studentId: 'HS001', studentName: 'Học Sinh', className: 'Lớp 10A1' };
        await forceReloadCloudQuizForStudent();
        
        const qCount = appData.currentQuestions ? appData.currentQuestions.length : 0;
        const qTitle = (qCount > 0) ? appData.currentQuestions[0].title : 'NONE';
        
        resolve({ count: qCount, title: qTitle, titleDisplay: appData.quizTitle });
    });
""")

print("Student Result:", student_result)

teacher_driver.quit()
student_driver.quit()
