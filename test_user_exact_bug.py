import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
import os

options = Options()
options.add_argument('--headless')
options.add_argument('--no-sandbox')
options.add_argument('--disable-dev-shm-usage')

file_path = "file://" + os.path.abspath("index.html")

print("======================================================================")
print("   VERIFYING USER EXACT BUG FIX: F5 PERSISTENCE & NO AUTO-ADDED CLASSES ")
print("======================================================================")

driver = webdriver.Chrome(options=options)
driver.get(file_path)
time.sleep(1.5) # Allow Cloud sync to run naturally

driver.execute_script("window.confirm = function() { return true; };")

# ----------------------------------------------------------------------
# STEP 1: Teacher creates class 'Teen 4', library quiz 'Đề Kiểm Tra Tiếng Anh 10'
# ----------------------------------------------------------------------
res1 = driver.execute_script("""
    return new Promise(async (resolve) => {
        appData.classes = [{ id: 'c_teen4', name: 'Teen 4', students: [{ id: 's1', name: 'Nguyễn Văn A' }] }];
        appData.quizLibrary = [{
            id: 'library_t10',
            title: 'Đề Kiểm Tra Tiếng Anh 10',
            level: 'B1',
            targetClass: 'all',
            createdDate: '2026-07-30',
            rawText: '## Bài 1\\n1. Test Q1?\\nA. Opt A\\nB. Opt B\\nAnswer: A',
            questionsCount: 1,
            sectionsCount: 1
        }];
        appData.classAssignments = {};
        appData.quizTargetClass = 'none';

        saveStorage();
        renderClassesList();
        renderQuizLibrary();
        renderClassAssignmentsPanel();

        // Assign library_t10 to Teen 4
        await assignSelectedQuizToClass('Teen 4', 'library_t10');

        const assignedBeforeF5 = getAssignedQuizForClass('Teen 4');

        resolve({
            classesCountBeforeF5: appData.classes.length,
            classNamesBeforeF5: appData.classes.map(c => c.name),
            assignedTitleBeforeF5: assignedBeforeF5 ? assignedBeforeF5.quizTitle : 'none'
        });
    });
""")

print("\n[STEP 1] Before F5 Page Reload:")
print(" - Classes Count (Expected 1):", res1['classesCountBeforeF5'])
print(" - Class Names:", res1['classNamesBeforeF5'])
print(" - Assigned Quiz Title (Expected 'Đề Kiểm Tra Tiếng Anh 10'):", res1['assignedTitleBeforeF5'])

assert res1['classesCountBeforeF5'] == 1, "Step 1 Failed: Extra classes present before F5"
assert res1['assignedTitleBeforeF5'] == 'Đề Kiểm Tra Tiếng Anh 10', "Step 1 Failed: Quiz assignment failed before F5"

# ----------------------------------------------------------------------
# STEP 2: Teacher reloads page (F5)
# ----------------------------------------------------------------------
driver.refresh()
time.sleep(2) # Give full time for fetchQuizFromCloud to run on refresh

res2 = driver.execute_script("""
    const assignedAfterF5 = getAssignedQuizForClass('Teen 4');
    return {
        classesCountAfterF5: appData.classes ? appData.classes.length : 0,
        classNamesAfterF5: appData.classes ? appData.classes.map(c => c.name) : [],
        assignedTitleAfterF5: assignedAfterF5 ? assignedAfterF5.quizTitle : 'none'
    };
""")

print("\n[STEP 2] After F5 Page Reload:")
print(" - Classes Count (Expected 1):", res2['classesCountAfterF5'])
print(" - Class Names:", res2['classNamesAfterF5'])
print(" - Assigned Quiz Title (Expected 'Đề Kiểm Tra Tiếng Anh 10'):", res2['assignedTitleAfterF5'])

assert res2['assignedTitleAfterF5'] == 'Đề Kiểm Tra Tiếng Anh 10', "Step 2 Failed: Quiz assignment lost on F5!"
assert res2['classesCountAfterF5'] == 1, "Step 2 Failed: Cloud automatically injected old/test classes into teacher class list!"

# ----------------------------------------------------------------------
# STEP 3: Student of 'Teen 4' logs in & verifies quiz availability
# ----------------------------------------------------------------------
res3 = driver.execute_script("""
    return new Promise((resolve) => {
        activeStudentInfo = { classId: 'c_teen4', className: 'Teen 4', studentId: 's1', studentName: 'Nguyễn Văn A' };
        localStorage.setItem('eduquiz_active_student', JSON.stringify(activeStudentInfo));
        restoreStudentSessionUI();

        const activeTitleDisplay = document.getElementById('active-quiz-title-display');
        const studentQuizTitle = activeTitleDisplay ? activeTitleDisplay.innerText : '';
        const hasQuestions = appData.currentQuestions && appData.currentQuestions.length > 0;

        resolve({
            studentQuizTitle,
            hasQuestions
        });
    });
""")

print("\n[STEP 3] Student Login & Quiz Visibility:")
print(" - Student Active Quiz Title (Expected 'Đề Kiểm Tra Tiếng Anh 10'):", res3['studentQuizTitle'])
print(" - Student Has Questions (Expected True):", res3['hasQuestions'])

assert res3['studentQuizTitle'] == 'Đề Kiểm Tra Tiếng Anh 10', "Step 3 Failed: Student sees wrong or no quiz title"
assert res3['hasQuestions'] == True, "Step 3 Failed: Student questions list is empty"

driver.quit()

print("\n======================================================================")
print("   🎉 USER EXACT BUG FIX VERIFIED 100% PERFECTLY! PERSISTENCE CONFIRMED! ")
print("======================================================================")
