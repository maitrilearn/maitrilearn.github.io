import { supabase } from "../../core/supabase.js";

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  MATCHING_INTERVAL: 3000, // Check for matches every 3 seconds
  MAX_WAIT_TIME: 300000,   // Max 5 minutes wait time
  CLEANUP_INTERVAL: 60000, // Cleanup every minute
  LANGUAGES: [
    { code: 'Te', name: 'Telugu', flag: '🇮🇳' },
    { code: 'Ta', name: 'Tamil', flag: '🇮🇳' },
    { code: 'En', name: 'English', flag: '🇺🇸' },
    { code: 'Hi', name: 'Hindi', flag: '🇮🇳' },
    { code: 'Ka', name: 'Kannada', flag: '🇮🇳' },
    { code: 'any', name: 'Any Language', flag: '🌍' }
  ],
  JITSI_CONFIG: {
    domain: 'meet.jit.si',
    width: '100%',
    height: '500px',
    configOverwrite: {
      startWithVideoMuted: true,
      startAudioOnly: true,
      prejoinPageEnabled: false,
      disableSimulcast: false,
      enableWelcomePage: false,
      enableClosePage: false,
      toolbarButtons: [
        'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
        'fodeviceselection', 'hangup', 'profile', 'chat', 'recording',
        'livestreaming', 'etherpad', 'sharedvideo', 'settings', 'raisehand',
        'videoquality', 'filmstrip', 'feedback', 'stats', 'shortcuts',
        'tileview', 'videobackgroundblur', 'download', 'help', 'mute-everyone',
        'security'
      ]
    },
    interfaceConfigOverwrite: {
      APP_NAME: 'SISO Call',
      SHOW_JITSI_WATERMARK: false,
      SHOW_WATERMARK_FOR_GUESTS: false,
      DEFAULT_BACKGROUND: '#667eea',
      TOOLBAR_BUTTONS: [
        'microphone', 'camera', 'hangup', 'settings', 'videoquality'
      ]
    }
  }
};

// ============================================
// STATE MANAGEMENT
// ============================================
const state = {
  userId: null,
  userLanguage: 'Te',
  allowAnyLanguage: true,
  matchingTimer: null,
  cleanupTimer: null,
  jitsiApi: null,
  isInQueue: false,
  startTime: null,
  matchAttempts: 0
};

// ============================================
// DOM ELEMENTS
// ============================================
let elements = {};

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('SISO Call System Initializing...');
  
  // Initialize DOM elements
  initializeElements();
  
  // Set up event listeners
  setupEventListeners();
  
  // Initialize language selector
  initializeLanguageSelector();
  
  // Load user preferences
  loadUserPreferences();
  
  // Check if user is already in queue
  await checkExistingSession();
  
  // Start periodic cleanup
  startCleanupTimer();
  
  // Update online count
  updateOnlineCount();
  
  console.log('SISO Call System Ready');
});

function initializeElements() {
  elements = {
    startBtn: document.getElementById('startCall'),
    cancelBtn: document.getElementById('cancelCall'),
    statusText: document.getElementById('statusText'),
    onlineCount: document.getElementById('onlineCount'),
    progressFill: document.getElementById('progressFill'),
    matchingInfo: document.getElementById('matchingInfo'),
    languageGrid: document.getElementById('languageGrid'),
    allowAnyLanguage: document.getElementById('allowAnyLanguage'),
    callArea: document.getElementById('callArea'),
    callPlaceholder: document.getElementById('callPlaceholder'),
    
    // Debug elements
    debugUserId: document.getElementById('debugUserId'),
    debugStatus: document.getElementById('debugStatus'),
    debugQueueSize: document.getElementById('debugQueueSize'),
    debugLanguage: document.getElementById('debugLanguage')
  };
}

function setupEventListeners() {
  elements.startBtn.addEventListener('click', handleStartCall);
  elements.cancelBtn.addEventListener('click', handleCancelCall);
  
  elements.allowAnyLanguage.addEventListener('change', function() {
    state.allowAnyLanguage = this.checked;
    localStorage.setItem('callAllowAnyLanguage', this.checked);
  });
}

