// Khai báo các hàm hỗ trợ cho phiên âm
// Sử dụng 3 nguồn phát âm theo thứ tự ưu tiên:
// 1. Free Dictionary API (không cần API key)
// 2. Google Text-to-Speech (không cần API key)
// 3. Browser Speech Synthesis API (sử dụng tính năng có sẵn của trình duyệt)

// Hàm kiểm tra xem extension context có hợp lệ không
function isExtensionContextValid() {
  try {
    // Kiểm tra xem chrome.runtime.id có tồn tại và không bị lỗi khi truy cập
    return chrome.runtime && chrome.runtime.id;
  } catch (e) {
    console.error('Extension context invalidated:', e);
    return false;
  }
}

// Hàm lấy phiên âm từ từ điển
async function getPronunciation(word) {
  // Mảng lưu các lỗi để debug
  const errors = [];
  
  try {
    // Thử với Free Dictionary API trước (miễn phí và không cần API key)
    console.log("Trying Free Dictionary API for pronunciation...");
    const freeDictResult = await getFreeDictionaryPronunciation(word);
    if (freeDictResult) {
      console.log("Got pronunciation from Free Dictionary API");
      return freeDictResult;
    }
    
    // Sử dụng Google Text-to-Speech làm phương án dự phòng thứ nhất
    console.log("No pronunciation from API, trying Google TTS...");
    const googleTTS = getGoogleTTSPronunciation(word);
    
    // Sử dụng Browser Speech Synthesis làm phương án dự phòng thứ hai
    console.log("Also providing browser speech synthesis as alternative");
    return {
      text: '', // Không có phiên âm text
      audio: googleTTS.audio,
      useBrowserSpeech: true,
      word: word
    };
    
  } catch (error) {
    console.error('Error retrieving pronunciation:', error);
    console.error('Previous errors:', errors);
    
    // Sử dụng Browser Speech Synthesis làm phương án dự phòng cuối cùng
    return {
      text: '',
      audio: '',
      useBrowserSpeech: true,
      word: word
    };
  }
}

// Hàm lấy phiên âm từ Free Dictionary API (hiện tại)
async function getFreeDictionaryPronunciation(word) {
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
            audio: phoneticWithAudio.audio,
            useBrowserSpeech: false
          };
        }
        
        // Nếu không tìm thấy mục có cả hai, ưu tiên lấy mục có audio
        const anyWithAudio = phonetics.find(p => p.audio);
        if (anyWithAudio) {
          return {
            text: anyWithAudio.text || '',
            audio: anyWithAudio.audio,
            useBrowserSpeech: false
          };
        }
        
        // Cuối cùng, lấy mục đầu tiên có phiên âm text
        const anyWithText = phonetics.find(p => p.text);
        if (anyWithText) {
          // Nếu chỉ có text phiên âm, dùng browser speech làm nguồn audio
          return {
            text: anyWithText.text,
            audio: anyWithText.audio || '',
            useBrowserSpeech: true,
            word: word
          };
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error in Free Dictionary API:', error);
    return null;
  }
}

