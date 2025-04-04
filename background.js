// Khai báo các biến toàn cục
let categories = [];
const PARENT_MENU_ID = 'saveVocabParent'; // More descriptive name

// Thêm biến flag cho biết chế độ hoạt động
const SIMPLIFIED_MODE = true; // Set to true to disable content script messaging

// Log khi service worker được khởi động
console.log('Vocab Saver Service Worker started at:', new Date().toISOString());

// Khởi tạo khi extension được cài đặt hoặc cập nhật
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Extension installed/updated:', details.reason);
  
  // Tải danh mục từ storage
  await loadCategories();
  
  // Tạo context menu chính
  createContextMenus();
});

// Thêm handler cho sự kiện onStartup để đảm bảo menu được tạo khi extension được khởi động
chrome.runtime.onStartup.addListener(async () => {
  // Tải danh mục từ storage
  await loadCategories();
  
  // Tạo context menu chính
  createContextMenus();
});

// Hàm tải danh mục từ storage và tạo context menu
function loadCategories() {
  return new Promise((resolve) => {
    console.log('Background: Loading categories from storage');
    chrome.storage.local.get(['vocabulary-categories'], function(result) {
      if (!result['vocabulary-categories']) {
        console.log('Background: No categories found, creating default category');
        // Tạo danh mục Default nếu chưa có
        categories = [{ 
          id: 'default', 
          name: 'Default',
          sourceLanguage: 'en', // Source language: English
          targetLanguage: 'vi'  // Target language: Vietnamese
        }];
        chrome.storage.local.set({
          'vocabulary-categories': JSON.stringify(categories)
        }, () => {
          console.log('Background: Default category created and saved');
          resolve();
        });
      } else {
        // Lưu danh mục vào biến toàn cục
        try {
          categories = JSON.parse(result['vocabulary-categories']);
          console.log('Background: Loaded', categories.length, 'categories from storage');
          
          // Kiểm tra xem có danh mục default không
          const hasDefaultCategory = categories.some(cat => cat.id === 'default');
          
          // Nếu không có danh mục default, thêm vào
          if (!hasDefaultCategory) {
            console.log('Background: Adding missing default category');
            categories.push({ 
              id: 'default', 
              name: 'Default',
              sourceLanguage: 'en',
              targetLanguage: 'vi'
            });
            
            // Lưu lại danh sách danh mục đã cập nhật
            chrome.storage.local.set({
              'vocabulary-categories': JSON.stringify(categories)
            }, () => {
              console.log('Background: Default category added and saved');
              resolve();
            });
          } else {
            // Nếu danh mục hiện tại chưa có thông tin ngôn ngữ, cập nhật
            const needsUpdate = categories.some(cat => !cat.sourceLanguage || !cat.targetLanguage);
            if (needsUpdate) {
              console.log('Background: Updating categories with missing language info');
              categories = categories.map(cat => {
                if (!cat.sourceLanguage) cat.sourceLanguage = 'en';
                if (!cat.targetLanguage) cat.targetLanguage = 'vi';
                return cat;
              });
              
              chrome.storage.local.set({
                'vocabulary-categories': JSON.stringify(categories)
              }, () => {
                console.log('Background: Updated categories saved');
                resolve();
              });
            } else {
              resolve();
            }
          }
        } catch (error) {
          console.error('Background: Error parsing categories:', error);
          // Trong trường hợp lỗi, khởi tạo lại danh mục mặc định
          categories = [{ 
            id: 'default', 
            name: 'Default',
            sourceLanguage: 'en',
            targetLanguage: 'vi'
          }];
          chrome.storage.local.set({
            'vocabulary-categories': JSON.stringify(categories)
          }, () => {
            console.log('Background: Reset to default category after error');
            resolve();
          });
        }
      }
    });
  });
}

