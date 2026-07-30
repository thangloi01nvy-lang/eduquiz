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
time.sleep(1)

raw_text = """## Bài 1: Chọn từ thích hợp điền vào chỗ trống
1. She was tired, ___ she went to bed early. (so)

## Bài 2: Nối hai câu sử dụng liên từ thích hợp 
1. She didn’t go to school. It was raining. (because) 
2. I like chocolate. My sister likes vanilla. (but) 
Answer: 
1.	She didn’t go to school because it was raining.
2.	I like chocolate, but my sister likes vanilla.

## Bài 3: Hãy xác định mệnh đề
1. Although she was tired. → DP
2. She went to bed early. → ID
"""

res = driver.execute_script("""
    const raw = arguments[0];
    document.getElementById('markdown-input').value = raw;
    generateQuiz();
    
    console.log("Initial questions:", appData.currentQuestions.length);

    // Edit Section 1 (Bài 2) in Bulk Modal
    openBulkSectionEditorModal(1);
    
    // Change Q1 title in bulk editor
    const q1TitleInput = document.querySelector('[id^="bulk-q-title-"]');
    if (q1TitleInput) {
        q1TitleInput.value = "EDITED QUESTION TITLE 2.1";
    }
    
    saveBulkSectionModal();

    const afterSaveQCount = appData.currentQuestions.length;
    const afterSaveSecCount = appData.sections.length;

    // Simulate clicking "Tạo Bài Tập" again from main page
    generateQuiz();

    const afterGenerateQCount = appData.currentQuestions.length;
    const afterGenerateSecCount = appData.sections.length;

    return {
        initialQCount: 5,
        afterSaveQCount,
        afterSaveSecCount,
        afterGenerateQCount,
        afterGenerateSecCount,
        markdownVal: document.getElementById('markdown-input').value,
        questions: appData.currentQuestions.map(q => ({ id: q.id, title: q.title }))
    };
""", raw_text)

print("Duplicate Test Result:")
print("After Save: Qs =", res['afterSaveQCount'], ", Secs =", res['afterSaveSecCount'])
print("After Re-Generate: Qs =", res['afterGenerateQCount'], ", Secs =", res['afterGenerateSecCount'])
print("Questions List:")
for q in res['questions']:
    print(f"  Q{q['id']}: {q['title']}")

driver.quit()
