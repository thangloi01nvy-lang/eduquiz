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
    appData.currentQuestions = parseInputToQuestions(raw);
    
    // Override parseInputToQuestions inside test to test optional parameter
    const origParse = window.parseInputToQuestions;
    window.parseInputToQuestions = function(rawText, updateGlobalSections = true) {
        const savedSections = appData.sections;
        const res = origParse(rawText);
        if (!updateGlobalSections) {
            appData.sections = savedSections;
        }
        return res;
    };

    openBulkSectionEditorModal(1);
    switchBulkEditorTab('raw');
    
    // Save in raw tab mode
    saveBulkSectionModal();

    return {
        secCount: appData.sections.length,
        totalQuestions: appData.currentQuestions.length,
        sections: appData.sections.map(s => ({ title: s.title, qCount: s.questions.length })),
        previewQCount: document.getElementById('preview-q-count-badge') ? document.getElementById('preview-q-count-badge').innerText : ''
    };
""", raw_text)

print("Test Result in RAW TAB MODE AFTER FIX:")
print("Sections count:", res['secCount'])
print("Total questions:", res['totalQuestions'])
print("Sections:", res['sections'])
print("Preview badge:", res['previewQCount'])

driver.quit()
