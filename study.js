// Study.js - Xử lý chức năng học từ vựng

document.addEventListener('DOMContentLoaded', function() {
  // DOM Elements
  const studyModeTabs = document.getElementById('study-mode-tabs');
  const flashcardsTab = document.getElementById('tab-flashcards');
  const matchTab = document.getElementById('tab-match');
  const studyCategory = document.getElementById('study-category');
  const studyTimeRange = document.getElementById('study-time-range');
  const flashcardsMode = document.getElementById('flashcards-mode');
  const matchMode = document.getElementById('match-mode');
  const flashcardElement = document.getElementById('flashcard');
  const prevCardBtn = document.getElementById('prev-card');
  const nextCardBtn = document.getElementById('next-card');
  const cardCountElement = document.getElementById('card-count');
  const shuffleCardsBtn = document.getElementById('shuffle-cards');
  const startMatchGameBtn = document.getElementById('start-match-game');
  const matchGameBoard = document.getElementById('match-game-board');
  const pairsMatchedElement = document.getElementById('pairs-matched');
  const totalPairsElement = document.getElementById('total-pairs');
  const matchTimerElement = document.getElementById('match-timer');
  const darkModeToggle = document.getElementById('darkModeToggle');
  const refreshDataBtn = document.getElementById('refresh-data');
  
  // Thêm DOM Elements mới
  const flashcardOptions = document.getElementById('flashcard-options');
  const matchOptions = document.getElementById('match-options');
  const flashcardOrderMode = document.getElementById('flashcard-order-mode');
  const matchPairsCount = document.getElementById('match-pairs-count');

  // State cho study mode
  let studyWords = [];
  let currentCardIndex = 0;
  let isCardFlipped = false;
  let matchGameActive = false;
  let matchedPairs = 0;
  let totalPairs = 0;
  let selectedCard = null;
  let selectedCards = []; // Array to track selected cards for Quizlet-style matching
  let gameStartTime = 0;
  let gameTimerInterval = null;
  let currentStudyMode = 'flashcards'; // Default mode
  
  // State cho chế độ học
  let flashcardMode = 'random'; // 'sequential' hoặc 'random'
  let matchPairsPerGame = 10; // Số lượng cặp từ trong match game

  // Debug: Logging dữ liệu hiện có trong localStorage
  logStorageData();

  // Khởi tạo ứng dụng
  initialize();
  
  // Lắng nghe sự kiện storage thay đổi (khi dữ liệu thay đổi từ tab khác)
  window.addEventListener('storage', function(e) {
    console.log('Storage changed:', e);
    
    // Nếu dữ liệu từ vựng hoặc danh mục thay đổi, cập nhật UI
    if (e.key === 'vocabulary-words' || e.key === 'vocabulary-categories') {
      console.log('Vocabulary data changed from another tab, reloading...');
      reloadDataAndUpdateUI();
    }
  });

  // Log dữ liệu localStorage để debug
  function logStorageData() {
    const words = JSON.parse(localStorage.getItem('vocabulary-words') || '[]');
    const categories = JSON.parse(localStorage.getItem('vocabulary-categories') || '[]');
    
    console.log('Debug - localStorage data:');
    console.log('Categories:', categories.length ? categories : 'No categories found');
    console.log('Words:', words.length ? words : 'No words found');
  }

  // Load study categories từ localStorage
  function loadStudyCategories() {
    logStorageData(); // Log dữ liệu hiện tại để debug
    
    console.log('Loading study categories...');
    
    try {
      // Đảm bảo danh mục Default luôn tồn tại trước khi tải
      // Sử dụng Promise từ ensureDefaultCategory để đảm bảo dữ liệu được đồng bộ đúng cách
      ensureDefaultCategory().then(categories => {
        console.log('Categories after ensuring default:', categories.length);
        
        // Hiển thị chi tiết về các danh mục được tải
        if (categories.length > 0) {
          console.log('Available categories:', categories.map(cat => ({ 
            id: cat.id, 
            name: cat.name 
          })));
        } else {
          console.warn('No categories found after ensuring default, this should not happen');
          // Nếu bằng cách nào đó vẫn không có danh mục, tạo lại danh mục mặc định
          const defaultCategory = { 
            id: 'default', 
            name: 'Default',
            sourceLanguage: 'en',
            targetLanguage: 'vi'
          };
          
          // Lưu trực tiếp vào localStorage để đảm bảo có ít nhất một danh mục
          localStorage.setItem('vocabulary-categories', JSON.stringify([defaultCategory]));
          console.log('Created emergency default category');
          
          // Đồng bộ với extension storage nếu đang trong extension context
          if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({
              'vocabulary-categories': JSON.stringify([defaultCategory])
            }, function() {
              if (chrome.runtime.lastError) {
                console.error('Error syncing emergency default category:', chrome.runtime.lastError);
              } else {
                console.log('Emergency default category synced to extension storage');
              }
            });
          }
          
          // Sử dụng danh mục mặc định này cho việc hiển thị
          categories = [defaultCategory];
        }
        
        // Lưu lại lựa chọn danh mục hiện tại nếu có
        const currentSelection = studyCategory.value;
        console.log('Current category selection before reload:', currentSelection);
        
        // Xóa tất cả option hiện tại trừ option "All categories"
        while (studyCategory.options.length > 1) {
          studyCategory.remove(1);
        }
        
        // Sử dụng danh mục từ ensureDefaultCategory thay vì đọc lại từ localStorage
        // Điều này đảm bảo chúng ta sử dụng dữ liệu mới nhất từ chrome.storage.local
        
        // Thêm các category từ danh sách đã đồng bộ
        categories.forEach(category => {
          const option = document.createElement('option');
          option.value = category.id;
          option.textContent = category.name;
          studyCategory.appendChild(option);
          console.log(`Added category option: ${category.name} (${category.id})`);
        });
        
        console.log('Finished loading categories, total options:', studyCategory.options.length);
        
        // Khôi phục lựa chọn danh mục trước đó nếu vẫn tồn tại
        if (currentSelection) {
          const categoryExists = Array.from(studyCategory.options).some(opt => opt.value === currentSelection);
          if (categoryExists) {
            studyCategory.value = currentSelection;
            console.log('Restored previous category selection:', currentSelection);
          } else {
            console.warn('Previous category selection no longer exists:', currentSelection);
            studyCategory.value = 'all'; // Fallback to "All" if category no longer exists
          }
        }
        
        // Tải lại danh sách từ vựng sau khi các tùy chọn danh mục đã được cập nhật
        filterStudyWords();
      }).catch(error => {
        console.error('Error processing categories:', error);
        // Xử lý lỗi nếu có
      });
    } catch (error) {
      console.error('Error in loadStudyCategories:', error);
      // Xử lý các lỗi không mong muốn
      alert('There was an error loading categories. The page will reload to fix this issue.');
      // Tải lại trang để khắc phục
      window.location.reload();
    }
  }

  // Set up tab navigation
  function setupTabNavigation() {
    // Add click event listeners to tabs
    flashcardsTab.addEventListener('click', () => {
      switchTab('flashcards');
    });
    
    matchTab.addEventListener('click', () => {
      switchTab('match');
    });
  }
  
  // Switch between study mode tabs
  function switchTab(mode) {
    console.log('Switching to tab:', mode);
    
    // Update current study mode
    currentStudyMode = mode;
    
    // Update active tab styling
    document.querySelectorAll('.tab-btn').forEach(tab => {
      tab.classList.remove('tab-active');
    });
    
    // Add active styling to selected tab
    const activeTab = document.getElementById(`tab-${mode}`);
    if (activeTab) {
      activeTab.classList.add('tab-active');
    } else {
      console.warn(`Tab element with ID tab-${mode} not found`);
    }
    
    // Show/hide study mode options dựa vào chế độ được chọn
    if (mode === 'flashcards') {
      flashcardOptions.classList.remove('hidden');
      matchOptions.classList.add('hidden');
    } else if (mode === 'match') {
      flashcardOptions.classList.add('hidden');
      matchOptions.classList.remove('hidden');
    }
    
    // Lưu chế độ hiện tại vào localStorage để duy trì lựa chọn
    localStorage.setItem('current-study-mode', mode);
    
    // Show appropriate study mode content
    showStudyMode(mode);
  }
  
  // Show the selected study mode content
  function showStudyMode(mode) {
    console.log('Showing study mode:', mode);
    
    if (mode === 'flashcards') {
      // Đảm bảo flashcards được hiển thị và match game bị ẩn
      flashcardsMode.classList.remove('hidden');
      matchMode.classList.add('hidden');
      
      // Khởi tạo flashcards
      console.log('Initializing flashcards');
      initFlashcards();
    } else if (mode === 'match') {
      // Đảm bảo match game được hiển thị và flashcards bị ẩn
      flashcardsMode.classList.add('hidden');
      matchMode.classList.remove('hidden');
      
      // Khởi tạo match game
      console.log('Initializing match game');
      initMatchGame();
      
      // Lưu ý: Không bắt đầu game ngay lập tức, người dùng cần click "Start Game"
      // Việc bắt đầu game sẽ được xử lý bởi hàm reloadDataAndUpdateUI nếu được gọi với mode='match'
      // hoặc khi người dùng click vào nút Start trong giao diện
    }
  }

  // Hàm hiển thị thông tin chi tiết về các từ vựng để debug
  function debugVocabularyData(label, words) {
    console.group(`Debug vocabulary data: ${label} (${words.length} words)`);
    
    if (words.length === 0) {
      console.log('No words to display');
    } else {
      // Giới hạn số lượng từ được hiển thị để tránh spam console
      const maxDisplay = Math.min(5, words.length);
      
      for (let i = 0; i < maxDisplay; i++) {
        const word = words[i];
        console.log(`Word ${i+1}/${maxDisplay}:`, {
          id: word.id,
          text: word.text,
          meaning: word.meaning,
          categoryId: word.categoryId,
          createdAt: new Date(word.createdAt).toLocaleString()
        });
      }
      
      if (words.length > maxDisplay) {
        console.log(`... and ${words.length - maxDisplay} more words`);
      }
      
      // Phân tích danh mục
      const categories = {};
      words.forEach(word => {
        const catId = word.categoryId || 'undefined';
        categories[catId] = (categories[catId] || 0) + 1;
      });
      
      console.log('Category distribution:', categories);
    }
    
    console.groupEnd();
    return words; // Trả về mảng đầu vào để có thể sử dụng trong chuỗi method
  }
  
  // Filter study words dựa trên category và time range
  function filterStudyWords() {
    console.log('Filtering study words...');
    
    // Lấy dữ liệu từ priority: chrome.storage.local > localStorage
    let allWords = [];
    let dataSource = 'localStorage'; // Track data source for logging
    
    // Định nghĩa một hàm promise để lấy dữ liệu từ chrome.storage.local nếu có thể
    const getDataFromChromeStorage = () => {
      return new Promise((resolve) => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          console.log('Attempting to read words from chrome.storage.local');
          chrome.storage.local.get(['vocabulary-words'], function(result) {
            if (chrome.runtime.lastError) {
              console.error('Error reading from chrome.storage.local:', chrome.runtime.lastError);
              resolve(null); // Resolve with null to indicate failure
              return;
            }
            
            if (result['vocabulary-words']) {
              try {
                const words = JSON.parse(result['vocabulary-words']);
                if (Array.isArray(words)) {
                  console.log(`Successfully read ${words.length} words from chrome.storage.local`);
                  resolve(words);
                  return;
                }
              } catch (error) {
                console.error('Error parsing words from chrome.storage.local:', error);
              }
            }
            
            resolve(null); // Resolve with null if no valid data found
          });
        } else {
          resolve(null); // Not in extension context or API not available
        }
      });
    };
    
    // Sử dụng IIFE async để đọc dữ liệu bất đồng bộ
    (async () => {
      // Thử đọc từ chrome.storage.local trước
      const chromeData = await getDataFromChromeStorage();
      
      if (chromeData) {
        allWords = chromeData;
        dataSource = 'chrome.storage.local';
        // Đồng bộ localStorage với chrome.storage.local
        try {
          localStorage.setItem('vocabulary-words', JSON.stringify(allWords));
          console.log('Synchronized localStorage with chrome.storage.local data');
        } catch (error) {
          console.warn('Could not update localStorage:', error);
        }
      } else {
        // Fallback to localStorage
        console.log('Falling back to localStorage for words data');
        try {
          const localDataStr = localStorage.getItem('vocabulary-words');
          if (localDataStr) {
            const localData = JSON.parse(localDataStr);
            if (Array.isArray(localData)) {
              allWords = localData;
              console.log(`Read ${allWords.length} words from localStorage`);
            } else {
              console.error('localStorage data is not an array');
            }
          } else {
            console.warn('No vocabulary words found in localStorage');
          }
        } catch (error) {
          console.error('Error reading from localStorage:', error);
        }
      }
      
      if (allWords.length === 0) {
        console.warn('No vocabulary words found in any storage');
        studyWords = [];
        return studyWords;
      }
      
      console.log(`Found ${allWords.length} words from ${dataSource}`);
      
      // Làm sạch dữ liệu trước khi sử dụng
      const validCategoryIds = [];
      let dataModified = false;
      
      // Lấy danh sách danh mục hiện có
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(['vocabulary-categories'], function(result) {
            if (result['vocabulary-categories']) {
              const categories = JSON.parse(result['vocabulary-categories']);
              if (Array.isArray(categories)) {
                categories.forEach(cat => {
                  if (cat && cat.id) validCategoryIds.push(cat.id);
                });
                console.log('Valid category IDs from chrome storage:', validCategoryIds);
              }
            }
          });
        } else {
          const categoriesStr = localStorage.getItem('vocabulary-categories');
          if (categoriesStr) {
            const categories = JSON.parse(categoriesStr);
            if (Array.isArray(categories)) {
              categories.forEach(cat => {
                if (cat && cat.id) validCategoryIds.push(cat.id);
              });
              console.log('Valid category IDs from localStorage:', validCategoryIds);
            }
          }
        }
      } catch (error) {
        console.error('Error getting valid category IDs:', error);
      }
      
      // Lấy trực tiếp danh mục từ chrome.storage.local để đảm bảo đồng bộ
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['vocabulary-categories'], function(result) {
          try {
            if (result['vocabulary-categories']) {
              const categories = JSON.parse(result['vocabulary-categories']);
              if (Array.isArray(categories)) {
                // Xóa danh sách cũ và thêm danh sách mới
                validCategoryIds.length = 0;
                categories.forEach(cat => {
                  if (cat && cat.id) validCategoryIds.push(cat.id);
                });
                console.log('Updated valid category IDs from chrome storage:', validCategoryIds);
              }
            }
          } catch (error) {
            console.error('Error getting updated category IDs:', error);
          }
        });
      }
      
      // Đảm bảo 'default' luôn là một ID hợp lệ
      if (!validCategoryIds.includes('default')) {
        validCategoryIds.push('default');
      }
      
      // Kiểm tra và sửa từ vựng có danh mục không hợp lệ
      // Chỉ thay đổi thành danh mục mặc định nếu categoryId rõ ràng không hợp lệ
      allWords.forEach(word => {
        if (word && word.id) {
          // Kiểm tra và sửa categoryId nếu không hợp lệ
          if (!word.categoryId || 
              typeof word.categoryId !== 'string' || 
              word.categoryId === 'undefined') {
            
            console.warn(`Word "${word.text}" has invalid categoryId format: ${word.categoryId}, fixing to default`);
            word.categoryId = 'default';
            dataModified = true;
          }
          // Chỉ thay đổi kategori nếu không có trong danh sách và rỗng hoặc không xác định
          // Không chuyển đổi các ID danh mục đã được thiết lập thành mặc định
          else if (!validCategoryIds.includes(word.categoryId) && 
                   (word.categoryId === '' || word.categoryId === 'undefined')) {
            console.warn(`Word "${word.text}" has unknown empty/undefined categoryId: ${word.categoryId}, fixing to default`);
            word.categoryId = 'default';
            dataModified = true;
          }
          
          // Đảm bảo có trường createdAt
          if (!word.createdAt) {
            word.createdAt = Date.now();
            dataModified = true;
          }
        }
      });
      
      // Lưu lại nếu có sửa đổi
      if (dataModified) {
        console.log('Fixed invalid categoryIds in words, saving back to localStorage');
        localStorage.setItem('vocabulary-words', JSON.stringify(allWords));
        
        // Đồng bộ với extension storage nếu đang trong extension context
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({
            'vocabulary-words': JSON.stringify(allWords)
          }, function() {
            if (chrome.runtime.lastError) {
              console.error('Error saving fixed words to extension storage:', chrome.runtime.lastError);
            } else {
              console.log('Fixed words saved to extension storage');
            }
          });
        }
      }
      
      // Kiểm tra cấu trúc dữ liệu từ vựng
      const validWords = validateWordData(allWords);
      console.log('Valid words after checking structure:', validWords.length);
      
      // Debug thông tin về dữ liệu hợp lệ
      debugVocabularyData('Valid words', validWords);
      
      // Lấy giá trị category hiện tại 
      const selectedCategory = studyCategory.value;
      console.log('Current selected category:', selectedCategory);
      
      // In ra tất cả các categoryId hiện có trong dữ liệu để debug
      const uniqueCategoryIds = [...new Set(validWords.map(word => word.categoryId))];
      console.log('Unique categoryIds in data:', uniqueCategoryIds);
      
      // Filter theo category
      let filteredWords = validWords;
      if (selectedCategory !== 'all') {
        // Kiểm tra định dạng categoryId trong dữ liệu
        if (validWords.length > 0) {
          const sampleWord = validWords[0];
          console.log('Sample word categoryId type:', typeof sampleWord.categoryId, 'value:', sampleWord.categoryId);
        }
        
        // Đảm bảo so sánh chuỗi với chuỗi
        filteredWords = validWords.filter(word => {
          // Đảm bảo categoryId là chuỗi trước khi so sánh
          const wordCategoryId = String(word.categoryId || 'default');
          const selectedCategoryId = String(selectedCategory);
          
          const match = wordCategoryId === selectedCategoryId;
          return match;
        });
        
        console.log('Filtered by category:', selectedCategory, 'resulting count:', filteredWords.length);
      }
      
      // Filter theo time range
      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;
      const oneWeek = 7 * oneDay;
      const oneMonth = 30 * oneDay;
      
      if (studyTimeRange.value === 'day') {
        filteredWords = filteredWords.filter(word => now - word.createdAt < oneDay);
        console.log('Filtered by time range: day, count:', filteredWords.length);
      } else if (studyTimeRange.value === 'week') {
        filteredWords = filteredWords.filter(word => now - word.createdAt < oneWeek);
        console.log('Filtered by time range: week, count:', filteredWords.length);
      } else if (studyTimeRange.value === 'month') {
        filteredWords = filteredWords.filter(word => now - word.createdAt < oneMonth);
        console.log('Filtered by time range: month, count:', filteredWords.length);
      }
      
      // Kiểm tra nếu sau khi lọc không còn từ nào
      if (filteredWords.length === 0) {
        console.warn(`No words found for category: ${selectedCategory} and time range: ${studyTimeRange.value}`);
      }
      
      // Lưu kết quả vào biến studyWords toàn cục để sử dụng trong các hàm khác
      studyWords = [...filteredWords].sort(() => Math.random() - 0.5);
      console.log('Final study words count:', studyWords.length);
      
      // Cập nhật UI
      if (currentStudyMode === 'flashcards') {
        updateFlashcardContent();
        updateFlashcardControls();
      } else if (currentStudyMode === 'match') {
        initMatchGame();
      }
      
      return studyWords;
    })();
    
    // Trả về studyWords hiện tại cho việc gọi đồng bộ
    return studyWords;
  }

  // Hàm kiểm tra và đảm bảo cấu trúc dữ liệu từ vựng hợp lệ
  function validateWordData(words) {
    if (!Array.isArray(words)) {
      console.error('Word data is not an array:', words);
      return [];
    }
    
    // Lấy danh sách danh mục hiện có để kiểm tra
    const categoriesStr = localStorage.getItem('vocabulary-categories');
    let availableCategories = [];
    let defaultCategoryId = 'default';
    
    try {
      if (categoriesStr) {
        availableCategories = JSON.parse(categoriesStr);
        // Tạo map ID danh mục cho việc kiểm tra nhanh
        const categoryIds = availableCategories.map(cat => cat.id);
        console.log('Available category IDs for validation:', categoryIds);
      }
    } catch (error) {
      console.error('Error parsing categories for validation:', error);
    }
    
    // Lọc để chỉ giữ lại các từ có cấu trúc đúng
    return words.filter(word => {
      // Kiểm tra các trường bắt buộc
      if (!word || typeof word !== 'object') return false;
      if (!word.id || !word.text || !word.meaning) {
        console.warn('Word missing required fields:', word);
        return false;
      }
      
      // Đảm bảo rằng các trường có giá trị hợp lệ
      if (typeof word.text !== 'string' || typeof word.meaning !== 'string') {
        console.warn('Word has invalid text or meaning:', word);
        return false;
      }
      
      // Đảm bảo rằng trường createdAt tồn tại và có giá trị hợp lệ
      if (!word.createdAt) {
        // Thêm trường createdAt nếu không có
        word.createdAt = Date.now();
      }
      
      // Xử lý categoryId
      // Kiểm tra nếu categoryId không tồn tại, undefined, null hoặc rỗng
      if (!word.categoryId || word.categoryId === 'undefined') {
        console.warn('Word missing categoryId or has invalid categoryId, setting default:', word);
        word.categoryId = defaultCategoryId;
      }
      
      // Đảm bảo categoryId là chuỗi
      if (typeof word.categoryId !== 'string') {
        console.warn('Word has non-string categoryId, converting:', word.categoryId);
        word.categoryId = String(word.categoryId);
      }
      
      // Kiểm tra xem categoryId có tồn tại trong danh sách danh mục hiện có không
      if (availableCategories.length > 0) {
        const categoryExists = availableCategories.some(cat => cat.id === word.categoryId);
        if (!categoryExists) {
          console.warn(`Word has categoryId (${word.categoryId}) that doesn't exist in available categories, changing to default:`, word);
          word.categoryId = defaultCategoryId;
        }
      }
      
      return true;
    });
  }

  // Initialize flashcards
  function initFlashcards() {
    // Lấy danh sách từ sau khi lọc
    const words = filterStudyWords();
    
    // Reset state
    currentCardIndex = 0;
    isCardFlipped = false;
    
    // Lấy chế độ học từ dropdown
    flashcardMode = flashcardOrderMode.value;
    
    if (words.length === 0) {
      // Không có từ vựng nào để học
      const selectedCategory = studyCategory.value;
      const selectedTimeRange = studyTimeRange.value;
      
      // Hiển thị thông báo cụ thể hơn dựa trên bộ lọc đã chọn
      let noWordsMessage = '<h3 class="text-white text-2xl font-bold">No vocabulary to study</h3>';
      
      if (selectedCategory !== 'all') {
        // Tìm tên danh mục từ ID
        let categoryName = 'selected category';
        try {
          const categories = JSON.parse(localStorage.getItem('vocabulary-categories') || '[]');
          const category = categories.find(cat => cat.id === selectedCategory);
          if (category) {
            categoryName = category.name;
          }
        } catch (error) {
          console.error('Error getting category name:', error);
        }
        
        noWordsMessage += `<p class="text-white text-lg mt-2">No words found in the "${categoryName}" category`;
        
        if (selectedTimeRange !== 'all') {
          noWordsMessage += ` within the selected time range (${selectedTimeRange})`;
        }
        
        noWordsMessage += '.</p>';
      } else if (selectedTimeRange !== 'all') {
        let timeRangeText = '';
        switch (selectedTimeRange) {
          case 'day': timeRangeText = 'the last 24 hours'; break;
          case 'week': timeRangeText = 'the last 7 days'; break;
          case 'month': timeRangeText = 'the last 30 days'; break;
          default: timeRangeText = 'the selected time range';
        }
        
        noWordsMessage += `<p class="text-white text-lg mt-2">No words added in ${timeRangeText}.</p>`;
      } else {
        noWordsMessage += '<p class="text-white text-lg mt-2">Please add some vocabulary words first.</p>';
      }
      
      noWordsMessage += '<p class="text-white text-md mt-3">Try changing the category or time range filter.</p>';
      
      flashcardElement.querySelector('.flashcard-front').innerHTML = noWordsMessage;
      flashcardElement.querySelector('.flashcard-back').innerHTML = '<h3 class="text-white text-2xl">Please add words or change filters</h3>';
      cardCountElement.textContent = '0/0';
      prevCardBtn.disabled = true;
      nextCardBtn.disabled = true;
      prevCardBtn.classList.add('opacity-50', 'cursor-not-allowed');
      nextCardBtn.classList.add('opacity-50', 'cursor-not-allowed');
      console.log('No words available for flashcard study');
      return;
    }
    
    // Sắp xếp từ dựa trên chế độ học
    if (flashcardMode === 'random') {
      // Shuffle ngẫu nhiên
      studyWords = [...words].sort(() => Math.random() - 0.5);
      console.log('Flashcards initialized in random order');
    } else {
      // Chế độ sequential: không shuffle
      studyWords = [...words]; // Chỉ sao chép mảng, không shuffle
      console.log('Flashcards initialized in sequential order');
    }
    
    // Cập nhật nút Shuffle & Start dựa trên chế độ hiện tại
    if (flashcardMode === 'random') {
      shuffleCardsBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Shuffle & Start
      `;
    } else {
      shuffleCardsBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Start Learning
      `;
    }
    
    // Cập nhật UI
    updateFlashcardContent();
    updateFlashcardControls();
  }

  // Update nội dung flashcard
  function updateFlashcardContent() {
    if (studyWords.length === 0) {
      console.log('No study words available');
      return;
    }
    
    console.log('Updating flashcard content for word at index:', currentCardIndex);
    const currentWord = studyWords[currentCardIndex];
    console.log('Current word:', currentWord);
    
    if (!currentWord || !currentWord.text) {
      console.error('Invalid word data at index:', currentCardIndex);
      return;
    }
    
    // Đảm bảo currentWord có các thuộc tính cần thiết
    currentWord.meaning = currentWord.meaning || 'No meaning available';
    
    // Đảm bảo pronunciation có cấu trúc đúng
    if (!currentWord.pronunciation || typeof currentWord.pronunciation !== 'object') {
      console.log('Creating default pronunciation object for word:', currentWord.text);
      currentWord.pronunciation = {
        text: '',
        audio: '',
        useBrowserSpeech: true,
        word: currentWord.text
      };
    }
    
    // Hiển thị thông tin từ vựng trên flashcard
    const frontCard = flashcardElement.querySelector('.flashcard-front');
    const backCard = flashcardElement.querySelector('.flashcard-back');
    
    if (!frontCard || !backCard) {
      console.error('Card elements not found');
      return;
    }
    
    // Xóa nội dung cũ
    frontCard.innerHTML = '';
    backCard.innerHTML = '';
    
    // Tạo nội dung cho mặt trước
    const wordText = document.createElement('h3');
    wordText.className = 'text-white text-2xl font-bold mb-2';
    wordText.textContent = currentWord.text;
    frontCard.appendChild(wordText);
    
    // Thêm phiên âm và nút phát âm
    const pronContainer = document.createElement('div');
    pronContainer.className = 'flex items-center mt-2';
    
    // Hiển thị phiên âm text nếu có
    if (currentWord.pronunciation && currentWord.pronunciation.text) {
      const phoneticText = document.createElement('span');
      phoneticText.className = 'text-white text-sm opacity-80 mr-2';
      phoneticText.textContent = currentWord.pronunciation.text;
      pronContainer.appendChild(phoneticText);
    }
    
    // Luôn thêm nút phát âm, bất kể có pronunciation hay không
    const pronButton = document.createElement('button');
    pronButton.className = 'p-1 bg-white bg-opacity-20 text-white rounded-full hover:bg-opacity-30 focus:outline-none transition-all duration-200';
    pronButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>';
    pronButton.title = 'Listen to pronunciation';
    
    // Xử lý phát âm
    pronButton.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      // Tránh nhiều cú nhấp liên tiếp
      if (this.disabled) return;
      
      // Vô hiệu hóa nút trong khi đang phát
      this.disabled = true;
      setTimeout(() => { this.disabled = false; }, 1500);
      
      playPronunciation(currentWord);
    });
    
    pronContainer.appendChild(pronButton);
    frontCard.appendChild(pronContainer);
    
    // Thêm hướng dẫn nhỏ
    const clickHint = document.createElement('div');
    clickHint.className = 'absolute bottom-4 left-0 right-0 text-center text-white text-xs opacity-70';
    clickHint.innerHTML = 'Click to reveal meaning';
    frontCard.appendChild(clickHint);
    
    // Tạo nội dung cho mặt sau
    const meaningText = document.createElement('h3');
    meaningText.className = 'text-white text-xl mb-4';
    meaningText.textContent = currentWord.meaning;
    backCard.appendChild(meaningText);
    
    // Thêm từ gốc ở dưới meaning để nhắc nhở
    const originalWord = document.createElement('div');
    originalWord.className = 'text-white text-sm font-medium opacity-80';
    originalWord.textContent = currentWord.text;
    backCard.appendChild(originalWord);
    
    // Thêm hướng dẫn nhỏ
    const backHint = document.createElement('div');
    backHint.className = 'absolute bottom-4 left-0 right-0 text-center text-white text-xs opacity-70';
    backHint.innerHTML = 'Click to flip back';
    backCard.appendChild(backHint);
    
    // Reset trạng thái card
    if (isCardFlipped) {
      flashcardElement.classList.remove('flipped');
      isCardFlipped = false;
    }
    
    // Cập nhật counter
    cardCountElement.textContent = `${currentCardIndex + 1}/${studyWords.length}`;
    console.log('Flashcard content updated successfully');
  }

  // Thêm hàm updateFlashcardControls để kiểm soát nút Prev/Next
  function updateFlashcardControls() {
    console.log('Updating flashcard controls');
    
    if (studyWords.length === 0) {
      // Nếu không có từ nào, vô hiệu hóa cả hai nút
      prevCardBtn.disabled = true;
      nextCardBtn.disabled = true;
      prevCardBtn.classList.add('opacity-50', 'cursor-not-allowed');
      nextCardBtn.classList.add('opacity-50', 'cursor-not-allowed');
      return;
    }
    
    // Kiểm tra nút Previous
    if (currentCardIndex <= 0) {
      // Không thể quay lại nữa
      prevCardBtn.disabled = true;
      prevCardBtn.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
      // Có thể quay lại
      prevCardBtn.disabled = false;
      prevCardBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
    
    // Kiểm tra nút Next
    if (currentCardIndex >= studyWords.length - 1) {
      // Không thể tiến tiếp
      nextCardBtn.disabled = true;
      nextCardBtn.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
      // Có thể tiến tiếp
      nextCardBtn.disabled = false;
      nextCardBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
    
    console.log('Flashcard controls updated - prevEnabled:', !prevCardBtn.disabled, 'nextEnabled:', !nextCardBtn.disabled);
  }

  // Phát âm từ vựng
  function playPronunciation(word) {
    if (!word) {
      console.error('Invalid word object passed to playPronunciation');
      return;
    }
    
    console.log('Playing pronunciation for word:', word.text);
    
    // Đảm bảo word.text tồn tại
    const textToSpeak = word.text || '';
    if (!textToSpeak) {
      console.error('Word has no text to pronounce');
      return;
    }
    
    // Hiển thị hiệu ứng đang phát
    const frontCard = flashcardElement.querySelector('.flashcard-front');
    if (!frontCard) {
      console.error('Front card element not found');
      return;
    }
    
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'absolute top-2 right-2 text-white text-xs bg-black bg-opacity-20 px-2 py-1 rounded-full';
    loadingIndicator.textContent = 'Playing...';
    frontCard.appendChild(loadingIndicator);
    
    // Xử lý phát âm dựa trên loại nguồn
    try {
      // Kiểm tra nếu có audio URL hợp lệ
      if (word.pronunciation && 
          word.pronunciation.audio && 
          typeof word.pronunciation.audio === 'string' &&
          word.pronunciation.audio !== 'undefined' && 
          word.pronunciation.audio.startsWith('http')) {
          
        console.log('Playing audio from URL:', word.pronunciation.audio);
        
        // Phát audio từ URL
        const audio = new Audio(word.pronunciation.audio);
        
        audio.oncanplaythrough = function() {
          console.log('Audio loaded and ready to play');
          loadingIndicator.textContent = 'Playing audio...';
        };
        
        audio.onended = function() {
          console.log('Audio playback completed');
          if (loadingIndicator.parentNode) {
            loadingIndicator.remove();
          }
        };
        
        audio.onerror = function(error) {
          console.error('Audio error:', error);
          loadingIndicator.textContent = 'Audio failed, using speech...';
          // Fallback to speech synthesis if audio fails
          playSpeechSynthesis(textToSpeak, loadingIndicator);
        };
        
        audio.play().catch(error => {
          console.error('Error playing audio:', error);
          loadingIndicator.textContent = 'Audio failed, using speech...';
          // Fallback to speech synthesis if audio fails
          playSpeechSynthesis(textToSpeak, loadingIndicator);
        });
      } else {
        // Không có audio URL hoặc URL không hợp lệ, dùng speech synthesis
        console.log('No valid audio URL found, using speech synthesis for:', textToSpeak);
        loadingIndicator.textContent = 'Using speech...';
        playSpeechSynthesis(textToSpeak, loadingIndicator);
      }
    } catch (error) {
      console.error('Error playing pronunciation:', error);
      loadingIndicator.textContent = 'Error, trying speech...';
      // Vẫn thử dùng speech synthesis trong trường hợp lỗi
      playSpeechSynthesis(textToSpeak, loadingIndicator);
    }
  }

  // Phát âm bằng Web Speech API
  function playSpeechSynthesis(text, loadingIndicator) {
    console.log('Using Speech Synthesis for pronunciation:', text);
    
    // Kiểm tra nếu text không hợp lệ
    if (!text || typeof text !== 'string') {
      console.error('Invalid text for speech synthesis:', text);
      if (loadingIndicator && loadingIndicator.parentNode) {
        loadingIndicator.textContent = 'Invalid text';
        setTimeout(() => {
          if (loadingIndicator.parentNode) {
            loadingIndicator.remove();
          }
        }, 2000);
      }
      return;
    }
    
    // Kiểm tra nếu trình duyệt có hỗ trợ SpeechSynthesis
    if (window.speechSynthesis) {
      if (loadingIndicator) {
        loadingIndicator.textContent = 'Synthesizing speech...';
      }
      
      // Reset speech synthesis nếu đang bị treo
      if (speechSynthesis.speaking || speechSynthesis.pending) {
        speechSynthesis.cancel();
      }
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9; // Giảm tốc độ nói để rõ hơn
      utterance.pitch = 1;
      utterance.lang = 'en-US'; // Đặt ngôn ngữ mặc định
      
      // Hàm setup voice và phát âm
      const setupVoiceAndSpeak = function() {
        try {
          const voices = speechSynthesis.getVoices();
          
          if (voices && voices.length > 0) {
            console.log('Available voices:', voices.length);
            
            // Ưu tiên giọng en-US của Google
            const englishVoice = 
              voices.find(voice => voice.name.includes('Google US English')) || 
              voices.find(voice => voice.name.includes('Google UK English')) || 
              voices.find(voice => voice.lang.includes('en-US')) || 
              voices.find(voice => voice.lang.includes('en-')) || 
              voices[0]; // Fallback to first voice
            
            if (englishVoice) {
              console.log('Using voice:', englishVoice.name);
              utterance.voice = englishVoice;
            }
          }
          
          // Xóa indicator khi phát xong
          utterance.onend = function() {
            if (loadingIndicator && loadingIndicator.parentNode) {
              loadingIndicator.remove();
            }
          };
          
          utterance.onerror = function(error) {
            console.error('Speech synthesis error:', error);
            if (loadingIndicator && loadingIndicator.parentNode) {
              loadingIndicator.textContent = 'Speech failed';
              setTimeout(() => {
                if (loadingIndicator.parentNode) {
                  loadingIndicator.remove();
                }
              }, 2000);
            }
          };
          
          // Phát âm
          speechSynthesis.speak(utterance);
        } catch (error) {
          console.error('Error setting up voice:', error);
          if (loadingIndicator && loadingIndicator.parentNode) {
            loadingIndicator.textContent = 'Speech error';
            setTimeout(() => loadingIndicator.remove(), 2000);
          }
        }
      };
      
      // Nếu danh sách giọng nói chưa sẵn sàng
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        // Chrome và một số trình duyệt cần onvoiceschanged event
        speechSynthesis.onvoiceschanged = setupVoiceAndSpeak;
        
        // Đôi khi event không được gọi, thiết lập timeout để đảm bảo
        setTimeout(setupVoiceAndSpeak, 500);
      } else {
        // Firefox và một số trình duyệt khác không cần event
        setupVoiceAndSpeak();
      }
    } else {
      // Không hỗ trợ SpeechSynthesis
      console.error('Speech Synthesis not supported in this browser');
      if (loadingIndicator && loadingIndicator.parentNode) {
        loadingIndicator.textContent = 'Speech not supported';
        setTimeout(() => {
          if (loadingIndicator.parentNode) {
            loadingIndicator.remove();
          }
        }, 2000);
      }
    }
  }

  // Hàm cập nhật tùy chọn match game dựa trên số lượng từ vựng có sẵn
  function updateMatchGameOptions(wordCount) {
    // Lấy tất cả options trong select
    const options = Array.from(matchPairsCount.options);
    
    // Duyệt qua các tùy chọn để ẩn/hiện dựa trên số lượng từ có sẵn
    options.forEach(option => {
      if (option.value === 'all') return; // Giữ nguyên tùy chọn "All available"
      
      const pairCount = parseInt(option.value, 10);
      if (pairCount > wordCount) {
        // Nếu số cặp cần nhiều hơn số từ có sẵn, disabled option
        option.disabled = true;
        option.textContent = `${pairCount} pairs (not enough words)`;
      } else {
        // Ngược lại, enable option
        option.disabled = false;
        option.textContent = `${pairCount} pairs`;
      }
    });
    
    // Kiểm tra nếu tùy chọn hiện tại bị vô hiệu hóa, chọn tùy chọn "all" thay thế
    if (matchPairsCount.selectedOptions[0].disabled) {
      matchPairsCount.value = 'all';
    }
  }

  // Các hàm phát âm thanh hiệu ứng game
  function playCardFlipSound() {
    // Dùng tạm Web Audio API để tạo âm thanh ngắn khi lật thẻ
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(500, audioCtx.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.1);
    } catch (e) {
      // Bỏ qua lỗi âm thanh - không ảnh hưởng đến gameplay
      console.log('Sound effect not supported');
    }
  }
  
  function playMatchSuccessSound() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(300, audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(500, audioCtx.currentTime + 0.1);
      oscillator.frequency.exponentialRampToValueAtTime(700, audioCtx.currentTime + 0.2);
      
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.2, audioCtx.currentTime + 0.1);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
      console.log('Sound effect not supported');
    }
  }
  
  function playMatchFailSound() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(400, audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.2);
      
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.2);
    } catch (e) {
      console.log('Sound effect not supported');
    }
  }
  
  function playGameWinSound() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      
      // Tạo chuỗi âm thanh ngắn giống như fanfare
      [0, 0.1, 0.2, 0.3, 0.4].forEach((delay, i) => {
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        const baseFreq = 300 + (i * 100);
        oscillator.type = i % 2 === 0 ? 'sine' : 'triangle';
        oscillator.frequency.setValueAtTime(baseFreq, audioCtx.currentTime + delay);
        oscillator.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, audioCtx.currentTime + delay + 0.1);
        
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime + delay);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + delay + 0.3);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.start(audioCtx.currentTime + delay);
        oscillator.stop(audioCtx.currentTime + delay + 0.3);
      });
    } catch (e) {
      console.log('Sound effect not supported');
    }
  }

  // Update timer cho match game
  function updateMatchTimer() {
    if (!gameStartTime) return;
    
    const elapsedSeconds = Math.floor((Date.now() - gameStartTime) / 1000);
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    
    matchTimerElement.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }

  // Toggle giữa các study modes
  function toggleStudyModes() {
    showStudyMode(currentStudyMode);
  }

  // Cập nhật Event Listeners cho category
  function setupEventListeners() {
    // Event listener cho category selector - đảm bảo xử lý đúng
    studyCategory.addEventListener('change', () => {
      const selectedCategory = studyCategory.value;
      console.log('Category changed to:', selectedCategory);
      
      // Log tất cả các tùy chọn hiện có
      const options = Array.from(studyCategory.options);
      console.log('Available category options:', 
        options.map(opt => ({ value: opt.value, text: opt.textContent }))
      );
      
      // Lưu lựa chọn danh mục hiện tại vào localStorage để duy trì lựa chọn
      localStorage.setItem('study-selected-category', selectedCategory);
      
      // Cập nhật dữ liệu và giao diện dựa theo chế độ học hiện tại
      if (currentStudyMode === 'match') {
        console.log('Category changed while in match mode, updating match game');
        // Nếu đang ở chế độ match, khởi động lại match game với danh mục mới
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          syncWithExtensionStorage().then(() => {
            console.log('Data synced, restarting match game with new category');
            initMatchGame();
          }).catch(error => {
            console.error('Error syncing with extension storage:', error);
            initMatchGame();
          });
        } else {
          initMatchGame();
        }
      } else {
        // Đối với các chế độ khác (flashcards), sử dụng phương pháp cũ
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          syncWithExtensionStorage().then(() => {
            console.log('Data synced, now filtering words by category:', selectedCategory);
            showStudyMode(currentStudyMode);
          }).catch(error => {
            console.error('Error syncing with extension storage:', error);
            showStudyMode(currentStudyMode);
          });
        } else {
          showStudyMode(currentStudyMode);
        }
      }
    });
    
    studyTimeRange.addEventListener('change', () => {
      console.log('Time range changed to:', studyTimeRange.value);
      
      // Lưu lựa chọn khoảng thời gian hiện tại vào localStorage để duy trì lựa chọn
      localStorage.setItem('study-time-range', studyTimeRange.value);
      
      // Xử lý khác biệt cho chế độ match
      if (currentStudyMode === 'match') {
        console.log('Time range changed while in match mode, updating match game');
        // Nếu đang ở chế độ match, khởi động lại match game với khoảng thời gian mới
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          syncWithExtensionStorage().then(() => {
            console.log('Data synced, restarting match game with new time range');
            initMatchGame();
          }).catch(error => {
            console.error('Error syncing with extension storage:', error);
            initMatchGame();
          });
        } else {
          initMatchGame();
        }
      } else {
        // Cập nhật dữ liệu và giao diện tương tự như thay đổi danh mục
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          syncWithExtensionStorage().then(() => {
            showStudyMode(currentStudyMode);
          }).catch(error => {
            console.error('Error syncing with extension storage:', error);
            showStudyMode(currentStudyMode);
          });
        } else {
          showStudyMode(currentStudyMode);
        }
      }
    });
    
    // Event listener cho flashcard order mode
    flashcardOrderMode.addEventListener('change', () => {
      console.log('Flashcard mode changed to:', flashcardOrderMode.value);
      
      // Lưu lựa chọn chế độ flashcard vào localStorage
      localStorage.setItem('flashcard-order-mode', flashcardOrderMode.value);
      
      // Cập nhật chế độ và khởi tạo lại flashcards
      flashcardMode = flashcardOrderMode.value;
      initFlashcards();
      
      // Cập nhật nút shuffle dựa trên chế độ
      if (flashcardMode === 'random') {
        shuffleCardsBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Shuffle & Start
        `;
      } else {
        shuffleCardsBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Start Learning
        `;
      }
    });
    
    // Event listener cho match pairs count
    matchPairsCount.addEventListener('change', () => {
      console.log('Match pairs count changed to:', matchPairsCount.value);
      
      // Lưu lựa chọn số lượng cặp từ vào localStorage
      localStorage.setItem('match-pairs-count', matchPairsCount.value);
      
      // Khởi tạo lại match game
      initMatchGame();
    });
  }

  // Event Listeners
  // studyCategory.addEventListener('change', () => {
  //   console.log('Category changed to:', studyCategory.value);
  //   reloadDataAndUpdateUI();
  // });
  
  // studyTimeRange.addEventListener('change', () => {
  //   console.log('Time range changed to:', studyTimeRange.value);
  //   reloadDataAndUpdateUI();
  // });
  
  // Event listener cho nút làm mới dữ liệu
  refreshDataBtn.addEventListener('click', () => {
    console.log('Refresh data button clicked');
    // Xóa localStorage cache
    localStorage.removeItem('vocabulary-words-cache');
    localStorage.removeItem('vocabulary-categories-cache');
    
    // Đồng bộ dữ liệu với extension storage
    syncWithExtensionStorage().then(() => {
      // Làm mới dữ liệu và cập nhật UI
      reloadDataAndUpdateUI();
      
      // Hiển thị thông báo
      alert('Data refreshed successfully!');
    }).catch(error => {
      console.error('Error syncing with extension storage:', error);
      // Vẫn làm mới UI với dữ liệu hiện có
      reloadDataAndUpdateUI();
      alert('Refreshed with local data only. Could not sync with extension.');
    });
  });
  
  // Event listeners cho flashcards
  flashcardElement.addEventListener('click', function() {
    if (studyWords.length === 0) return;
    
    // Toggle flip class
    this.classList.toggle('flipped');
    isCardFlipped = !isCardFlipped;
    
    // Phát âm thanh khi lật thẻ
    playCardFlipSound();
  });
  
  prevCardBtn.addEventListener('click', () => {
    if (currentCardIndex > 0) {
      currentCardIndex--;
      updateFlashcardContent();
      updateFlashcardControls();
    }
  });
  
  nextCardBtn.addEventListener('click', () => {
    if (currentCardIndex < studyWords.length - 1) {
      currentCardIndex++;
      updateFlashcardContent();
      updateFlashcardControls();
    }
  });
  
  shuffleCardsBtn.addEventListener('click', () => {
    console.log('Shuffle cards clicked');
    reloadDataAndUpdateUI();
  });
  
  startMatchGameBtn.addEventListener('click', () => {
    console.log('Start match game clicked');
    // Add detailed debugging for match game start
    console.log('Current study mode before starting match game:', currentStudyMode);
    console.log('Match game active state before starting:', matchGameActive);
    
    // Force match mode if not already set
    if (currentStudyMode !== 'match') {
      console.log('Not in match mode, switching to match mode first');
      switchTab('match');
      // Give UI a moment to update before starting game
      setTimeout(() => {
        console.log('Now starting match game after switching tabs');
        startMatchGame();
      }, 100);
    } else {
      // Bắt đầu hoặc khởi động lại trò chơi match
      startMatchGame();
    }
  });
  
  // Hàm giúp làm mới dữ liệu và cập nhật UI
  function reloadDataAndUpdateUI(mode = currentStudyMode) {
    console.log('Reloading data and updating UI for mode:', mode);
    
    // Log dữ liệu hiện tại trong localStorage
    logStorageData();
    
    // Kiểm tra nếu đang chạy trong extension context
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      console.log('Running in extension context, updating data from extension storage...');
      
      // Lấy dữ liệu mới nhất từ chrome.storage.local trước
      chrome.storage.local.get(['vocabulary-categories', 'vocabulary-words'], function(result) {
        if (chrome.runtime.lastError) {
          console.error('Error reading from extension storage:', chrome.runtime.lastError);
          updateUIAfterDataLoad(mode);
          return;
        }
        
        let dataUpdated = false;
        
        // Cập nhật danh mục từ chrome.storage.local vào localStorage
        if (result['vocabulary-categories']) {
          try {
            const extensionCategories = JSON.parse(result['vocabulary-categories']);
            if (Array.isArray(extensionCategories)) {
              console.log(`Found ${extensionCategories.length} categories in extension storage, updating localStorage`);
              
              // Đảm bảo danh mục Default luôn tồn tại
              const hasDefaultCategory = extensionCategories.some(cat => cat && cat.id === 'default');
              if (!hasDefaultCategory && extensionCategories.length > 0) {
                extensionCategories.push({
                  id: 'default',
                  name: 'Default',
                  sourceLanguage: 'en',
                  targetLanguage: 'vi'
                });
                console.log('Added missing default category');
              }
              
              // Lưu dữ liệu vào localStorage
              localStorage.setItem('vocabulary-categories', JSON.stringify(extensionCategories));
              dataUpdated = true;
            }
          } catch (error) {
            console.error('Error processing categories during reload:', error);
          }
        }
        
        // Cập nhật từ vựng từ chrome.storage.local vào localStorage
        if (result['vocabulary-words']) {
          try {
            const extensionWords = JSON.parse(result['vocabulary-words']);
            if (Array.isArray(extensionWords)) {
              console.log(`Found ${extensionWords.length} words in extension storage, updating localStorage`);
              localStorage.setItem('vocabulary-words', JSON.stringify(extensionWords));
              dataUpdated = true;
            }
          } catch (error) {
            console.error('Error processing words during reload:', error);
          }
        }
        
        // Cập nhật UI sau khi đã đồng bộ dữ liệu
        console.log('Data synchronization complete, updating UI');
        updateUIAfterDataLoad(mode);
      });
    } else {
      // Không trong extension context, chỉ cập nhật UI
      updateUIAfterDataLoad(mode);
    }
  }
  
  // Hàm cập nhật UI sau khi dữ liệu được tải
  function updateUIAfterDataLoad(mode) {
    // Cập nhật danh sách danh mục
    loadStudyCategories();
    
    // Hiển thị chế độ học thích hợp
    showStudyMode(mode);
    
    // Nếu mode là match, bắt đầu game ngay sau khi UI được cập nhật
    if (mode === 'match') {
      console.log('Match game mode requested, starting match game');
      // Sử dụng setTimeout để đảm bảo UI đã được cập nhật trước khi bắt đầu game
      setTimeout(() => {
        startMatchGame();
      }, 300);
    }
  }
  
  // Hàm kiểm tra sự khác biệt giữa dữ liệu localStorage và extension storage
  function checkDataDifferences() {
    return new Promise((resolve) => {
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        resolve(false);
        return;
      }
      
      try {
        // Lấy dữ liệu từ localStorage
        const localWords = JSON.parse(localStorage.getItem('vocabulary-words') || '[]');
        const localCategories = JSON.parse(localStorage.getItem('vocabulary-categories') || '[]');
        
        // Lấy dữ liệu từ extension storage
        chrome.storage.local.get(['vocabulary-words', 'vocabulary-categories'], function(result) {
          if (chrome.runtime.lastError) {
            console.error('Error checking data differences:', chrome.runtime.lastError);
            resolve(false);
            return;
          }
          
          let extensionWords = [];
          let extensionCategories = [];
          
          // Xử lý dữ liệu từ vựng từ extension
          if (result['vocabulary-words']) {
            try {
              // Lấy dữ liệu từ extension
              let extensionWords;
              if (typeof result['vocabulary-words'] === 'string') {
                extensionWords = JSON.parse(result['vocabulary-words']);
              } else if (Array.isArray(result['vocabulary-words'])) {
                extensionWords = result['vocabulary-words'];
              }
              
              if (extensionWords && Array.isArray(extensionWords) && extensionWords.length > 0) {
                console.log(`Found ${extensionWords.length} words in extension storage`);
                
                // Lấy dữ liệu từ localStorage
                const localWords = JSON.parse(localStorage.getItem('vocabulary-words') || '[]');
                console.log(`Found ${localWords.length} words in localStorage`);
                
                // Kết hợp dữ liệu
                const wordMap = {};
                
                // Thêm từ vựng từ localStorage trước
                localWords.forEach(word => {
                  if (word && word.id) {
                    wordMap[word.id] = word;
                  }
                });
                
                // Thêm từ vựng từ extension (ưu tiên nếu trùng ID)
                extensionWords.forEach(word => {
                  if (word && word.id) {
                    wordMap[word.id] = word;
                  }
                });
                
                // Chuyển đổi map thành mảng
                const mergedWords = Object.values(wordMap);
                
                // Lưu dữ liệu kết hợp vào localStorage
                localStorage.setItem('vocabulary-words', JSON.stringify(mergedWords));
                console.log(`Combined ${extensionWords.length} extension words with ${localWords.length} local words, resulting in ${mergedWords.length} total words`);
                
                dataUpdated = true;
              }
            } catch (error) {
              console.error('Error processing vocabulary words:', error);
            }
          }
          
          // Xử lý dữ liệu danh mục
          if (result['vocabulary-categories']) {
            try {
              // Lấy dữ liệu danh mục từ extension
              let extensionCategories;
              if (typeof result['vocabulary-categories'] === 'string') {
                extensionCategories = JSON.parse(result['vocabulary-categories']);
              } else if (Array.isArray(result['vocabulary-categories'])) {
                extensionCategories = result['vocabulary-categories'];
              }
              
              if (extensionCategories && Array.isArray(extensionCategories)) {
                console.log(`Found ${extensionCategories.length} categories in extension storage`);
                
                // Ưu tiên sử dụng dữ liệu từ extension storage thay vì gộp
                // Điều này đảm bảo các danh mục đã bị xóa không được phục hồi
                
                // Đảm bảo danh mục Default luôn tồn tại
                const hasDefaultCategory = extensionCategories.some(cat => cat && cat.id === 'default');
                if (!hasDefaultCategory) {
                  extensionCategories.push({
                    id: 'default',
                    name: 'Default',
                    sourceLanguage: 'en',
                    targetLanguage: 'vi'
                  });
                  console.log('Added missing default category to extension categories');
                }
                
                // Lưu dữ liệu vào localStorage
                localStorage.setItem('vocabulary-categories', JSON.stringify(extensionCategories));
                console.log(`Updated localStorage with ${extensionCategories.length} categories from extension storage`);
                
                dataUpdated = true;
              }
            } catch (error) {
              console.error('Error processing vocabulary categories:', error);
            }
          } else {
            // Nếu không có dữ liệu danh mục trong extension storage, đảm bảo danh mục mặc định vẫn tồn tại
            ensureDefaultCategory();
          }
          
          // Cập nhật UI nếu dữ liệu đã được cập nhật
          if (dataUpdated) {
            console.log('Data was updated, refreshing UI');
            loadStudyCategories();
            showStudyMode(currentStudyMode);
          } else {
            console.log('No data was updated from extension');
          }
          
          // Giải quyết Promise
          resolve(dataUpdated);
        });
      } catch (error) {
        console.error('Error in checkDataDifferences:', error);
        resolve(false);
      }
    });
  }

  // Hàm đồng bộ dữ liệu với extension storage
  function syncWithExtensionStorage() {
    return new Promise((resolve, reject) => {
      // Biến theo dõi dữ liệu đã được cập nhật
      let dataUpdated = false;
      
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        try {
          console.log('Syncing with extension storage...');
          
          // Lấy cả dữ liệu từ vựng và danh mục từ extension storage
          chrome.storage.local.get(['vocabulary-words', 'vocabulary-categories'], function(result) {
            if (chrome.runtime.lastError) {
              console.error('Error accessing extension storage:', chrome.runtime.lastError);
              reject(chrome.runtime.lastError);
              return;
            }
            
            // XỬ LÝ ĐỒNG BỘ DANH MỤC TRƯỚC
            if (result['vocabulary-categories']) {
              try {
                // Lấy dữ liệu danh mục từ extension
                let extensionCategories;
                if (typeof result['vocabulary-categories'] === 'string') {
                  extensionCategories = JSON.parse(result['vocabulary-categories']);
                } else if (Array.isArray(result['vocabulary-categories'])) {
                  extensionCategories = result['vocabulary-categories'];
                }
                
                if (extensionCategories && Array.isArray(extensionCategories)) {
                  console.log(`Found ${extensionCategories.length} categories in extension storage`);
                  
                  // Lấy dữ liệu danh mục từ localStorage
                  let localCategories = [];
                  try {
                    const localCategoriesStr = localStorage.getItem('vocabulary-categories');
                    if (localCategoriesStr) {
                      localCategories = JSON.parse(localCategoriesStr);
                    }
                  } catch (error) {
                    console.error('Error parsing local categories:', error);
                    localCategories = [];
                  }
                  
                  console.log(`Found ${localCategories.length} categories in localStorage`);
                  
                  // Kết hợp dữ liệu danh mục
                  const categoryMap = {};
                  
                  // Thêm danh mục từ extension (ưu tiên cao)
                  extensionCategories.forEach(category => {
                    if (category && category.id) {
                      categoryMap[category.id] = category;
                    }
                  });
                  
                  // Thêm danh mục từ localStorage (chỉ nếu không trùng ID)
                  localCategories.forEach(category => {
                    if (category && category.id && !categoryMap[category.id]) {
                      categoryMap[category.id] = category;
                    }
                  });
                  
                  // Đảm bảo danh mục Default luôn tồn tại
                  if (!categoryMap['default']) {
                    categoryMap['default'] = {
                      id: 'default',
                      name: 'Default',
                      sourceLanguage: 'en',
                      targetLanguage: 'vi'
                    };
                    console.log('Added missing default category');
                  }
                  
                  // Chuyển đổi map thành mảng
                  const mergedCategories = Object.values(categoryMap);
                  
                  // Lưu dữ liệu kết hợp vào localStorage
                  localStorage.setItem('vocabulary-categories', JSON.stringify(mergedCategories));
                  console.log(`Merged categories: extension(${extensionCategories.length}) + local(${localCategories.length}) = total(${mergedCategories.length})`);
                  
                  // Cập nhật dữ liệu trong chrome.storage.local để đảm bảo đồng bộ
                  chrome.storage.local.set({
                    'vocabulary-categories': JSON.stringify(mergedCategories)
                  }, function() {
                    if (chrome.runtime.lastError) {
                      console.error('Error updating categories in extension storage:', chrome.runtime.lastError);
                    } else {
                      console.log('Updated categories in extension storage');
                    }
                  });
                  
                  dataUpdated = true;
                }
              } catch (error) {
                console.error('Error processing vocabulary categories:', error);
              }
            } else {
              console.log('No categories found in extension storage, ensuring default category exists');
              // Nếu không có dữ liệu danh mục trong extension storage, đảm bảo danh mục mặc định vẫn tồn tại
              const defaultCategories = ensureDefaultCategory();
              
              // Đồng bộ hóa danh mục mặc định với extension storage
              chrome.storage.local.set({
                'vocabulary-categories': JSON.stringify(defaultCategories)
              }, function() {
                if (chrome.runtime.lastError) {
                  console.error('Error saving default categories to extension storage:', chrome.runtime.lastError);
                } else {
                  console.log('Default categories synced to extension storage');
                }
              });
            }
            
            // XỬ LÝ ĐỒNG BỘ TỪ VỰNG
            if (result['vocabulary-words']) {
              try {
                // Lấy dữ liệu từ extension
                let extensionWords;
                if (typeof result['vocabulary-words'] === 'string') {
                  extensionWords = JSON.parse(result['vocabulary-words']);
                } else if (Array.isArray(result['vocabulary-words'])) {
                  extensionWords = result['vocabulary-words'];
                }
                
                if (extensionWords && Array.isArray(extensionWords) && extensionWords.length > 0) {
                  console.log(`Found ${extensionWords.length} words in extension storage`);
                  
                  // Lấy dữ liệu từ localStorage
                  let localWords = [];
                  try {
                    const localWordsStr = localStorage.getItem('vocabulary-words');
                    if (localWordsStr) {
                      localWords = JSON.parse(localWordsStr);
                    }
                  } catch (error) {
                    console.error('Error parsing local words:', error);
                    localWords = [];
                  }
                  
                  console.log(`Found ${localWords.length} words in localStorage`);
                  
                  // Lấy lại danh mục đã được kết hợp
                  const categoriesStr = localStorage.getItem('vocabulary-categories');
                  let categories = [];
                  
                  try {
                    if (categoriesStr) {
                      categories = JSON.parse(categoriesStr);
                    }
                  } catch (error) {
                    console.error('Error parsing categories for word validation:', error);
                  }
                  
                  // Tạo danh sách ID danh mục hợp lệ
                  const validCategoryIds = categories.map(cat => cat.id);
                  const defaultCategoryId = 'default';
                  
                  // Kết hợp dữ liệu
                  const wordMap = {};
                  
                  // Thêm từ vựng từ extension (ưu tiên cao)
                  extensionWords.forEach(word => {
                    if (word && word.id) {
                      // More thorough validation of categoryId
                      if (!word.categoryId) {
                        console.warn(`Word has missing categoryId, changing to default: ${defaultCategoryId}`);
                        word.categoryId = defaultCategoryId;
                      } else if (typeof word.categoryId !== 'string') {
                        console.warn(`Word has invalid categoryId type: ${typeof word.categoryId}, changing to default: ${defaultCategoryId}`);
                        word.categoryId = defaultCategoryId;
                      } else if (!validCategoryIds.includes(word.categoryId)) {
                        console.warn(`Word has categoryId (${word.categoryId}) that doesn't exist in available categories, changing to default: ${defaultCategoryId}`);
                        word.categoryId = defaultCategoryId;
                      }
                      wordMap[word.id] = word;
                    }
                  });
                  
                  // Thêm từ vựng từ localStorage (chỉ nếu không trùng ID)
                  localWords.forEach(word => {
                    if (word && word.id && !wordMap[word.id]) {
                      // More thorough validation of categoryId
                      if (!word.categoryId) {
                        console.warn(`Word has missing categoryId, changing to default: ${defaultCategoryId}`);
                        word.categoryId = defaultCategoryId;
                      } else if (typeof word.categoryId !== 'string') {
                        console.warn(`Word has invalid categoryId type: ${typeof word.categoryId}, changing to default: ${defaultCategoryId}`);
                        word.categoryId = defaultCategoryId;
                      } else if (!validCategoryIds.includes(word.categoryId)) {
                        console.warn(`Word has categoryId (${word.categoryId}) that doesn't exist in available categories, changing to default: ${defaultCategoryId}`);
                        word.categoryId = defaultCategoryId;
                      }
                      wordMap[word.id] = word;
                    }
                  });
                  
                  // Chuyển đổi map thành mảng
                  const mergedWords = Object.values(wordMap);
                  
                  // Lưu dữ liệu kết hợp vào localStorage
                  localStorage.setItem('vocabulary-words', JSON.stringify(mergedWords));
                  console.log(`Merged words: extension(${extensionWords.length}) + local(${localWords.length}) = total(${mergedWords.length})`);
                  
                  // Cập nhật extension storage với dữ liệu kết hợp
                  chrome.storage.local.set({
                    'vocabulary-words': JSON.stringify(mergedWords)
                  }, function() {
                    if (chrome.runtime.lastError) {
                      console.error('Error updating words in extension storage:', chrome.runtime.lastError);
                    } else {
                      console.log('Updated words in extension storage');
                    }
                  });
                  
                  dataUpdated = true;
                }
              } catch (error) {
                console.error('Error processing vocabulary words:', error);
              }
            }
            
            // Cập nhật UI nếu dữ liệu đã được cập nhật
            if (dataUpdated) {
              console.log('Data was updated, refreshing UI');
              // Tải lại danh mục trước khi hiển thị
              loadStudyCategories();
              // Sau đó hiển thị chế độ học tập
              showStudyMode(currentStudyMode);
            } else {
              console.log('No data was updated from extension');
              // Đảm bảo luôn tải lại danh mục dù không có cập nhật
              loadStudyCategories();
            }
            
            // Giải quyết Promise
            resolve(dataUpdated);
          });
        } catch (error) {
          console.error('Error accessing extension storage:', error);
          reject(error); // Đảm bảo reject Promise khi có lỗi
        }
      } else {
        console.log('Not running in Chrome extension context, using localStorage only');
        // Đảm bảo luôn tải lại danh mục
        loadStudyCategories();
        resolve(false); // Đảm bảo resolve Promise khi không phải extension context
      }
    });
  }

  // Hàm kiểm tra và đảm bảo danh mục Default luôn tồn tại
  function ensureDefaultCategory() {
    console.log('Checking for default category and ensuring category synchronization...');
    
    return new Promise((resolve) => {
      // First, get categories from localStorage
      let localCategories = [];
      try {
        const categoriesStr = localStorage.getItem('vocabulary-categories');
        if (categoriesStr) {
          localCategories = JSON.parse(categoriesStr);
          if (!Array.isArray(localCategories)) {
            console.error('Local categories data is not an array, resetting to empty array');
            localCategories = [];
          }
        }
      } catch (error) {
        console.error('Error parsing local categories:', error);
        localCategories = [];
      }
      
      // If we're in a Chrome extension context, merge with categories from storage
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['vocabulary-categories'], function(result) {
          let extensionCategories = [];
          
          if (result['vocabulary-categories']) {
            try {
              extensionCategories = JSON.parse(result['vocabulary-categories']);
              if (!Array.isArray(extensionCategories)) {
                console.error('Extension categories data is not an array, resetting to empty array');
                extensionCategories = [];
              }
            } catch (error) {
              console.error('Error parsing extension categories:', error);
              extensionCategories = [];
            }
          }
          
          // Merge categories from both sources
          const mergedCategories = mergeCategories(localCategories, extensionCategories);
          
          // Ensure default category exists
          let hasDefaultCategory = mergedCategories.some(cat => cat && cat.id === 'default');
          if (!hasDefaultCategory) {
            console.log('Default category not found, adding it...');
            mergedCategories.push({ 
              id: 'default', 
              name: 'Default',
              sourceLanguage: 'en',
              targetLanguage: 'vi'
            });
          }
          
          // Save the merged categories to both localStorage and chrome.storage
          localStorage.setItem('vocabulary-categories', JSON.stringify(mergedCategories));
          
          chrome.storage.local.set({
            'vocabulary-categories': JSON.stringify(mergedCategories)
          }, function() {
            console.log('Categories synchronized between localStorage and extension storage');
            resolve(mergedCategories);
          });
        });
      } else {
        // If not in Chrome extension context, just ensure default category in localStorage
        let hasDefaultCategory = localCategories.some(cat => cat && cat.id === 'default');
        if (!hasDefaultCategory) {
          console.log('Default category not found in localStorage, adding it...');
          localCategories.push({ 
            id: 'default', 
            name: 'Default',
            sourceLanguage: 'en',
            targetLanguage: 'vi'
          });
          localStorage.setItem('vocabulary-categories', JSON.stringify(localCategories));
        }
        resolve(localCategories);
      }
    });
  }
  
  // Helper function to merge categories from different sources
  function mergeCategories(localCategories, extensionCategories) {
    const categoryMap = {};
    
    // Add extension categories first (higher priority)
    extensionCategories.forEach(category => {
      if (category && category.id) {
        categoryMap[category.id] = category;
      }
    });
    
    // Add local categories (only if ID doesn't already exist)
    localCategories.forEach(category => {
      if (category && category.id && !categoryMap[category.id]) {
        categoryMap[category.id] = category;
      }
    });
    
    // Convert back to array
    return Object.values(categoryMap);
  }
  
  // Cập nhật hàm initialize() để gọi ensureDefaultCategory()
  function initialize() {
    console.log('Initializing vocabulary study...');
    
    // Thêm listener để lắng nghe thay đổi trong chrome.storage.local
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      console.log('Setting up storage change listener');
      chrome.storage.onChanged.addListener(function(changes, namespace) {
        if (namespace === 'local') {
          // Kiểm tra nếu có thay đổi trong danh mục
          if (changes['vocabulary-categories']) {
            console.log('Categories changed in storage, reloading UI');
            console.log('Old categories count:', 
              JSON.parse(changes['vocabulary-categories'].oldValue || '[]').length);
            console.log('New categories count:', 
              JSON.parse(changes['vocabulary-categories'].newValue || '[]').length);
              
            // Cập nhật localStorage ngay lập tức để đồng bộ với chrome.storage
            localStorage.setItem('vocabulary-categories', changes['vocabulary-categories'].newValue);
            
            // Tải lại danh mục và cập nhật UI
            loadStudyCategories();
          }
          
          // Kiểm tra nếu có thay đổi trong từ vựng
          if (changes['vocabulary-words']) {
            console.log('Words changed in storage, reloading UI');
            
            // Cập nhật localStorage ngay lập tức
            localStorage.setItem('vocabulary-words', changes['vocabulary-words'].newValue);
            
            // Tải lại từ vựng nếu cần
            filterStudyWords();
          }
        }
      });
    }
    
    // Đảm bảo danh mục Default luôn tồn tại
    ensureDefaultCategory();
    
    // Thử đọc dữ liệu từ extension storage nếu đang chạy trong context của extension
    tryReadExtensionStorage();
    
    // Khôi phục lựa chọn danh mục và khoảng thời gian từ localStorage (nếu có)
    const savedCategory = localStorage.getItem('study-selected-category');
    const savedTimeRange = localStorage.getItem('study-time-range');
    const savedFlashcardMode = localStorage.getItem('flashcard-order-mode');
    const savedMatchPairsCount = localStorage.getItem('match-pairs-count');
    
    // Log các giá trị đã lưu
    console.log('Restoring saved settings - Category:', savedCategory, 
                'Time Range:', savedTimeRange,
                'Flashcard Mode:', savedFlashcardMode,
                'Match Pairs Count:', savedMatchPairsCount);
    
    // Thiết lập lựa chọn danh mục
    if (savedCategory) {
      // Đảm bảo danh mục được tải trước khi thiết lập giá trị
      loadStudyCategories();
      
      // Cần kiểm tra xem danh mục đã lưu có tồn tại không
      const categoryExists = Array.from(studyCategory.options).some(opt => opt.value === savedCategory);
      if (categoryExists) {
        studyCategory.value = savedCategory;
        console.log('Restored saved category:', savedCategory);
      } else {
      
      }
    }
    
    // Thiết lập khoảng thời gian
    if (savedTimeRange && studyTimeRange.querySelector(`option[value="${savedTimeRange}"]`)) {
      studyTimeRange.value = savedTimeRange;
      console.log('Restored saved time range:', savedTimeRange);
    }
    
    // Thiết lập chế độ flashcard
    if (savedFlashcardMode && (savedFlashcardMode === 'sequential' || savedFlashcardMode === 'random')) {
      flashcardOrderMode.value = savedFlashcardMode;
      flashcardMode = savedFlashcardMode;
      console.log('Restored saved flashcard mode:', savedFlashcardMode);
    }
    
    // Thiết lập số lượng cặp từ cho match game
    if (savedMatchPairsCount) {
      // Kiểm tra giá trị hợp lệ
      const validPairCounts = ['5', '10', '15', '20', 'all'];
      if (validPairCounts.includes(savedMatchPairsCount)) {
        matchPairsCount.value = savedMatchPairsCount;
        console.log('Restored saved match pairs count:', savedMatchPairsCount);
      }
    }
    
    // Tiếp tục khởi tạo các thành phần khác
    setupTabNavigation();
    setupEventListeners();
    switchTab('flashcards'); // Dùng switchTab thay vì showStudyMode để hiển thị đúng UI
  }
  
  // Thử đọc dữ liệu từ extension storage nếu đang chạy trong context của extension
  function tryReadExtensionStorage() {
    // Kiểm tra xem có đang chạy trong extension context không
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      console.log('Detected Chrome extension environment, attempting to read from extension storage');
      
      try {
        // Đọc dữ liệu từ extension storage
        chrome.storage.local.get(['vocabulary-words', 'vocabulary-categories'], function(result) {
          if (chrome.runtime.lastError) {
            console.error('Error reading from extension storage:', chrome.runtime.lastError);
            return;
          }
          
          console.log('Data received from extension storage:', result);
          let dataUpdated = false;
          
          // Xử lý dữ liệu từ vựng
          if (result['vocabulary-words']) {
            try {
              // Lấy dữ liệu từ extension
              let extensionWords;
              if (typeof result['vocabulary-words'] === 'string') {
                extensionWords = JSON.parse(result['vocabulary-words']);
              } else if (Array.isArray(result['vocabulary-words'])) {
                extensionWords = result['vocabulary-words'];
              }
              
              if (extensionWords && Array.isArray(extensionWords) && extensionWords.length > 0) {
                console.log(`Found ${extensionWords.length} words in extension storage`);
                
                // Lấy dữ liệu từ localStorage
                const localWords = JSON.parse(localStorage.getItem('vocabulary-words') || '[]');
                console.log(`Found ${localWords.length} words in localStorage`);
                
                // Kết hợp dữ liệu
                const wordMap = {};
                
                // Thêm từ vựng từ localStorage trước
                localWords.forEach(word => {
                  if (word && word.id) {
                    wordMap[word.id] = word;
                  }
                });
                
                // Thêm từ vựng từ extension (ưu tiên nếu trùng ID)
                extensionWords.forEach(word => {
                  if (word && word.id) {
                    wordMap[word.id] = word;
                  }
                });
                
                // Chuyển đổi map thành mảng
                const mergedWords = Object.values(wordMap);
                
                // Lưu dữ liệu kết hợp vào localStorage
                localStorage.setItem('vocabulary-words', JSON.stringify(mergedWords));
                console.log(`Combined ${extensionWords.length} extension words with ${localWords.length} local words, resulting in ${mergedWords.length} total words`);
                
                dataUpdated = true;
              }
            } catch (error) {
              console.error('Error processing vocabulary words:', error);
            }
          }
          
          // Xử lý dữ liệu danh mục
          if (result['vocabulary-categories']) {
            try {
              // Lấy dữ liệu danh mục từ extension
              let extensionCategories;
              if (typeof result['vocabulary-categories'] === 'string') {
                extensionCategories = JSON.parse(result['vocabulary-categories']);
              } else if (Array.isArray(result['vocabulary-categories'])) {
                extensionCategories = result['vocabulary-categories'];
              }
              
              if (extensionCategories && Array.isArray(extensionCategories)) {
                console.log(`Found ${extensionCategories.length} categories in extension storage`);
                
                // Ưu tiên sử dụng dữ liệu từ extension storage thay vì gộp
                // Điều này đảm bảo các danh mục đã bị xóa không được phục hồi
                
                // Đảm bảo danh mục Default luôn tồn tại
                const hasDefaultCategory = extensionCategories.some(cat => cat && cat.id === 'default');
                if (!hasDefaultCategory) {
                  extensionCategories.push({
                    id: 'default',
                    name: 'Default',
                    sourceLanguage: 'en',
                    targetLanguage: 'vi'
                  });
                  console.log('Added missing default category to extension categories');
                }
                
                // Lưu dữ liệu vào localStorage
                localStorage.setItem('vocabulary-categories', JSON.stringify(extensionCategories));
                console.log(`Updated localStorage with ${extensionCategories.length} categories from extension storage`);
                
                dataUpdated = true;
              }
            } catch (error) {
              console.error('Error processing vocabulary categories:', error);
            }
          } else {
            // Nếu không có dữ liệu danh mục trong extension storage, đảm bảo danh mục mặc định vẫn tồn tại
            ensureDefaultCategory();
          }
          
          // Cập nhật UI nếu dữ liệu đã được cập nhật
          if (dataUpdated) {
            console.log('Data was updated, refreshing UI');
            loadStudyCategories();
            showStudyMode(currentStudyMode);
          } else {
            console.log('No data was updated from extension');
          }
        });
      } catch (error) {
        console.error('Error accessing extension storage:', error);
      }
    } else {
      console.log('Not running in Chrome extension context, using localStorage only');
    }
  }

  function initMatchGame() {
    console.log('Initializing match game');
    
    // Reset game state
    matchGameActive = false;
    matchedPairs = 0;
    selectedCard = null;
    selectedCards = [];
    clearInterval(gameTimerInterval);
    
    // Hiển thị loading indicator
    matchGameBoard.innerHTML = `
      <div class="text-center py-8 col-span-4">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-accent mb-4"></div>
        <p class="text-gray-500">Loading match game data...</p>
      </div>
    `;
    
    // Sử dụng loadMatchGameData thay vì filterStudyWords để tải dữ liệu đặc biệt cho match game
    loadMatchGameData().then(words => {
      console.log('Match game initialization: loaded', words.length, 'words');
      
      // Cập nhật tùy chọn match game dựa trên số lượng từ vựng có sẵn
      updateMatchGameOptions(words.length);
      
      // Hiển thị message "click start" với hướng dẫn cách chơi mới
      matchGameBoard.innerHTML = `
        <div class="text-center py-8 col-span-4">
          <p class="text-gray-500 mb-3">Click "Start Game" to begin matching words with their meanings</p>
          <div class="bg-blue-50 dark:bg-blue-900 p-4 rounded-lg border border-blue-200 dark:border-blue-700 text-sm">
            <h4 class="font-medium text-blue-700 dark:text-blue-300 mb-2">How to play:</h4>
            <ul class="text-left text-blue-600 dark:text-blue-400 space-y-2">
              <li>• All words and meanings are visible</li>
              <li>• Click on a word and its matching meaning to make a pair</li>
              <li>• Matched pairs will be removed from the board</li>
              <li>• Match all pairs to complete the game</li>
            </ul>
          </div>
        </div>
      `;
      
      // Reset the start button text
      startMatchGameBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Start Matching Game
      `;
    }).catch(error => {
      console.error('Error initializing match game:', error);
      matchGameBoard.innerHTML = `
        <div class="text-center py-8 col-span-4">
          <p class="text-red-600 mb-3 font-bold">Error loading vocabulary data</p>
          <p class="text-gray-500 mb-4">There was a problem loading your vocabulary data.</p>
          <button id="retry-match-init-btn" class="px-4 py-2 bg-accent text-white rounded-md hover:bg-accent-hover transition-colors duration-300">
            Try Again
          </button>
        </div>
      `;
      
      // Add retry button listener
      setTimeout(() => {
        const retryBtn = document.getElementById('retry-match-init-btn');
        if (retryBtn) {
          retryBtn.addEventListener('click', () => {
            initMatchGame();
          });
        }
      }, 100);
    });
  }

  // Thêm hàm startMatchGame để bắt đầu trò chơi ghép cặp từ vựng
  function startMatchGame() {
    console.log('=== START MATCH GAME ===');
    
    // Ensure we're in match mode
    if (currentStudyMode !== 'match') {
      console.log('Not in match mode, switching to match mode');
      switchTab('match');
      // Let the UI update before trying to start the game
      setTimeout(() => {
        console.log('Now starting match game after tab switch');
        startMatchGame();
      }, 100);
      return;
    }
    
    // Sử dụng hàm tải dữ liệu chuyên biệt cho match game
    loadMatchGameData().then(words => {
      console.log('Match game: found', words.length, 'filtered words from loadMatchGameData');
      
      if (words.length === 0) {
        console.log('No words available for match game');
        // Hiển thị thông báo cho người dùng
        matchGameBoard.innerHTML = `
          <div class="text-center py-8 col-span-full">
            <div class="flex justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-orange-500 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p class="text-red-600 mb-3 font-bold">No words available for matching game</p>
            <p class="text-gray-500">Try changing the category or time range filter, or add more words.</p>
            <button id="reload-match-data-btn" class="mt-4 px-4 py-2 bg-accent text-white rounded-md hover:bg-accent-hover transition-colors duration-300">
              Try Again
            </button>
          </div>
        `;
        
        // Add event listener to the reload button
        setTimeout(() => {
          const reloadBtn = document.getElementById('reload-match-data-btn');
          if (reloadBtn) {
            reloadBtn.addEventListener('click', () => {
              reloadDataAndUpdateUI('match');
            });
          }
        }, 100);
        
        return;
      }
      
      // Lấy số lượng cặp từ từ dropdown
      const pairsCountValue = matchPairsCount.value;
      let maxPairs;
      
      if (pairsCountValue === 'all') {
        // Sử dụng tất cả các từ có sẵn
        maxPairs = words.length;
      } else {
        // Chuyển đổi giá trị từ chuỗi sang số
        const requestedPairs = parseInt(pairsCountValue, 10);
        
        // Đảm bảo không vượt quá số từ vựng hiện có
        maxPairs = Math.min(requestedPairs, words.length);
      }
      
      console.log('Starting match game with', maxPairs, 'pairs');
      
      // Lấy danh sách từ vựng được sử dụng trong game
      const gameWords = words.slice(0, maxPairs);
      
      // Set game active
      matchGameActive = true;
      matchedPairs = 0;
      selectedCard = null;
      selectedCards = []; // Array to track selected cards for Quizlet-style matching
      
      // Reset và bắt đầu timer
      clearInterval(gameTimerInterval);
      gameStartTime = Date.now();
      gameTimerInterval = setInterval(updateMatchTimer, 1000);
      matchTimerElement.textContent = '0:00';
      
      // Cập nhật số lượng cặp từ
      totalPairs = gameWords.length;
      
      // Cập nhật counter
      pairsMatchedElement.textContent = '0';
      totalPairsElement.textContent = totalPairs.toString();
      
      // Create array of all cards (both words and meanings)
      const allCards = [];
      
      // Prepare the cards data
      gameWords.forEach(word => {
        // Word card
        allCards.push({
          id: `word-${word.id}`,
          content: word.text,
          type: 'word',
          originalId: word.id,
          isMatched: false,
          pronunciation: word.pronunciation ? true : false
        });
        
        // Meaning card
        allCards.push({
          id: `meaning-${word.id}`,
          content: word.meaning,
          type: 'meaning',
          originalId: word.id,
          isMatched: false,
          pronunciation: false
        });
      });
      
      // Shuffle all cards together
      const shuffledCards = [...allCards].sort(() => Math.random() - 0.5);
      
      console.log('Created and shuffled cards for match game:', shuffledCards.length, 'cards');
      
      // Render game board as a grid
      matchGameBoard.innerHTML = '';
      
      // Determine grid columns based on number of cards
      const totalCards = shuffledCards.length;
      let gridColumns = 4; // Default to 4 columns
      
      if (totalCards <= 8) gridColumns = 2;
      else if (totalCards <= 16) gridColumns = 3;
      else if (totalCards > 30) gridColumns = 5;
      
      console.log('Setting up game grid with', gridColumns, 'columns');
      
      // Use direct style manipulation instead of Tailwind classes
      matchGameBoard.style.display = 'grid';
      matchGameBoard.style.gridTemplateColumns = `repeat(${gridColumns}, minmax(0, 1fr))`;
      matchGameBoard.style.gap = '0.75rem';
      matchGameBoard.style.marginBottom = '1.5rem';
      matchGameBoard.className = 'match-game-board';
      
      // Create a title/header for the game
      const gameHeader = document.createElement('div');
      gameHeader.style.gridColumn = '1 / -1'; // Span all columns
      gameHeader.className = 'text-center mb-4';
      gameHeader.innerHTML = `
        <h3 class="text-lg font-medium text-accent mb-2">Match each term with its correct definition</h3>
        <div class="flex justify-center items-center gap-4 text-sm">
          <div class="flex items-center">
            <div class="w-4 h-4 bg-blue-100 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-sm mr-1"></div>
            <span class="text-blue-600 dark:text-blue-400">Words</span>
          </div>
          <div class="flex items-center">
            <div class="w-4 h-4 bg-green-100 dark:bg-green-900 border border-green-200 dark:border-green-700 rounded-sm mr-1"></div>
            <span class="text-green-600 dark:text-green-400">Meanings</span>
          </div>
        </div>
      `;
      matchGameBoard.appendChild(gameHeader);
      
      // Add match game styles if not already present
      if (!document.getElementById('match-game-styles')) {
        const styleEl = document.createElement('style');
        styleEl.id = 'match-game-styles';
        styleEl.textContent = `
          .match-card.selected {
            border-width: 3px !important;
            transform: scale(1.02);
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .match-card.matched {
            opacity: 0.7;
            border-color: #10B981 !important;
          }
          .match-card.shake {
            animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
          }
          .match-card.highlight-pair {
            animation: highlight 0.5s ease;
          }
          @keyframes shake {
            10%, 90% { transform: translate3d(-1px, 0, 0); }
            20%, 80% { transform: translate3d(2px, 0, 0); }
            30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
            40%, 60% { transform: translate3d(4px, 0, 0); }
          }
          @keyframes highlight {
            0% { background-color: rgba(16, 185, 129, 0.2); }
            50% { background-color: rgba(16, 185, 129, 0.5); }
            100% { background-color: rgba(16, 185, 129, 0.2); }
          }
        `;
        document.head.appendChild(styleEl);
      }
      
      // Render all cards in the grid
      shuffledCards.forEach(card => {
        const cardElement = document.createElement('div');
        
        // Apply different styling based on card type - Show content directly without flipping
        if (card.type === 'word') {
          cardElement.className = 'match-card match-card-word';
        } else {
          cardElement.className = 'match-card match-card-meaning';
        }
        
        cardElement.dataset.id = card.id;
        cardElement.dataset.originalId = card.originalId;
        cardElement.dataset.type = card.type;
        
        // Content container
        const contentContainer = document.createElement('div');
        contentContainer.className = 'match-card-content flex flex-col items-center justify-center w-full';
        
        // Main content - Already visible
        const contentElement = document.createElement('div');
        if (card.type === 'word') {
          contentElement.className = 'font-medium';
        }
        contentElement.textContent = card.content;
        contentContainer.appendChild(contentElement);
        
        // Add pronunciation button if available
        if (card.type === 'word' && card.pronunciation) {
          const pronBtn = document.createElement('button');
          pronBtn.className = 'mt-2 p-1 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200 focus:outline-none transition-opacity duration-300';
          pronBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>';
          
          // Handle pronunciation event
          pronBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            // Find corresponding word to pronounce
            const wordObj = gameWords.find(w => w.id === card.originalId);
            if (wordObj) {
              playPronunciation(wordObj);
            }
          });
          
          contentContainer.appendChild(pronBtn);
        }
        
        cardElement.appendChild(contentContainer);
        
        // Add to the game board
        matchGameBoard.appendChild(cardElement);
        
        // Add event listener for click
        cardElement.addEventListener('click', handleMatchCardClick);
      });
      
      console.log('Rendered', shuffledCards.length, 'cards in match game board');
      
      // Update the start button to "Restart Game"
      startMatchGameBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Restart Game
      `;
      
      console.log('=== MATCH GAME STARTED ===');
    }).catch(error => {
      console.error('Error loading match game data:', error);
      matchGameBoard.innerHTML = `
        <div class="text-center py-8 col-span-full">
          <p class="text-red-600 mb-3 font-bold">Error loading vocabulary data</p>
          <p class="text-gray-500">Please try again or refresh the page.</p>
          <button id="reload-match-data-btn" class="mt-4 px-4 py-2 bg-accent text-white rounded-md hover:bg-accent-hover transition-colors duration-300">
            Try Again
          </button>
        </div>
      `;
      
      // Add event listener to the reload button
      setTimeout(() => {
        const reloadBtn = document.getElementById('reload-match-data-btn');
        if (reloadBtn) {
          reloadBtn.addEventListener('click', () => {
            reloadDataAndUpdateUI('match');
          });
        }
      }, 100);
    });
  }
  
  // Hàm chuyên biệt để tải dữ liệu cho Match Game
  function loadMatchGameData() {
    console.log('Loading data specifically for match game...');
    
    return new Promise((resolve, reject) => {
      // Ưu tiên sử dụng chrome.storage.local nếu có thể
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['vocabulary-words', 'vocabulary-categories'], function(result) {
          if (chrome.runtime.lastError) {
            console.error('Error reading from chrome.storage.local:', chrome.runtime.lastError);
            // Fallback to localStorage
            tryLoadFromLocalStorage();
            return;
          }
          
          try {
            if (result['vocabulary-words']) {
              let words = [];
              try {
                words = JSON.parse(result['vocabulary-words']);
              } catch (e) {
                console.error('Error parsing words from chrome storage:', e);
                if (typeof result['vocabulary-words'] === 'object' && Array.isArray(result['vocabulary-words'])) {
                  words = result['vocabulary-words'];
                }
              }
              
              if (Array.isArray(words) && words.length > 0) {
                console.log(`Found ${words.length} words in chrome.storage.local for match game`);
                
                // Đồng bộ với localStorage
                try {
                  localStorage.setItem('vocabulary-words', JSON.stringify(words));
                } catch (e) {
                  console.warn('Could not sync words to localStorage:', e);
                }
                
                // Tiếp tục xử lý dữ liệu
                const filteredWords = filterWordsByCurrentSelections(words);
                resolve(filteredWords);
                return;
              }
            }
            
            // Nếu không tìm thấy dữ liệu, chuyển sang localStorage
            tryLoadFromLocalStorage();
          } catch (error) {
            console.error('Error processing chrome storage data:', error);
            tryLoadFromLocalStorage();
          }
        });
      } else {
        // Không có chrome storage, sử dụng localStorage
        tryLoadFromLocalStorage();
      }
      
      // Hàm để thử tải dữ liệu từ localStorage
      function tryLoadFromLocalStorage() {
        console.log('Trying to load match game data from localStorage');
        try {
          const wordsStr = localStorage.getItem('vocabulary-words');
          if (wordsStr) {
            const words = JSON.parse(wordsStr);
            if (Array.isArray(words) && words.length > 0) {
              console.log(`Found ${words.length} words in localStorage for match game`);
              const filteredWords = filterWordsByCurrentSelections(words);
              resolve(filteredWords);
              return;
            }
          }
          
          // Không có dữ liệu trong cả hai nơi lưu trữ
          console.warn('No vocabulary data found in any storage');
          resolve([]);
        } catch (error) {
          console.error('Error loading from localStorage:', error);
          reject(error);
        }
      }
      
      // Hàm lọc từ dựa trên category và time range đã chọn
      function filterWordsByCurrentSelections(words) {
        const selectedCategory = studyCategory.value;
        const selectedTimeRange = studyTimeRange.value;
        console.log(`Filtering match game words by: category=${selectedCategory}, timeRange=${selectedTimeRange}`);
        
        let filteredWords = words;
        
        // Lọc theo danh mục
        if (selectedCategory !== 'all') {
          filteredWords = filteredWords.filter(word => 
            word && typeof word.categoryId === 'string' && word.categoryId === selectedCategory
          );
          console.log(`After category filter: ${filteredWords.length} words`);
        }
        
        // Lọc theo thời gian
        if (selectedTimeRange !== 'all') {
          const now = Date.now();
          let timeThreshold = now;
          
          switch (selectedTimeRange) {
            case 'day':
              timeThreshold = now - 24 * 60 * 60 * 1000; // 24 hours ago
              break;
            case 'week':
              timeThreshold = now - 7 * 24 * 60 * 60 * 1000; // 7 days ago
              break;
            case 'month':
              timeThreshold = now - 30 * 24 * 60 * 60 * 1000; // 30 days ago
              break;
          }
          
          filteredWords = filteredWords.filter(word => {
            if (!word.createdAt) return false;
            return word.createdAt > timeThreshold;
          });
          
          console.log(`After time range filter: ${filteredWords.length} words`);
        }
        
        // Kiểm tra cấu trúc dữ liệu
        filteredWords = filteredWords.filter(word => 
          word && word.id && word.text && word.meaning
        );
        
        console.log(`Final filtered words for match game: ${filteredWords.length} words`);
        return filteredWords;
      }
    });
  }

  // Cần thêm hàm xử lý click trên thẻ card
  function handleMatchCardClick(event) {
    if (!matchGameActive) {
      console.log('Match game is not active, ignoring click');
      return;
    }
    
    console.log('Card clicked in match game');
    
    const card = event.currentTarget;
    const cardId = card.dataset.id;
    const originalId = card.dataset.originalId;
    const cardType = card.dataset.type;
    
    console.log(`Card clicked: ID=${cardId}, originalId=${originalId}, type=${cardType}`);
    
    // If card is already matched, ignore
    if (card.classList.contains('matched')) {
      console.log('Card is already matched, ignoring click');
      return;
    }
    
    // If this card type is already selected (we can only select one word and one meaning)
    const alreadySelectedSameType = selectedCards.find(c => c.dataset.type === cardType);
    if (alreadySelectedSameType) {
      // Deselect the previous card of the same type
      console.log('Deselecting previous card of same type');
      alreadySelectedSameType.classList.remove('selected');
      selectedCards = selectedCards.filter(c => c !== alreadySelectedSameType);
    }
    
    // Create a style element for selected cards if it doesn't exist
    if (!document.getElementById('match-game-styles')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'match-game-styles';
      styleEl.textContent = `
        .match-card.selected {
          border-width: 3px !important;
          transform: scale(1.02);
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .match-card.matched {
          opacity: 0.7;
          border-color: #10B981 !important;
        }
        .match-card.shake {
          animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
        }
        .match-card.highlight-pair {
          animation: highlight 0.5s ease;
        }
        @keyframes shake {
          10%, 90% { transform: translate3d(-1px, 0, 0); }
          20%, 80% { transform: translate3d(2px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
          40%, 60% { transform: translate3d(4px, 0, 0); }
        }
        @keyframes highlight {
          0% { background-color: rgba(16, 185, 129, 0.2); }
          50% { background-color: rgba(16, 185, 129, 0.5); }
          100% { background-color: rgba(16, 185, 129, 0.2); }
        }
      `;
      document.head.appendChild(styleEl);
    }
    
    // Toggle selection on this card
    if (selectedCards.includes(card)) {
      // Deselect
      console.log('Deselecting card');
      card.classList.remove('selected');
      selectedCards = selectedCards.filter(c => c !== card);
      playCardFlipSound();
    } else {
      // Select
      console.log('Selecting card');
      card.classList.add('selected');
      selectedCards.push(card);
      playCardFlipSound();
    }
    
    // If we have 2 cards selected (one word and one meaning), check for a match
    if (selectedCards.length === 2) {
      const [card1, card2] = selectedCards;
      
      // Check if they match (same originalId and different types)
      if (card1.dataset.originalId === card2.dataset.originalId && 
          card1.dataset.type !== card2.dataset.type) {
        
        console.log('Match found!');
        
        // Match success!
        setTimeout(() => {
          // Add matched class with animation
          card1.classList.add('matched');
          card2.classList.add('matched');
          
          // Thêm hiệu ứng kết nối giữa các thẻ
          card1.classList.add('highlight-pair');
          card2.classList.add('highlight-pair');
          
          // Play success sound
          playMatchSuccessSound();
          
          // Remove from selectedCards
          selectedCards = [];
          
          // Update match count
          matchedPairs++;
          pairsMatchedElement.textContent = matchedPairs.toString();
          
          // Apply fade-out animation
          setTimeout(() => {
            card1.style.visibility = 'hidden';
            card2.style.visibility = 'hidden';
            
            // Xóa lớp highlight-pair sau khi thẻ biến mất
            card1.classList.remove('highlight-pair');
            card2.classList.remove('highlight-pair');
            
            // Check if game is complete
            if (matchedPairs === totalPairs) {
              console.log('Game complete! All pairs matched.');
              handleGameCompletion();
            }
          }, 500);
          
        }, 300);
      } else {
        // Not a match
        console.log('No match found');
        
        // Add shake animation to both cards
        card1.classList.add('shake');
        card2.classList.add('shake');
        
        // Play failure sound
        playMatchFailSound();
        
        // Remove animation and selected class after delay
        setTimeout(() => {
          // Remove shake animation
          card1.classList.remove('shake');
          card2.classList.remove('shake');
          
          // Remove selected class
          card1.classList.remove('selected');
          card2.classList.remove('selected');
          
          // Clear selected cards
          selectedCards = [];
        }, 800);
      }
    }
  }
  
  // Helper function to handle game completion
  function handleGameCompletion() {
    // Game over - player won
    clearInterval(gameTimerInterval);
    
    // Show victory message with animation
    setTimeout(() => {
      const totalTime = matchTimerElement.textContent;
      const elapsedSeconds = Math.floor((Date.now() - gameStartTime) / 1000);
      
      // Calculate score based on time and number of pairs
      const score = Math.max(100 - Math.floor(elapsedSeconds/totalPairs * 2), 10) * totalPairs;
      
      matchGameBoard.innerHTML = '';
      matchGameBoard.className = 'flex justify-center items-center mb-6';
      
      const resultCard = document.createElement('div');
      resultCard.className = 'game-result-card col-span-4 bg-green-50 dark:bg-green-900 p-6 rounded-lg border border-green-200 dark:border-green-700 text-center transform transition-all duration-500 opacity-0 scale-95';
      
      resultCard.innerHTML = `
        <div class="flex justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-green-500 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 class="text-green-700 dark:text-green-300 text-xl font-bold mb-2">Congratulations!</h3>
        <p class="text-green-700 dark:text-green-300 mb-4">
          You matched all ${totalPairs} pairs in ${totalTime}
        </p>
        <div class="bg-white dark:bg-gray-800 rounded-lg p-4 mb-4">
          <div class="text-2xl font-bold text-accent">${score} points</div>
          <div class="text-sm text-gray-500 dark:text-gray-400">Score based on time and difficulty</div>
        </div>
        <button id="play-again-btn" class="px-4 py-2 bg-accent text-white rounded-md hover:bg-accent-hover transition-colors duration-300">
          Play Again
        </button>
      `;
      
      matchGameBoard.appendChild(resultCard);
      
      // Animation effect
      setTimeout(() => {
        resultCard.classList.remove('opacity-0', 'scale-95');
      }, 100);
      
      // Add listener for play again button
      setTimeout(() => {
        const playAgainBtn = document.getElementById('play-again-btn');
        if (playAgainBtn) {
          playAgainBtn.addEventListener('click', () => {
            initMatchGame();
            setTimeout(() => startMatchGame(), 300);
          });
        }
      }, 150);
      
      // Play win sound
      playGameWinSound();
    }, 800);
  }
}); 