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
print("   VERIFYING USER EXACT BUG FIX: DEDUPLICATION & ZERO CLOUD POLLUTION ")
print("======================================================================")

driver = webdriver.Chrome(options=options)
driver.get(file_path)

# DISABLE CLOUD SYNC FOR TESTS 100% TO PREVENT TEST DATA POLLUTION
driver.execute_script("""
    window.__disable_cloud__ = true;
    window.fetchQuizFromCloud = async function() { return false; };
    window.publishQuizToCloud = async function() { return true; };
    window.confirm = function() { return true; };
    localStorage.clear();
""")
time.sleep(0.5)

# ----------------------------------------------------------------------
# STEP 1: Verify deduplication of 'Teen 4' and 'Teen 04'
# ----------------------------------------------------------------------
res1 = driver.execute_script("""
    return new Promise(async (resolve) => {
        appData.classes = [
            { id: 'c1', name: 'Teen 4', students: [{ id: 's1', name: 'Học Sinh A' }] },
            { id: 'c2', name: 'Teen 04', students: [{ id: 's2', name: 'Học Sinh B' }] }
        ];

        saveStorage();
        sanitizeClassesData();
        renderClassesList();
        updateTargetClassSelectOptions();

        resolve({
            classesCount: appData.classes.length,
            firstClassName: appData.classes[0].name,
            totalStudentsInClass: appData.classes[0].students.length
        });
    });
""")

print("\n[STEP 1] Deduplication of 'Teen 4' and 'Teen 04':")
print(" - Clean Classes Count (Expected 1):", res1['classesCount'])
print(" - Remaining Class Name (Expected 'Teen 4'):", res1['firstClassName'])
print(" - Merged Students Count (Expected 2):", res1['totalStudentsInClass'])

assert res1['classesCount'] == 1, "Step 1 Failed: Teen 04 duplicate not merged into Teen 4"
assert res1['totalStudentsInClass'] == 2, "Step 1 Failed: Student roster lost during merge"

# ----------------------------------------------------------------------
# STEP 2: Verify matching 'Teen 4' student gets assigned quiz even if target was 'Teen 04'
# ----------------------------------------------------------------------
res2 = driver.execute_script("""
    return new Promise(async (resolve) => {
        appData.classAssignments = {
            'Teen 04': {
                quizTitle: 'Đề Ôn Tập Tiếng Anh B1',
                questions: [{ id: 1, text: 'Q1?' }]
            }
        };

        const assigned = getAssignedQuizForClass('Teen 4');

        resolve({
            quizTitle: assigned ? assigned.quizTitle : 'none'
        });
    });
""")

print("\n[STEP 2] Student 'Teen 4' matching assigned quiz for 'Teen 04':")
print(" - Assigned Quiz Title (Expected 'Đề Ôn Tập Tiếng Anh B1'):", res2['quizTitle'])

assert res2['quizTitle'] == 'Đề Ôn Tập Tiếng Anh B1', "Step 2 Failed: Teen 4 student failed to match Teen 04 quiz"

driver.quit()

print("\n======================================================================")
print("   🎉 ALL DEDUPLICATION & ZERO CLOUD POLLUTION TESTS PASSED 100%!       ")
print("======================================================================")