// Hàm tạo context menu
function createContextMenus() {
  // Xóa tất cả menu hiện tại
  chrome.contextMenus.removeAll(function() {
    try {
      console.log("Creating context menu with", categories.length, "categories");
      
      // Tạo menu cha cho nhóm tính năng
      chrome.contextMenus.create({
        id: PARENT_MENU_ID,
        title: "Vocab Saver", 
        contexts: ["selection", "page"]
      });
      
      // Tạo menu trực tiếp cho từng danh mục khi có chọn text
      categories.forEach(category => {
        chrome.contextMenus.create({
          id: `save-to-category-${category.id}`,
          parentId: PARENT_MENU_ID,
          title: `"${category.name}"`,
          contexts: ["selection"]
        });
      });

      // Menu quản lý từ vựng (luôn hiển thị ở cuối)
      chrome.contextMenus.create({
        id: "openVocabManager",
        parentId: PARENT_MENU_ID,
        title: "Open vocabulary manager",
        contexts: ["selection", "page"]
      });
      
      console.log("Context menu created successfully");
    } catch (error) {
      console.error("Error creating context menu:", error);
    }
  });
}

// Lắng nghe sự kiện storage.onChanged để cập nhật danh mục
chrome.storage.onChanged.addListener(function(changes, namespace) {
  if (namespace === 'local' && changes['vocabulary-categories']) {
    // Danh mục đã thay đổi, cập nhật lại menu
    loadCategories().then(() => createContextMenus());
  }
});

// Xử lý sự kiện khi click vào menu ngữ cảnh
chrome.contextMenus.onClicked.addListener((info, tab) => {
  // Xử lý menu mở quản lý từ vựng
  if (info.menuItemId === "openVocabManager") {
    const managerUrl = chrome.runtime.getURL('extension_index.html');
    chrome.tabs.create({ url: managerUrl });
    return;
  }

  // Xử lý menu lưu từ vựng vào danh mục
  if (info.menuItemId.startsWith('save-to-category-') && info.selectionText) {
    const categoryId = info.menuItemId.replace('save-to-category-', '');
    const selectedText = info.selectionText.trim();

    // Lưu từ vựng vào danh mục đã chọn với dịch tự động
    saveWordWithAutoTranslation(selectedText, categoryId, tab);
  }
});

// Hàm lấy phiên âm từ từ điển
async function getPronunciation(word) {
  try {
    // Sử dụng Free Dictionary API để lấy phiên âm
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    
    // Kiểm tra nếu có dữ liệu phiên âm
    if (data && data.length > 0) {
      // Lấy phiên âm từ kết quả đầu tiên
      const phonetics = data[0].phonetics;
      
      if (phonetics && phonetics.length > 0) {
        // Ưu tiên lấy các mục có cả phiên âm text và audio
        const phoneticWithAudio = phonetics.find(p => p.text && p.audio);
        
        if (phoneticWithAudio) {
          return {
            text: phoneticWithAudio.text,
            audio: phoneticWithAudio.audio
          };
        }
        
        // Nếu không tìm thấy mục có cả hai, ưu tiên lấy mục có audio
        const anyWithAudio = phonetics.find(p => p.audio);
        if (anyWithAudio) {
          return {
            text: anyWithAudio.text || '',
            audio: anyWithAudio.audio
          };
        }
        
        // Cuối cùng, lấy mục đầu tiên có phiên âm text
        const anyWithText = phonetics.find(p => p.text);
        if (anyWithText) {
          return {
            text: anyWithText.text,
            audio: anyWithText.audio || ''
          };
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error retrieving pronunciation:', error);
    return null;
  }
}

// Thêm hàm wrapper an toàn cho sendMessage
function sendMessageToTabSafely(tabId, message) {
  // Nếu ở chế độ đơn giản hóa, chỉ ghi log và không gửi tin nhắn
  if (SIMPLIFIED_MODE) {
    console.log('Simplified mode: Would have sent message to tab', tabId, message);
    return Promise.resolve(null);
  }
  
  // Nếu không ở chế độ đơn giản hóa, gửi tin nhắn bình thường với error handling
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(tabId, message, function(response) {
        if (chrome.runtime.lastError) {
          console.warn(`Error sending message to tab ${tabId}:`, chrome.runtime.lastError);
          resolve(null);
        } else {
          resolve(response);
        }
      });
    } catch (error) {
      console.warn(`Exception sending message to tab ${tabId}:`, error);
      resolve(null);
    }
  });
}

// Thay thế các hàm hiện tại sử dụng chrome.tabs.sendMessage
// Tìm và thay thế hàm saveWordWithAutoTranslation

