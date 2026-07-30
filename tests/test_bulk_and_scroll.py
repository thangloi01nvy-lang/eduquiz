import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
import os

options = Options()
options.add_argument('--headless')
options.add_argument('--no-sandbox')
options.add_argument('--disable-dev-shm-usage')

driver = webdriver.Chrome(options=options)
file_path = "file://" + os.path.abspath("index.html")
driver.get(file_path)
time.sleep(1)

# Generate sample quiz
driver.execute_script("generateQuiz();")
time.sleep(0.5)

# Test 1: Scroll position after changing question type
driver.execute_script("window.scrollTo(0, 500);")
scroll_before = driver.execute_script("return window.scrollY;")
driver.execute_script("changeQuestionTypeInTeacherPreview(0, 'multiple_choice');")
time.sleep(0.3)
scroll_after = driver.execute_script("return window.scrollY;")

print("Scroll position before change:", scroll_before)
print("Scroll position after change:", scroll_after)
print("No jump scroll verified:", abs(scroll_before - scroll_after) < 10)

# Test 2: Bulk section modal
driver.execute_script("openBulkSectionEditorModal(0);")
time.sleep(0.5)
bulk_modal = driver.find_element(By.ID, "bulk-section-modal")
print("Bulk Section Modal visible:", bulk_modal.is_displayed())

# Test 3: Save bulk modal and verify sync
driver.execute_script("""
    document.getElementById('bulk-sec-title-input').value = 'Bài 1: Nâng Cấp Hàng Loạt';
    saveBulkSectionModal();
""")
time.sleep(0.5)

print("Bulk title updated in appData:", driver.execute_script("return appData.sections[0].title") == 'Bài 1: Nâng Cấp Hàng Loạt')

driver.quit()
