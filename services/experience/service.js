import { supabase } from "../../core/supabase.js";
import { formatDate, getRandomColor, getInitials } from "../../core/utils.js";

// State
let currentCategory = 'All';
let sortBy = 'newest';
let currentUserId = null;
let commentsModal = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Generate user ID for this session
  currentUserId = 'user-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  localStorage.setItem('experienceUserId', currentUserId);
  
  // Load experiences
  loadExperiences();
  
  // Set up filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentCategory = e.target.dataset.category;
      loadExperiences();
    });
  });
  
  // Set up sort dropdown
  const sortSelect = document.getElementById('sortSelect');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      sortBy = e.target.value;
      loadExperiences();
    });
  }
  
  // Initialize mood selector
  const moodSelect = document.getElementById('mood');
  if (moodSelect) {
    moodSelect.value = '😊 Happy'; // Default mood
  }
  
  // Initialize post button
  const postBtn = document.getElementById('post');
  if (postBtn) {
    postBtn.addEventListener('click', postExperience);
  }
  
  // Create comments modal
  createCommentsModal();
});

// Post experience
async function postExperience() {
  const contentEl = document.getElementById('content');
  const categoryEl = document.getElementById('category');
  const moodEl = document.getElementById('mood');
  const postBtn = document.getElementById('post');
  
  if (!contentEl || !contentEl.value.trim()) {
    showError('Please enter some content');
    return;
  }
  
  const originalText = postBtn.innerHTML;
  postBtn.disabled = true;
  postBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting...';
  
  try {
    const experienceData = {
      content: contentEl.value.trim(),
      category: categoryEl ? categoryEl.value : 'Life',
      mood: moodEl ? moodEl.value : '😊 Happy',
      likes: 0,
      comments: 0,
      created_at: new Date().toISOString()
    };
    
    console.log('Posting experience:', experienceData);
    
    const { error } = await supabase
      .from("experiences")
      .insert([experienceData]);
    
    if (error) throw error;
    
    // Clear form
    contentEl.value = '';
    if (moodEl) moodEl.value = '😊 Happy';
    
    showSuccess('Experience shared successfully!');
    loadExperiences();
    
  } catch (error) {
    console.error('Post error:', error);
    showError('Failed to post: ' + error.message);
  } finally {
    postBtn.disabled = false;
    postBtn.innerHTML = originalText;
  }
}

// Load experiences
async function loadExperiences() {
  const feedEl = document.getElementById('feed');
  if (!feedEl) return;
  
  feedEl.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading experiences...</div>';
  
  try {
    let query = supabase.from("experiences").select("*");
    
    // Apply category filter
    if (currentCategory !== 'All') {
      query = query.eq('category', currentCategory);
    }
    
    // Apply sorting
    if (sortBy === 'newest') {
      query = query.order('created_at', { ascending: false });
    } else if (sortBy === 'oldest') {
      query = query.order('created_at', { ascending: true });
    } else if (sortBy === 'likes') {
      query = query.order('likes', { ascending: false });
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      feedEl.innerHTML = '<div class="card">No experiences yet. Be the first to share!</div>';
      return;
    }
    
    feedEl.innerHTML = data.map(exp => createExperienceCard(exp)).join("");
    
    // Add event listeners to like and comment buttons
    addExperienceEventListeners();
    
  } catch (error) {
    console.error('Load error:', error);
    feedEl.innerHTML = `
      <div class="error">
        <i class="fas fa-exclamation-triangle"></i> 
        Failed to load experiences: ${error.message}
      </div>
    `;
  }
}