async function saveWordWithAutoTranslation(text, categoryId, tab) {
  try {
    // Tìm thông tin category để lấy ngôn ngữ nguồn và đích
    let category = categories.find(cat => cat.id === categoryId);
    
    // Nếu không tìm thấy category, thử dùng category default
    if (!category) {
      console.warn('Category not found with ID:', categoryId, 'Falling back to default category');
      category = categories.find(cat => cat.id === 'default');
      
      // Nếu vẫn không tìm thấy, tạo mới category default
      if (!category) {
        console.warn('Default category not found, creating it');
        category = { 
          id: 'default', 
          name: 'Default',
          sourceLanguage: 'en',
          targetLanguage: 'vi'
        };
        
        // Thêm category default vào danh sách
        categories.push(category);
        await new Promise(resolve => {
          chrome.storage.local.set({
            'vocabulary-categories': JSON.stringify(categories)
          }, resolve);
        });
      }
      // Cập nhật categoryId
      categoryId = 'default';
    }
    
    console.log(`Translating selected word: "${text}" with category ${category.name}`);
    console.log('Source language:', category.sourceLanguage, 'Target language:', category.targetLanguage);
    
    // Chế độ đơn giản hóa: Chỉ ghi log thay vì hiển thị thông báo
    if (SIMPLIFIED_MODE) {
      console.log(`Simplified mode: Would show 'Translating "${text}" in "${category.name}" category' notification`);
    } else {
      // Code gốc gửi tin nhắn đến content script ở đây
      try {
        await sendMessageToTabSafely(tab.id, {
          action: 'showTranslatingNotification',
          word: text,
          categoryName: category.name,
          sourceLanguage: category.sourceLanguage,
          targetLanguage: category.targetLanguage
        });
      } catch (notificationError) {
        console.warn('Could not show translating notification:', notificationError);
      }
    }
    
    // Dịch nghĩa tự động với timeout
    let meaning = '';
    let translatedBy = 'Google Translate';
    
    try {
      // Thêm timeout để đảm bảo không chờ quá lâu
      const translatePromise = getAutoMeaning(text, category);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Translation timeout after 8 seconds')), 8000)
      );
      
      // Chọn promise nào hoàn thành trước
      const result = await Promise.race([translatePromise, timeoutPromise]);
      
      meaning = result.meaning;
      translatedBy = getServiceName(result.service);
      console.log('Translation result from context menu:', meaning, '(by', translatedBy, ')');
    } catch (error) {
      console.error('Error during automatic translation from context menu:', error);
      
      // Thử lại với Google Translate nếu dịch vụ khác thất bại
      try {
        if (category.sourceLanguage && category.targetLanguage) {
          const fallbackTranslation = await translateText(text, category.sourceLanguage, category.targetLanguage);
          if (fallbackTranslation) {
            meaning = fallbackTranslation;
            translatedBy = 'Google Translate (Fallback)';
            console.log('Fallback translation result:', meaning);
          } else {
            meaning = `${text} (could not translate)`;
            translatedBy = 'error';
          }
        } else {
          meaning = `${text} (could not translate)`;
          translatedBy = 'error';
        }
      } catch (fallbackError) {
        console.error('Fallback translation also failed:', fallbackError);
        meaning = `${text} (could not translate)`;
        translatedBy = 'error';
      }
    }
    
    // Lưu từ với nghĩa đã dịch
    saveWord(text, meaning, categoryId, tab, translatedBy);
  } catch (error) {
    console.error('Error in saveWordWithAutoTranslation:', error);
    // Fallback: lưu từ không có nghĩa
    saveWord(text, '', 'default', tab);
  }
}

