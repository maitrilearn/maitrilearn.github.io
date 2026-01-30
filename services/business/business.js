import { supabase } from "../../core/supabase.js";
import { formatDate, getRandomColor } from "../../core/utils.js";

// ============================================
// STATE MANAGEMENT
// ============================================
const state = {
  businesses: [],
  filteredBusinesses: [],
  categories: [],
  currentCategory: 'all',
  searchQuery: '',
  sortBy: 'newest',
  currentTags: [],
  userId: null,
  currentBusinessId: null
};

// ============================================
// DOM ELEMENTS
// ============================================
let elements = {};

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Business System Initializing...');
  
  // Initialize DOM elements
  initializeElements();
  
  // Set up event listeners
  setupEventListeners();
  
  // Generate user ID
  state.userId = 'user-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  localStorage.setItem('businessUserId', state.userId);
  
  // Load categories
  await loadCategories();
  
  // Load businesses
  await loadBusinesses();
  
  // Load statistics
  await loadStatistics();
  
  console.log('Business System Ready');
});

function initializeElements() {
  elements = {
    // Form elements
    businessTitle: document.getElementById('businessTitle'),
    businessCategory: document.getElementById('businessCategory'),
    businessDescription: document.getElementById('businessDescription'),
    contactType: document.getElementById('contactType'),
    contactInfo: document.getElementById('contactInfo'),
    businessLocation: document.getElementById('businessLocation'),
    tagInput: document.getElementById('tagInput'),
    tagsContainer: document.getElementById('tagsContainer'),
    postBusiness: document.getElementById('postBusiness'),
    
    // Search and filter
    searchInput: document.getElementById('searchInput'),
    filterButtons: document.querySelectorAll('.filter-btn'),
    
    // Display
    businessList: document.getElementById('businessList'),
    totalBusinesses: document.getElementById('totalBusinesses'),
    totalViews: document.getElementById('totalViews'),
    totalLikes: document.getElementById('totalLikes'),
    featuredCount: document.getElementById('featuredCount'),
    
    // Modal
    contactModal: document.getElementById('contactModal'),
    modalClose: document.querySelector('.modal-close'),
    modalBusinessInfo: document.getElementById('modalBusinessInfo'),
    contactForm: document.getElementById('contactForm'),
    senderName: document.getElementById('senderName'),
    senderContact: document.getElementById('senderContact'),
    message: document.getElementById('message')
  };
}

function setupEventListeners() {
  // Post business
  elements.postBusiness.addEventListener('click', postBusiness);
  
  // Search input
  elements.searchInput.addEventListener('input', debounce(handleSearch, 300));
  
  // Filter buttons
  elements.filterButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      elements.filterButtons.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      state.currentCategory = this.dataset.category;
      filterBusinesses();
    });
  });
  
  // Tag input
  elements.tagInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && this.value.trim()) {
      e.preventDefault();
      addTag(this.value.trim());
      this.value = '';
    }
  });
  
  // Modal close
  elements.modalClose.addEventListener('click', closeModal);
  elements.contactModal.addEventListener('click', function(e) {
    if (e.target === this) closeModal();
  });
  
  // Contact form
  elements.contactForm.addEventListener('submit', handleContactSubmit);
  
  // Close modal on Escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeModal();
  });
}

// ============================================
// BUSINESS POSTING
// ============================================
async function postBusiness() {
  const title = elements.businessTitle.value.trim();
  const category = elements.businessCategory.value;
  const description = elements.businessDescription.value.trim();
  
  if (!title) {
    showError('Please enter a business name');
    elements.businessTitle.focus();
    return;
  }
  
  if (!category) {
    showError('Please select a category');
    elements.businessCategory.focus();
    return;
  }
  
  if (!description) {
    showError('Please enter a description');
    elements.businessDescription.focus();
    return;
  }
  
  const originalText = elements.postBusiness.innerHTML;
  elements.postBusiness.disabled = true;
  elements.postBusiness.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting...';
  
  try {
    const businessData = {
      title: title,
      description: description,
      category: category,
      contact: elements.contactInfo.value.trim(),
      contact_type: elements.contactType.value,
      location: elements.businessLocation.value.trim(),
      tags: state.currentTags.length > 0 ? state.currentTags : null,
      views: 0,
      likes: 0,
      created_at: new Date().toISOString()
    };
    
    console.log('Posting business:', businessData);
    
    const { data, error } = await supabase
      .from('businesses')
      .insert([businessData])
      .select();
    
    if (error) throw error;
    
    // Reset form
    resetForm();
    
    // Show success
    showSuccess('Business posted successfully!');
    
    // Reload businesses
    await loadBusinesses();
    await loadStatistics();
    
  } catch (error) {
    console.error('Post error:', error);
    showError('Failed to post business: ' + error.message);
  } finally {
    elements.postBusiness.disabled = false;
    elements.postBusiness.innerHTML = originalText;
  }
}

