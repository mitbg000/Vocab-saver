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

// Hàm phát âm từ vựng
function playPronunciation(audioUrl) {
  if (!audioUrl) return;
  
  const audio = new Audio(audioUrl);
  audio.play().catch(error => {
    console.error('Error playing pronunciation:', error);
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
  
  // Nút phát âm
  if (pronunciation && pronunciation.audio) {
    const playButton = document.createElement('button');
    playButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>';
    playButton.className = 'p-1 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200 focus:outline-none';
    playButton.title = 'Listen to pronunciation';
    playButton.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      playPronunciation(pronunciation.audio);
    });
    
    container.appendChild(playButton);
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
      }
    }
    
    return wordObj;
  } catch (error) {
    console.error('Error saving pronunciation:', error);
    return wordObj;
  }
}

// Export các hàm để sử dụng ở các file khác
export {
  getPronunciation,
  playPronunciation,
  createPronunciationElement,
  saveWordWithPronunciation
}; 