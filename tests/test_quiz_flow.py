import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
import os

options = Options()
options.add_argument('--headless')
options.add_argument('--no-sandbox')
options.add_argument('--disable-dev-shm-usage')

driver = webdriver.Chrome(options=options)
file_path = "file://" + os.path.abspath("index.html")
driver.get(file_path)
time.sleep(2)  # Wait for load

res = driver.execute_script("""
    return new Promise((resolve) => {
        // Teacher sets up a class
        appData.classes = [{ name: 'Lớp 10A1', teacher: 'Thầy Lợi' }];
        appData.quizTargetClass = 'Lớp 10A1';
        appData.quizTitle = 'Bài Kiểm Tra Lớp 10A1';
        appData.currentQuestions = [{ id: 1, title: 'Câu số 1', type: 'short_answer', answer: 'A' }];

        // Publish to students (this triggers assignQuizToClassTarget and publishQuizToCloud)
        publishQuizToStudents();
        
        // Wait 1.5 seconds for publishQuizToCloud to finish
        setTimeout(async () => {
            const teacherLocalAssignments = JSON.parse(JSON.stringify(appData.classAssignments));

            // Now, simulate a student logging in
            activeStudentInfo = { studentId: 'HS001', studentName: 'ABC', className: 'Lớp 10A1' };
            
            // Student manually fetches from cloud
            await forceReloadCloudQuizForStudent();
            
            const studentQuestions = appData.currentQuestions;
            
            resolve({
                teacherLocalAssignmentsKeys: Object.keys(teacherLocalAssignments),
                studentQuestionsLength: studentQuestions ? studentQuestions.length : 0,
                studentQ1Title: (studentQuestions && studentQuestions[0]) ? studentQuestions[0].title : null
            });
        }, 1500);
    });
""")

print("Quiz Flow Results:", res)

driver.quit()
