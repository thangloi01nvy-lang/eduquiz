import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
import os

options = Options()
options.add_argument('--headless')
options.add_argument('--no-sandbox')
options.add_argument('--disable-dev-shm-usage')

file_path = "file://" + os.path.abspath("index.html") + "?test=true"

print("======================================================================")
print("   SENIOR MULTI-CLASS MULTI-QUIZ ARCHITECTURE TEST SUITE              ")
print("======================================================================")

driver = webdriver.Chrome(options=options)
driver.get(file_path)
time.sleep(1)

driver.execute_script("window.confirm = function() { return true; };")

# ----------------------------------------------------------------------
# FLOW 1 & 2: Setup Classes, Library & Multi-Class Assignments
# ----------------------------------------------------------------------
res = driver.execute_script("""
    return new Promise(async (resolve) => {
        appData.classAssignments = {};
        appData.quizTargetClass = 'none';

        appData.classes = [
            { id: 'c1', name: 'Harmonize 1', students: [] },
            { id: 'c2', name: 'TOEIC Sáng', students: [] },
            { id: 'c3', name: 'Teen 4', students: [] }
        ];

        appData.quizLibrary = [
            {
                id: 'library_101',
                title: 'Đề Ngữ Pháp B1',
                level: 'B1',
                targetClass: 'all',
                createdDate: '2026-07-30',
                savedAt: '30/07/2026',
                rawText: '## Bài 1\\n1. Grammar Q1?\\nA. Yes\\nB. No\\nAnswer: A',
                questionsCount: 1,
                sectionsCount: 1
            },
            {
                id: 'library_102',
                title: 'Đề Đọc Hiểu B2',
                level: 'B2',
                targetClass: 'all',
                createdDate: '2026-07-30',
                savedAt: '30/07/2026',
                rawText: '## Bài 1\\n1. Reading Q1?\\nA. True\\nB. False\\nAnswer: A',
                questionsCount: 1,
                sectionsCount: 1
            }
        ];

        saveStorage();
        renderClassesList();
        renderQuizLibrary();
        renderClassAssignmentsPanel();

        // Assign 'library_101' (Đề Ngữ Pháp B1) to 'Harmonize 1'
        await assignSelectedQuizToClass('Harmonize 1', 'library_101');

        // Assign 'library_102' (Đề Đọc Hiểu B2) to 'TOEIC Sáng'
        await assignSelectedQuizToClass('TOEIC Sáng', 'library_102');

        saveStorage();
        renderClassAssignmentsPanel();

        const assignedH1 = getAssignedQuizForClass('Harmonize 1');
        const assignedToeic = getAssignedQuizForClass('TOEIC Sáng');
        const assignedTeen4 = getAssignedQuizForClass('Teen 4');

        const summaryText = document.getElementById('class-assignments-list-container').innerText;

        resolve({
            h1Title: assignedH1 ? assignedH1.quizTitle : '',
            toeicTitle: assignedToeic ? assignedToeic.quizTitle : '',
            teen4Assigned: !!assignedTeen4,
            summaryTextHasGreenBanner: summaryText.includes('CÁC LỚP ĐANG ĐƯỢC PHÁT HÀNH BÀI TẬP LIVE'),
            summaryTextHasDraftWarning: summaryText.includes('TRẠNG THÁI BẢN NHÁP')
        });
    });
""")

print("\n[FLOW 1 & 2] Multi-Class Setup & Assignment Status:")
print(" - Harmonize 1 Quiz Title (Expected 'Đề Ngữ Pháp B1'):", res['h1Title'])
print(" - TOEIC Sáng Quiz Title (Expected 'Đề Đọc Hiểu B2'):", res['toeicTitle'])
print(" - Summary Banner Shows Green Live (Expected True):", res['summaryTextHasGreenBanner'])
print(" - Summary Banner Shows Draft Warning (Expected False):", res['summaryTextHasDraftWarning'])

assert res['h1Title'] == 'Đề Ngữ Pháp B1', "Flow 2 Failed: Harmonize 1 quiz title mismatch"
assert res['toeicTitle'] == 'Đề Đọc Hiểu B2', "Flow 2 Failed: TOEIC Sáng quiz title mismatch"
assert res['summaryTextHasGreenBanner'] == True, "Flow 2 Failed: Green live banner missing"
assert res['summaryTextHasDraftWarning'] == False, "Flow 2 Failed: Confusing draft warning banner still displayed!"

# ----------------------------------------------------------------------
# FLOW 3: Verify Student Isolation Across Classes
# ----------------------------------------------------------------------
res3 = driver.execute_script("""
    return new Promise(async (resolve) => {
        // Log in as student of Harmonize 1
        activeStudentInfo = { classId: '', className: 'Harmonize 1', studentId: 'H1_01', studentName: 'Học Sinh Harmonize' };
        localStorage.setItem('eduquiz_active_student', JSON.stringify(activeStudentInfo));
        restoreStudentSessionUI();

        const h1QuizTitle = document.getElementById('active-quiz-title-display') ? document.getElementById('active-quiz-title-display').innerText : '';

        // Log in as student of TOEIC Sáng
        activeStudentInfo = { classId: '', className: 'TOEIC Sáng', studentId: 'T_01', studentName: 'Học Sinh TOEIC' };
        localStorage.setItem('eduquiz_active_student', JSON.stringify(activeStudentInfo));
        restoreStudentSessionUI();

        const toeicQuizTitle = document.getElementById('active-quiz-title-display') ? document.getElementById('active-quiz-title-display').innerText : '';

        resolve({
            h1QuizTitle,
            toeicQuizTitle
        });
    });
""")

print("\n[FLOW 3] Student Isolation Verification:")
print(" - Harmonize 1 Student Quiz (Expected 'Đề Ngữ Pháp B1'):", res3['h1QuizTitle'])
print(" - TOEIC Sáng Student Quiz (Expected 'Đề Đọc Hiểu B2'):", res3['toeicQuizTitle'])

assert res3['h1QuizTitle'] == 'Đề Ngữ Pháp B1', "Flow 3 Failed: Student Harmonize 1 received wrong quiz"
assert res3['toeicQuizTitle'] == 'Đề Đọc Hiểu B2', "Flow 3 Failed: Student TOEIC Sáng received wrong quiz"

# ----------------------------------------------------------------------
# FLOW 4: Reload F5 & Confirm Persistence
# ----------------------------------------------------------------------
driver.refresh()
time.sleep(1)

res4 = driver.execute_script("""
    const assignedH1 = getAssignedQuizForClass('Harmonize 1');
    const assignedToeic = getAssignedQuizForClass('TOEIC Sáng');
    return {
        h1Title: assignedH1 ? assignedH1.quizTitle : '',
        toeicTitle: assignedToeic ? assignedToeic.quizTitle : ''
    };
""")

print("\n[FLOW 4] F5 Reload Persistence Verification:")
print(" - Harmonize 1 Quiz Title after F5:", res4['h1Title'])
print(" - TOEIC Sáng Quiz Title after F5:", res4['toeicTitle'])

assert res4['h1Title'] == 'Đề Ngữ Pháp B1', "Flow 4 Failed: F5 lost Harmonize 1 assignment"
assert res4['toeicTitle'] == 'Đề Đọc Hiểu B2', "Flow 4 Failed: F5 lost TOEIC Sáng assignment"

driver.quit()

print("\n======================================================================")
print("   🎉 ALL SENIOR MULTI-CLASS MULTI-QUIZ TESTS PASSED 100% PERFECTLY!  ")
print("======================================================================")
