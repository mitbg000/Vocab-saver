// Khai báo các hàm hỗ trợ cho phiên âm
// Hàm lấy phiên âm từ từ điển
async function getPronunciation(word) {
  try {
    // Sử dụng Free Dictionary API để lấy phiên âm
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    
    if (!response.ok) {
      // Nếu API không trả về kết quả, tạo đối tượng phát âm với browser speech
      return {
        text: '',
        audio: '',
        useBrowserSpeech: true,
        word: word
      };
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
            audio: '',
            useBrowserSpeech: true,
            word: word
          };
        }
      }
    }
    
    // Trả về đối tượng phát âm mặc định sử dụng browser speech
    return {
      text: '',
      audio: '',
      useBrowserSpeech: true,
      word: word
    };
  } catch (error) {
    console.error('Error retrieving pronunciation:', error);
    // Trong trường hợp lỗi, vẫn trả về đối tượng phát âm mặc định
    return {
      text: '',
      audio: '',
      useBrowserSpeech: true,
      word: word
    };
  }
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
  container.className = 'flex items-center space-x-2 text-sm text-gray-500 mt-1';
  
  // Phần hiển thị phiên âm
  if (pronunciation && pronunciation.text) {
    const phoneticText = document.createElement('span');
    phoneticText.textContent = pronunciation.text;
    container.appendChild(phoneticText);
  }
  
  // Luôn tạo nút phát âm, kể cả khi không có pronunciation.audio
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
  
  // Thêm chỉ báo nếu đang sử dụng browser speech
  if (pronunciation && pronunciation.useBrowserSpeech) {
    const speechNote = document.createElement('span');
    speechNote.className = 'text-xs text-gray-500 ml-2 italic';
    speechNote.textContent = '(browser speech)';
    container.appendChild(speechNote);
  }
  
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

// Hàm quản lý dark mode
function toggleDarkMode() {
  // Lấy trạng thái dark mode hiện tại từ document
  const isDarkMode = document.documentElement.classList.contains('dark');
  
  // Chuyển đổi trạng thái
  if (isDarkMode) {
    document.documentElement.classList.remove('dark');
    // Lưu trạng thái vào localStorage và chrome.storage nếu có
    localStorage.setItem('vocabulary-dark-mode', 'light');
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({'dark-mode-enabled': false});
    }
    
    // Cập nhật trạng thái nút toggle
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
      darkModeToggle.classList.remove('active');
    }
  } else {
    document.documentElement.classList.add('dark');
    // Lưu trạng thái vào localStorage và chrome.storage nếu có
    localStorage.setItem('vocabulary-dark-mode', 'dark');
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({'dark-mode-enabled': true});
    }
    
    // Cập nhật trạng thái nút toggle
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
      darkModeToggle.classList.add('active');
    }
  }
}

// Hàm khởi tạo dark mode dựa trên cài đặt đã lưu
function initDarkMode() {
  // Kiểm tra cài đặt dark mode từ chrome.storage (nếu có) hoặc localStorage
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.get(['dark-mode-enabled'], function(result) {
      // Nếu có lỗi hoặc không tìm thấy cài đặt trong chrome.storage, kiểm tra localStorage
      if (chrome.runtime.lastError || result['dark-mode-enabled'] === undefined) {
        checkLocalStorageDarkMode();
        return;
      }
      
      const isDarkModeEnabled = result['dark-mode-enabled'] === true;
      applyDarkModeSettings(isDarkModeEnabled);
    });
  } else {
    // Nếu không có chrome.storage, sử dụng localStorage
    checkLocalStorageDarkMode();
  }
  
  // Gắn sự kiện cho nút toggle dark mode nếu đã có
  const darkModeToggle = document.getElementById('darkModeToggle');
  if (darkModeToggle) {
    darkModeToggle.addEventListener('click', toggleDarkMode);
  }
}

// Hàm kiểm tra cài đặt dark mode từ localStorage
function checkLocalStorageDarkMode() {
  const darkModeSetting = localStorage.getItem('vocabulary-dark-mode');
  const isDarkModeEnabled = darkModeSetting === 'dark';
  applyDarkModeSettings(isDarkModeEnabled);
}

// Hàm áp dụng cài đặt dark mode
function applyDarkModeSettings(isDarkModeEnabled) {
  if (isDarkModeEnabled) {
    document.documentElement.classList.add('dark');
    
    // Cập nhật trạng thái nút toggle
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
      darkModeToggle.classList.add('active');
    }
  } else {
    document.documentElement.classList.remove('dark');
    
    // Cập nhật trạng thái nút toggle
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
      darkModeToggle.classList.remove('active');
    }
  }
}