// Create experience card HTML
function createExperienceCard(exp) {
  const mood = exp.mood || '😊';
  const likes = exp.likes || 0;
  const comments = exp.comments || 0;
  const category = exp.category || 'Life';
  const createdAt = exp.created_at ? formatDate(exp.created_at) : 'Recently';
  
  // Get color based on category
  const categoryColors = {
    'Life': '#FF6B6B',
    'Work': '#4ECDC4',
    'Relationship': '#FFD166',
    'MentalHealth': '#06D6A0',
    'Advice': '#118AB2',
    'Success': '#9D4EDD'
  };
  
  const cardColor = categoryColors[category] || getRandomColor();
  
  return `
    <div class="card experience-card" data-id="${exp.id}">
      <div style="display: flex; align-items: center; margin-bottom: 15px;">
        <div style="width: 50px; height: 50px; border-radius: 50%; background: ${cardColor}; 
                    display: flex; align-items: center; justify-content: center; color: white; 
                    font-weight: bold; margin-right: 15px; font-size: 1.5em;">
          ${mood}
        </div>
        <div style="flex: 1;">
          <div style="font-weight: bold; color: #333; font-size: 1.1em;">Anonymous User</div>
          <div style="display: flex; gap: 10px; font-size: 0.9em; color: #666; margin-top: 5px;">
            <span class="category-badge" style="background: ${cardColor}20; color: ${cardColor}; 
                  padding: 2px 10px; border-radius: 12px; font-weight: 600;">
              ${category}
            </span>
            <span><i class="far fa-clock"></i> ${createdAt}</span>
          </div>
        </div>
      </div>
      
      <div style="margin: 15px 0; line-height: 1.6; color: #444; font-size: 1.05em;">
        ${escapeHtml(exp.content).replace(/\n/g, '<br>')}
      </div>
      
      <div style="display: flex; gap: 20px; border-top: 1px solid #eee; padding-top: 12px;">
        <button class="like-btn" data-id="${exp.id}" 
                style="background: none; border: none; color: #666; cursor: pointer; 
                       display: flex; align-items: center; gap: 5px; padding: 5px 10px; 
                       border-radius: 6px; transition: all 0.2s;">
          <i class="far fa-heart"></i> 
          <span class="like-count">${likes}</span> Likes
        </button>
        
        <button class="comment-btn" data-id="${exp.id}" 
                style="background: none; border: none; color: #666; cursor: pointer; 
                       display: flex; align-items: center; gap: 5px; padding: 5px 10px; 
                       border-radius: 6px; transition: all 0.2s;">
          <i class="far fa-comment"></i> 
          <span class="comment-count">${comments}</span> Comments
        </button>
      </div>
      
      <!-- Comments section (initially hidden) -->
      <div class="comments-section" data-id="${exp.id}" style="display: none; margin-top: 15px;">
        <div class="comments-list" data-id="${exp.id}" style="margin-bottom: 10px; max-height: 200px; overflow-y: auto;"></div>
        <div style="display: flex; gap: 10px;">
          <input type="text" class="comment-input" data-id="${exp.id}" 
                 placeholder="Add a comment..." 
                 style="flex: 1; padding: 8px 12px; border: 1px solid #ddd; border-radius: 20px;">
          <button class="submit-comment" data-id="${exp.id}" 
                  style="background: #007bff; color: white; border: none; padding: 8px 15px; 
                         border-radius: 20px; cursor: pointer;">
            <i class="fas fa-paper-plane"></i>
          </button>
        </div>
      </div>
    </div>
  `;
}

// Add event listeners to experience cards
function addExperienceEventListeners() {
  // Like button click
  document.querySelectorAll('.like-btn').forEach(btn => {
    btn.addEventListener('click', async function() {
      const expId = this.dataset.id;
      await likeExperience(expId, this);
    });
  });
  
  // Comment button click
  document.querySelectorAll('.comment-btn').forEach(btn => {
    btn.addEventListener('click', async function() {
      const expId = this.dataset.id;
      const card = this.closest('.experience-card');
      const commentsSection = card.querySelector('.comments-section');
      
      // Toggle comments section
      if (commentsSection.style.display === 'none') {
        commentsSection.style.display = 'block';
        await loadComments(expId);
        this.innerHTML = '<i class="fas fa-comment"></i> Hide Comments';
      } else {
        commentsSection.style.display = 'none';
        this.innerHTML = '<i class="far fa-comment"></i> Comments';
      }
    });
  });
  
  // Submit comment
  document.querySelectorAll('.submit-comment').forEach(btn => {
    btn.addEventListener('click', async function() {
      const expId = this.dataset.id;
      const card = this.closest('.experience-card');
      const input = card.querySelector('.comment-input');
      await addComment(expId, input.value.trim());
      input.value = '';
    });
  });
  
  // Submit comment on Enter key
  document.querySelectorAll('.comment-input').forEach(input => {
    input.addEventListener('keypress', async function(e) {
      if (e.key === 'Enter') {
        const expId = this.dataset.id;
        await addComment(expId, this.value.trim());
        this.value = '';
      }
    });
  });
}