function resetForm() {
  elements.businessTitle.value = '';
  elements.businessCategory.value = '';
  elements.businessDescription.value = '';
  elements.contactInfo.value = '';
  elements.businessLocation.value = '';
  state.currentTags = [];
  elements.tagsContainer.innerHTML = '';
}

// ============================================
// TAG MANAGEMENT
// ============================================
function addTag(tag) {
  if (state.currentTags.length >= 5) {
    showError('Maximum 5 tags allowed');
    return;
  }
  
  if (!state.currentTags.includes(tag)) {
    state.currentTags.push(tag);
    renderTags();
  }
}

function removeTag(tag) {
  state.currentTags = state.currentTags.filter(t => t !== tag);
  renderTags();
}

function renderTags() {
  elements.tagsContainer.innerHTML = state.currentTags.map(tag => `
    <div class="tag">
      ${tag}
      <button class="tag-remove" onclick="removeTag('${tag}')">&times;</button>
    </div>
  `).join('');
}

// Make removeTag available globally
window.removeTag = removeTag;

// ============================================
// LOAD BUSINESSES
// ============================================
async function loadBusinesses() {
  elements.businessList.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading businesses...</div>';
  
  try {
    let query = supabase
      .from('businesses')
      .select('*')
      .order('created_at', { ascending: false });
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    state.businesses = data || [];
    state.filteredBusinesses = [...state.businesses];
    
    renderBusinesses();
    
  } catch (error) {
    console.error('Load error:', error);
    elements.businessList.innerHTML = `
      <div class="error">
        <i class="fas fa-exclamation-triangle"></i> 
        Failed to load businesses: ${error.message}
      </div>
    `;
  }
}