document.addEventListener('DOMContentLoaded', function() {
  // DOM Elements
  const wordList = document.getElementById('word-list');
  const filterCategory = document.getElementById('filter-category');
  const addWordInput = document.getElementById('add-word');
  const addMeaningInput = document.getElementById('add-meaning');
  const addCategorySelect = document.getElementById('add-category');
  const addWordBtn = document.getElementById('add-word-btn');
  const newCategoryInput = document.getElementById('new-category');
  const addCategoryBtn = document.getElementById('add-category-btn');
  const categoryList = document.getElementById('category-list');
  const exportCategorySelect = document.getElementById('export-category');
  const exportFormatSelect = document.getElementById('export-format');
  const exportBtn = document.getElementById('export-btn');


  // AI API Elements
  const translationServiceSelect = document.getElementById('translation-service');
  const apiSettingsDivs = document.querySelectorAll('.api-settings');
  const saveApiSettingsBtn = document.getElementById('save-api-settings');
  const testApiConnectionBtn = document.getElementById('test-api-connection');
  
  // OpenAI Elements
  const openaiApiKeyInput = document.getElementById('openai-api-key');
  
  // Gemini Elements
  const geminiApiKeyInput = document.getElementById('gemini-api-key');
  const geminiModelSelect = document.getElementById('gemini-model');
  
  // DeepSeek Elements
  const deepseekApiKeyInput = document.getElementById('deepseek-api-key');
  const deepseekModelSelect = document.getElementById('deepseek-model');
  
  // Grok Elements
  const grokApiKeyInput = document.getElementById('grok-api-key');

  // Pagination Elements
  const pageSizeSelect = document.getElementById('page-size');
  const prevPageBtn = document.getElementById('prev-page');
  const nextPageBtn = document.getElementById('next-page');
  const currentPageSpan = document.getElementById('current-page');
  const totalPagesSpan = document.getElementById('total-pages');
  const paginationControls = document.getElementById('pagination-controls');
  const goToPageInput = document.getElementById('go-to-page');
  const goToPageBtn = document.getElementById('go-to-page-btn');

  // Pagination state
  let currentPage = 1;
  let pageSize = parseInt(pageSizeSelect.value);
  let totalPages = 1;

  // Tab Elements
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  
  // Xử lý chuyển đổi tab khi click
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Bỏ active class từ tất cả buttons
      tabButtons.forEach(btn => btn.classList.remove('tab-active'));
      
      // Thêm active class cho button được click
      button.classList.add('tab-active');
      
      // Lấy ID của tab content tương ứng
      const tabId = button.id.replace('tab-', 'content-');
      
      // Ẩn tất cả tab content
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Hiển thị tab content được chọn
      document.getElementById(tabId).classList.add('active');
      
      // Nếu đang chuyển đến tab danh sách từ vựng, load lại danh sách
      if (tabId === 'content-word-list') {
        loadWords();
      }
      
      // Nếu đang chuyển đến tab quản lý danh mục, load lại danh mục
      if (tabId === 'content-manage-categories') {
        loadCategories();
      }
    });
  });

  // Thêm biến lưu dữ liệu phiên âm tạm thời
  let currentPronunciation = null;

  // Load data
  loadCategories();
  loadWords();
  loadApiSettings();

  // Event Listeners
  filterCategory.addEventListener('change', loadWords);
  addWordBtn.addEventListener('click', addWord);
  addCategoryBtn.addEventListener('click', addCategory);
  exportBtn.addEventListener('click', exportWords);
  
  // AI API Tab Event Listeners
  translationServiceSelect.addEventListener('change', function() {
    showHideApiSettings(this.value);
  });
  
  saveApiSettingsBtn.addEventListener('click', saveApiSettings);
  testApiConnectionBtn.addEventListener('click', testApiConnection);
  
  // Thêm sự kiện cho phân trang
  pageSizeSelect.addEventListener('change', function() {
    pageSize = parseInt(this.value);
    currentPage = 1; // Reset về trang đầu tiên khi thay đổi kích thước trang
    loadWords();
  });
  
  prevPageBtn.addEventListener('click', function() {
    if (currentPage > 1) {
      currentPage--;
      renderCurrentPage();
    }
  });
  
  nextPageBtn.addEventListener('click', function() {
    if (currentPage < totalPages) {
      currentPage++;
      renderCurrentPage();
    }
  });
  
  // Xử lý sự kiện đi đến trang cụ thể
  goToPageBtn.addEventListener('click', function() {
    goToSpecificPage();
  });
  
  // Cho phép nhấn Enter trong input để đi đến trang
  goToPageInput.addEventListener('keyup', function(event) {
    if (event.key === 'Enter') {
      goToSpecificPage();
    }
  });
  
  // Hàm xử lý chuyển đến trang cụ thể
  function goToSpecificPage() {
    const pageNum = parseInt(goToPageInput.value);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      currentPage = pageNum;
      renderCurrentPage();
      goToPageInput.value = ''; // Xóa giá trị input sau khi đã xử lý
    } else {
      // Thông báo nếu số trang không hợp lệ
      alert(`Please enter a page number between 1 and ${totalPages}`);
    }
  }
  
  // Thêm sự kiện lấy phiên âm khi nhập từ vựng mới
  addWordInput.addEventListener('change', getPronunciationForInput);

  // Hàm lấy phiên âm cho từ vựng đang nhập
  async function getPronunciationForInput() {
    const word = addWordInput.value.trim();
    if (word) {
      // Thêm indicator loading
      const loadingElement = document.createElement('div');
      loadingElement.id = 'pronunciation-loading';
      loadingElement.textContent = 'Loading pronunciation...';
      loadingElement.className = 'text-sm text-gray-500 mt-1';
      
      const existingLoading = document.getElementById('pronunciation-loading');
      const existingPronunciation = document.getElementById('pronunciation-container');
      
      if (existingLoading) existingLoading.remove();
      if (existingPronunciation) existingPronunciation.remove();
      
      addWordInput.parentNode.appendChild(loadingElement);
      
      console.log("Fetching pronunciation for:", word);
      
      // Lấy phiên âm
      const pronunciation = await getPronunciation(word);
      
      // Xóa indicator loading
      loadingElement.remove();
      
      console.log("Pronunciation result:", pronunciation);
      
      // Lưu phiên âm tạm thời
      currentPronunciation = pronunciation;
      
      // Luôn tạo phần tử phát âm, dù có pronunciation hay không
      const pronunciationElement = createPronunciationElement(pronunciation);
      pronunciationElement.id = 'pronunciation-container';
      pronunciationElement.className = 'flex items-center space-x-2 text-sm text-gray-500 mt-2 mb-2 bg-blue-50 p-2 rounded';
      
      // Nếu đang sử dụng browser speech vì không tìm thấy phát âm từ API, hiển thị thông báo
      if (pronunciation.useBrowserSpeech && !pronunciation.text) {
        const speechNote = document.createElement('span');
        speechNote.className = 'text-xs text-gray-500 ml-2 italic';
        speechNote.textContent = '(No API pronunciation found, using browser speech)';
        pronunciationElement.appendChild(speechNote);
      }
      
      addWordInput.parentNode.appendChild(pronunciationElement);
    }
  }

  // Load categories to all selects
  function loadCategories() {
    chrome.storage.local.get(['vocabulary-categories'], function(result) {
      let categories = [];
      
      if (result['vocabulary-categories']) {
        categories = JSON.parse(result['vocabulary-categories']);
      } else {
        // Default category if none exists
        categories = [{ 
          id: 'default', 
          name: 'Default',
          sourceLanguage: 'en',
          targetLanguage: 'vi'
        }];
        chrome.storage.local.set({
          'vocabulary-categories': JSON.stringify(categories)
        });
      }

      // Clear existing options in all selects except the "All" option in filter
      addCategorySelect.innerHTML = '';
      exportCategorySelect.innerHTML = '<option value="all">All categories</option>';
      filterCategory.innerHTML = '<option value="all">All categories</option>';
      
      // Add categories to selects
      categories.forEach(category => {
        // Add to filter select
        const filterOption = document.createElement('option');
        filterOption.value = category.id;
        filterOption.textContent = category.name;
        filterCategory.appendChild(filterOption);
        
        // Add to add word form select
        const addOption = document.createElement('option');
        addOption.value = category.id;
        addOption.textContent = category.name;
        addCategorySelect.appendChild(addOption);
        
        // Add to export select
        const exportOption = document.createElement('option');
        exportOption.value = category.id;
        exportOption.textContent = category.name;
        exportCategorySelect.appendChild(exportOption);
      });
      
      // Render category list
      renderCategoryList(categories);
    });
  }

  // Render category list with delete buttons
  function renderCategoryList(categories) {
    categoryList.innerHTML = '';
    
    categories.forEach(category => {
      const categoryItem = document.createElement('div');
      categoryItem.className = 'flex flex-col p-3 border border-gray-200 rounded-md hover:shadow-sm transition-shadow mb-3';
      
      const header = document.createElement('div');
      header.className = 'flex justify-between items-center mb-2';
      
      const categoryName = document.createElement('span');
      categoryName.className = 'font-medium text-gray-800';
      categoryName.textContent = category.name;
      
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'text-gray-400 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-red-50';
      deleteBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>';
      deleteBtn.title = 'Delete category';
      
      // Don't allow deleting default category
      if (category.id === 'default') {
        deleteBtn.disabled = true;
        deleteBtn.className += ' opacity-50 cursor-not-allowed';
      } else {
        deleteBtn.addEventListener('click', function() {
          if (confirm(`Are you sure you want to delete the "${category.name}" category? All vocabulary in this category will be moved to the Default category.`)) {
            deleteCategory(category.id);
          }
        });
      }
      
      header.appendChild(categoryName);
      header.appendChild(deleteBtn);
      categoryItem.appendChild(header);
      
      // Hiển thị thông tin ngôn ngữ
      if (category.sourceLanguage || category.targetLanguage) {
        const langInfo = document.createElement('div');
        langInfo.className = 'text-xs text-gray-500 mt-1 bg-gray-50 p-2 rounded-md';
        
        // Map mã ngôn ngữ sang tên hiển thị
        const languageMap = {
          'en': 'English',
          'vi': 'Vietnamese',
          'zh': 'Chinese',
          'fr': 'French',
          'de': 'German',
          'ja': 'Japanese',
          'ko': 'Korean'
        };
        
        const source = languageMap[category.sourceLanguage] || category.sourceLanguage;
        const target = languageMap[category.targetLanguage] || category.targetLanguage;
        
        langInfo.innerHTML = `<span class="font-medium">Languages:</span> ${source} → ${target}`;
        categoryItem.appendChild(langInfo);
      }
      
      categoryList.appendChild(categoryItem);
    });
  }

  // Load words from storage
  function loadWords() {
    chrome.storage.local.get(['vocabulary-words'], function(result) {
      wordList.innerHTML = '<div class="text-center text-gray-500 py-4">Loading vocabulary...</div>';
      
      if (!result['vocabulary-words']) {
        // Không có từ vựng nào, hiển thị thông báo
        wordList.innerHTML = '';
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'text-center text-gray-500 py-6 bg-gray-50 rounded-lg';
        emptyMessage.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <p>No vocabulary words yet.</p>
          <p class="mt-2">Switch to the "Add New Word" tab to add your first word!</p>
        `;
        wordList.appendChild(emptyMessage);
        // Ẩn điều khiển phân trang khi không có từ vựng
        paginationControls.style.display = 'none';
        return;
      }
      
      // Parse stored words
      let words = JSON.parse(result['vocabulary-words']);
      
      // Sort by newest first
      words.sort((a, b) => b.createdAt - a.createdAt);
      
      // Get categories for displaying names
      chrome.storage.local.get(['vocabulary-categories'], function(result) {
        let categories = [];
        
        if (result['vocabulary-categories']) {
          categories = JSON.parse(result['vocabulary-categories']);
        }
        
        // Hiển thị điều khiển phân trang
        paginationControls.style.display = 'flex';
        
        // Lưu trữ danh sách từ vựng đã lọc để sử dụng khi chuyển trang
        window.filteredVocabularyWords = words;
        window.vocabularyCategories = categories;
        
        // Render the words for current page
        renderCurrentPage();
      });
    });
  }

  // Render current page of words
  function renderCurrentPage() {
    // Lấy danh sách từ vựng đã lọc
    const words = window.filteredVocabularyWords || [];
    const categories = window.vocabularyCategories || [];
    
    // Get filter value
    const filterValue = filterCategory.value;
    
    // Filter words by category if needed
    const filteredWords = filterValue === 'all' 
      ? words 
      : words.filter(word => word.categoryId === filterValue);
    
    // Tính toán tổng số trang
    totalPages = Math.max(1, Math.ceil(filteredWords.length / pageSize));
    
    // Đảm bảo trang hiện tại không vượt quá tổng số trang
    if (currentPage > totalPages) {
      currentPage = totalPages;
    }
    
    // Cập nhật UI phân trang
    currentPageSpan.textContent = currentPage;
    totalPagesSpan.textContent = totalPages;
    
    // Cập nhật thuộc tính max của input go-to-page
    goToPageInput.max = totalPages;
    
    // Kích hoạt/vô hiệu hóa các nút phân trang
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages;
    
    // Tính toán chỉ mục bắt đầu và kết thúc của từ vựng cần hiển thị
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, filteredWords.length);
    
    // Lấy các từ vựng cho trang hiện tại
    const currentPageWords = filteredWords.slice(startIndex, endIndex);
    
    // Render the words
    renderWords(currentPageWords, categories, filteredWords.length);
  }

  // Render words list with pronunciation
  function renderWords(words, categories, totalCount) {
    wordList.innerHTML = '';
    
    // Tạo thông tin tổng quan
    const wordCount = document.createElement('div');
    wordCount.className = 'text-sm text-gray-500 mb-4';
    
    if (words.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'text-center text-gray-500 py-6 bg-gray-50 rounded-lg';
      emptyMessage.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <p>No vocabulary in this category.</p>
        <p class="mt-2">Switch to the "Add New Word" tab to add your first word!</p>
      `;
      wordList.appendChild(emptyMessage);
      
      // Ẩn điều khiển phân trang khi không có từ vựng
      paginationControls.style.display = 'none';
      return;
    }
    
    // Hiển thị thông tin phân trang
    const startIdx = (currentPage - 1) * pageSize + 1;
    const endIdx = Math.min(startIdx + words.length - 1, totalCount);
    wordCount.textContent = `Showing ${startIdx}-${endIdx} of ${totalCount} words`;
    wordList.appendChild(wordCount);
    
    // Render each word as a card with hover effect
    words.forEach(word => {
      const wordCard = document.createElement('div');
      wordCard.className = 'bg-white border border-gray-200 rounded-lg p-3 mb-3 transition-all duration-200 hover:shadow-md hover:border-blue-300';
      
      // Tạo header chứa từ và nút xóa
      const header = document.createElement('div');
      header.className = 'flex justify-between items-start mb-2';
      
      // Phần từ vựng và danh mục
      const wordInfo = document.createElement('div');
      
      // Từ vựng chính
      const wordText = document.createElement('h3');
      wordText.className = 'text-lg font-medium text-gray-900';
      wordText.textContent = word.text;
      wordInfo.appendChild(wordText);
      
      // Danh mục
      const category = categories.find(c => c.id === word.categoryId);
      const categoryName = category ? category.name : 'Undefined';
      const categoryBadge = document.createElement('span');
      categoryBadge.className = 'inline-block bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded mt-1';
      categoryBadge.textContent = categoryName;
      wordInfo.appendChild(categoryBadge);
      
      header.appendChild(wordInfo);
      
      // Action buttons container
      const actionButtons = document.createElement('div');
      actionButtons.className = 'flex space-x-1';
      
      // Nút chỉnh sửa nghĩa
      const editButton = document.createElement('button');
      editButton.className = 'text-gray-400 hover:text-blue-500 transition-colors p-1 rounded-full hover:bg-blue-50';
      editButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>';
      editButton.title = 'Edit meaning';
      editButton.addEventListener('click', function() {
        editWordMeaning(word);
      });
      actionButtons.appendChild(editButton);
      
      // Nút xóa từ (xóa nhanh không cần xác nhận)
      const deleteButton = document.createElement('button');
      deleteButton.className = 'text-gray-400 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-red-50';
      deleteButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>';
      deleteButton.title = 'Delete word';
      deleteButton.addEventListener('click', function() {
        // Gọi hàm xóa không cần xác nhận
        deleteWord(word.id);
      });
      actionButtons.appendChild(deleteButton);
      
      header.appendChild(actionButtons);
      
      wordCard.appendChild(header);
      
      // Hiển thị phiên âm nếu có
      if (word.pronunciation) {
        const pronunciationElement = createPronunciationElement(word.pronunciation);
        pronunciationElement.className = 'flex items-center space-x-2 text-sm text-gray-500 mb-2 bg-gray-50 p-2 rounded-md';
        wordCard.appendChild(pronunciationElement);
      } else {
        // Nếu không có pronunciation, tạo một đối tượng pronunciation mặc định sử dụng browser speech
        const fallbackPronunciation = {
          text: '',
          audio: '',
          useBrowserSpeech: true,
          word: word.text
        };
        
        const pronunciationElement = createPronunciationElement(fallbackPronunciation);
        pronunciationElement.className = 'flex items-center space-x-2 text-sm text-gray-500 mb-2 bg-gray-50 p-2 rounded-md';
        wordCard.appendChild(pronunciationElement);
      }
      
      // Ý nghĩa của từ
      if (word.meaning) {
        const meaningElement = document.createElement('div');
        meaningElement.className = 'text-gray-700 mt-2';
        meaningElement.setAttribute('data-word-id', word.id); // Thêm ID để tham chiếu khi chỉnh sửa
        
        const meaningLabel = document.createElement('span');
        meaningLabel.className = 'text-sm text-gray-500';
        meaningLabel.textContent = 'Meaning: ';
        
        const meaningText = document.createElement('span');
        meaningText.textContent = word.meaning;
        meaningText.className = 'meaning-text';
        
        meaningElement.appendChild(meaningLabel);
        meaningElement.appendChild(meaningText);
        wordCard.appendChild(meaningElement);
      }
      
      // Thời gian tạo
      const timeElement = document.createElement('div');
      timeElement.className = 'text-xs text-gray-400 mt-2';
      const date = new Date(word.createdAt);
      timeElement.textContent = `Added: ${date.toLocaleDateString('en-US')} ${date.toLocaleTimeString('en-US')}`;
      wordCard.appendChild(timeElement);
      
      // Hiển thị thông tin dịch vụ AI đã dịch từ (nếu có)
      if (word.translatedBy) {
        const translatedByElement = document.createElement('div');
        translatedByElement.className = 'text-xs text-gray-400 mt-1';
        translatedByElement.innerHTML = `<span class="text-blue-400">✓</span> Translated by: ${word.translatedBy}`;
        wordCard.appendChild(translatedByElement);
      }
      
      wordList.appendChild(wordCard);
    });
  }

  // Hàm chỉnh sửa nghĩa của từ
  function editWordMeaning(word) {
    // Tạo modal chỉnh sửa
    const editModal = document.createElement('div');
    editModal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    
    // Nội dung modal
    const modalContent = document.createElement('div');
    modalContent.className = 'bg-white rounded-lg shadow-lg p-6 w-full max-w-lg mx-4';
    
    // Header
    const modalHeader = document.createElement('div');
    modalHeader.className = 'flex justify-between items-center mb-4';
    
    const modalTitle = document.createElement('h3');
    modalTitle.className = 'text-xl font-semibold text-gray-800';
    modalTitle.textContent = `Edit meaning for "${word.text}"`;
    modalHeader.appendChild(modalTitle);
    
    const closeButton = document.createElement('button');
    closeButton.className = 'text-gray-400 hover:text-gray-600';
    closeButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>';
    closeButton.addEventListener('click', () => editModal.remove());
    modalHeader.appendChild(closeButton);
    
    modalContent.appendChild(modalHeader);
    
    // Input field for meaning
    const inputLabel = document.createElement('label');
    inputLabel.className = 'block text-sm font-medium text-gray-700 mb-2';
    inputLabel.textContent = 'Meaning:';
    modalContent.appendChild(inputLabel);
    
    const meaningInput = document.createElement('textarea');
    meaningInput.className = 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500';
    meaningInput.value = word.meaning || '';
    meaningInput.rows = 4;
    modalContent.appendChild(meaningInput);
    
    // Buttons
    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'mt-6 flex justify-end space-x-3';
    
    const cancelButton = document.createElement('button');
    cancelButton.className = 'px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300';
    cancelButton.textContent = 'Cancel';
    cancelButton.addEventListener('click', () => editModal.remove());
    buttonGroup.appendChild(cancelButton);
    
    const saveButton = document.createElement('button');
    saveButton.className = 'px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700';
    saveButton.textContent = 'Save Changes';
    saveButton.addEventListener('click', () => {
      // Cập nhật nghĩa của từ
      updateWordMeaning(word.id, meaningInput.value.trim());
      editModal.remove();
    });
    buttonGroup.appendChild(saveButton);
    
    modalContent.appendChild(buttonGroup);
    editModal.appendChild(modalContent);
    
    // Add modal to page
    document.body.appendChild(editModal);
    
    // Focus input
    meaningInput.focus();
  }
  
  // Hàm cập nhật nghĩa của từ
  function updateWordMeaning(wordId, newMeaning) {
    chrome.storage.local.get(['vocabulary-words'], function(result) {
      if (!result['vocabulary-words']) return;
      
      let words = JSON.parse(result['vocabulary-words']);
      
      // Tìm và cập nhật từ vựng
      const wordIndex = words.findIndex(word => word.id === wordId);
      if (wordIndex === -1) return;
      
      // Cập nhật nghĩa
      const updatedWord = words[wordIndex];
      updatedWord.meaning = newMeaning;
      words[wordIndex] = updatedWord;
      
      // Lưu lại danh sách từ đã cập nhật
      chrome.storage.local.set({
        'vocabulary-words': JSON.stringify(words)
      }, function() {
        // Thông báo cập nhật thành công
        const updateMsg = document.createElement('div');
        updateMsg.className = 'fixed bottom-4 right-4 bg-green-600 text-white p-3 rounded shadow-lg';
        updateMsg.innerHTML = `Updated meaning for "${updatedWord.text}"`;
        document.body.appendChild(updateMsg);
        
        // Tự động ẩn thông báo sau 3 giây
        setTimeout(() => {
          updateMsg.remove();
        }, 3000);
        
        // Cập nhật danh sách từ vựng đã lọc
        window.filteredVocabularyWords = words;
        
        // Reload words với trang hiện tại
        renderCurrentPage();
      });
    });
  }

  // Cập nhật hàm deleteWord để xóa không cần xác nhận
  function deleteWord(wordId) {
    chrome.storage.local.get(['vocabulary-words'], function(result) {
      if (!result['vocabulary-words']) return;
      
      let words = JSON.parse(result['vocabulary-words']);
      
      // Find word to delete
      const wordToDelete = words.find(word => word.id === wordId);
      if (!wordToDelete) return;
      
      // Remove the word
      words = words.filter(word => word.id !== wordId);
      
      // Save updated words
      chrome.storage.local.set({
        'vocabulary-words': JSON.stringify(words)
      }, function() {
        // Thông báo xóa thành công
        const deleteMsg = document.createElement('div');
        deleteMsg.className = 'fixed bottom-4 right-4 bg-red-600 text-white p-3 rounded shadow-lg';
        deleteMsg.innerHTML = `Deleted word "${wordToDelete.text}"`;
        document.body.appendChild(deleteMsg);
        
        // Tự động ẩn thông báo sau 3 giây
        setTimeout(() => {
          deleteMsg.remove();
        }, 3000);
        
        // Cập nhật danh sách từ vựng đã lọc
        window.filteredVocabularyWords = words;
        
        // Kiểm tra nếu trang hiện tại không còn từ vựng nào và không phải trang đầu tiên
        if (currentPage > 1 && (currentPage - 1) * pageSize >= window.filteredVocabularyWords.length) {
          currentPage--; // Quay lại trang trước nếu trang hiện tại rỗng
        }
        
        // Reload words với trang hiện tại
        renderCurrentPage();
      });
    });
  }
  
  // Biến DOM cho phần xuất từ vựng theo khoảng thời gian
  const exportTimeRangeSelect = document.getElementById('export-time-range');
  const customDateRangeDiv = document.getElementById('custom-date-range');
  const dateFromInput = document.getElementById('date-from');
  const dateToInput = document.getElementById('date-to');
  
  // Xử lý hiển thị/ẩn phần chọn ngày tùy chỉnh
  exportTimeRangeSelect.addEventListener('change', function() {
    if (this.value === 'custom') {
      customDateRangeDiv.style.display = 'grid';
    } else {
      customDateRangeDiv.style.display = 'none';
    }
  });
  
  // Đặt giá trị Default cho ngày từ và ngày đến (tuần hiện tại)
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay()); // Chủ nhật của tuần hiện tại
  
  dateFromInput.valueAsDate = weekStart;
  dateToInput.valueAsDate = today;

  // Add a new word with pronunciation
  async function addWord() {
    const text = addWordInput.value.trim();
    const meaning = addMeaningInput.value.trim();
    const categoryId = addCategorySelect.value;
    
    if (!text) {
      alert('Word cannot be empty!');
      return;
    }
    
    if (!categoryId) {
      alert('Please select a category!');
      return;
    }
    
    // Hiển thị thông báo đang xử lý
    const saveIndicator = document.createElement('div');
    saveIndicator.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    saveIndicator.innerHTML = '<div class="bg-white p-4 rounded-lg shadow-lg"><p class="text-center">Processing...</p></div>';
    document.body.appendChild(saveIndicator);
    
    try {
      chrome.storage.local.get(['vocabulary-words', 'vocabulary-categories', 'vocabulary-api-settings'], async function(result) {
        let words = [];
        let autoMeaning = meaning;
        let translationService = 'Google Translate';
        
        if (result['vocabulary-words']) {
          words = JSON.parse(result['vocabulary-words']);
        }
        
        // Get selected translation service
        if (result['vocabulary-api-settings']) {
          const apiSettings = JSON.parse(result['vocabulary-api-settings']);
          if (apiSettings.service) {
            switch (apiSettings.service) {
              case 'openai':
                translationService = `OpenAI (${apiSettings.openai?.model || 'GPT-3.5'})`;
                break;
              case 'gemini':
                translationService = `Google Gemini (${apiSettings.gemini?.model || 'Gemini Pro'})`;
                break;
              case 'deepseek':
                translationService = `DeepSeek (${apiSettings.deepseek?.model || 'DeepSeek Chat'})`;
                break;
              case 'grok':
                translationService = 'Grok AI';
                break;
              default:
                translationService = 'Google Translate';
            }
          }
        }
        
        // Nếu người dùng không nhập nghĩa, sử dụng dịch tự động
        if (!meaning && result['vocabulary-categories']) {
          const categories = JSON.parse(result['vocabulary-categories']);
          const category = categories.find(cat => cat.id === categoryId);
          
          if (category) {
            // Cập nhật thông báo
            saveIndicator.innerHTML = `<div class="bg-white p-4 rounded-lg shadow-lg">
              <p class="text-center">Translating meaning with ${translationService}...</p>
            </div>`;
            
            // Gọi hàm dịch từ background thông qua message
            try {
              const translationResult = await new Promise((resolve) => {
                console.log("Sending translation request for:", text, "with category:", category);
                
                // Đảm bảo gửi đầy đủ thông tin ngôn ngữ
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
                    console.log("Received translation response:", response);
                    if (response && response.success) {
                      resolve({
                        meaning: response.meaning || '',
                        service: response.translatedBy || 'google'
                      });
                    } else {
                      console.error('Error during automatic translation:', response ? response.error : 'No response');
                      // Sử dụng fallbackMeaning nếu có
                      if (response && response.fallbackMeaning) {
                        console.log('Using fallback meaning:', response.fallbackMeaning);
                        resolve({
                          meaning: response.fallbackMeaning,
                          service: response.translatedBy || 'error'
                        });
                      } else {
                        // Nếu không có kết quả dịch, hiển thị thông báo lỗi
                        const errorMsg = (response && response.error) ? 
                          response.error : 'Could not translate this word';
                          
                        // Hiển thị thông báo lỗi
                        const errorToast = document.createElement('div');
                        errorToast.className = 'fixed bottom-4 right-4 bg-red-600 text-white p-3 rounded shadow-lg';
                        errorToast.innerHTML = `Translation error: ${errorMsg}`;
                        document.body.appendChild(errorToast);
                        
                        // Tự động ẩn thông báo lỗi sau 5 giây
                        setTimeout(() => {
                          errorToast.remove();
                        }, 5000);
                        
                        resolve({
                          meaning: `${text} (translation failed)`,
                          service: 'error'
                        });
                      }
                    }
                  }
                );
              });
              
              // Set the meaning from the result
              autoMeaning = translationResult.meaning;
              
              // Update the translation service based on the actual service used
              if (translationResult.service) {
                translationService = getDisplayServiceName(translationResult.service);
              }
            } catch (error) {
              console.error('Error calling background translation function:', error);
              autoMeaning = `${text} (translation error: ${error.message || 'unknown'})`;
              translationService = 'error';
            }
          }
        }
        
        // Cập nhật thông báo
        saveIndicator.innerHTML = '<div class="bg-white p-4 rounded-lg shadow-lg"><p class="text-center">Saving word...</p></div>';
        
        // Create new word with pronunciation and auto meaning
        const newWord = {
          id: Date.now().toString(),
          text: text,
          meaning: autoMeaning || meaning || '',
          categoryId: categoryId,
          createdAt: Date.now(),
          pronunciation: currentPronunciation,
          translatedBy: !meaning && autoMeaning ? translationService : null // Track which service translated it
        };
        
        // Function to get a user-friendly service name for display
        function getDisplayServiceName(serviceCode) {
          switch(serviceCode) {
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
        
        // Nếu chưa có phiên âm, cố gắng lấy
        if (!newWord.pronunciation) {
          const wordWithPronunciation = await saveWordWithPronunciation(newWord);
          // Cập nhật từ vựng với phiên âm
          newWord.pronunciation = wordWithPronunciation.pronunciation;
        }
        
        // Add to array and save
        words.push(newWord);
        chrome.storage.local.set({
          'vocabulary-words': JSON.stringify(words)
        }, function() {
          // Clear inputs
          addWordInput.value = '';
          addMeaningInput.value = '';
          currentPronunciation = null;
          
          // Xóa phiên âm hiển thị
          const pronunciationContainer = document.getElementById('pronunciation-container');
          if (pronunciationContainer) {
            pronunciationContainer.remove();
          }
          
          // Cập nhật danh sách từ vựng đã lọc
          window.filteredVocabularyWords = words;
          
          // Đảm bảo quay lại trang đầu tiên khi thêm từ mới
          currentPage = 1;
          
          // Chuyển sang tab danh sách từ vựng để hiển thị từ mới
          document.getElementById('tab-word-list').click();
          
          // Xóa thông báo đang lưu
          saveIndicator.remove();
          
          // Thông báo thành công 
          const successMsg = document.createElement('div');
          successMsg.className = 'fixed bottom-4 right-4 bg-green-600 text-white p-3 rounded shadow-lg';
          
          if (!meaning && autoMeaning && newWord.translatedBy) {
            successMsg.innerHTML = `Word saved successfully!<br><span class="text-xs">Meaning translated with ${newWord.translatedBy}</span>`;
          } else {
            successMsg.innerHTML = 'Word saved successfully!';
          }
          document.body.appendChild(successMsg);
          
          // Tự động ẩn thông báo sau 3 giây
          setTimeout(() => {
            successMsg.remove();
          }, 3000);
        });
      });
    } catch (error) {
      console.error('Error saving word:', error);
      // Xóa thông báo đang lưu
      saveIndicator.remove();
      alert('An error occurred while saving the word. Please try again.');
    }
  }

  // Add a new category
  function addCategory() {
    const name = newCategoryInput.value.trim();
    const sourceLanguage = document.getElementById('source-language').value;
    const targetLanguage = document.getElementById('target-language').value;
    
    if (!name) {
      alert('Category name cannot be empty!');
      return;
    }
    
    chrome.storage.local.get(['vocabulary-categories'], function(result) {
      let categories = [];
      
      if (result['vocabulary-categories']) {
        categories = JSON.parse(result['vocabulary-categories']);
      }
      
      // Check if category name already exists
      const isDuplicate = categories.some(cat => cat.name.toLowerCase() === name.toLowerCase());
      
      if (isDuplicate) {
        alert('This category already exists!');
        return;
      }
      
      // Create new category
      const newCategory = {
        id: Date.now().toString(),
        name: name,
        sourceLanguage: sourceLanguage,
        targetLanguage: targetLanguage
      };
      
      // Add to array and save
      categories.push(newCategory);
      chrome.storage.local.set({
        'vocabulary-categories': JSON.stringify(categories)
      }, function() {
        // Clear input
        newCategoryInput.value = '';
        
        // Reload categories
        loadCategories();
        
        // Thông báo thành công
        const successMsg = document.createElement('div');
        successMsg.className = 'fixed bottom-4 right-4 bg-green-600 text-white p-3 rounded shadow-lg';
        successMsg.innerHTML = `Category "${name}" added successfully!`;
        document.body.appendChild(successMsg);
        
        // Tự động ẩn thông báo sau 3 giây
        setTimeout(() => {
          successMsg.remove();
        }, 3000);
      });
    });
  }

  // Delete a category
  function deleteCategory(categoryId) {
    chrome.storage.local.get(['vocabulary-categories', 'vocabulary-words'], function(result) {
      if (!result['vocabulary-categories']) return;
      
      let categories = JSON.parse(result['vocabulary-categories']);
      
      // Get category name for confirmation
      const categoryToDelete = categories.find(cat => cat.id === categoryId);
      if (!categoryToDelete) return;
      
      // Remove the category
      categories = categories.filter(cat => cat.id !== categoryId);
      
      // Update words to move them to default category
      if (result['vocabulary-words']) {
        let words = JSON.parse(result['vocabulary-words']);
        
        // Count affected words
        const affectedWords = words.filter(word => word.categoryId === categoryId).length;
        
        // Update category ID for affected words
        words = words.map(word => {
          if (word.categoryId === categoryId) {
            return { ...word, categoryId: 'default' };
          }
          return word;
        });
        
        // Save updated words
        chrome.storage.local.set({
          'vocabulary-words': JSON.stringify(words)
        });
        
        // Thông báo di chuyển từ vựng
        if (affectedWords > 0) {
          const moveMsg = document.createElement('div');
          moveMsg.className = 'fixed bottom-4 right-4 bg-blue-600 text-white p-3 rounded shadow-lg';
          moveMsg.innerHTML = `Moved ${affectedWords} words to Default category`;
          document.body.appendChild(moveMsg);
          
          // Tự động ẩn thông báo sau 3 giây
          setTimeout(() => {
            moveMsg.remove();
          }, 4000);
        }
      }
      
      // Save updated categories
      chrome.storage.local.set({
        'vocabulary-categories': JSON.stringify(categories)
      }, function() {
        // Thông báo xóa thành công
        const deleteMsg = document.createElement('div');
        deleteMsg.className = 'fixed bottom-4 right-4 bg-red-600 text-white p-3 rounded shadow-lg';
        deleteMsg.innerHTML = `Deleted category "${categoryToDelete.name}"`;
        document.body.appendChild(deleteMsg);
        
        // Tự động ẩn thông báo sau 3 giây
        setTimeout(() => {
          deleteMsg.remove();
        }, 3000);
        
        // Reload categories and words
        loadCategories();
        loadWords();
      });
    });
  }

  // Export words
  function exportWords() {
    const categoryId = exportCategorySelect.value;
    const format = exportFormatSelect.value;
    const timeRange = exportTimeRangeSelect.value;
    
    chrome.storage.local.get(['vocabulary-words', 'vocabulary-categories'], function(result) {
      if (!result['vocabulary-words'] || !result['vocabulary-categories']) {
        alert('No data to export.');
        return;
      }
      
      let words = JSON.parse(result['vocabulary-words']);
      const categories = JSON.parse(result['vocabulary-categories']);
      
      // Filter by category if needed
      if (categoryId !== 'all') {
        words = words.filter(word => word.categoryId === categoryId);
      }
      
      // Filter by time range
      words = filterWordsByTimeRange(words, timeRange);
      
      if (words.length === 0) {
        alert('No vocabulary words to export.');
        return;
      }
      
      // Create a map for quick category lookup
      const categoryMap = {};
      categories.forEach(cat => {
        categoryMap[cat.id] = cat.name;
      });
      
      // Sort words by category and then by text
      words.sort((a, b) => {
        const catA = categoryMap[a.categoryId] || '';
        const catB = categoryMap[b.categoryId] || '';
        
        if (catA !== catB) {
          return catA.localeCompare(catB);
        }
        
        return a.text.localeCompare(b.text);
      });
      
      // Export based on format
      if (format === 'csv') {
        exportToCSV(words, categoryMap);
      } else if (format === 'txt') {
        exportToTXT(words, categoryMap);
      }
      
      // Thông báo xuất thành công
      const exportMsg = document.createElement('div');
      exportMsg.className = 'fixed bottom-4 right-4 bg-green-600 text-white p-3 rounded shadow-lg';
      exportMsg.innerHTML = `Successfully exported ${words.length} words!`;
      document.body.appendChild(exportMsg);
      
      // Tự động ẩn thông báo sau 3 giây
      setTimeout(() => {
        exportMsg.remove();
      }, 3000);
    });
  }
  
  // Hàm lọc từ vựng theo khoảng thời gian
  function filterWordsByTimeRange(words, timeRange) {
    if (timeRange === 'all') {
      return words; // Không lọc
    }
    
    const now = new Date();
    let startDate, endDate;
    
    switch (timeRange) {
      case 'today':
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;
        
      case 'yesterday':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setDate(endDate.getDate() - 1);
        endDate.setHours(23, 59, 59, 999);
        break;
        
      case 'this-week':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - startDate.getDay()); // Sunday of current week
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;
        
      case 'last-week':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - startDate.getDay() - 7); // Sunday of last week
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6); // Saturday of last week
        endDate.setHours(23, 59, 59, 999);
        break;
        
      case 'this-month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;
        
      case 'last-month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        break;
        
      case 'custom':
        startDate = new Date(dateFromInput.value);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(dateToInput.value);
        endDate.setHours(23, 59, 59, 999);
        break;
        
      default:
        return words; // Default is no filtering
    }
    
    // Convert to timestamps for comparison
    const startTimestamp = startDate.getTime();
    const endTimestamp = endDate.getTime();
    
    // Filter words by creation date within the range
    return words.filter(word => {
      const wordTimestamp = word.createdAt;
      return wordTimestamp >= startTimestamp && wordTimestamp <= endTimestamp;
    });
  }

  // Export to CSV format
  function exportToCSV(words, categoryMap) {
    // Thêm thông tin tóm tắt
    const summary = getExportSummary(words);
    let csv = '# Export Summary\n';
    csv += `# Date: ${summary.exportDate}\n`;
    csv += `# Time Range: ${summary.timeRangeText}\n`;
    csv += `# Total Words: ${words.length}\n`;
    if (summary.categoryName !== 'All categories') {
      csv += `# Category: ${summary.categoryName}\n`;
    }
    csv += '#\n';
    
    // Header
    csv += 'Word,Meaning,Category,Pronunciation,Date Added\n';
    
    words.forEach(word => {
      const text = `"${word.text.replace(/"/g, '""')}"`;
      const meaning = `"${(word.meaning || '').replace(/"/g, '""')}"`;
      const category = `"${categoryMap[word.categoryId] || 'Undefined'}"`;
      const phonetic = `"${word.pronunciation?.text || ''}"`;
      const dateAdded = `"${formatDate(word.createdAt)}"`;
      
      csv += `${text},${meaning},${category},${phonetic},${dateAdded}\n`;
    });
    
    const fileName = getExportFileName('csv');
    downloadFile(csv, fileName, 'text/csv;charset=utf-8');
  }

  // Export to TXT format
  function exportToTXT(words, categoryMap) {
    // Thêm thông tin tóm tắt
    const summary = getExportSummary(words);
    let txt = '===== VOCABULARY EXPORT SUMMARY =====\n\n';
    txt += `Export Date: ${summary.exportDate}\n`;
    txt += `Time Range: ${summary.timeRangeText}\n`;
    txt += `Total Words: ${words.length}\n`;
    if (summary.categoryName !== 'All categories') {
      txt += `Category: ${summary.categoryName}\n`;
    }
    txt += '\n===== VOCABULARY WORDS =====\n\n';
    
    let currentCategory = '';
    
    words.forEach(word => {
      const category = categoryMap[word.categoryId] || 'Undefined';
      
      // Add category header if changed
      if (category !== currentCategory) {
        if (txt !== '') {
          txt += '\n\n';
        }
        
        txt += `===== ${category} =====\n\n`;
        currentCategory = category;
      }
      
      // Add word
      txt += `${word.text}`;
      
      // Add pronunciation if available
      if (word.pronunciation && word.pronunciation.text) {
        txt += ` ${word.pronunciation.text}`;
      }
      
      // Add meaning
      if (word.meaning) {
        txt += `\n  ${word.meaning}`;
      }
      
      // Add date
      txt += `\n  Added: ${formatDate(word.createdAt)}`;
      
      txt += '\n\n';
    });
    
    const fileName = getExportFileName('txt');
    downloadFile(txt, fileName, 'text/plain;charset=utf-8');
  }
  
  // Hàm lấy thông tin tóm tắt cho file xuất
  function getExportSummary(words) {
    const timeRange = exportTimeRangeSelect.value;
    const categoryId = exportCategorySelect.value;
    
    // Lấy tên của category
    let categoryName = 'All categories';
    if (categoryId !== 'all') {
      const categoryOption = exportCategorySelect.querySelector(`option[value="${categoryId}"]`);
      if (categoryOption) {
        categoryName = categoryOption.textContent;
      }
    }
    
    // Tạo mô tả khoảng thời gian
    let timeRangeText = 'All time';
    if (timeRange !== 'all') {
      switch (timeRange) {
        case 'today':
          timeRangeText = 'Today';
          break;
        case 'yesterday':
          timeRangeText = 'Yesterday';
          break;
        case 'this-week':
          timeRangeText = 'This week';
          break;
        case 'last-week':
          timeRangeText = 'Last week';
          break;
        case 'this-month':
          timeRangeText = 'This month';
          break;
        case 'last-month':
          timeRangeText = 'Last month';
          break;
        case 'custom':
          const fromDate = formatDate(new Date(dateFromInput.value));
          const toDate = formatDate(new Date(dateToInput.value));
          timeRangeText = `Custom (${fromDate} to ${toDate})`;
          break;
      }
    }
    
    // Định dạng ngày xuất
    const exportDate = formatDate(new Date());
    
    return {
      exportDate,
      timeRangeText,
      categoryName
    };
  }
  
  // Hàm định dạng ngày tháng
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

  // Hàm tạo tên file xuất dựa trên khoảng thời gian
  function getExportFileName(extension) {
    const timeRange = exportTimeRangeSelect.value;
    let fileName = 'vocabulary';
    
    // Thêm thông tin khoảng thời gian
    if (timeRange !== 'all') {
      if (timeRange === 'custom') {
        // Format: vocabulary_2023-05-01_to_2023-05-31.extension
        const fromDate = dateFromInput.value;
        const toDate = dateToInput.value;
        fileName += `_${fromDate}_to_${toDate}`;
      } else {
        // Format: vocabulary_this-week.extension
        fileName += `_${timeRange}`;
      }
    }
    
    // Thêm thông tin category nếu đang lọc theo category
    const categoryId = exportCategorySelect.value;
    if (categoryId !== 'all') {
      // Lấy danh sách category từ dropdown export-category
      const categoryOption = exportCategorySelect.querySelector(`option[value="${categoryId}"]`);
      if (categoryOption) {
        const categoryName = categoryOption.textContent;
        fileName += `_${categoryName.toLowerCase().replace(/\s+/g, '-')}`;
      }
    }
    
    return `${fileName}.${extension}`;
  }

  // Helper function to download a file
  function downloadFile(content, fileName, contentType) {
    const a = document.createElement('a');
    const file = new Blob([content], { type: contentType });
    
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
    
    URL.revokeObjectURL(a.href);
  }

  // Function to load API settings from storage
  function loadApiSettings() {
    chrome.storage.local.get(['vocabulary-api-settings'], function(result) {
      if (result['vocabulary-api-settings']) {
        const settings = JSON.parse(result['vocabulary-api-settings']);
        
        // Set selected translation service
        if (settings.service) {
          translationServiceSelect.value = settings.service;
        }
        
        // Set API keys and models
        if (settings.openai) {
          openaiApiKeyInput.value = settings.openai.apiKey || '';
        }
        
        if (settings.gemini) {
          geminiApiKeyInput.value = settings.gemini.apiKey || '';
          if (settings.gemini.model) {
            geminiModelSelect.value = settings.gemini.model;
          }
        }
        
        if (settings.deepseek) {
          deepseekApiKeyInput.value = settings.deepseek.apiKey || '';
          if (settings.deepseek.model) {
            deepseekModelSelect.value = settings.deepseek.model;
          }
        }
        
        if (settings.grok) {
          grokApiKeyInput.value = settings.grok.apiKey || '';
        }
        
        // Show appropriate settings section
        showHideApiSettings(settings.service || 'google');
      } else {
        // Default to Google Translate if no settings exist
        showHideApiSettings('google');
      }
    });
  }
  
  // Function to show/hide API settings based on selected service
  function showHideApiSettings(service) {
    // Hide all API settings divs
    apiSettingsDivs.forEach(div => {
      div.style.display = 'none';
    });
    
    // Show settings for selected service
    switch (service) {
      case 'openai':
        document.getElementById('openai-settings').style.display = 'block';
        break;
      case 'gemini':
        document.getElementById('gemini-settings').style.display = 'block';
        break;
      case 'deepseek':
        document.getElementById('deepseek-settings').style.display = 'block';
        break;
      case 'grok':
        document.getElementById('grok-settings').style.display = 'block';
        break;
      default:
        // Google Translate doesn't need API key
        break;
    }
  }
  
  // Function to save API settings
  function saveApiSettings() {
    const service = translationServiceSelect.value;
    
    // Create settings object
    const settings = {
      service: service,
      openai: {
        apiKey: openaiApiKeyInput.value.trim()
      },
      gemini: {
        apiKey: geminiApiKeyInput.value.trim(),
        model: geminiModelSelect.value
      },
      deepseek: {
        apiKey: deepseekApiKeyInput.value.trim(),
        model: deepseekModelSelect.value
      },
      grok: {
        apiKey: grokApiKeyInput.value.trim()
      }
    };
    
    // Save to storage
    chrome.storage.local.set({
      'vocabulary-api-settings': JSON.stringify(settings)
    }, function() {
      // Show success message
      const successMsg = document.createElement('div');
      successMsg.className = 'fixed bottom-4 right-4 bg-green-600 text-white p-3 rounded shadow-lg';
      successMsg.innerHTML = 'API settings saved successfully!';
      document.body.appendChild(successMsg);
      
      // Auto hide message after 3 seconds
      setTimeout(() => {
        successMsg.remove();
      }, 3000);
    });
  }
  
  // Function to test API connection
  async function testApiConnection() {
    const service = translationServiceSelect.value;
    
    // Don't need to test Google Translate
    if (service === 'google') {
      showApiTestResult(true, 'Google Translate API is ready to use.');
      return;
    }
    
    // Show processing message
    const testingMsg = document.createElement('div');
    testingMsg.className = 'fixed bottom-4 right-4 bg-blue-600 text-white p-3 rounded shadow-lg';
    testingMsg.innerHTML = `Testing connection to ${service} API...`;
    document.body.appendChild(testingMsg);
    
    try {
      // Test word translation
      const result = await testTranslationAPI(service, 'hello');
      
      // Remove testing message
      testingMsg.remove();
      
      // Show success message
      if (result && result.success) {
        showApiTestResult(true, `Connection successful! Sample translation: "${result.translation}"`);
      } else {
        showApiTestResult(false, `Connection failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      // Remove testing message
      testingMsg.remove();
      
      // Show error message
      showApiTestResult(false, `Error testing API: ${error.message}`);
    }
  }
  
  // Function to show API test result
  function showApiTestResult(success, message) {
    const resultMsg = document.createElement('div');
    resultMsg.className = `fixed bottom-4 right-4 ${success ? 'bg-green-600' : 'bg-red-600'} text-white p-3 rounded shadow-lg max-w-md`;
    resultMsg.innerHTML = message;
    document.body.appendChild(resultMsg);
    
    // Auto hide message after 5 seconds
    setTimeout(() => {
      resultMsg.remove();
    }, 5000);
  }
  
  // Function to test translation API
  async function testTranslationAPI(service, text) {
    try {
      // Get API settings
      const settingsResult = await new Promise(resolve => {
        chrome.storage.local.get(['vocabulary-api-settings'], resolve);
      });
      
      if (!settingsResult['vocabulary-api-settings']) {
        return { success: false, error: 'API settings not found' };
      }
      
      const settings = JSON.parse(settingsResult['vocabulary-api-settings']);
      
      switch (service) {
        case 'openai':
          return await testOpenAITranslation(settings.openai, text);
        case 'gemini':
          return await testGeminiTranslation(settings.gemini, text);
        case 'deepseek':
          return await testDeepseekTranslation(settings.deepseek, text);
        case 'grok':
          return await testGrokTranslation(settings.grok, text);
        default:
          return { success: false, error: 'Invalid service' };
      }
    } catch (error) {
      console.error('Error testing translation API:', error);
      return { success: false, error: error.message || 'Unknown error' };
    }
  }
  
  // Test OpenAI translation
  async function testOpenAITranslation(settings, text) {
    if (!settings || !settings.apiKey) {
      return { success: false, error: 'Missing OpenAI API key' };
    }
    
    try {
      // Sử dụng API chính thức theo hướng dẫn từ OpenAI
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: 'You are a helpful assistant that translates English to Vietnamese. Respond with only the translation, no additional text.' },
            { role: 'user', content: `Translate "${text}" to Vietnamese` }
          ],
          max_tokens: 150,
          temperature: 0.3
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error?.message || 'API request failed';
        
        // Kiểm tra nếu lỗi là vượt quá hạn mức (quota)
        if (errorMessage.includes("exceeded your current quota") || 
            errorMessage.includes("billing") || 
            errorMessage.includes("limit")) {
          
          // Trả về thông báo đặc biệt cho biết lỗi quota nhưng vẫn có thể sử dụng
          return { 
            success: false, 
            error: `${errorMessage} \n\nNote: Despite this error with the test, the extension will still work for translations as it will automatically fall back to Google Translate.`
          };
        }
        
        return { success: false, error: errorMessage };
      }
      
      const data = await response.json();
      const translation = data.choices[0]?.message?.content?.trim();
      
      if (!translation) {
        return { success: false, error: 'No translation received' };
      }
      
      return { success: true, translation };
    } catch (error) {
      console.error('Error with OpenAI translation:', error);
      
      // Kiểm tra lỗi network
      if (error.message.includes("Failed to fetch") || error.message.includes("Network Error")) {
        return { 
          success: false, 
          error: `Network error: ${error.message}. The extension will automatically fall back to Google Translate for actual translations.`
        };
      }
      
      return { success: false, error: error.message || 'Error processing request' };
    }
  }
  
  // Test Gemini translation
  async function testGeminiTranslation(settings, text) {
    if (!settings || !settings.apiKey) {
      return { success: false, error: 'Missing Gemini API key' };
    }
    
    try {
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
              text: `Translate the following English text to Vietnamese, provide only the translation: "${text}"`
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
        return { success: false, error: errorData.error?.message || 'API request failed' };
      }
      
      const data = await response.json();
      
      // Cập nhật xử lý phản hồi cho Gemini 2.0
      let translation;
      if (data.candidates && data.candidates[0]) {
        if (data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
          translation = data.candidates[0].content.parts[0].text?.trim();
        }
      }
      
      if (!translation) {
        return { success: false, error: 'No translation received' };
      }
      
      return { success: true, translation };
    } catch (error) {
      console.error('Error with Gemini translation:', error);
      return { success: false, error: error.message || 'Error processing request' };
    }
  }
  
  // Test DeepSeek translation
  async function testDeepseekTranslation(settings, text) {
    if (!settings || !settings.apiKey) {
      return { success: false, error: 'Missing DeepSeek API key' };
    }
    
    try {
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey}`
        },
        body: JSON.stringify({
          model: settings.model || 'deepseek-chat',
          messages: [
            { role: 'system', content: 'You are a helpful assistant that translates English to Vietnamese. Respond with only the translation, no additional text.' },
            { role: 'user', content: `Translate "${text}" to Vietnamese` }
          ],
          max_tokens: 150
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        return { success: false, error: errorData.error?.message || 'API request failed' };
      }
      
      const data = await response.json();
      const translation = data.choices[0]?.message?.content?.trim();
      
      if (!translation) {
        return { success: false, error: 'No translation received' };
      }
      
      return { success: true, translation };
    } catch (error) {
      console.error('Error with DeepSeek translation:', error);
      return { success: false, error: error.message || 'Error processing request' };
    }
  }
  
  // Test Grok translation
  async function testGrokTranslation(settings, text) {
    if (!settings || !settings.apiKey) {
      return { success: false, error: 'Missing Grok API key' };
    }
    
    try {
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey}`
        },
        body: JSON.stringify({
          model: 'grok-2-latest',
          messages: [
            { role: 'system', content: 'You are a helpful assistant that translates English to Vietnamese. Respond with only the translation, no additional text.' },
            { role: 'user', content: `Translate "${text}" to Vietnamese` }
          ],
          max_tokens: 50,
          temperature: 0.1,
          stream: false
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        return { success: false, error: errorData.error?.message || 'API request failed' };
      }
      
      const data = await response.json();
      const translation = data.choices[0]?.message?.content?.trim();
      
      if (!translation) {
        return { success: false, error: 'No translation received' };
      }
      
      return { success: true, translation };
    } catch (error) {
      console.error('Error with Grok translation:', error);
      return { success: false, error: error.message || 'Error processing request' };
    }
  }

  // Thêm CSS cho dark mode vào head
  function applyQuizletColorScheme() {
    const darkModeStyles = document.createElement('style');
    darkModeStyles.textContent = `
      /* Quizlet Color Scheme - Cập nhật theo hình ảnh */
      :root {
        --quizlet-primary:rgb(88, 27, 220);
        --quizlet-primary-dark:rgb(15, 85, 197);
        --quizlet-primary-light:rgb(72, 78, 192);
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

      /* Light Mode Styles (Default) */
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

      .tab-btn {
        color: var(--quizlet-light-text-secondary);
      }

      .tab-active {
        color: var(--quizlet-primary);
        border-color: var(--quizlet-primary);
      }

      .btn-primary {
        background-color: var(--quizlet-primary);
        color: white;
      }

      .btn-primary:hover {
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
        border-color: var(--quizlet-light-border);
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
      .dark {
        --quizlet-primary:rgb(46, 20, 215);
        --quizlet-primary-dark:rgb(78, 24, 193);
        --quizlet-primary-light:rgb(149, 191, 255);
      }

      .dark body {
        background-color: var(--quizlet-bg-primary);
        color: var(--quizlet-text-primary);
      }
      
      .dark .bg-white {
        background-color: var(--quizlet-bg-card);
      }
      
      .dark .text-gray-700, .dark .text-gray-800, .dark .text-gray-900, .dark .text-normal {
        color: var(--quizlet-text-primary);
      }
      
      .dark .text-gray-500, .dark .text-gray-600, .dark .text-muted {
        color: var(--quizlet-text-secondary);
      }
      
      .dark .text-gray-400 {
        color: var(--quizlet-text-light);
      }
      
      .dark .border-gray-200, .dark .border-gray-300, .dark .border-normal {
        border-color: var(--quizlet-border);
      }
      
      .dark .bg-gray-50, .dark .bg-gray-100, .dark .bg-card {
        background-color: var(--quizlet-bg-card);
        border-color: var(--quizlet-border);
      }
      
      .dark .bg-blue-50 {
        background-color: var(--quizlet-bg-tertiary);
      }
      
      .dark .bg-blue-100 {
        background-color: var(--quizlet-bg-card);
      }
      
      .dark .text-blue-600, .dark .text-blue-700 {
        color: var(--quizlet-primary-light);
      }
      
      .dark input, .dark select, .dark textarea {
        background-color: var(--quizlet-bg-tertiary);
        color: var(--quizlet-text-primary);
        border-color: var(--quizlet-border);
      }
      
      .dark .tab-btn {
        color: var(--quizlet-text-secondary);
      }
      
      .dark .tab-active {
        color: var(--quizlet-primary-light);
        border-color: var(--quizlet-primary-light);
      }
      
      .dark .btn-primary {
        background-color: var(--quizlet-primary);
        color: white;
      }
      
      .dark .btn-primary:hover {
        background-color: var(--quizlet-primary-dark);
      }

      .dark .btn-secondary {
        background-color: var(--quizlet-bg-tertiary);
        color: var(--quizlet-text-secondary);
        border-color: var(--quizlet-border);
      }
      
      .dark .btn-secondary:hover {
        background-color: var(--quizlet-bg-card);
      }
      
      /* Word cards styling */
      .vocabulary-card {
        border-radius: 8px;
        transition: transform 0.2s, box-shadow 0.2s;
      }
      
      .vocabulary-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }
      
      .dark .vocabulary-card:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
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
      
      .dark .pronunciation {
        background-color: var(--quizlet-bg-tertiary);
        color: var(--quizlet-text-secondary);
      }
      
      .pronunciation-icon {
        cursor: pointer;
        margin-left: 4px;
        color: var(--quizlet-primary);
      }
    `;
    document.head.appendChild(darkModeStyles);
  }

  // Khởi tạo dark mode
  initDarkMode();
  applyQuizletColorScheme();
});