// Thay thế hàm saveWord
async function saveWord(text, meaning, categoryId, tab, translatedBy = null) {
  try {
    console.log(`Saving word "${text}" with meaning "${meaning}" to category ID: ${categoryId}`);
    
    // Chuẩn bị dữ liệu từ vựng
    const word = {
      id: Date.now().toString(), // Dùng timestamp làm ID
      text: text,
      meaning: meaning,
      createdAt: Date.now(),
      categoryId: categoryId || 'default', // Đảm bảo luôn có categoryId
      translatedBy: translatedBy || null
    };
    
    // Kiểm tra xem category có tồn tại không
    const categoryExists = categories.some(cat => cat.id === categoryId);
    if (!categoryExists) {
      console.warn(`Category with ID ${categoryId} not found, using default category`);
      word.categoryId = 'default';
      
      // Kiểm tra xem danh mục default có tồn tại không
      const hasDefaultCategory = categories.some(cat => cat.id === 'default');
      if (!hasDefaultCategory) {
        console.warn('Default category not found, creating it');
        const defaultCategory = { 
          id: 'default', 
          name: 'Default',
          sourceLanguage: 'en',
          targetLanguage: 'vi'
        };
        
        // Thêm danh mục default và lưu lại
        categories.push(defaultCategory);
        await new Promise(resolve => {
          chrome.storage.local.set({
            'vocabulary-categories': JSON.stringify(categories)
          }, resolve);
        });
      }
    }
    
    // Thử lấy phiên âm cho từ vựng nếu là tiếng Anh
    const category = categories.find(cat => cat.id === word.categoryId);
    if (category && category.sourceLanguage === 'en') {
      try {
        const pronunciation = await getPronunciation(text);
        if (pronunciation) {
          // Thêm thông tin phiên âm vào từ vựng
          word.pronunciation = pronunciation;
        }
      } catch (pronunciationError) {
        console.warn('Error getting pronunciation:', pronunciationError);
        // Vẫn tiếp tục lưu từ vựng, chỉ bỏ qua phần phiên âm
      }
    }
    
    // Thêm từ vựng vào danh sách
    chrome.storage.local.get(['vocabulary-words'], function(result) {
      let words = [];
      
      if (result['vocabulary-words']) {
        words = JSON.parse(result['vocabulary-words']);
      }
      
      // Thêm từ mới vào danh sách
      words.push(word);
      
      // Lưu danh sách cập nhật vào storage
      chrome.storage.local.set({
        'vocabulary-words': JSON.stringify(words)
      }, function() {
        console.log('Word saved successfully:', word);
        
        // Chế độ đơn giản hóa: Chỉ ghi log thay vì hiển thị thông báo
        if (SIMPLIFIED_MODE) {
          console.log(`Simplified mode: Would show 'Saved "${text}" to "${category?.name || 'Default'}" category' notification`);
        } else {
          // Hiển thị thông báo cho người dùng
          sendMessageToTabSafely(tab.id, {
            action: 'showSavedNotification',
            word: word
          });
        }
      });
    });
  } catch (error) {
    console.error('Error in saveWord function:', error);
    
    // Trong trường hợp lỗi nghiêm trọng, thử lưu từ một cách đơn giản nhất
    saveWordWithoutPronunciation(text, meaning, 'default', tab, translatedBy);
  }
}

// Thay thế hàm saveWordWithoutPronunciation
function saveWordWithoutPronunciation(text, meaning, categoryId, tab, translatedBy = null) {
  return new Promise((resolve, reject) => {
    try {
      // Lấy thông tin danh mục
      const category = categories.find(cat => cat.id === categoryId);
      const categoryName = category?.name || 'Default';
      const sourceLanguage = category?.sourceLanguage || 'en';
      const targetLanguage = category?.targetLanguage || 'vi';
      
      chrome.storage.local.get(['vocabulary-words'], function(result) {
        let words = [];
        
        if (result['vocabulary-words']) {
          try {
            words = JSON.parse(result['vocabulary-words']);
          } catch (parseError) {
            console.error('Error parsing vocabulary words:', parseError);
            words = [];
          }
        }
        
        // Tạo đối tượng từ vựng mới không có phiên âm
        const newWord = {
          id: Date.now().toString(),
          text: text,
          meaning: meaning,
          categoryId: categoryId,
          createdAt: Date.now(),
          translatedBy: translatedBy
        };
        
        // Thêm vào mảng và lưu
        words.push(newWord);
        
        // Lưu danh sách từ vựng
        chrome.storage.local.set({
          'vocabulary-words': JSON.stringify(words)
        }, function() {
          console.log('Word saved using fallback method:', newWord);
          
          // Chế độ đơn giản hóa: Chỉ ghi log thay vì hiển thị thông báo
          if (SIMPLIFIED_MODE) {
            console.log(`Simplified mode: Would show 'Saved "${text}" to "${categoryName}" category' notification`);
            resolve(newWord);
          } else {
            // Hiển thị thông báo cho người dùng
            try {
              sendMessageToTabSafely(tab.id, {
                action: 'showSavedNotification',
                word: newWord
              }).then(() => {
                resolve(newWord);
              });
            } catch (error) {
              console.warn('Error showing notification in fallback save:', error);
              resolve(newWord); // Still resolve to maintain the flow
            }
          }
        });
      });
    } catch (error) {
      console.error('Error in saveWordWithoutPronunciation:', error);
      reject(error);
    }
  });
}