function initializeLanguageSelector() {
  elements.languageGrid.innerHTML = CONFIG.LANGUAGES.map(lang => `
    <div class="language-option ${lang.code === state.userLanguage ? 'active' : ''}" 
         data-lang="${lang.code}">
      <div class="language-flag">${lang.flag}</div>
      <div>${lang.name}</div>
    </div>
  `).join('');
  
  // Add click handlers
  document.querySelectorAll('.language-option').forEach(option => {
    option.addEventListener('click', function() {
      // Remove active class from all
      document.querySelectorAll('.language-option').forEach(el => {
        el.classList.remove('active');
      });
      
      // Add active class to clicked
      this.classList.add('active');
      
      // Update state
      state.userLanguage = this.dataset.lang;
      localStorage.setItem('callLanguage', state.userLanguage);
      
      // Update debug display
      updateDebugDisplay();
    });
  });
}

function loadUserPreferences() {
  // Load language preference
  const savedLanguage = localStorage.getItem('callLanguage');
  if (savedLanguage) {
    state.userLanguage = savedLanguage;
  }
  
  // Load any language preference
  const savedAllowAny = localStorage.getItem('callAllowAnyLanguage');
  if (savedAllowAny !== null) {
    state.allowAnyLanguage = savedAllowAny === 'true';
    elements.allowAnyLanguage.checked = state.allowAnyLanguage;
  }
  
  // Update debug display
  updateDebugDisplay();
}

// ============================================
// CORE FUNCTIONS
// ============================================
async function handleStartCall() {
  console.log('Starting call search...');
  
  // Generate user ID if not exists
  if (!state.userId) {
    state.userId = generateUserId();
    localStorage.setItem('callUserId', state.userId);
  }
  
  // Update state
  state.isInQueue = true;
  state.startTime = Date.now();
  state.matchAttempts = 0;
  
  // Update UI
  updateUIForSearching();
  
  try {
    // Add user to queue
    await addToQueue();
    
    // Start matching process
    startMatchingProcess();
    
    // Update debug display
    updateDebugDisplay();
    
    console.log('User added to queue:', state.userId);
    
  } catch (error) {
    console.error('Failed to start call:', error);
    showError(`Failed to start search: ${error.message}`);
    resetCallSystem();
  }
}

async function handleCancelCall() {
  console.log('Cancelling call search...');
  
  try {
    // Remove from queue
    await removeFromQueue();
    
    // Reset system
    resetCallSystem();
    
    showMessage('Search cancelled', 'info');
    
  } catch (error) {
    console.error('Failed to cancel call:', error);
    showError(`Failed to cancel: ${error.message}`);
  }
}

// ============================================
// QUEUE MANAGEMENT
// ============================================
async function addToQueue() {
  try {
    // First, remove any existing entry for this user
    await supabase
      .from('call_queue')
      .delete()
      .eq('user_id', state.userId);
    
    // Add new entry
    const { error } = await supabase
      .from('call_queue')
      .insert([{
        user_id: state.userId,
        language: state.userLanguage,
        status: 'waiting',
        created_at: new Date().toISOString()
      }]);
    
    if (error) throw error;
    
  } catch (error) {
    console.error('Queue add error:', error);
    throw error;
  }
}

async function removeFromQueue() {
  if (!state.userId) return;
  
  try {
    const { error } = await supabase
      .from('call_queue')
      .delete()
      .eq('user_id', state.userId);
    
    if (error) throw error;
    
  } catch (error) {
    console.error('Queue remove error:', error);
    throw error;
  }
}

async function checkExistingSession() {
  // Load saved user ID
  const savedUserId = localStorage.getItem('callUserId');
  if (!savedUserId) return;
  
  state.userId = savedUserId;
  
  try {
    // Check if user is still in queue
    const { data, error } = await supabase
      .from('call_queue')
      .select('*')
      .eq('user_id', state.userId)
      .eq('status', 'waiting');
    
    if (error) throw error;
    
    if (data && data.length > 0) {
      // User is still in queue
      state.isInQueue = true;
      state.userLanguage = data[0].language;
      updateUIForSearching();
      startMatchingProcess();
      console.log('Resumed existing session');
    } else {
      // Clear invalid session
      localStorage.removeItem('callUserId');
      state.userId = null;
    }
    
  } catch (error) {
    console.error('Session check error:', error);
  }
}