// ============================================
// RENDER BUSINESSES
// ============================================
function renderBusinesses() {
  if (state.filteredBusinesses.length === 0) {
    elements.businessList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-store-slash"></i>
        <h3>No businesses found</h3>
        <p>Be the first to post your business!</p>
      </div>
    `;
    return;
  }
  
  elements.businessList.innerHTML = `
    <div class="business-grid">
      ${state.filteredBusinesses.map(business => createBusinessCard(business)).join('')}
    </div>
  `;
  
  // Add event listeners to business cards
  addBusinessCardListeners();
}

function createBusinessCard(business) {
  const categoryColors = {
    'Food': '#FF6B6B',
    'Tech': '#4ECDC4',
    'Health': '#06D6A0',
    'Education': '#118AB2',
    'Retail': '#FFD166',
    'Service': '#9D4EDD',
    'Local': '#EF476F',
    'Online': '#1B9AAA',
    'Startup': '#7209B7',
    'Other': '#6C757D'
  };
  
  const color = categoryColors[business.category] || '#667eea';
  const createdAt = business.created_at ? formatDate(business.created_at) : 'Recently';
  const contactIcon = getContactIcon(business.contact_type);
  
  return `
    <div class="business-card ${business.featured ? 'featured' : ''}" data-id="${business.id}">
      ${business.featured ? '<div class="featured-badge"><i class="fas fa-star"></i> Featured</div>' : ''}
      
      <div class="business-header">
        <div class="business-category" style="background: ${color}">
          ${business.category}
        </div>
        <h3 class="business-title">${escapeHtml(business.title)}</h3>
        <p class="business-description">${escapeHtml(business.description)}</p>
        
        ${business.tags && business.tags.length > 0 ? `
          <div class="business-tags">
            ${business.tags.slice(0, 3).map(tag => `
              <span class="business-tag">${escapeHtml(tag)}</span>
            `).join('')}
            ${business.tags.length > 3 ? `<span class="business-tag">+${business.tags.length - 3}</span>` : ''}
          </div>
        ` : ''}
      </div>
      
      <div class="business-details">
        ${business.contact ? `
          <div class="contact-info">
            <i class="${contactIcon}"></i>
            <span>${escapeHtml(business.contact)}</span>
          </div>
        ` : ''}
        
        ${business.location ? `
          <div class="contact-info">
            <i class="fas fa-map-marker-alt"></i>
            <span>${escapeHtml(business.location)}</span>
          </div>
        ` : ''}
        
        <div class="business-stats-row">
          <div class="stat-item">
            <i class="far fa-eye"></i>
            <span>${business.views || 0} views</span>
          </div>
          <div class="stat-item">
            <i class="far fa-clock"></i>
            <span>${createdAt}</span>
          </div>
        </div>
        
        <div class="business-actions">
          <button class="action-btn btn-view" data-action="view" data-id="${business.id}">
            <i class="fas fa-eye"></i> View
          </button>
          <button class="action-btn btn-contact" data-action="contact" data-id="${business.id}">
            <i class="fas fa-envelope"></i> Contact
          </button>
          <button class="action-btn btn-like ${isBusinessLiked(business.id) ? 'liked' : ''}" 
                  data-action="like" data-id="${business.id}">
            <i class="${isBusinessLiked(business.id) ? 'fas' : 'far'} fa-heart"></i>
            <span class="like-count">${business.likes || 0}</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

function getContactIcon(contactType) {
  const icons = {
    'email': 'fas fa-envelope',
    'phone': 'fas fa-phone',
    'whatsapp': 'fab fa-whatsapp',
    'website': 'fas fa-globe',
    'instagram': 'fab fa-instagram',
    'facebook': 'fab fa-facebook',
    'twitter': 'fab fa-twitter'
  };
  return icons[contactType] || 'fas fa-envelope';
}

function addBusinessCardListeners() {
  // View button
  document.querySelectorAll('.btn-view').forEach(btn => {
    btn.addEventListener('click', async function() {
      const businessId = this.dataset.id;
      await viewBusiness(businessId);
    });
  });
  
  // Contact button
  document.querySelectorAll('.btn-contact').forEach(btn => {
    btn.addEventListener('click', function() {
      const businessId = this.dataset.id;
      openContactModal(businessId);
    });
  });
  
  // Like button
  document.querySelectorAll('.btn-like').forEach(btn => {
    btn.addEventListener('click', async function() {
      const businessId = this.dataset.id;
      await toggleLike(businessId, this);
    });
  });
}

// ============================================
// BUSINESS ACTIONS
// ============================================
async function viewBusiness(businessId) {
  try {
    // Get current views
    const { data: business } = await supabase
      .from('businesses')
      .select('views')
      .eq('id', businessId)
      .single();
    
    if (business) {
      // Update views count
      await supabase
        .from('businesses')
        .update({ views: (business.views || 0) + 1 })
        .eq('id', businessId);
      
      // Record detailed view
      try {
        await supabase
          .from('business_views')
          .insert([{
            business_id: businessId,
            user_id: state.userId
          }]);
      } catch (e) {
        console.log('Detailed view tracking error:', e);
      }
      
      // Update UI
      const viewCount = document.querySelector(`.btn-view[data-id="${businessId}"]`)
        ?.closest('.business-card')
        ?.querySelector('.fa-eye')
        ?.closest('.stat-item')
        ?.querySelector('span');
      
      if (viewCount) {
        const currentViews = parseInt(viewCount.textContent) || 0;
        viewCount.textContent = `${currentViews + 1} views`;
      }
      
      // Update statistics
      await loadStatistics();
    }
  } catch (error) {
    console.error('View error:', error);
  }
}

async function toggleLike(businessId, button) {
  try {
    const isLiked = button.classList.contains('liked');
    
    if (isLiked) {
      // Unlike
      await supabase
        .from('business_likes')
        .delete()
        .eq('business_id', businessId)
        .eq('user_id', state.userId);
      
      // Update business likes count
      const { data: business } = await supabase
        .from('businesses')
        .select('likes')
        .eq('id', businessId)
        .single();
      
      if (business) {
        const newLikes = Math.max(0, (business.likes || 0) - 1);
        await supabase
          .from('businesses')
          .update({ likes: newLikes })
          .eq('id', businessId);
        
        // Update UI
        updateLikeUI(button, false, newLikes);
      }
    } else {
      // Like
      await supabase
        .from('business_likes')
        .insert([{
          business_id: businessId,
          user_id: state.userId
        }]);
      
      // Update business likes count
      const { data: business } = await supabase
        .from('businesses')
        .select('likes')
        .eq('id', businessId)
        .single();
      
      if (business) {
        const newLikes = (business.likes || 0) + 1;
        await supabase
          .from('businesses')
          .update({ likes: newLikes })
          .eq('id', businessId);
        
        // Update UI
        updateLikeUI(button, true, newLikes);
      }
    }
    
    // Update statistics
    await loadStatistics();
    
  } catch (error) {
    console.error('Like error:', error);
    showError('Failed to update like');
  }
}

function updateLikeUI(button, isLiked, count) {
  button.classList.toggle('liked', isLiked);
  button.innerHTML = `
    <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i>
    <span class="like-count">${count}</span>
  `;
}

function isBusinessLiked(businessId) {
  // In a real app, you would check from database
  // For now, we'll check localStorage
  const likedBusinesses = JSON.parse(localStorage.getItem('likedBusinesses') || '[]');
  return likedBusinesses.includes(businessId);
}

// ============================================
// CONTACT MODAL
// ============================================
function openContactModal(businessId) {
  state.currentBusinessId = businessId;
  
  const business = state.businesses.find(b => b.id === businessId);
  if (!business) return;
  
  elements.modalBusinessInfo.innerHTML = `
    <div style="margin-bottom: 20px;">
      <h4 style="margin: 0 0 10px 0; color: #2d3748;">${escapeHtml(business.title)}</h4>
      <p style="color: #718096; margin: 0;">${escapeHtml(business.category)}</p>
      ${business.contact ? `
        <p style="color: #4a5568; margin: 10px 0;">
          <i class="${getContactIcon(business.contact_type)}"></i>
          ${escapeHtml(business.contact)}
        </p>
      ` : ''}
    </div>
  `;
  
  elements.contactModal.style.display = 'flex';
  elements.senderName.focus();
}

function closeModal() {
  elements.contactModal.style.display = 'none';
  elements.contactForm.reset();
  state.currentBusinessId = null;
}

async function handleContactSubmit(e) {
  e.preventDefault();
  
  const business = state.businesses.find(b => b.id === state.currentBusinessId);
  if (!business) return;
  
  const name = elements.senderName.value.trim();
  const contact = elements.senderContact.value.trim();
  const message = elements.message.value.trim();
  
  if (!name || !contact || !message) {
    showError('Please fill all fields');
    return;
  }
  
  // In a real app, you would send this to your backend
  // For now, we'll simulate sending
  console.log('Contact request:', {
    business: business.title,
    businessId: state.currentBusinessId,
    senderName: name,
    senderContact: contact,
    message: message
  });
  
  showSuccess(`Message sent to ${business.title}! They'll contact you soon.`);
  closeModal();
}

// ============================================
// FILTER AND SEARCH
// ============================================
function handleSearch() {
  state.searchQuery = elements.searchInput.value.toLowerCase();
  filterBusinesses();
}

function filterBusinesses() {
  let filtered = [...state.businesses];
  
  // Apply search filter
  if (state.searchQuery) {
    filtered = filtered.filter(business => 
      business.title.toLowerCase().includes(state.searchQuery) ||
      business.description.toLowerCase().includes(state.searchQuery) ||
      business.category.toLowerCase().includes(state.searchQuery) ||
      (business.tags && business.tags.some(tag => 
        tag.toLowerCase().includes(state.searchQuery)
      ))
    );
  }
  
  // Apply category filter
  switch (state.currentCategory) {
    case 'featured':
      filtered = filtered.filter(b => b.featured);
      break;
    case 'new':
      // Show businesses from last 7 days
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      filtered = filtered.filter(b => new Date(b.created_at) > weekAgo);
      break;
    case 'popular':
      filtered.sort((a, b) => (b.views || 0) - (a.views || 0));
      break;
  }
  
  state.filteredBusinesses = filtered;
  renderBusinesses();
}

// ============================================
// CATEGORIES
// ============================================
async function loadCategories() {
  try {
    // Try to load from database
    const { data, error } = await supabase
      .from('business_categories')
      .select('*')
      .order('name');
    
    if (!error && data) {
      state.categories = data;
    } else {
      // Fallback categories
      state.categories = [
        { name: 'Food', icon: '🍔', color: '#FF6B6B' },
        { name: 'Tech', icon: '💻', color: '#4ECDC4' },
        { name: 'Health', icon: '🏥', color: '#06D6A0' },
        { name: 'Education', icon: '🎓', color: '#118AB2' },
        { name: 'Retail', icon: '🛍️', color: '#FFD166' },
        { name: 'Service', icon: '🔧', color: '#9D4EDD' },
        { name: 'Local', icon: '📍', color: '#EF476F' },
        { name: 'Online', icon: '🌐', color: '#1B9AAA' },
        { name: 'Startup', icon: '🚀', color: '#7209B7' },
        { name: 'Other', icon: '📊', color: '#6C757D' }
      ];
    }
    
    // Populate category dropdown
    elements.businessCategory.innerHTML = `
      <option value="">Select a category</option>
      ${state.categories.map(cat => `
        <option value="${cat.name}" style="color: ${cat.color};">
          ${cat.icon} ${cat.name}
        </option>
      `).join('')}
    `;
    
  } catch (error) {
    console.error('Categories error:', error);
  }
}

// ============================================
// STATISTICS
// ============================================
async function loadStatistics() {
  try {
    const { data: businesses, error } = await supabase
      .from('businesses')
      .select('views, likes, featured');
    
    if (error) throw error;
    
    if (businesses) {
      const totalBusinesses = businesses.length;
      const totalViews = businesses.reduce((sum, b) => sum + (b.views || 0), 0);
      const totalLikes = businesses.reduce((sum, b) => sum + (b.likes || 0), 0);
      const featuredCount = businesses.filter(b => b.featured).length;
      
      elements.totalBusinesses.textContent = totalBusinesses;
      elements.totalViews.textContent = totalViews.toLocaleString();
      elements.totalLikes.textContent = totalLikes.toLocaleString();
      elements.featuredCount.textContent = featuredCount;
    }
  } catch (error) {
    console.error('Statistics error:', error);
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error';
  errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
  errorDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #fee;
    color: #d00;
    padding: 15px 20px;
    border-radius: 8px;
    border-left: 4px solid #f00;
    z-index: 1000;
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 300px;
    max-width: 400px;
    animation: slideIn 0.3s ease;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  `;
  
  document.body.appendChild(errorDiv);
  
  setTimeout(() => {
    if (errorDiv.parentNode) {
      errorDiv.remove();
    }
  }, 5000);
}

function showSuccess(message) {
  const successDiv = document.createElement('div');
  successDiv.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
  successDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #d4edda;
    color: #155724;
    padding: 15px 20px;
    border-radius: 8px;
    border-left: 4px solid #28a745;
    z-index: 1000;
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 300px;
    max-width: 400px;
    animation: slideIn 0.3s ease;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  `;
  
  document.body.appendChild(successDiv);
  
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

// ============================================
// ADD CSS ANIMATION
// ============================================
const businessStyles = document.createElement('style');
businessStyles.textContent = `
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
  
  .error {
    background: #fee;
    color: #d00;
    padding: 12px 15px;
    border-radius: 8px;
    margin: 10px 0;
    border: 1px solid #fcc;
  }
`;
document.head.appendChild(businessStyles);

// ============================================
// DEBUG FUNCTIONS (Optional)
// ============================================
window.debugBusiness = {
  getState: () => ({ ...state }),
  reload: async () => {
    await loadBusinesses();
    await loadStatistics();
  },
  clearData: async () => {
    await supabase.from('businesses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await loadBusinesses();
    await loadStatistics();
  },
  addSample: async () => {
    const sampleBusiness = {
      title: 'Sample Business ' + Date.now(),
      description: 'This is a sample business for testing purposes.',
      category: 'Tech',
      contact: 'sample@example.com',
      contact_type: 'email',
      location: 'Sample City',
      tags: ['sample', 'test', 'demo']
    };
    
    await supabase.from('businesses').insert([sampleBusiness]);
    await loadBusinesses();
    await loadStatistics();
  }
};