// Hàm chuyển đổi mã dịch vụ thành tên hiển thị
function getServiceName(serviceCode) {
  switch (serviceCode) {
    case 'openai': return 'OpenAI';
    case 'gemini': return 'Google Gemini';
    case 'deepseek': return 'DeepSeek AI';
    case 'grok': return 'Grok AI';
    case 'google': return 'Google Translate';
    case 'dictionary': return 'Dictionary';
    case 'error': return 'Translation Error';
    default: return serviceCode;
  }
}

// Lắng nghe tin nhắn từ popup và content script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  // Ping để kiểm tra kết nối
  if (request.action === 'ping') {
    sendResponse({ status: 'connected' });
    return true;
  }
  
  // Yêu cầu dịch từ
  if (request.action === 'translateWord') {
    console.log("Translating word:", request.text, "with category:", request.category);
    
    // Kiểm tra dữ liệu đầu vào
    if (!request.text || !request.category) {
      sendResponse({ 
        success: false, 
        error: 'Missing required data'
      });
      return true;
    }
    
    // Dịch từ và trả về kết quả
    getAutoMeaning(request.text, request.category)
      .then(result => {
        if (result && result.meaning) {
          sendResponse({ 
            success: true, 
            meaning: result.meaning,
            translatedBy: result.service
          });
        } else {
          console.warn("Could not find suitable translation");
          sendResponse({ 
            success: false, 
            error: "Could not translate this word",
            fallbackMeaning: `${request.text} (could not translate)`,
            translatedBy: 'error'
          });
        }
      })
      .catch(error => {
        console.error("Error translating word:", error);
        sendResponse({ 
          success: false, 
          error: error.message || "Unknown error during translation",
          fallbackMeaning: `${request.text} (translation error)`,
          translatedBy: 'error'
        });
      });
    
    return true; // Indicates an async response
  }
});