// ============================================
// MATCHING ALGORITHM
// ============================================
function startMatchingProcess() {
  // Clear any existing timer
  if (state.matchingTimer) {
    clearInterval(state.matchingTimer);
  }
  
  // Start matching interval
  state.matchingTimer = setInterval(async () => {
    await findMatch();
  }, CONFIG.MATCHING_INTERVAL);
  
  // Update progress bar
  updateProgressBar();
}

async function findMatch() {
  if (!state.isInQueue || !state.userId) return;
  
  state.matchAttempts++;
  
  try {
    // Get current queue
    const { data: queue, error } = await supabase
      .from('call_queue')
      .select('*')
      .eq('status', 'waiting')
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    
    // Update queue size
    const queueSize = queue ? queue.length : 0;
    elements.debugQueueSize.textContent = queueSize;
    
    // Check if we're still in queue
    const meInQueue = queue ? queue.find(u => u.user_id === state.userId) : null;
    if (!meInQueue) {
      console.log('User not in queue anymore');
      clearInterval(state.matchingTimer);
      resetCallSystem();
      return;
    }
    
    // Update matching info
    updateMatchingInfo(queueSize);
    
    // Check for timeout
    const elapsedTime = Date.now() - state.startTime;
    if (elapsedTime > CONFIG.MAX_WAIT_TIME) {
      showMessage('Maximum wait time reached. Try again!', 'warning');
      await handleCancelCall();
      return;
    }
    
    // Try to find match
    if (queue && queue.length >= 2) {
      let match = null;
      
      // First, try to match with same language
      if (state.userLanguage !== 'any') {
        match = queue.find(user => 
          user.user_id !== state.userId && 
          user.language === state.userLanguage
        );
      }
      
      // If no same language match and allowed, match with any
      if (!match && state.allowAnyLanguage) {
        match = queue.find(user => 
          user.user_id !== state.userId && 
          user.language !== 'any'
        );
      }
      
      // If still no match, match with 'any' language users
      if (!match) {
        match = queue.find(user => 
          user.user_id !== state.userId
        );
      }
      
      // If match found
      if (match) {
        console.log('Match found!', match);
        
        // Remove both users from queue
        await supabase
          .from('call_queue')
          .delete()
          .in('user_id', [state.userId, match.user_id]);
        
        // Clear matching timer
        clearInterval(state.matchingTimer);
        state.matchingTimer = null;
        
        // Create call session record (optional)
        await createCallSession(match);
        
        // Start the call
        const roomId = generateRoomId();
        startJitsiCall(roomId);
        
        // Update user stats (optional)
        await updateUserStats();
      }
    }
    
    // Update progress bar
    updateProgressBar();
    
  } catch (error) {
    console.error('Matching error:', error);
  }
}

// ============================================
// JITSI CALL MANAGEMENT
// ============================================
function startJitsiCall(roomId) {
  console.log('Starting Jitsi call in room:', roomId);
  
  // Update UI
  elements.statusText.innerHTML = `<i class="fas fa-phone-alt"></i> Connecting to call...`;
  elements.startBtn.style.display = 'none';
  elements.cancelBtn.style.display = 'none';
  
  // Clear call area
  elements.callArea.innerHTML = '';
  
  try {
    // Initialize Jitsi
    state.jitsiApi = new JitsiMeetExternalAPI(
      CONFIG.JITSI_CONFIG.domain,
      {
        ...CONFIG.JITSI_CONFIG,
        roomName: roomId,
        parentNode: elements.callArea
      }
    );
    
    // Add event listeners
    state.jitsiApi.addEventListeners({
      readyToClose: () => {
        console.log('Call ended');
        endCallSession();
      },
      participantJoined: (participant) => {
        console.log('Participant joined:', participant);
        elements.statusText.innerHTML = `<i class="fas fa-check-circle"></i> Call connected!`;
      },
      participantLeft: (participant) => {
        console.log('Participant left:', participant);
        // Wait a moment then end call
        setTimeout(endCallSession, 2000);
      },
      videoConferenceJoined: () => {
        console.log('Joined video conference');
      },
      videoConferenceLeft: () => {
        console.log('Left video conference');
        endCallSession();
      }
    });
    
  } catch (error) {
    console.error('Jitsi initialization error:', error);
    showError('Failed to start call. Please try again.');
    endCallSession();
  }
}