// Like an experience
async function likeExperience(expId, button) {
  try {
    // Get current likes
    const { data: exp, error: fetchError } = await supabase
      .from('experiences')
      .select('likes')
      .eq('id', expId)
      .single();
    
    if (fetchError) throw fetchError;
    
    // Update likes count
    const newLikes = (exp.likes || 0) + 1;
    
    const { error: updateError } = await supabase
      .from('experiences')
      .update({ likes: newLikes })
      .eq('id', expId);
    
    if (updateError) throw updateError;
    
    // Update UI
    const likeCount = button.querySelector('.like-count');
    if (likeCount) {
      likeCount.textContent = newLikes;
    }
    
    // Visual feedback
    button.style.color = '#ff4757';
    button.innerHTML = `<i class="fas fa-heart"></i> <span class="like-count">${newLikes}</span> Likes`;
    
    setTimeout(() => {
      button.style.color = '#666';
    }, 1000);
    
  } catch (error) {
    console.error('Like error:', error);
    showError('Failed to like experience');
  }
}

// Load comments for an experience
async function loadComments(expId) {
  try {
    const commentsList = document.querySelector(`.comments-list[data-id="${expId}"]`);
    if (!commentsList) return;
    
    commentsList.innerHTML = '<div style="padding: 10px; color: #666; text-align: center;">Loading comments...</div>';
    
    // Try to fetch from experiences_comments table first
    let comments = [];
    try {
      const { data, error } = await supabase
        .from('experiences_comments')
        .select('*')
        .eq('experience_id', expId)
        .order('created_at', { ascending: true });
      
      if (!error && data) {
        comments = data;
      }
    } catch (e) {
      console.log('No comments table or error:', e);
    }
    
    if (comments.length === 0) {
      commentsList.innerHTML = '<div style="padding: 10px; color: #666; text-align: center;">No comments yet. Be the first!</div>';
      return;
    }
    
    commentsList.innerHTML = comments.map(comment => `
      <div style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">
        <div style="font-weight: 600; color: #333; font-size: 0.9em;">
          <i class="fas fa-user-circle" style="margin-right: 5px;"></i>Anonymous
          <span style="font-weight: normal; color: #888; font-size: 0.85em; margin-left: 10px;">
            ${formatDate(comment.created_at)}
          </span>
        </div>
        <div style="color: #444; margin-top: 3px; font-size: 0.95em;">
          ${escapeHtml(comment.content)}
        </div>
      </div>
    `).join('');
    
  } catch (error) {
    console.error('Load comments error:', error);
    const commentsList = document.querySelector(`.comments-list[data-id="${expId}"]`);
    if (commentsList) {
      commentsList.innerHTML = '<div style="padding: 10px; color: #f00; text-align: center;">Error loading comments</div>';
    }
  }
}

// Add a comment
async function addComment(expId, commentText) {
  if (!commentText.trim()) {
    showError('Please enter a comment');
    return;
  }
  
  try {
    // First, update the comments count in experiences table
    const { data: exp } = await supabase
      .from('experiences')
      .select('comments')
      .eq('id', expId)
      .single();
    
    const newCommentsCount = (exp.comments || 0) + 1;
    
    await supabase
      .from('experiences')
      .update({ comments: newCommentsCount })
      .eq('id', expId);
    
    // Try to save comment to experiences_comments table
    try {
      await supabase
        .from('experiences_comments')
        .insert([{
          experience_id: expId,
          user_id: currentUserId,
          content: commentText,
          created_at: new Date().toISOString()
        }]);
    } catch (commentError) {
      console.log('Comment save error (table might not exist):', commentError);
      // Table might not exist, but we still updated the count
    }
    
    // Update comment count in UI
    const commentBtn = document.querySelector(`.comment-btn[data-id="${expId}"]`);
    if (commentBtn) {
      const commentCount = commentBtn.querySelector('.comment-count');
      if (commentCount) {
        commentCount.textContent = newCommentsCount;
      }
    }
    
    // Reload comments
    await loadComments(expId);
    
    // Show success
    showSuccess('Comment added!');
    
  } catch (error) {
    console.error('Add comment error:', error);
    showError('Failed to add comment');
  }
}

