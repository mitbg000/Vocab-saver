// theme.js - Xử lý chế độ dark mode cho toàn bộ extension

document.addEventListener('DOMContentLoaded', function() {
  // Kiểm tra darkMode từ localStorage - sử dụng cùng key với các file khác
  const isDarkMode = localStorage.getItem('vocabulary-dark-mode') === 'dark';
  
  // Function để áp dụng trạng thái dark mode
  function applyDarkMode(enabled) {
    if (enabled) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark-mode');
      
      // Cập nhật tất cả các nút toggle
      document.querySelectorAll('.toggle-dark-mode').forEach(toggle => {
        toggle.setAttribute('aria-checked', 'true');
        toggle.setAttribute('title', 'Switch to Light Mode');
        
        // Thêm hiệu ứng animation nếu không phải là lần load ban đầu
        if (document.readyState === 'complete') {
          const moonIcon = toggle.querySelector('.moon-icon');
          if (moonIcon) {
            moonIcon.style.animation = 'rotateIcon 0.5s ease-in-out';
            setTimeout(() => {
              moonIcon.style.animation = '';
            }, 500);
          }
        }
      });
      
      // Cập nhật darkModeToggle nếu có (cho các file cũ)
      const darkModeToggle = document.getElementById('darkModeToggle');
      if (darkModeToggle) {
        darkModeToggle.classList.add('active');
      }
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark-mode');
      
      // Cập nhật tất cả các nút toggle
      document.querySelectorAll('.toggle-dark-mode').forEach(toggle => {
        toggle.setAttribute('aria-checked', 'false');
        toggle.setAttribute('title', 'Switch to Dark Mode');
        
        // Thêm hiệu ứng animation nếu không phải là lần load ban đầu
        if (document.readyState === 'complete') {
          const sunIcon = toggle.querySelector('.sun-icon');
          if (sunIcon) {
            sunIcon.style.animation = 'rotateIcon 0.5s ease-in-out';
            setTimeout(() => {
              sunIcon.style.animation = '';
            }, 500);
          }
        }
      });
      
      // Cập nhật darkModeToggle nếu có (cho các file cũ)
      const darkModeToggle = document.getElementById('darkModeToggle');
      if (darkModeToggle) {
        darkModeToggle.classList.remove('active');
      }
    }
    
    // Lưu trạng thái vào localStorage với cùng key mà các file khác sử dụng
    localStorage.setItem('vocabulary-dark-mode', enabled ? 'dark' : 'light');
    console.log('Theme.js: Dark mode set to:', enabled ? 'dark' : 'light');
  }
  
  // Áp dụng dark mode nếu đã được lưu
  applyDarkMode(isDarkMode);
  
  // Tìm tất cả các nút toggle
  const darkModeToggles = document.querySelectorAll('.toggle-dark-mode');
  const darkModeToggle = document.getElementById('darkModeToggle');
  
  console.log('Theme.js: Found toggle-dark-mode elements:', darkModeToggles.length);
  console.log('Theme.js: Found darkModeToggle element:', darkModeToggle ? 'yes' : 'no');
  
  // Xử lý sự kiện click cho tất cả các nút toggle có class toggle-dark-mode
  darkModeToggles.forEach(toggle => {
    // Thiết lập thuộc tính ARIA cho accessibility
    toggle.setAttribute('role', 'switch');
    toggle.setAttribute('aria-checked', isDarkMode ? 'true' : 'false');
    
    toggle.addEventListener('click', function() {
      const currentMode = document.documentElement.classList.contains('dark');
      applyDarkMode(!currentMode);
      
      // Thêm hiệu ứng ripple
      const ripple = document.createElement('span');
      ripple.classList.add('ripple-effect');
      this.appendChild(ripple);
      
      // Xóa hiệu ứng ripple sau khi animation hoàn thành
      setTimeout(() => {
        ripple.remove();
      }, 600);
      
      console.log('Theme.js: Dark mode toggled to:', !currentMode ? 'dark' : 'light');
    });
  });
  
  // Xử lý sự kiện cho darkModeToggle nếu có (cho các file cũ) và không chứa class toggle-dark-mode
  if (darkModeToggle && !darkModeToggle.classList.contains('toggle-dark-mode')) {
    darkModeToggle.addEventListener('click', function() {
      const currentMode = document.documentElement.classList.contains('dark');
      applyDarkMode(!currentMode);
      console.log('Theme.js: Dark mode toggled via darkModeToggle to:', !currentMode ? 'dark' : 'light');
    });
  }
  
  // Xử lý dark mode theo cài đặt hệ thống (nếu người dùng chưa thiết lập)
  if (localStorage.getItem('vocabulary-dark-mode') === null) {
    // Kiểm tra xem trình duyệt có hỗ trợ dark mode không
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      applyDarkMode(true);
    }
    
    // Thêm event listener để theo dõi thay đổi hệ thống
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
      if (localStorage.getItem('vocabulary-dark-mode') === null) {
        applyDarkMode(event.matches);
      }
    });
  }
}); 