// Hàm lấy phiên âm từ Google TTS (phương án dự phòng)
function getGoogleTTSPronunciation(word) {
  // Google TTS không cung cấp phiên âm text, chỉ có audio
  // Sử dụng API miễn phí của Google TTS
  const audioUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(word)}&tl=en&client=tw-ob`;
  
  return {
    text: '', // Không có phiên âm text
    audio: audioUrl,
    useBrowserSpeech: false
  };
}

// Hàm phát âm từ vựng
function playPronunciation(audioUrl, useBrowserSpeech = false, word = '') {
  // Hiển thị indicator đang tải
  const loadingIndicator = document.createElement('div');
  loadingIndicator.id = 'audio-loading-indicator';
  loadingIndicator.className = 'text-xs text-blue-600 italic';
  loadingIndicator.textContent = 'Loading audio...';
  
  // Thêm vào gần nút phát đã được nhấp
  document.body.appendChild(loadingIndicator);
  
  // Đặt vị trí indicator gần con trỏ chuột
  loadingIndicator.style.position = 'absolute';
  loadingIndicator.style.left = `${event.clientX + 10}px`;
  loadingIndicator.style.top = `${event.clientY + 10}px`;
  loadingIndicator.style.padding = '2px 6px';
  loadingIndicator.style.backgroundColor = '#EDF2F7';
  loadingIndicator.style.borderRadius = '4px';
  loadingIndicator.style.zIndex = '10000';
  
  // Kiểm tra nếu dùng Speech Synthesis của trình duyệt
  if (useBrowserSpeech && 'speechSynthesis' in window) {
    try {
      // Xóa indicator loading
      if (loadingIndicator.parentNode) {
        loadingIndicator.textContent = 'Speaking...';
      }
      
      // Tạo một đối tượng phát âm
      const utterance = new SpeechSynthesisUtterance(word);
      
      // Cấu hình phát âm
      utterance.lang = 'en-US';
      utterance.rate = 0.9; // Tốc độ phát âm hơi chậm
      
      // Tìm giọng tiếng Anh phù hợp
      let voices = speechSynthesis.getVoices();
      
      // Đôi khi, danh sách giọng nói chưa được tải khi chạy lần đầu
      if (voices.length === 0) {
        // Đặt một timeout ngắn để đợi giọng nói tải
        setTimeout(() => {
          voices = speechSynthesis.getVoices();
          // Tìm giọng tiếng Anh
          const englishVoice = voices.find(voice => 
            voice.lang.includes('en-') && voice.localService === true
          ) || voices.find(voice => 
            voice.lang.includes('en-')
          );
          
          if (englishVoice) {
            utterance.voice = englishVoice;
          }
          
          // Phát âm
          speechSynthesis.speak(utterance);
        }, 100);
      } else {
        // Tìm giọng tiếng Anh
        const englishVoice = voices.find(voice => 
          voice.lang.includes('en-') && voice.localService === true
        ) || voices.find(voice => 
          voice.lang.includes('en-')
        );
        
        if (englishVoice) {
          utterance.voice = englishVoice;
        }
        
        // Phát âm
        speechSynthesis.speak(utterance);
      }
      
      // Xử lý sự kiện khi phát âm xong
      utterance.onend = function() {
        if (loadingIndicator.parentNode) {
          loadingIndicator.remove();
        }
      };
      
      // Xử lý sự kiện khi có lỗi
      utterance.onerror = function(error) {
        console.error('Error playing speech:', error);
        if (loadingIndicator.parentNode) {
          loadingIndicator.textContent = 'Speech failed';
          loadingIndicator.className = 'text-xs text-red-600 italic';
          
          // Tự động xóa sau 2 giây
          setTimeout(() => {
            if (loadingIndicator.parentNode) {
              loadingIndicator.remove();
            }
          }, 2000);
        }
      };
      
    } catch (error) {
      console.error('Error with speech synthesis:', error);
      
      // Hiển thị lỗi
      if (loadingIndicator.parentNode) {
        loadingIndicator.textContent = 'Speech synthesis failed';
        loadingIndicator.className = 'text-xs text-red-600 italic';
        
        // Tự động xóa sau 2 giây
        setTimeout(() => {
          if (loadingIndicator.parentNode) {
            loadingIndicator.remove();
          }
        }, 2000);
      }
      
      // Thử dùng audio URL nếu có
      if (audioUrl) {
        playAudioFromUrl(audioUrl, loadingIndicator);
      }
    }
  } else if (audioUrl) {
    // Phát audio từ URL
    playAudioFromUrl(audioUrl, loadingIndicator);
  } else {
    // Không có phương án nào khả dụng
    if (loadingIndicator.parentNode) {
      loadingIndicator.textContent = 'No audio available';
      loadingIndicator.className = 'text-xs text-red-600 italic';
      
      // Tự động xóa sau 2 giây
      setTimeout(() => {
        if (loadingIndicator.parentNode) {
          loadingIndicator.remove();
        }
      }, 2000);
    }
  }
}

// Hàm phụ trợ để phát audio từ URL
function playAudioFromUrl(audioUrl, loadingIndicator) {
  if (!audioUrl) {
    if (loadingIndicator && loadingIndicator.parentNode) {
      loadingIndicator.textContent = 'No audio available';
      loadingIndicator.className = 'text-xs text-red-600 italic';
      setTimeout(() => loadingIndicator.remove(), 2000);
    }
    return;
  }
  
  const audio = new Audio(audioUrl);
  
  // Xử lý sự kiện tải audio
  audio.oncanplaythrough = function() {
    // Xóa indicator khi audio đã tải xong và sẵn sàng phát
    if (loadingIndicator && loadingIndicator.parentNode) {
      loadingIndicator.remove();
    }
  };
  
  // Xử lý lỗi
  audio.onerror = function(error) {
    console.error('Error playing pronunciation:', error);
    
    // Thay đổi thông báo
    if (loadingIndicator && loadingIndicator.parentNode) {
      loadingIndicator.textContent = 'Audio failed to load';
      loadingIndicator.className = 'text-xs text-red-600 italic';
      
      // Tự động xóa sau 2 giây
      setTimeout(() => {
        if (loadingIndicator.parentNode) {
          loadingIndicator.remove();
        }
      }, 2000);
    }
  };
  
  // Bắt đầu tải và phát audio
  audio.play().catch(error => {
    console.error('Error playing pronunciation:', error);
    
    // Xóa indicator nếu có lỗi
    if (loadingIndicator && loadingIndicator.parentNode) {
      loadingIndicator.textContent = 'Audio playback failed';
      loadingIndicator.className = 'text-xs text-red-600 italic';
      
      // Tự động xóa sau 2 giây
      setTimeout(() => {
        if (loadingIndicator.parentNode) {
          loadingIndicator.remove();
        }
      }, 2000);
    }
  });
}

// Tạo phần tử HTML để hiển thị phiên âm và nút phát âm
function createPronunciationElement(pronunciation) {
  const container = document.createElement('div');
  container.className = 'flex items-center space-x-2 text-sm text-muted mt-1';
  
  // Phần hiển thị phiên âm
  if (pronunciation && pronunciation.text) {
    const phoneticText = document.createElement('span');
    phoneticText.textContent = pronunciation.text;
    container.appendChild(phoneticText);
  }
  
  // Luôn tạo nút phát âm, kể cả khi không có pronunciation
  const playButton = document.createElement('button');
  playButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>';
  playButton.className = 'p-1 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200 focus:outline-none';
  playButton.title = 'Listen to pronunciation';
  playButton.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    
    // Phát âm dựa vào nguồn
    if (pronunciation) {
      // Nếu đã được đánh dấu sử dụng browser speech hoặc không có audio URL
      if (pronunciation.useBrowserSpeech || !pronunciation.audio) {
        // Dùng từ vựng hoặc phiên âm để phát âm
        const textToSpeak = pronunciation.word || (pronunciation.text ? pronunciation.text.replace(/[\/\[\]]/g, '') : '');
        if (textToSpeak) {
          playPronunciation('', true, textToSpeak);
        }
      } else {
        playPronunciation(pronunciation.audio, false);
      }
    }
  });
  
  container.appendChild(playButton);
  
  return container;
}

// Lưu phiên âm vào từ vựng
async function saveWordWithPronunciation(wordObj) {
  try {
    // Kiểm tra nếu từ đã có phiên âm
    if (!wordObj.pronunciation) {
      const pronunciation = await getPronunciation(wordObj.text);
      
      // Cập nhật đối tượng từ vựng với phiên âm
      if (pronunciation) {
        wordObj.pronunciation = pronunciation;
      } else {
        // Nếu không tìm được phiên âm, vẫn tạo một đối tượng phiên âm với browser speech
        wordObj.pronunciation = {
          text: '',
          audio: '',
          useBrowserSpeech: true,
          word: wordObj.text
        };
      }
    }
    
    return wordObj;
  } catch (error) {
    console.error('Error saving pronunciation:', error);
    // Trong trường hợp lỗi, vẫn tạo phiên âm với browser speech
    wordObj.pronunciation = {
      text: '',
      audio: '',
      useBrowserSpeech: true, 
      word: wordObj.text
    };
    return wordObj;
  }
}

document.addEventListener('DOMContentLoaded', function() {
  // DOM Elements - Form inputs
  const wordInput = document.getElementById('word');
  const meaningInput = document.getElementById('meaning');
  const categorySelect = document.getElementById('category');
  const saveButton = document.getElementById('saveWord');
  const openManagerButton = document.getElementById('openManager');
  const addNewWordBtn = document.getElementById('addNewWordBtn');
  const cancelAddWordBtn = document.getElementById('cancelAddWord');
  const addWordForm = document.getElementById('add-word-form');
  
  // DOM Elements - Tabs
  const tabRecent = document.getElementById('tab-recent');
  const tabSearch = document.getElementById('tab-search');
  const tabCategories = document.getElementById('tab-categories');
  const contentRecent = document.getElementById('content-recent');
  const contentSearch = document.getElementById('content-search');
  const contentCategories = document.getElementById('content-categories');
  
  // DOM Elements - Content containers
  const recentWordsContainer = document.getElementById('recent-words');
  const searchInput = document.getElementById('search-input');
  const searchResultsContainer = document.getElementById('search-results');
  const categoryFilterContainer = document.getElementById('category-filter');
  const categoryWordsContainer = document.getElementById('category-words');
  
  // Initialize
  loadCategories();
  loadRecentWords();
  setupTabNavigation();
  setupEventListeners();
  initDarkMode();
  
  // Áp dụng phối màu Quizlet
  applyQuizletColorScheme();
  
  // Hiển thị thông báo lỗi
  function showErrorNotification(message) {
    const errorNotification = document.createElement('div');
    errorNotification.className = 'fixed inset-x-0 top-0 flex items-center justify-center p-4 bg-red-600 text-white z-50';
    errorNotification.textContent = message;
    document.body.appendChild(errorNotification);
    
    // Tự động ẩn sau 3 giây
    setTimeout(() => {
      if (errorNotification.parentNode) {
        errorNotification.remove();
      }
    }, 3000);
  }
  
  // Khởi tạo Dark Mode dựa trên trạng thái đã lưu
  function initDarkMode() {
    chrome.storage.local.get(['dark-mode-enabled'], function(result) {
      if (chrome.runtime.lastError) {
        console.error('Error accessing dark mode setting:', chrome.runtime.lastError);
        // Fallback: Kiểm tra localStorage
        checkLocalStorageDarkMode();
        return;
      }
      
      const isDarkModeEnabled = result['dark-mode-enabled'] === true;
      applyDarkModeSettings(isDarkModeEnabled);
    });
    
    // Nếu có darkModeToggle, gắn sự kiện click
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
      darkModeToggle.addEventListener('click', toggleDarkMode);
    }
  }
  
  // Hàm kiểm tra cài đặt dark mode từ localStorage (fallback)
  function checkLocalStorageDarkMode() {
    const darkModeSetting = localStorage.getItem('vocabulary-dark-mode');
    const isDarkModeEnabled = darkModeSetting === 'dark';
    applyDarkModeSettings(isDarkModeEnabled);
  }
  
  // Hàm áp dụng cài đặt dark mode
  function applyDarkModeSettings(isDarkModeEnabled) {
    if (isDarkModeEnabled) {
      document.body.classList.add('dark-mode');
      // Cập nhật trạng thái toggle nếu có
      const darkModeToggle = document.getElementById('darkModeToggle');
      if (darkModeToggle) {
        darkModeToggle.classList.add('active');
      }
    } else {
      document.body.classList.remove('dark-mode');
      // Cập nhật trạng thái toggle nếu có
      const darkModeToggle = document.getElementById('darkModeToggle');
      if (darkModeToggle) {
        darkModeToggle.classList.remove('active');
      }
    }
  }
  
  // Thêm phối màu Quizlet
  function applyQuizletColorScheme() {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      /* Quizlet Color Scheme - Cập nhật theo hình ảnh */
      :root {
        --quizlet-primary: #8358e1;
        --quizlet-primary-dark: #7048c8;
        --quizlet-primary-light: #9976e9;
        --quizlet-secondary: #4257b2;
        
        /* Light Mode Colors */
        --quizlet-light-text-primary: #2e3856;
        --quizlet-light-text-secondary: #646f90;
        --quizlet-light-text-light: #939bb4;
        --quizlet-light-bg-primary: #ffffff;
        --quizlet-light-bg-secondary: #f6f7fb;
        --quizlet-light-bg-tertiary: #e9ebf4;
        --quizlet-light-bg-card: #ffffff;
        --quizlet-light-border: #d9dde8;
        
        /* Dark Mode Colors */
        --quizlet-text-primary: #ffffff;
        --quizlet-text-secondary: #e0e0f0;
        --quizlet-text-light: #b0b0d0;
        --quizlet-bg-primary: #0a092d;
        --quizlet-bg-secondary: #141339;
        --quizlet-bg-tertiary: #1e1c50;
        --quizlet-bg-card: #232264;
        --quizlet-border: #323288;
        
        /* Common Colors */
        --quizlet-success: #23b26e;
        --quizlet-danger: #ff725b;
        --quizlet-warning: #ffcd1f;
      }

      /* Popup Style - Light Mode (Default) */
      body {
        color: var(--quizlet-light-text-primary);
        background-color: var(--quizlet-light-bg-primary);
        transition: background-color 0.3s, color 0.3s;
      }

      .text-normal {
        color: var(--quizlet-light-text-primary);
      }

      .text-muted {
        color: var(--quizlet-light-text-secondary);
      }

      .bg-card {
        background-color: var(--quizlet-light-bg-card);
        border: 1px solid var(--quizlet-light-border);
      }

      .border-normal {
        border-color: var(--quizlet-light-border);
      }

      .tab {
        color: var(--quizlet-light-text-secondary);
        border-bottom: 2px solid transparent;
        transition: color 0.2s, border-color 0.2s;
      }

      .tab.active {
        color: var(--quizlet-primary);
        border-color: var(--quizlet-primary);
      }

      button {
        transition: all 0.2s ease;
      }

      .btn-primary, button[type="submit"] {
        background-color: var(--quizlet-primary);
        color: white;
      }

      .btn-primary:hover, button[type="submit"]:hover {
        background-color: var(--quizlet-primary-dark);
      }

      .btn-secondary {
        background-color: var(--quizlet-light-bg-tertiary);
        color: var(--quizlet-light-text-secondary);
        border: 1px solid var(--quizlet-light-border);
      }

      .btn-secondary:hover {
        background-color: var(--quizlet-light-bg-secondary);
      }

      .btn-success {
        background-color: var(--quizlet-success);
        color: white;
      }

      .btn-success:hover {
        background-color: #1a9d5f;
      }

      .text-blue-600 {
        color: var(--quizlet-primary);
      }

      .text-blue-700 {
        color: var(--quizlet-primary-dark);
      }
      
      .bg-blue-50 {
        background-color: var(--quizlet-light-bg-tertiary);
      }

      .bg-blue-100 {
        background-color: var(--quizlet-light-bg-secondary);
      }

      .hover\\:bg-blue-50:hover {
        background-color: var(--quizlet-light-bg-tertiary);
      }

      .hover\\:bg-gray-200:hover {
        background-color: var(--quizlet-light-bg-tertiary);
      }
      
      input, select, textarea {
        background-color: var(--quizlet-light-bg-primary);
        color: var(--quizlet-light-text-primary);
        border: 1px solid var(--quizlet-light-border);
        padding: 8px 12px;
        border-radius: 4px;
      }

      input:focus, select:focus, textarea:focus {
        border-color: var(--quizlet-primary);
        outline: none;
        box-shadow: 0 0 0 2px rgba(131, 88, 225, 0.2);
      }

      /* Popup specific styles */
      #add-word-form {
        border: 1px solid var(--quizlet-light-border);
        border-radius: 8px;
        background-color: var(--quizlet-light-bg-secondary);
      }

      /* Toggle Dark Mode Switch */
      .toggle-dark-mode {
        background-color: var(--quizlet-light-text-light);
      }
      
      .toggle-dark-mode::after {
        background-color: #ffffff;
      }
      
      .toggle-dark-mode.active {
        background-color: var(--quizlet-primary);
      }

      /* Dark Mode Styles */
      .dark-mode {
        --quizlet-primary: #8358e1;
        --quizlet-primary-dark: #7048c8;
        --quizlet-primary-light: #9976e9;
      }

      .dark-mode body, body.dark-mode {
        background-color: var(--quizlet-bg-primary);
        color: var(--quizlet-text-primary);
      }

      .dark-mode .bg-white, .dark-mode .bg-card {
        background-color: var(--quizlet-bg-card);
        border-color: var(--quizlet-border);
      }

      .dark-mode .text-normal {
        color: var(--quizlet-text-primary);
      }

      .dark-mode .text-muted {
        color: var(--quizlet-text-secondary);
      }

      .dark-mode .border-normal {
        border-color: var(--quizlet-border);
      }

      .dark-mode input, .dark-mode select, .dark-mode textarea {
        background-color: var(--quizlet-bg-tertiary);
        color: var(--quizlet-text-primary);
        border-color: var(--quizlet-border);
      }
      
      .dark-mode input:focus, .dark-mode select:focus, .dark-mode textarea:focus {
        border-color: var(--quizlet-primary-light);
        box-shadow: 0 0 0 2px rgba(153, 118, 233, 0.3);
      }

      .dark-mode .tab {
        color: var(--quizlet-text-secondary);
      }

      .dark-mode .tab.active {
        color: var(--quizlet-primary-light);
        border-color: var(--quizlet-primary-light);
      }
      
      .dark-mode .btn-primary, .dark-mode button[type="submit"] {
        background-color: var(--quizlet-primary);
        color: white;
      }
      
      .dark-mode .btn-primary:hover, .dark-mode button[type="submit"]:hover {
        background-color: var(--quizlet-primary-dark);
      }
      
      .dark-mode .btn-secondary {
        background-color: var(--quizlet-bg-tertiary);
        color: var(--quizlet-text-secondary);
        border-color: var(--quizlet-border);
      }
      
      .dark-mode .btn-secondary:hover {
        background-color: var(--quizlet-bg-card);
      }

      .dark-mode .bg-blue-50, .dark-mode .bg-blue-100 {
        background-color: var(--quizlet-bg-tertiary);
      }

      .dark-mode .text-blue-600, .dark-mode .text-blue-700 {
        color: var(--quizlet-primary-light);
      }
      
      /* Dark mode specific for popup */
      .dark-mode #add-word-form {
        background-color: var(--quizlet-bg-tertiary);
        border-color: var(--quizlet-border);
      }
      
      /* Word card styling */
      .word-card {
        border-radius: 8px;
        transition: transform 0.2s, box-shadow 0.2s;
        border: 1px solid var(--quizlet-light-border);
      }
      
      .word-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        border-color: var(--quizlet-primary);
      }
      
      .dark-mode .word-card {
        border-color: var(--quizlet-border);
      }
      
      .dark-mode .word-card:hover {
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4);
        border-color: var(--quizlet-primary-light);
      }
      
      /* Pronunciation element */
      .pronunciation {
        display: inline-flex;
        align-items: center;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 0.85em;
        background-color: var(--quizlet-light-bg-tertiary);
        color: var(--quizlet-light-text-secondary);
      }
      
      .dark-mode .pronunciation {
        background-color: var(--quizlet-bg-tertiary);
        color: var(--quizlet-text-secondary);
      }
      
      .pronunciation-icon {
        cursor: pointer;
        margin-left: 4px;
        color: var(--quizlet-primary);
      }
      
      /* Clean up notification styles */
      .notification {
        border-radius: 4px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
      }
      
      .dark-mode .notification {
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
      }
    `;
    document.head.appendChild(styleElement);
  }
  
  // Hàm toggle dark mode
  function toggleDarkMode() {
    const isDarkMode = document.body.classList.contains('dark-mode');
    
    if (isDarkMode) {
      document.body.classList.remove('dark-mode');
      // Lưu trạng thái
      localStorage.setItem('vocabulary-dark-mode', 'light');
      chrome.storage.local.set({'dark-mode-enabled': false});
      
      // Cập nhật trạng thái toggle
      const darkModeToggle = document.getElementById('darkModeToggle');
      if (darkModeToggle) {
        darkModeToggle.classList.remove('active');
      }
    } else {
      document.body.classList.add('dark-mode');
      // Lưu trạng thái
      localStorage.setItem('vocabulary-dark-mode', 'dark');
      chrome.storage.local.set({'dark-mode-enabled': true});
      
      // Cập nhật trạng thái toggle
      const darkModeToggle = document.getElementById('darkModeToggle');
      if (darkModeToggle) {
        darkModeToggle.classList.add('active');
      }
    }
  }
  
  // Kiểm tra và xử lý lỗi extension context
  function handleExtensionContextError(callback) {
    try {
      if (!isExtensionContextValid()) {
        showErrorNotification('Extension context invalidated. Please refresh the page.');
        return false;
      }
      if (callback) callback();
      return true;
    } catch (error) {
      console.error('Extension error:', error);
      showErrorNotification('Extension error: ' + (error.message || 'Unknown error'));
      return false;
    }
  }
  
  // Check if there's selected text from the context menu
  handleExtensionContextError(() => {
    chrome.storage.local.get(['selectedText'], function(result) {
      if (chrome.runtime.lastError) {
        console.error('Error accessing storage:', chrome.runtime.lastError);
        return;
      }
      
      if (result.selectedText) {
        wordInput.value = result.selectedText;
        showAddWordForm();
        
        // Tự động lấy phiên âm khi từ được thêm từ context menu
        getPronunciationForInput();
        
        // Clear the selected text after using it
        chrome.storage.local.remove(['selectedText']);
      }
    });
  });
  
  // Listen for text selection message from content script
  handleExtensionContextError(() => {
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
      if (request.action === 'textSelected') {
        wordInput.value = request.text;
        showAddWordForm();
        
        // Tự động lấy phiên âm khi từ được thêm từ selection
        getPronunciationForInput();
      }
      return true; // Quan trọng để giữ kết nối mở cho sendResponse bất đồng bộ
    });
  });
  
  // Hàm lấy phiên âm cho từ vựng đang nhập
  async function getPronunciationForInput() {
    const word = wordInput.value.trim();
    if (word) {
      // Thêm indicator loading
      const loadingElement = document.createElement('div');
      loadingElement.id = 'pronunciation-loading';
      loadingElement.textContent = 'Loading pronunciation...';
      loadingElement.className = 'text-sm text-muted mt-1';
      
      const existingLoading = document.getElementById('pronunciation-loading');
      const existingPronunciation = document.getElementById('pronunciation-container');
      
      if (existingLoading) existingLoading.remove();
      if (existingPronunciation) existingPronunciation.remove();
      
      wordInput.parentNode.appendChild(loadingElement);
      
      console.log("Fetching pronunciation for:", word);
      
      // Lấy phiên âm
      const pronunciation = await getPronunciation(word);
      
      // Xóa indicator loading
      loadingElement.remove();
      
      console.log("Pronunciation result:", pronunciation);
      
      if (pronunciation) {
        const pronunciationElement = createPronunciationElement(pronunciation);
        pronunciationElement.id = 'pronunciation-container';
        pronunciationElement.className = 'flex items-center space-x-2 text-sm text-muted mt-2 mb-2 bg-card p-2 rounded border border-normal';
        wordInput.parentNode.appendChild(pronunciationElement);
        
        // Lưu phiên âm tạm thời để sử dụng khi lưu từ
        wordInput.dataset.pronunciation = JSON.stringify(pronunciation);
      } else {
        // Hiển thị thông báo không tìm thấy phiên âm và tạo phát âm từ browser speech
        const fallbackPronunciation = {
          text: '',
          audio: '',
          useBrowserSpeech: true,
          word: word
        };
        
        const pronunciationElement = createPronunciationElement(fallbackPronunciation);
        pronunciationElement.id = 'pronunciation-container';
        pronunciationElement.className = 'flex items-center space-x-2 text-sm text-muted mt-2 mb-2 bg-card p-2 rounded border border-normal';
        
        // Thêm một thông báo nhỏ rằng sẽ sử dụng browser speech
        const speechNote = document.createElement('span');
        speechNote.className = 'text-xs text-muted ml-2 italic';
        speechNote.textContent = '(Using browser speech)';
        pronunciationElement.appendChild(speechNote);
        
        wordInput.parentNode.appendChild(pronunciationElement);
        
        // Lưu phiên âm tạm thời để sử dụng khi lưu từ
        wordInput.dataset.pronunciation = JSON.stringify(fallbackPronunciation);
      }
    }
  }
  
  // Thêm sự kiện lấy phiên âm khi nhập từ vựng mới
  wordInput.addEventListener('change', getPronunciationForInput);
  
  function setupTabNavigation() {
    // Tab switching
    tabRecent.addEventListener('click', () => switchTab('recent'));
    tabSearch.addEventListener('click', () => switchTab('search'));
    tabCategories.addEventListener('click', () => {
      switchTab('categories');
      loadCategoryFilters();
    });
  }
  
  function setupEventListeners() {
    // Add new word button
    addNewWordBtn.addEventListener('click', showAddWordForm);
    
    // Cancel add word
    cancelAddWordBtn.addEventListener('click', hideAddWordForm);
    
    // Save word button
    saveButton.addEventListener('click', saveWord);
    
    // Open manager button
    openManagerButton.addEventListener('click', function() {
      const managerUrl = chrome.runtime.getURL('extension_index.html');
      chrome.tabs.create({ url: managerUrl });
    });
    
    // Search input
    searchInput.addEventListener('input', debounce(function() {
      if (this.value.trim().length > 1) {
        searchWords(this.value.trim());
      } else {
        searchResultsContainer.innerHTML = '<div class="text-center text-muted py-4">Enter at least 2 characters to search</div>';
      }
    }, 300));
  }
  
  function switchTab(tabId) {
    // Remove active class from all tabs and contents
    [tabRecent, tabSearch, tabCategories].forEach(tab => {
      tab.classList.remove('active');
    });
    
    [contentRecent, contentSearch, contentCategories].forEach(content => {
      content.classList.remove('active');
    });
    
    // Add active class to selected tab and content
    document.getElementById('tab-' + tabId).classList.add('active');
    document.getElementById('content-' + tabId).classList.add('active');
    
    // Load data for the active tab if needed
    if (tabId === 'recent') loadRecentWords();
  }
  
  function showAddWordForm() {
    addWordForm.classList.remove('hidden');
    addNewWordBtn.style.display = 'none';
  }
  
  function hideAddWordForm() {
    addWordForm.classList.add('hidden');
    addNewWordBtn.style.display = 'block';
    wordInput.value = '';
    meaningInput.value = '';
    const pronunciationContainer = document.getElementById('pronunciation-container');
    if (pronunciationContainer) pronunciationContainer.remove();
  }
  
  function loadCategories() {
    handleExtensionContextError(() => {
      chrome.storage.local.get(['vocabulary-categories'], function(result) {
        if (chrome.runtime.lastError) {
          console.error('Error loading categories:', chrome.runtime.lastError);
          showErrorNotification('Failed to load categories. Please refresh the page.');
          return;
        }
        
        categorySelect.innerHTML = '';
        
        let categories = [];
        if (result['vocabulary-categories']) {
          categories = JSON.parse(result['vocabulary-categories']);
        }
        
        // Đảm bảo luôn có category mặc định
        const hasDefaultCategory = categories.some(cat => cat.id === 'default');
        if (!hasDefaultCategory) {
          const defaultCategory = { 
            id: 'default', 
            name: 'Default',
            sourceLanguage: 'en',
            targetLanguage: 'vi'
          };
          categories.push(defaultCategory);
          
          // Lưu lại danh sách categories với category mặc định
          chrome.storage.local.set({
            'vocabulary-categories': JSON.stringify(categories)
          }, function() {
            if (chrome.runtime.lastError) {
              console.error('Error saving default category:', chrome.runtime.lastError);
            } else {
              console.log('Default category added successfully');
            }
          });
        }
        
        // Add options to select
        categories.forEach(category => {
          const option = document.createElement('option');
          option.value = category.id;
          option.textContent = category.name;
          categorySelect.appendChild(option);
        });
      });
    });
  }
  
  function loadCategoryFilters() {
    handleExtensionContextError(() => {
      chrome.storage.local.get(['vocabulary-categories'], function(result) {
        if (chrome.runtime.lastError) {
          console.error('Error loading category filters:', chrome.runtime.lastError);
          showErrorNotification('Failed to load category filters. Please refresh the page.');
          return;
        }
        
        categoryFilterContainer.innerHTML = '';
        
        if (!result['vocabulary-categories']) {
          categoryWordsContainer.innerHTML = '<div class="text-center text-muted py-4">No categories found</div>';
          return;
        }
        
        const categories = JSON.parse(result['vocabulary-categories']);
        
        // Đảm bảo luôn có category mặc định
        const hasDefaultCategory = categories.some(cat => cat.id === 'default');
        if (!hasDefaultCategory && categories.length === 0) {
          categoryWordsContainer.innerHTML = '<div class="text-center text-muted py-4">No categories found</div>';
          return;
        }
        
        // Create filter for each category
        categories.forEach(category => {
          const filterBtn = document.createElement('button');
          filterBtn.className = 'px-3 py-2 mb-2 mr-2 border rounded-full text-sm hover:bg-blue-50 transition-colors';
          filterBtn.textContent = category.name;
          filterBtn.dataset.categoryId = category.id;
          
          filterBtn.addEventListener('click', function() {
            highlightSelectedFilter(this);
            loadCategoryWords(category.id);
          });
          
          categoryFilterContainer.appendChild(filterBtn);
        });
        
        // If there are categories, load words for the first one
        if (categories.length > 0) {
          const firstFilter = categoryFilterContainer.querySelector('button');
          if (firstFilter) {
            highlightSelectedFilter(firstFilter);
            loadCategoryWords(categories[0].id);
          }
        } else {
          categoryWordsContainer.innerHTML = '<div class="text-center text-muted py-4">No categories found</div>';
        }
      });
    });
  }
  
  function highlightSelectedFilter(selectedFilter) {
    // Remove highlight from all filters
    const allFilters = categoryFilterContainer.querySelectorAll('button');
    allFilters.forEach(filter => {
      filter.classList.remove('bg-blue-100', 'text-blue-700', 'border-blue-300');
      filter.classList.add('border-normal');
    });
    
    // Add highlight to selected filter
    selectedFilter.classList.add('bg-blue-100', 'text-blue-700', 'border-blue-300');
    selectedFilter.classList.remove('border-normal');
  }
  
  function loadRecentWords(limit = 10) {
    chrome.storage.local.get(['vocabulary-words', 'vocabulary-categories'], function(result) {
      recentWordsContainer.innerHTML = '<div class="text-center text-muted py-4">Loading recent words...</div>';
      
      if (!result['vocabulary-words'] || !result['vocabulary-categories']) {
        recentWordsContainer.innerHTML = '<div class="text-center text-muted py-4">No words saved yet</div>';
        return;
      }
      
      const words = JSON.parse(result['vocabulary-words']);
      const categories = JSON.parse(result['vocabulary-categories']);
      
      // Create category name map for quick lookup
      const categoryMap = {};
      categories.forEach(cat => categoryMap[cat.id] = cat.name);
      
      // Get most recent words
      const recentWords = [...words].sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
      
      if (recentWords.length === 0) {
        recentWordsContainer.innerHTML = '<div class="text-center text-muted py-4">No words saved yet</div>';
        return;
      }
      
      renderWords(recentWords, categoryMap, recentWordsContainer);
    });
  }
  
  function loadCategoryWords(categoryId) {
    chrome.storage.local.get(['vocabulary-words', 'vocabulary-categories'], function(result) {
      categoryWordsContainer.innerHTML = '<div class="text-center text-muted py-4">Loading category words...</div>';
      
      if (!result['vocabulary-words'] || !result['vocabulary-categories']) {
        categoryWordsContainer.innerHTML = '<div class="text-center text-muted py-4">No words in this category</div>';
        return;
      }
      
      const words = JSON.parse(result['vocabulary-words']);
      const categories = JSON.parse(result['vocabulary-categories']);
      
      // Filter words by category ID
      const categoryWords = words.filter(word => word.categoryId === categoryId);
      
      // Create category name map for quick lookup
      const categoryMap = {};
      categories.forEach(cat => categoryMap[cat.id] = cat.name);
      
      if (categoryWords.length === 0) {
        categoryWordsContainer.innerHTML = '<div class="text-center text-muted py-4">No words in this category</div>';
        return;
      }
      
      renderWords(categoryWords, categoryMap, categoryWordsContainer);
    });
  }
  
  function searchWords(query) {
    chrome.storage.local.get(['vocabulary-words', 'vocabulary-categories'], function(result) {
      searchResultsContainer.innerHTML = '<div class="text-center text-muted py-4">Searching...</div>';
      
      if (!result['vocabulary-words'] || !result['vocabulary-categories']) {
        searchResultsContainer.innerHTML = '<div class="text-center text-muted py-4">No words to search</div>';
        return;
      }
      
      const words = JSON.parse(result['vocabulary-words']);
      const categories = JSON.parse(result['vocabulary-categories']);
      
      // Create category name map for quick lookup
      const categoryMap = {};
      categories.forEach(cat => categoryMap[cat.id] = cat.name);
      
      // Search in word text and meaning
      const queryLower = query.toLowerCase();
      const searchResults = words.filter(word => 
        word.text.toLowerCase().includes(queryLower) || 
        (word.meaning && word.meaning.toLowerCase().includes(queryLower))
      );
      
      if (searchResults.length === 0) {
        searchResultsContainer.innerHTML = '<div class="text-center text-muted py-4">No matching words found</div>';
        return;
      }
      
      renderWords(searchResults, categoryMap, searchResultsContainer);
    });
  }
  
  function renderWords(words, categoryMap, container) {
    container.innerHTML = '';
    
    words.forEach(word => {
      const wordCard = document.createElement('div');
      wordCard.className = 'bg-card mb-3 border border-normal rounded-lg p-3 hover:shadow-sm transition-shadow';
      wordCard.id = `word-card-${word.id}`;
      
      // Word text and category section
      const wordText = document.createElement('div');
      wordText.className = 'flex justify-between items-start';
      
      const textSpan = document.createElement('span');
      textSpan.className = 'font-medium text-lg text-normal';
      textSpan.textContent = word.text;
      wordText.appendChild(textSpan);
      
      // Category badge
      const categoryName = categoryMap[word.categoryId] || 'Undefined';
      const catBadge = document.createElement('span');
      catBadge.className = 'text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded';
      catBadge.textContent = categoryName;
      wordText.appendChild(catBadge);
      
      wordCard.appendChild(wordText);
      
      // Pronunciation section
      // Nếu không có pronunciation, tạo một đối tượng pronunciation mặc định sử dụng browser speech
      let pronunciationObj = word.pronunciation;
      if (!pronunciationObj) {
        pronunciationObj = {
          text: '',
          audio: '',
          useBrowserSpeech: true,
          word: word.text
        };
      }
      
      const pronElement = createPronunciationElement(pronunciationObj);
      pronElement.className = 'flex items-center space-x-2 text-sm text-muted mt-2 bg-card p-1 rounded border border-normal';
      
      // Thêm chỉ báo nếu đang sử dụng browser speech
      if (pronunciationObj.useBrowserSpeech) {
        const speechNote = document.createElement('span');
        speechNote.className = 'text-xs text-muted ml-2 italic';
        speechNote.textContent = '(browser speech)';
        pronElement.appendChild(speechNote);
      }
      
      wordCard.appendChild(pronElement);
      
      // Meaning section (in edit mode or display mode)
      const meaningContainer = document.createElement('div');
      meaningContainer.className = 'mt-2 relative';
      meaningContainer.id = `meaning-container-${word.id}`;
      
      // Default display view
      const meaningDiv = document.createElement('div');
      meaningDiv.className = 'text-normal'; // Đã xóa padding-right vì không còn nút ở bên phải
      meaningDiv.textContent = word.meaning || '';
      meaningDiv.id = `meaning-text-${word.id}`;
      meaningContainer.appendChild(meaningDiv);
      
      // Edit view (hidden by default)
      const editContainer = document.createElement('div');
      editContainer.className = 'hidden'; // Hidden by default
      editContainer.id = `meaning-edit-${word.id}`;
      
      const editInput = document.createElement('input');
      editInput.type = 'text';
      editInput.className = 'w-full px-2 py-1 border border-normal rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-card text-normal';
      editInput.value = word.meaning || '';
      editInput.id = `meaning-input-${word.id}`;
      
      const editButtonsContainer = document.createElement('div');
      editButtonsContainer.className = 'flex space-x-2 mt-1';
      
      const saveEditButton = document.createElement('button');
      saveEditButton.className = 'px-2 py-1 text-xs btn-primary rounded';
      saveEditButton.textContent = 'Save';
      saveEditButton.addEventListener('click', () => updateWordMeaning(word.id, editInput.value));
      
      const cancelEditButton = document.createElement('button');
      cancelEditButton.className = 'px-2 py-1 text-xs btn-secondary rounded';
      cancelEditButton.textContent = 'Cancel';
      cancelEditButton.addEventListener('click', () => toggleMeaningEdit(word.id, false));
      
      editButtonsContainer.appendChild(saveEditButton);
      editButtonsContainer.appendChild(cancelEditButton);
      
      editContainer.appendChild(editInput);
      editContainer.appendChild(editButtonsContainer);
      meaningContainer.appendChild(editContainer);
      
      wordCard.appendChild(meaningContainer);
      
      // Footer container - Thời gian thêm từ + nút edit và xoá
      const footerContainer = document.createElement('div');
      footerContainer.className = 'mt-2 flex justify-between items-center';
      
      // Date added
      const dateDiv = document.createElement('div');
      dateDiv.className = 'text-xs text-muted';
      dateDiv.textContent = 'Added: ' + formatDate(word.createdAt);
      footerContainer.appendChild(dateDiv);
      
      // Action buttons container
      const actionButtons = document.createElement('div');
      actionButtons.className = 'flex space-x-2';
      
      // Edit button
      const editButton = document.createElement('button');
      editButton.className = 'p-1 text-blue-600 hover:text-blue-800 rounded-full';
      editButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>';
      editButton.title = 'Edit meaning';
      editButton.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMeaningEdit(word.id, true);
      });
      
      // Delete button
      const deleteButton = document.createElement('button');
      deleteButton.className = 'p-1 text-red-600 hover:text-red-800 rounded-full';
      deleteButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>';
      deleteButton.title = 'Delete word';
      deleteButton.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteWord(word.id);
      });
      
      actionButtons.appendChild(editButton);
      actionButtons.appendChild(deleteButton);
      
      footerContainer.appendChild(actionButtons);
      wordCard.appendChild(footerContainer);
      
      container.appendChild(wordCard);
    });
  }
  
  // Hàm để chuyển đổi giữa chế độ hiển thị và chế độ chỉnh sửa nghĩa
  function toggleMeaningEdit(wordId, isEditMode) {
    const displayElement = document.getElementById(`meaning-text-${wordId}`);
    const editElement = document.getElementById(`meaning-edit-${wordId}`);
    
    if (isEditMode) {
      displayElement.classList.add('hidden');
      editElement.classList.remove('hidden');
      // Focus vào input
      document.getElementById(`meaning-input-${wordId}`).focus();
    } else {
      displayElement.classList.remove('hidden');
      editElement.classList.add('hidden');
    }
  }
  
  // Hàm cập nhật nghĩa của từ
  function updateWordMeaning(wordId, newMeaning) {
    // Hiển thị thông báo đang cập nhật
    const updateNotification = document.createElement('div');
    updateNotification.className = 'fixed inset-x-0 top-0 flex items-center justify-center p-4 bg-blue-600 text-white z-50';
    updateNotification.textContent = 'Updating meaning...';
    document.body.appendChild(updateNotification);
    
    chrome.storage.local.get(['vocabulary-words'], function(result) {
      if (!result['vocabulary-words']) {
        updateNotification.textContent = 'Error: Could not find vocabulary data';
        setTimeout(() => updateNotification.remove(), 2000);
        return;
      }
      
      let words = JSON.parse(result['vocabulary-words']);
      const wordIndex = words.findIndex(word => word.id === wordId);
      
      if (wordIndex === -1) {
        updateNotification.textContent = 'Error: Word not found';
        setTimeout(() => updateNotification.remove(), 2000);
        return;
      }
      
      // Cập nhật nghĩa mới
      words[wordIndex].meaning = newMeaning.trim();
      
      // Lưu lại vào storage
      chrome.storage.local.set({
        'vocabulary-words': JSON.stringify(words)
      }, function() {
        // Cập nhật UI
        const meaningElement = document.getElementById(`meaning-text-${wordId}`);
        if (meaningElement) {
          meaningElement.textContent = newMeaning.trim();
        }
        
        // Chuyển về chế độ hiển thị
        toggleMeaningEdit(wordId, false);
        
        // Cập nhật thông báo thành công
        updateNotification.className = 'fixed inset-x-0 top-0 flex items-center justify-center p-4 bg-green-600 text-white z-50';
        updateNotification.textContent = 'Meaning updated successfully!';
        
        // Tự động ẩn thông báo sau 2 giây
        setTimeout(() => {
          updateNotification.remove();
        }, 2000);
      });
    });
  }
  
  // Hàm xóa từ
  function deleteWord(wordId) {
    // Hiển thị thông báo đang xóa
    const deleteNotification = document.createElement('div');
    deleteNotification.className = 'fixed inset-x-0 top-0 flex items-center justify-center p-4 bg-blue-600 text-white z-50';
    deleteNotification.textContent = 'Deleting word...';
    document.body.appendChild(deleteNotification);
    
    chrome.storage.local.get(['vocabulary-words'], function(result) {
      if (!result['vocabulary-words']) {
        deleteNotification.textContent = 'Error: Could not find vocabulary data';
        setTimeout(() => deleteNotification.remove(), 2000);
        return;
      }
      
      let words = JSON.parse(result['vocabulary-words']);
      const filteredWords = words.filter(word => word.id !== wordId);
      
      // Lưu lại vào storage
      chrome.storage.local.set({
        'vocabulary-words': JSON.stringify(filteredWords)
      }, function() {
        // Xóa phần tử từ UI với animation
        const wordElement = document.getElementById(`word-card-${wordId}`);
        if (wordElement) {
          wordElement.style.transition = 'all 0.3s ease';
          wordElement.style.opacity = '0';
          wordElement.style.height = '0';
          wordElement.style.overflow = 'hidden';
          
          setTimeout(() => {
            wordElement.remove();
          }, 300);
        }
        
        // Cập nhật thông báo thành công
        deleteNotification.className = 'fixed inset-x-0 top-0 flex items-center justify-center p-4 bg-green-600 text-white z-50';
        deleteNotification.textContent = 'Word deleted successfully!';
        
        // Tự động ẩn thông báo sau 2 giây
        setTimeout(() => {
          deleteNotification.remove();
        }, 2000);
      });
    });
  }
  
  async function saveWord() {
    if (!handleExtensionContextError()) return;
    
    const text = wordInput.value.trim();
    const meaning = meaningInput.value.trim();
    const categoryId = categorySelect.value;
    
    if (!text) {
      alert('Please enter a word!');
      return;
    }
    
    if (!categoryId) {
      alert('Please select a category!');
      return;
    }
    
    // Retrieve the selected category details
    chrome.storage.local.get(['vocabulary-categories'], async function(result) {
      if (chrome.runtime.lastError) {
        console.error('Error accessing storage:', chrome.runtime.lastError);
        showErrorNotification('Error: Could not access storage');
        return;
      }
      
      if (!result['vocabulary-categories']) {
        showErrorNotification('Error: Categories not found');
        return;
      }
      
      const categories = JSON.parse(result['vocabulary-categories']);
      let category = categories.find(cat => cat.id === categoryId);
      
      // Nếu không tìm thấy category, sử dụng category mặc định hoặc tạo mới
      if (!category) {
        console.warn(`Category not found with ID: ${categoryId}`);
        category = categories.find(cat => cat.id === 'default');
        
        // Nếu không có category mặc định, tạo mới
        if (!category) {
          category = { 
            id: 'default', 
            name: 'Default',
            sourceLanguage: 'en',
            targetLanguage: 'vi'
          };
          
          // Thêm category mặc định vào danh sách
          categories.push(category);
          chrome.storage.local.set({
            'vocabulary-categories': JSON.stringify(categories)
          }, function() {
            if (chrome.runtime.lastError) {
              console.error('Error creating default category:', chrome.runtime.lastError);
            } else {
              console.log('Default category created');
              // Cập nhật danh sách category trong select
              loadCategories();
            }
          });
        }
      }
      
      // Show saving notification
      const saveNotification = document.createElement('div');
      saveNotification.className = 'fixed inset-x-0 top-0 flex items-center justify-center p-4 bg-blue-600 text-white z-50';
      saveNotification.textContent = 'Saving word...';
      document.body.appendChild(saveNotification);
      
      try {
        // Get the pronunciation from the dataset or fetch it
        let pronunciation = null;
        if (wordInput.dataset.pronunciation) {
          pronunciation = JSON.parse(wordInput.dataset.pronunciation);
        } else {
          pronunciation = await getPronunciation(text);
        }
        
        // Đảm bảo luôn có đối tượng pronunciation, ngay cả khi không lấy được từ API
        if (!pronunciation) {
          pronunciation = {
            text: '',
            audio: '',
            useBrowserSpeech: true,
            word: text
          };
        }
        
        // Get automatically translated meaning if not provided
        let autoMeaning = meaning;
        
        if (!meaning) {
          saveNotification.textContent = 'Translating meaning...';
          
          try {
            // Kiểm tra xem extension context có hợp lệ không
            if (!isExtensionContextValid()) {
              throw new Error('Extension context invalidated during translation');
            }
            
            // Call the background script to translate
            autoMeaning = await new Promise((resolve, reject) => {
              chrome.runtime.sendMessage(
                { 
                  action: "translateWord", 
                  text: text, 
                  category: {
                    id: category.id,
                    name: category.name,
                    sourceLanguage: category.sourceLanguage || 'en',
                    targetLanguage: category.targetLanguage || 'vi'
                  }
                }, 
                (response) => {
                  if (chrome.runtime.lastError) {
                    console.error('Runtime error during translation:', chrome.runtime.lastError);
                    reject(chrome.runtime.lastError);
                    return;
                  }
                  
                  if (response && response.success) {
                    resolve(response.meaning || '');
                  } else {
                    console.error('Error during translation:', response ? response.error : 'No response');
                    
                    // Use fallbackMeaning if available
                    if (response && response.fallbackMeaning) {
                      resolve(response.fallbackMeaning);
                    } else {
                      resolve(`${text} (translation failed)`);
                    }
                  }
                }
              );
            });
          } catch (error) {
            console.error('Error calling translation function:', error);
            autoMeaning = `${text} (translation error: ${error.message || 'unknown'})`;
          }
        }
        
        // Kiểm tra lại xem extension context có còn hợp lệ không
        if (!isExtensionContextValid()) {
          saveNotification.className = 'fixed inset-x-0 top-0 flex items-center justify-center p-4 bg-red-600 text-white z-50';
          saveNotification.textContent = 'Extension context invalidated. Please refresh and try again.';
          setTimeout(() => {
            if (saveNotification.parentNode) saveNotification.remove();
          }, 3000);
          return;
        }
        
        // Get existing words from storage
        chrome.storage.local.get(['vocabulary-words'], function(result) {
          if (chrome.runtime.lastError) {
            console.error('Error accessing storage for words:', chrome.runtime.lastError);
            saveNotification.className = 'fixed inset-x-0 top-0 flex items-center justify-center p-4 bg-red-600 text-white z-50';
            saveNotification.textContent = 'Error accessing storage. Please try again.';
            setTimeout(() => saveNotification.remove(), 3000);
            return;
          }
          
          let words = [];
          
          if (result['vocabulary-words']) {
            try {
              words = JSON.parse(result['vocabulary-words']);
            } catch (e) {
              console.error('Error parsing vocabulary words:', e);
              words = [];
            }
          }
          
          // Create new word object
          const newWord = {
            id: Date.now().toString(),
            text: text,
            meaning: autoMeaning,
            categoryId: category.id, // Sử dụng category.id thay vì categoryId để đảm bảo luôn có category hợp lệ
            createdAt: Date.now(),
            pronunciation: pronunciation
          };
          
          // Add to array and save
          words.push(newWord);
          chrome.storage.local.set({
            'vocabulary-words': JSON.stringify(words)
          }, function() {
            if (chrome.runtime.lastError) {
              console.error('Error saving word:', chrome.runtime.lastError);
              saveNotification.className = 'fixed inset-x-0 top-0 flex items-center justify-center p-4 bg-red-600 text-white z-50';
              saveNotification.textContent = 'Error saving word: ' + chrome.runtime.lastError.message;
              setTimeout(() => saveNotification.remove(), 3000);
              return;
            }
            
            // Update success notification
            saveNotification.className = 'fixed inset-x-0 top-0 flex items-center justify-center p-4 bg-green-600 text-white z-50';
            saveNotification.textContent = 'Word saved successfully!';
            
            // Remove notification after a delay
            setTimeout(() => {
              if (saveNotification.parentNode) saveNotification.remove();
            }, 2000);
            
            // Clear form and hide it
            hideAddWordForm();
            
            // Reload recent words
            loadRecentWords();
            
            // Kiểm tra xem extension context có còn hợp lệ không trước khi gửi thông báo
            if (isExtensionContextValid()) {
              // Notify content script if word was saved from page
              try {
                chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                  if (chrome.runtime.lastError) {
                    console.error('Error querying tabs:', chrome.runtime.lastError);
                    return;
                  }
                  
                  if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                      action: "wordSaved",
                      word: text,
                      meaning: autoMeaning,
                      categoryName: category.name,
                      pronunciation: pronunciation,
                      sourceLanguage: category.sourceLanguage,
                      targetLanguage: category.targetLanguage
                    }, function(response) {
                      if (chrome.runtime.lastError) {
                        console.error('Error sending message to tab:', chrome.runtime.lastError);
                      }
                    });
                  }
                });
              } catch (e) {
                console.error('Error notifying content script:', e);
              }
            }
          });
        });
      } catch (error) {
        console.error('Error saving word:', error);
        saveNotification.className = 'fixed inset-x-0 top-0 flex items-center justify-center p-4 bg-red-600 text-white z-50';
        saveNotification.textContent = 'Error saving word: ' + (error.message || 'Unknown error');
        
        setTimeout(() => {
          if (saveNotification.parentNode) saveNotification.remove();
        }, 3000);
      }
    });
  }
  
  function formatDate(timestamp) {
    const date = new Date(timestamp);
    const options = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return date.toLocaleDateString('en-US', options);
  }
  
  // Utility function to debounce search input
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        timeout = null;
        func.apply(this, args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
}); 