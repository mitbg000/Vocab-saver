// Thông báo content script đã được tải
console.log("Vocab Saver: Content script loaded");

// Biến flag để theo dõi xem thông báo có đang được hiển thị hay không
let notificationActive = false;
let notificationRetryCount = 0;
const MAX_RETRIES = 3;

// Kiểm tra kết nối đến background script
checkBackgroundConnection();

// Hàm kiểm tra kết nối đến background script
function checkBackgroundConnection() {
  chrome.runtime.sendMessage({action: 'ping'}, function(response) {
    if (chrome.runtime.lastError) {
      console.warn('Vocab Saver: Unable to connect to background script', chrome.runtime.lastError);
      // Thử lại sau 2 giây nếu kết nối thất bại
      setTimeout(checkBackgroundConnection, 2000);
    } else {
      console.log('Vocab Saver: Successfully connected to background script', response);
    }
  });
}

// Lắng nghe sự kiện nhấn đúp chuột để gửi văn bản đến popup
document.addEventListener('dblclick', function (event) {
  const selection = window.getSelection().toString().trim();
  
  if (selection) {
    // Gửi văn bản đã chọn đến popup
    chrome.runtime.sendMessage({
      action: 'textSelected',
      text: selection
    });
  }
});

// Lắng nghe phím tắt Ctrl+Shift+S để lưu từ vựng hiện tại
document.addEventListener('keydown', function (event) {
  // Phím tắt Ctrl+Shift+S (hoặc Command+Shift+S trên Mac)
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 's') {
    event.preventDefault(); // Prevent browser from saving the page
    
    const selection = window.getSelection().toString().trim();
    if (selection) {
      // Cannot directly open context menu at cursor position
      // Instead, send a notification to guide user to use right-click
      showHelpNotification();
    }
  }
});