// ============================================
// DATABASE FUNCTIONS
// ============================================
async function createCallSession(match) {
  try {
    const roomId = generateRoomId();
    
    const { error } = await supabase
      .from('call_sessions')
      .insert([{
        room_id: roomId,
        user1_id: state.userId,
        user2_id: match.user_id,
        user1_language: state.userLanguage,
        user2_language: match.language,
        started_at: new Date().toISOString()
      }]);
    
    if (error) console.error('Session creation error:', error);
    
  } catch (error) {
    console.error('Call session error:', error);
  }
}

async function updateUserStats() {
  try {
    // Check if user exists in stats
    const { data: existing } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', state.userId);
    
    if (existing && existing.length > 0) {
      // Update existing
      await supabase
        .from('user_stats')
        .update({
          total_calls: existing[0].total_calls + 1,
          last_active: new Date().toISOString(),
          preferred_language: state.userLanguage
        })
        .eq('user_id', state.userId);
    } else {
      // Create new
      await supabase
        .from('user_stats')
        .insert([{
          user_id: state.userId,
          total_calls: 1,
          preferred_language: state.userLanguage,
          last_active: new Date().toISOString()
        }]);
    }
  } catch (error) {
    console.error('Stats update error:', error);
  }
}

async function updateOnlineCount() {
  try {
    const { data, error } = await supabase
      .from('call_queue')
      .select('id', { count: 'exact' })
      .eq('status', 'waiting');
    
    if (!error && data !== null) {
      elements.onlineCount.textContent = data.length;
    }
  } catch (error) {
    console.error('Online count error:', error);
  }
  
  // Update every 10 seconds
  setTimeout(updateOnlineCount, 10000);
}