// Create comments modal
function createCommentsModal() {
  commentsModal = document.createElement('div');
  commentsModal.id = 'commentsModal';
  commentsModal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    display: none;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  `;
  
  commentsModal.innerHTML = `
    <div style="background: white; border-radius: 12px; width: 90%; max-width: 500px; max-height: 80vh; overflow: hidden;">
      <div style="padding: 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
        <h3 style="margin: 0;"><i class="fas fa-comments"></i> Comments</h3>
        <button id="closeModal" style="background: none; border: none; font-size: 1.5em; color: #666; cursor: pointer;">×</button>
      </div>
      <div id="modalCommentsList" style="padding: 20px; overflow-y: auto; max-height: 50vh;">
        Loading comments...
      </div>
      <div style="padding: 20px; border-top: 1px solid #eee;">
        <div style="display: flex; gap: 10px;">
          <input type="text" id="modalCommentInput" 
                 placeholder="Write a comment..." 
                 style="flex: 1; padding: 10px 15px; border: 1px solid #ddd; border-radius: 20px;">
          <button id="modalSubmitComment" 
                  style="background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 20px; cursor: pointer;">
            <i class="fas fa-paper-plane"></i>
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(commentsModal);
  
  // Close modal button
  document.getElementById('closeModal').addEventListener('click', () => {
    commentsModal.style.display = 'none';
  });
  
  // Close on background click
  commentsModal.addEventListener('click', (e) => {
    if (e.target === commentsModal) {
      commentsModal.style.display = 'none';
    }
  });
}

// Show comments modal (alternative method)
function showCommentsModal(expId) {
  commentsModal.style.display = 'flex';
  // Load comments and setup for this experience
  // (You would need to store currentExpId in a variable)
}

// Helper functions
function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error';
  errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
  document.querySelector('.container').prepend(errorDiv);
  
  setTimeout(() => {
    if (errorDiv.parentNode) {
      errorDiv.remove();
    }
  }, 5000);
}

function showSuccess(message) {
  const successDiv = document.createElement('div');
  successDiv.style.cssText = `
    background: #d4edda;
    color: #155724;
    padding: 12px 15px;
    border-radius: 8px;
    margin: 10px 0;
    border: 1px solid #c3e6cb;
    display: flex;
    align-items: center;
    gap: 10px;
  `;
  successDiv.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
  document.querySelector('.container').prepend(successDiv);
  
  setTimeout(() => {
    if (successDiv.parentNode) {
      successDiv.remove();
    }
  }, 3000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Add some CSS for better experience cards
const experienceStyles = document.createElement('style');
experienceStyles.textContent = `
  .experience-card {
    transition: transform 0.2s, box-shadow 0.2s;
    border-left: 4px solid #007bff;
  }
  
  .experience-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(0,0,0,0.1);
  }
  
  .like-btn:hover, .comment-btn:hover {
    background: #f8f9fa !important;
    color: #007bff !important;
  }
  
  .category-badge {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 12px;
    font-size: 0.85em;
    font-weight: 600;
  }
  
  .loading {
    text-align: center;
    padding: 30px;
    color: #666;
  }
  
  .error {
    background: #fee;
    color: #d00;
    padding: 12px 15px;
    border-radius: 8px;
    margin: 10px 0;
    border: 1px solid #fcc;
  }
`;
document.head.appendChild(experienceStyles);