// Hiển thị thông báo hướng dẫn
function showHelpNotification() {
  const notification = document.createElement('div');
  notification.textContent = 'Right-click and select "Save vocabulary" to save the selected word';
  notification.id = 'vocab-help-notification';
  
  // Style thông báo
  Object.assign(notification.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    backgroundColor: '#2563eb',
    color: 'white',
    padding: '12px 16px',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    zIndex: '10000',
    fontSize: '14px',
    fontWeight: 'bold'
  });
  
  // Add to page
  document.body.appendChild(notification);
  
  // Remove notification after 3 seconds
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// Hiển thị thông báo đang dịch từ vựng
function showTranslatingNotification(word, categoryName, sourceLang = null, targetLang = null) {
  try {
    // Đánh dấu thông báo đang hoạt động
    notificationActive = true;
    
    // Xóa thông báo cũ nếu có
    clearExistingNotifications();
    
    // Tạo thông báo
    const notification = document.createElement('div');
    const container = document.createElement('div');
    notification.appendChild(container);
    
    // Thêm nội dung thông báo
    const mainText = document.createElement('div');
    mainText.textContent = `Translating "${word}" to save in "${categoryName}" category...`;
    container.appendChild(mainText);
    
    // Thêm animation loading
    const loadingIndicator = document.createElement('div');
    loadingIndicator.style.width = '100%';
    loadingIndicator.style.height = '3px';
    loadingIndicator.style.backgroundColor = 'rgba(255,255,255,0.3)';
    loadingIndicator.style.marginTop = '8px';
    loadingIndicator.style.borderRadius = '2px';
    loadingIndicator.style.overflow = 'hidden';
    loadingIndicator.innerHTML = '<div style="width: 30%; height: 100%; background-color: white; border-radius: 2px; animation: slide 1.5s infinite;"></div>';
    container.appendChild(loadingIndicator);
    
    // Thêm style animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slide {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(300%); }
      }
    `;
    document.head.appendChild(style);
    
    // Hiển thị thông tin ngôn ngữ nếu có
    if (sourceLang && targetLang) {
      const languageInfo = document.createElement('div');
      languageInfo.textContent = `${getLanguageName(sourceLang)} → ${getLanguageName(targetLang)}`;
      languageInfo.style.fontSize = '12px';
      languageInfo.style.marginTop = '4px';
      languageInfo.style.opacity = '0.8';
      container.appendChild(languageInfo);
    }
    
    notification.id = 'vocab-translating-notification';
    
    // Style thông báo
    Object.assign(notification.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      backgroundColor: '#3b82f6',
      color: 'white',
      padding: '12px 16px',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      zIndex: '10000',
      fontSize: '14px',
      fontWeight: 'bold',
      maxWidth: '300px'
    });
    
    // Thêm vào trang
    document.body.appendChild(notification);
    
    // Thiết lập timeout để xóa thông báo sau 10 giây nếu không có phản hồi từ server
    setTimeout(() => {
      if (document.getElementById('vocab-translating-notification')) {
        // Vẫn còn thông báo dịch, tức là chưa nhận được kết quả
        const fallbackNotification = document.getElementById('vocab-translating-notification');
        if (fallbackNotification) {
          fallbackNotification.remove();
          // Hiển thị thông báo lỗi
          showSaveNotification(
            word, 
            categoryName, 
            "(Translation timeout, saved without meaning)", 
            null, 
            sourceLang, 
            targetLang, 
            "Timeout Error"
          );
        }
      }
      notificationActive = false;
    }, 10000);
    
    // Trả về thông báo để có thể xóa sau khi hoàn thành
    return notification;
  } catch (error) {
    console.error('Error showing translating notification:', error);
    return null;
  }
}

// Xóa tất cả thông báo hiện có
function clearExistingNotifications() {
  // Xóa thông báo đang dịch
  const translatingNotification = document.getElementById('vocab-translating-notification');
  if (translatingNotification) {
    translatingNotification.remove();
  }
  
  // Xóa thông báo đã lưu
  const saveNotification = document.getElementById('vocab-save-notification');
  if (saveNotification) {
    saveNotification.remove();
  }
  
  // Xóa thông báo trợ giúp
  const helpNotification = document.getElementById('vocab-help-notification');
  if (helpNotification) {
    helpNotification.remove();
  }
}

// Hàm helper để hiển thị tên ngôn ngữ
function getLanguageName(langCode) {
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
  
  return languageMap[langCode] || langCode;
}

// Hiển thị thông báo đã lưu từ vựng
function showSaveNotification(word, categoryName, meaning = '', pronunciation = null, sourceLang = null, targetLang = null, translatedBy = null) {
  try {
    // Reset trạng thái thông báo
    notificationActive = false;
    
    // Xóa thông báo đang hiển thị nếu có
    clearExistingNotifications();
    
    // Tạo thông báo
    const notification = document.createElement('div');
    
    // Tạo container để có thể style nội dung
    const container = document.createElement('div');
    notification.appendChild(container);
    
    // Thêm từ vựng và danh mục
    const wordInfo = document.createElement('div');
    const wordElement = document.createElement('span');
    wordElement.textContent = `Saved "${word}"`;
    wordInfo.appendChild(wordElement);
    
    // Thêm phiên âm nếu có
    if (pronunciation && pronunciation.text) {
      const pronElement = document.createElement('span');
      pronElement.textContent = ` ${pronunciation.text}`;
      pronElement.style.color = '#e2e8f0';
      pronElement.style.fontSize = '13px';
      pronElement.style.marginLeft = '4px';
      wordInfo.appendChild(pronElement);
    }
    
    // Thêm thông tin danh mục
    const catElement = document.createElement('span');
    catElement.textContent = ` to "${categoryName}" category`;
    wordInfo.appendChild(catElement);
    
    wordInfo.style.marginBottom = (meaning || (sourceLang && targetLang) || translatedBy) ? '4px' : '0';
    container.appendChild(wordInfo);
    
    // Thêm thông tin ngôn ngữ nếu có
    if (sourceLang && targetLang) {
      const langInfo = document.createElement('div');
      langInfo.textContent = `${getLanguageName(sourceLang)} → ${getLanguageName(targetLang)}`;
      langInfo.style.fontSize = '12px';
      langInfo.style.opacity = '0.9';
      langInfo.style.marginBottom = (meaning || translatedBy) ? '4px' : '0';
      container.appendChild(langInfo);
    }
    
    // Thêm nghĩa nếu có
    if (meaning) {
      const meaningElement = document.createElement('div');
      meaningElement.textContent = `Meaning: ${meaning}`;
      meaningElement.style.fontSize = '12px';
      meaningElement.style.opacity = '0.9';
      meaningElement.style.marginBottom = translatedBy ? '4px' : '0';
      container.appendChild(meaningElement);
    }
    
    // Thêm thông tin dịch vụ nếu có
    if (translatedBy) {
      const translatedByElement = document.createElement('div');
      translatedByElement.textContent = `Translated by: ${translatedBy}`;
      translatedByElement.style.fontSize = '11px';
      translatedByElement.style.opacity = '0.8';
      translatedByElement.style.fontStyle = 'italic';
      container.appendChild(translatedByElement);
    }
    
    notification.id = 'vocab-save-notification';
    
    // Style thông báo
    Object.assign(notification.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      backgroundColor: '#10b981',
      color: 'white',
      padding: '12px 16px',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      zIndex: '10000',
      fontSize: '14px',
      fontWeight: 'bold',
      maxWidth: '300px'
    });
    
    // Thêm vào trang
    document.body.appendChild(notification);
    
    // Xóa thông báo sau 5 giây (thêm thời gian để người dùng đọc nghĩa)
    setTimeout(() => {
      if (notification && notification.parentNode) {
        notification.remove();
      }
    }, 5000); // Tăng thời gian hiển thị lên 5 giây
  } catch (error) {
    console.error('Error showing save notification:', error);
    // Nếu có lỗi, hiển thị thông báo đơn giản
    showSimpleSaveNotification(word, categoryName);
  }
}

// Hiển thị thông báo đơn giản khi có lỗi
function showSimpleSaveNotification(word, categoryName) {
  try {
    const notification = document.createElement('div');
    notification.textContent = `Saved "${word}" to "${categoryName}" category`;
    notification.id = 'vocab-save-notification';
    
    Object.assign(notification.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      backgroundColor: '#10b981',
      color: 'white',
      padding: '12px 16px',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      zIndex: '10000',
      fontSize: '14px',
      fontWeight: 'bold'
    });
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification && notification.parentNode) {
        notification.remove();
      }
    }, 5000);
  } catch (error) {
    console.error('Even simple notification failed:', error);
  }
}

// Lắng nghe thông điệp từ background script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  try {
    // Xử lý yêu cầu lấy văn bản đã chọn
    if (request.action === 'getSelectedText') {
      sendResponse({ selectedText: window.getSelection().toString().trim() });
      return true;
    }
    
    // Xử lý yêu cầu hiển thị thông báo đang dịch
    if (request.action === 'showTranslatingNotification') {
      notificationRetryCount = 0;
      showTranslatingNotification(
        request.word, 
        request.categoryName,
        request.sourceLanguage,
        request.targetLanguage
      );
      sendResponse({ success: true });
      return true;
    }
    
    // Xử lý yêu cầu hiển thị thông báo đã lưu
    if (request.action === 'showSaveNotification') {
      showSaveNotification(
        request.word,
        request.categoryName,
        request.meaning,
        request.pronunciation,
        request.sourceLanguage,
        request.targetLanguage,
        request.translatedBy
      );
      sendResponse({ success: true });
      return true;
    }
  } catch (error) {
    console.error('Error processing message:', error);
    sendResponse({ success: false, error: error.message });
    return true;
  }
});

// Kiểm tra lại kết nối định kỳ mỗi 30 giây
setInterval(checkBackgroundConnection, 30000);