// Hàm lấy định nghĩa từ từ điển (cho tiếng Anh)
async function getDefinitionFromDictionary(word) {
  // Chỉ có Free Dictionary API cho tiếng Anh
  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    
    // Kiểm tra nếu có dữ liệu định nghĩa
    if (data && data.length > 0) {
      const meaning = data[0].meanings;
      if (meaning && meaning.length > 0) {
        const definitions = meaning[0].definitions;
        if (definitions && definitions.length > 0) {
          return definitions[0].definition;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error retrieving definition:', error);
    return null;
  }
}

// Hàm dịch tự động dựa trên cài đặt ngôn ngữ của danh mục
async function getAutoMeaning(text, category) {
  const sourceLanguage = category.sourceLanguage || 'en';
  const targetLanguage = category.targetLanguage || 'vi';
  
  try {
    // Kiểm tra thiết lập API dịch nghĩa
    const apiSettingsResult = await new Promise(resolve => {
      chrome.storage.local.get(['vocabulary-api-settings'], resolve);
    });
    
    let translationService = 'google'; // Default is Google Translate
    let apiSettings = null;
    
    if (apiSettingsResult['vocabulary-api-settings']) {
      const settings = JSON.parse(apiSettingsResult['vocabulary-api-settings']);
      translationService = settings.service || 'google';
      apiSettings = settings;
    }
    
    console.log(`Selected translation service: ${translationService} for word "${text}"`);
    let translation = null;
    let serviceUsed = translationService;
    
    // Nếu nguồn là tiếng Anh, ưu tiên sử dụng định nghĩa từ từ điển
    if (sourceLanguage === 'en') {
      // Thử lấy định nghĩa từ từ điển
      const definition = await getDefinitionFromDictionary(text);
      if (definition) {
        // Nếu ngôn ngữ đích cũng là tiếng Anh, trả về định nghĩa luôn
        if (targetLanguage === 'en') {
          return {
            meaning: definition,
            service: 'dictionary'
          };
        }
        
        // Nếu đích là ngôn ngữ khác, dịch định nghĩa sang ngôn ngữ đích
        try {
          // Dịch định nghĩa bằng dịch vụ đã chọn
          translation = await translateWithSelectedService(
            definition, 
            'en', 
            targetLanguage, 
            translationService, 
            apiSettings
          );
          return {
            meaning: translation,
            service: serviceUsed
          };
        } catch (error) {
          // Nếu có lỗi khi dịch định nghĩa, thử dịch từ gốc
          console.error('Error translating definition, falling back to word translation:', error);
        }
      }
    }
    
    // Dùng dịch vụ được chọn để dịch từ
    try {
      translation = await translateWithSelectedService(
        text, 
        sourceLanguage, 
        targetLanguage, 
        translationService, 
        apiSettings
      );
      
      if (!translation) {
        throw new Error('Empty translation result');
      }
      
      return {
        meaning: translation,
        service: serviceUsed
      };
    } catch (error) {
      console.error(`Error with ${translationService}, falling back to Google Translate:`, error);
      
      // Nếu dịch vụ được chọn không phải Google Translate và bị lỗi, thử dùng Google
      if (translationService !== 'google') {
        try {
          translation = await translateText(text, sourceLanguage, targetLanguage);
          if (translation) {
            return {
              meaning: translation,
              service: 'google'
            };
          }
        } catch (googleError) {
          console.error('Google Translate fallback also failed:', googleError);
        }
      }
      
      // Nếu vẫn không dịch được, trả về thông báo lỗi
      return {
        meaning: `${text} (translation error)`,
        service: 'error'
      };
    }
  } catch (error) {
    console.error('Error in getAutoMeaning:', error);
    return {
      meaning: `${text} (could not translate: ${error.message})`,
      service: 'error'
    };
  }
}

// Hàm dịch văn bản với dịch vụ được chọn
async function translateWithSelectedService(text, sourceLang, targetLang, service, apiSettings) {
  if (!text) {
    console.error('translateWithSelectedService: No text to translate');
    return null;
  }
  
  console.log(`Translating with service: ${service}, from ${sourceLang} to ${targetLang}`);
  
  // Validate API service and settings
  if (service !== 'google') {
    if (!apiSettings || !apiSettings[service] || !apiSettings[service].apiKey) {
      console.warn(`Missing or invalid API settings for ${service}, falling back to Google Translate`);
      return await translateText(text, sourceLang, targetLang);
    }
  }
  
  // Maximum number of retries for any service
  const MAX_RETRIES = 2;
  let lastError = null;
  
  // Set timeout for API calls to avoid hanging
  const TIMEOUT_MS = 5000;
  
  for (let retry = 0; retry < MAX_RETRIES; retry++) {
    try {
      let translationPromise;
      
      switch (service) {
        case 'openai':
          translationPromise = translateWithOpenAI(text, sourceLang, targetLang, apiSettings.openai);
          break;
        case 'gemini':
          translationPromise = translateWithGemini(text, sourceLang, targetLang, apiSettings.gemini);
          break;
        case 'deepseek':
          translationPromise = translateWithDeepseek(text, sourceLang, targetLang, apiSettings.deepseek);
          break;
        case 'grok':
          translationPromise = translateWithGrok(text, sourceLang, targetLang, apiSettings.grok);
          break;
        case 'google':
        default:
          // Fallback to Google Translate
          translationPromise = translateText(text, sourceLang, targetLang);
          break;
      }
      
      // Add timeout to avoid hanging on API calls
      const result = await Promise.race([
        translationPromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`${service} API call timed out after ${TIMEOUT_MS}ms`)), TIMEOUT_MS)
        )
      ]);
      
      // If we got a result, process it to ensure it's concise
      if (result) {
        // Make sure the result is not too long (max 150 chars)
        const shortResult = result.length > 150 ? result.substring(0, 147) + '...' : result;
        console.log(`Translation successful with ${service}: "${shortResult}"`);
        return shortResult;
      }
    } catch (error) {
      lastError = error;
      console.warn(`Translation attempt ${retry + 1} failed with service ${service}:`, error);
      
      // Wait before retrying
      if (retry < MAX_RETRIES - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  // If all retries fail, try Google Translate as a backup if not already using it
  if (service !== 'google') {
    try {
      console.log('Falling back to Google Translate after API failures');
      return await translateText(text, sourceLang, targetLang);
    } catch (fallbackError) {
      console.error('Even Google Translate fallback failed:', fallbackError);
      throw lastError; // Throw the original error
    }
  }
  
  throw lastError || new Error('Translation failed after multiple attempts');
}

// Hàm dịch với Google Gemini
async function translateWithGemini(text, sourceLang, targetLang, settings) {
  if (!settings || !settings.apiKey) {
    throw new Error('Missing Gemini API key');
  }
  
  const languageMap = {
    'en': 'English',
    'vi': 'Vietnamese',
    'zh': 'Chinese',
    'fr': 'French',
    'de': 'German',
    'ja': 'Japanese',
    'ko': 'Korean',
    'es': 'Spanish',
    'it': 'Italian',
    'ru': 'Russian',
    'pt': 'Portuguese'
  };
  
  const sourceLanguage = languageMap[sourceLang] || sourceLang;
  const targetLanguage = languageMap[targetLang] || targetLang;
  
  // Sử dụng mô hình gemini-2.0-flash (Gemini 2) nếu có, ngược lại sử dụng model đã chọn
  const modelToUse = settings.model === 'gemini-2.0-flash' ? 'gemini-2.0-flash' : (settings.model || 'gemini-pro');
  
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${settings.apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `Translate this text from ${sourceLanguage} to ${targetLanguage}. Provide only the translation, no additional text, no explanations, and no quotation marks: "${text}"`
        }]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 50
      }
    })
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || `Gemini API request failed with status ${response.status}`);
  }
  
  const data = await response.json();
  // Xử lý phản hồi từ Gemini 2.0 (hoặc các phiên bản khác)
  let translation;
  
  if (data.candidates && data.candidates[0]) {
    if (data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
      translation = data.candidates[0].content.parts[0].text?.trim();
    }
  }
  
  if (!translation) {
    throw new Error('No translation received from Gemini');
  }
  
  // Remove any quotation marks from the response
  translation = translation.replace(/^["']|["']$/g, '');
  
  return translation;
}

// Hàm dịch với OpenAI
async function translateWithOpenAI(text, sourceLang, targetLang, settings) {
  if (!settings || !settings.apiKey) {
    throw new Error('Missing OpenAI API key');
  }
  
  const languageMap = {
    'en': 'English',
    'vi': 'Vietnamese',
    'zh': 'Chinese',
    'fr': 'French',
    'de': 'German',
    'ja': 'Japanese',
    'ko': 'Korean',
    'es': 'Spanish',
    'it': 'Italian',
    'ru': 'Russian',
    'pt': 'Portuguese'
  };
  
  const sourceLanguage = languageMap[sourceLang] || sourceLang;
  const targetLanguage = languageMap[targetLang] || targetLang;
  
  try {
    // Sử dụng API chính thức của OpenAI - cập nhật theo hướng dẫn từ trang chủ
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: `You are a precise translator. Translate from ${sourceLanguage} to ${targetLanguage}. Be extremely concise - provide ONLY the direct translation with no explanations, no additional context, and no quotation marks. Maximum 1-3 words unless translating a phrase.` 
          },
          { 
            role: 'user', 
            content: `"${text}"` 
          }
        ],
        max_tokens: 50,
        temperature: 0.1
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      const errorMessage = errorData.error?.message || `OpenAI API request failed with status ${response.status}`;
      
      // Kiểm tra nếu lỗi là vượt quá hạn mức (quota)
      if (errorMessage.includes("exceeded your current quota") || 
          errorMessage.includes("billing") || 
          errorMessage.includes("limit")) {
        console.warn("OpenAI quota exceeded, falling back to Google Translate:", errorMessage);
        
        // Sử dụng Google Translate làm fallback
        return await translateText(text, sourceLang, targetLang);
      }
      
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    let translation = data.choices[0]?.message?.content?.trim();
    
    if (!translation) {
      throw new Error('No translation received from OpenAI');
    }
    
    // Remove any quotation marks from the response
    translation = translation.replace(/^["']|["']$/g, '');
    
    return translation;
  } catch (error) {
    // Nếu lỗi khác, kiểm tra lỗi network  
    if (error.message.includes("Failed to fetch") || error.message.includes("Network Error")) {
      console.warn("OpenAI network error, falling back to Google Translate");
      return await translateText(text, sourceLang, targetLang);
    }
    
    // Ném lỗi để xử lý ở cấp cao hơn
    throw error;
  }
}

// Hàm dịch với Grok
async function translateWithGrok(text, sourceLang, targetLang, settings) {
  if (!settings || !settings.apiKey) {
    throw new Error('Missing Grok API key');
  }
  
  const languageMap = {
    'en': 'English',
    'vi': 'Vietnamese',
    'zh': 'Chinese',
    'fr': 'French',
    'de': 'German',
    'ja': 'Japanese',
    'ko': 'Korean',
    'es': 'Spanish',
    'it': 'Italian',
    'ru': 'Russian',
    'pt': 'Portuguese'
  };
  
  const sourceLanguage = languageMap[sourceLang] || sourceLang;
  const targetLanguage = languageMap[targetLang] || targetLang;
  
  // Cập nhật URL và model thành grok-2-latest
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({
      model: 'grok-2-latest',
      messages: [
        { 
          role: 'system', 
          content: `You are a precise translator. Translate from ${sourceLanguage} to ${targetLanguage}. Be extremely concise - provide ONLY the direct translation with no explanations, no additional context, and no quotation marks. Maximum 1-3 words unless translating a phrase.` 
        },
        { 
          role: 'user', 
          content: `"${text}"` 
        }
      ],
      max_tokens: 50,
      temperature: 0.1,
      stream: false
    })
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || `Grok API request failed with status ${response.status}`);
  }
  
  const data = await response.json();
  let translation = data.choices[0]?.message?.content?.trim();
  
  if (!translation) {
    throw new Error('No translation received from Grok');
  }
  
  // Remove any quotation marks from the response
  translation = translation.replace(/^["']|["']$/g, '');
  
  return translation;
}

// Hàm dịch với DeepSeek
async function translateWithDeepseek(text, sourceLang, targetLang, settings) {
  if (!settings || !settings.apiKey) {
    throw new Error('Missing DeepSeek API key');
  }
  
  const languageMap = {
    'en': 'English',
    'vi': 'Vietnamese',
    'zh': 'Chinese',
    'fr': 'French',
    'de': 'German',
    'ja': 'Japanese',
    'ko': 'Korean',
    'es': 'Spanish',
    'it': 'Italian',
    'ru': 'Russian',
    'pt': 'Portuguese'
  };
  
  const sourceLanguage = languageMap[sourceLang] || sourceLang;
  const targetLanguage = languageMap[targetLang] || targetLang;
  
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({
      model: settings.model || 'deepseek-chat',
      messages: [
        { 
          role: 'system', 
          content: `You are a precise translator. Translate from ${sourceLanguage} to ${targetLanguage}. Be extremely concise - provide ONLY the direct translation with no explanations, no additional context, and no quotation marks. Maximum 1-3 words unless translating a phrase.` 
        },
        { 
          role: 'user', 
          content: `"${text}"` 
        }
      ],
      max_tokens: 50,  // Reduced max tokens
      temperature: 0.1 // Lower temperature for more predictable outputs
    })
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || `DeepSeek API request failed with status ${response.status}`);
  }
  
  const data = await response.json();
  let translation = data.choices[0]?.message?.content?.trim();
  
  if (!translation) {
    throw new Error('No translation received from DeepSeek');
  }
  
  // Remove any quotation marks from the response
  translation = translation.replace(/^["']|["']$/g, '');
  
  // Limit length for conciseness since DeepSeek tends to be verbose
  if (translation.length > 100) {
    translation = translation.substring(0, 97) + '...';
  }
  
  return translation;
}

// Hàm dịch văn bản sử dụng Google Translate API
async function translateText(text, sourceLang, targetLang) {
  if (!text) {
    console.error('translateText: No text to translate');
    return null;
  }
  
  try {
    // Sử dụng API Google Translate không chính thức (miễn phí)
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Translation API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Xử lý kết quả dịch
    let translation = '';
    
    if (data && data[0] && data[0].length > 0) {
      // Kết hợp tất cả các đoạn dịch
      data[0].forEach(item => {
        if (item[0]) {
          translation += item[0];
        }
      });
      
      return translation.trim();
    }
    
    console.warn('No suitable translation result found from Google API');
    return null;
  } catch (error) {
    console.error('Error during translation:', error);
    throw new Error(`Could not translate text: ${error.message}`);
  }
} 