function startCleanupTimer() {
  state.cleanupTimer = setInterval(async () => {
    try {
      // Remove entries older than 1 hour
      const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
      
      await supabase
        .from('call_queue')
        .delete()
        .lt('created_at', oneHourAgo);
      
      console.log('Cleanup completed');
      
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }, CONFIG.CLEANUP_INTERVAL);
}

// ============================================
// UI UPDATES
// ============================================
function updateUIForSearching() {
  elements.startBtn.disabled = true;
  elements.startBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Searching...';
  elements.cancelBtn.style.display = 'inline-block';
  elements.statusText.innerHTML = `<i class="fas fa-search"></i> Looking for match...`;
  elements.debugStatus.textContent = 'searching';
}

function updateMatchingInfo(queueSize) {
  const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
  const languageName = CONFIG.LANGUAGES.find(l => l.code === state.userLanguage)?.name || state.userLanguage;
  
  elements.matchingInfo.innerHTML = `
    <div class="matching-info">
      <i class="fas fa-clock"></i> Searching for ${queueSize-1} other user(s)<br>
      <small>Language: <span class="language-badge">${languageName}</span></small><br>
      <small>Time: ${elapsed}s • Attempts: ${state.matchAttempts}</small>
    </div>
  `;
}

function updateProgressBar() {
  if (!state.startTime) return;
  
  const elapsed = Date.now() - state.startTime;
  const progress = Math.min((elapsed / CONFIG.MAX_WAIT_TIME) * 100, 100);
  
  elements.progressFill.style.width = `${progress}%`;
}

function updateDebugDisplay() {
  elements.debugUserId.textContent = state.userId || '-';
  elements.debugStatus.textContent = state.isInQueue ? 'searching' : 'idle';
  elements.debugLanguage.textContent = state.userLanguage;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function generateUserId() {
  return `siso-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateRoomId() {
  return `siso-room-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
}

function showMessage(message, type = 'info') {
  const colors = {
    info: '#4299e1',
    success: '#48bb78',
    warning: '#ed8936',
    error: '#f56565'
  };
  
  const icon = {
    info: 'info-circle',
    success: 'check-circle',
    warning: 'exclamation-triangle',
    error: 'exclamation-circle'
  }[type];
  
  const messageDiv = document.createElement('div');
  messageDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: white;
    color: ${colors[type]};
    padding: 15px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    border-left: 4px solid ${colors[type]};
    z-index: 1000;
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 300px;
    max-width: 400px;
    animation: slideIn 0.3s ease;
  `;
  
  messageDiv.innerHTML = `
    <i class="fas fa-${icon}" style="font-size: 1.2em;"></i>
    <div>${message}</div>
    <button onclick="this.parentElement.remove()" 
            style="margin-left: auto; background: none; border: none; color: #999; cursor: pointer;">
      <i class="fas fa-times"></i>
    </button>
  `;
  
  document.body.appendChild(messageDiv);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (messageDiv.parentNode) {
      messageDiv.remove();
    }
  }, 5000);
}

function showError(message) {
  showMessage(message, 'error');
}

// ============================================
// CLEANUP AND RESET
// ============================================
function endCallSession() {
  console.log('Ending call session');
  
  // Clean up Jitsi
  if (state.jitsiApi) {
    try {
      state.jitsiApi.dispose();
    } catch (error) {
      console.error('Error disposing Jitsi:', error);
    }
    state.jitsiApi = null;
  }
  
  // Reset system
  resetCallSystem();
  
  // Show call ended message
  showMessage('Call ended. Ready for another conversation!', 'info');
}

function resetCallSystem() {
  console.log('Resetting call system');
  
  // Clear timers
  if (state.matchingTimer) {
    clearInterval(state.matchingTimer);
    state.matchingTimer = null;
  }
  
  // Reset state
  state.isInQueue = false;
  state.startTime = null;
  state.matchAttempts = 0;
  
  // Reset UI
  elements.startBtn.disabled = false;
  elements.startBtn.innerHTML = '<i class="fas fa-phone-alt"></i> Start Anonymous Call';
  elements.startBtn.style.display = 'inline-block';
  elements.cancelBtn.style.display = 'none';
  elements.statusText.innerHTML = '<i class="fas fa-user-clock"></i> Ready to connect';
  elements.progressFill.style.width = '0%';
  elements.matchingInfo.innerHTML = '';
  
  // Reset call area
  elements.callArea.innerHTML = '';
  elements.callArea.appendChild(elements.callPlaceholder);
  
  // Update debug display
  updateDebugDisplay();
  
  // Update online count
  updateOnlineCount();
}

// ============================================
// DEBUG FUNCTIONS (Optional)
// ============================================
window.debugCall = {
  clearQueue: async () => {
    try {
      await supabase
        .from('call_queue')
        .delete()
        .neq('id', 0);
      console.log('Queue cleared');
      showMessage('Queue cleared', 'info');
      updateOnlineCount();
    } catch (error) {
      console.error('Clear queue error:', error);
    }
  },
  
  getQueue: async () => {
    const { data } = await supabase
      .from('call_queue')
      .select('*');
    console.log('Current queue:', data);
    return data;
  },
  
  reset: resetCallSystem,
  
  getState: () => ({ ...state }),
  
  testMatch: async () => {
    // Add a test user to queue
    const testUserId = `test-${Date.now()}`;
    await supabase
      .from('call_queue')
      .insert([{
        user_id: testUserId,
        language: state.userLanguage,
        status: 'waiting'
      }]);
    console.log('Test user added:', testUserId);
  }
};

// ============================================
// ADD CSS ANIMATION FOR MESSAGES
// ============================================
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
`;
document.head.appendChild(style);
