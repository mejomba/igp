let currentUser = null;
let accessToken = null;
let refreshToken = null;

// ============================================
// تابع خواندن CSRF Token از کوکی
// ============================================
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            // آیا این کوکی با نام مورد نظر شروع می‌شود؟
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

// ============================================
// تابع دریافت CSRF Token از کوکی (با نام csrftoken)
// ============================================
function getCsrfToken() {
    return getCookie('csrftoken');
}

// ============================================
// تنظیمات全局 Ajax با CSRF Token
// ============================================
$.ajaxSetup({
    headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRFToken': getCsrfToken()  // اضافه کردن CSRF Token به همه درخواست‌ها
    },
    xhrFields: {
        withCredentials: true
    },
    beforeSend: function(xhr, settings) {
        // به‌روزرسانی CSRF Token قبل از هر درخواست (در صورت تغییر)
        if (!settings.headers['X-CSRFToken']) {
            settings.headers['X-CSRFToken'] = getCsrfToken();
        }
    }
});

// ============================================
// تابع برای اضافه کردن Authorization header
// ============================================
function setAuthHeader() {
    const csrfToken = getCsrfToken();
    if (accessToken) {
        $.ajaxSetup({
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRFToken': csrfToken
            }
        });
    } else {
        $.ajaxSetup({
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRFToken': csrfToken
            }
        });
    }
}

// ============================================
// تابع کمکی برای ارسال درخواست با CSRF و Auth
// ============================================
function ajaxWithCsrf(options) {
    // اطمینان از وجود CSRF Token
    if (!options.headers) {
        options.headers = {};
    }
    if (!options.headers['X-CSRFToken']) {
        options.headers['X-CSRFToken'] = getCsrfToken();
    }
    if (!options.headers['X-Requested-With']) {
        options.headers['X-Requested-With'] = 'XMLHttpRequest';
    }
    
    // اضافه کردن Authorization Token اگر موجود باشد
    if (accessToken && !options.headers['Authorization']) {
        options.headers['Authorization'] = `Bearer ${accessToken}`;
    }
    
    return $.ajax(options);
}

// ============================================
// توابع احراز هویت
// ============================================
function login() {
    const username = $('#login-username').val();
    const password = $('#login-password').val();
    
    if (!username || !password) {
        alert('لطفاً نام کاربری و رمز عبور را وارد کنید');
        return;
    }
    
    $.ajax({
        url: '/api/login/',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ username, password }),
        headers: {
            'X-CSRFToken': getCsrfToken(),
            'X-Requested-With': 'XMLHttpRequest'
        },
        success: function(data) {
            accessToken = data.tokens.access;
            refreshToken = data.tokens.refresh;
            currentUser = data.user.username;
            
            // ذخیره در localStorage
            localStorage.setItem('access_token', accessToken);
            localStorage.setItem('refresh_token', refreshToken);
            localStorage.setItem('username', currentUser);
            
            // تنظیم header برای درخواست‌های بعدی
            setAuthHeader();
            
            $('#login-section').hide();
            $('#user-info').show();
            $('#username-display').text(currentUser);
            $('#create-post-section').show();
            
            loadPosts();
        },
        error: function(xhr) {
            const error = xhr.responseJSON?.error || 'خطا در ورود';
            alert(error);
        }
    });
}

function logout() {
    // ارسال درخواست logout به سرور
    if (refreshToken) {
        $.ajax({
            url: '/api/logout/',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ refresh: refreshToken }),
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'X-CSRFToken': getCsrfToken(),
                'X-Requested-With': 'XMLHttpRequest'
            },
            complete: function() {
                clearUserSession();
            }
        });
    } else {
        clearUserSession();
    }
}

function clearUserSession() {
    // پاک کردن اطلاعات محلی
    currentUser = null;
    accessToken = null;
    refreshToken = null;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('username');
    
    $.ajaxSetup({
        headers: {
            'Authorization': '',
            'X-CSRFToken': getCsrfToken(),
            'X-Requested-With': 'XMLHttpRequest'
        }
    });
    
    $('#login-section').show();
    $('#user-info').hide();
    $('#create-post-section').hide();
    $('#posts-container').html('');
    $('#login-username').val('');
    $('#login-password').val('');
}

function register() {
    const username = $('#reg-username').val();
    const password = $('#reg-password').val();
    const email = $('#reg-email').val();
    
    if (!username || !password) {
        alert('لطفاً نام کاربری و رمز عبور را وارد کنید');
        return;
    }
    
    $.ajax({
        url: '/api/register/',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ username, password, email }),
        headers: {
            'X-CSRFToken': getCsrfToken(),
            'X-Requested-With': 'XMLHttpRequest'
        },
        success: function(data) {
            alert('ثبت نام با موفقیت انجام شد');
            hideRegister();
            $('#login-username').val(username);
            $('#login-password').val(password);
            // به صورت خودکار وارد شوید
            login();
        },
        error: function(xhr) {
            const error = xhr.responseJSON || 'خطا در ثبت نام';
            alert('خطا در ثبت نام: ' + JSON.stringify(error));
        }
    });
}

// ============================================
// تابع برای رفرش توکن
// ============================================
function refreshAccessToken() {
    if (!refreshToken) {
        return $.Deferred().reject('No refresh token');
    }
    
    return $.ajax({
        url: '/api/token/refresh/',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ refresh: refreshToken }),
        headers: {
            'X-CSRFToken': getCsrfToken(),
            'X-Requested-With': 'XMLHttpRequest'
        },
        success: function(data) {
            accessToken = data.access;
            localStorage.setItem('access_token', accessToken);
            setAuthHeader();
        },
        error: function() {
            logout();
        }
    });
}

// ============================================
// تابع برای ارسال درخواست با احراز هویت و CSRF
// ============================================
function ajaxWithAuth(options) {
    // تنظیمات پیش‌فرض
    const defaultOptions = {
        headers: {
            'X-CSRFToken': getCsrfToken(),
            'X-Requested-With': 'XMLHttpRequest'
        }
    };
    
    // ادغام تنظیمات
    const finalOptions = $.extend(true, {}, defaultOptions, options);
    
    // اضافه کردن Authorization اگر توکن موجود باشد
    if (accessToken) {
        finalOptions.headers['Authorization'] = `Bearer ${accessToken}`;
    }
    
    return $.ajax(finalOptions).fail(function(xhr) {
        // اگر توکن منقضی شده بود
        if (xhr.status === 401) {
            refreshAccessToken().then(function() {
                // دوباره امتحان کن با توکن جدید
                if (accessToken) {
                    finalOptions.headers['Authorization'] = `Bearer ${accessToken}`;
                }
                return $.ajax(finalOptions);
            }).fail(function() {
                alert('لطفاً دوباره وارد شوید');
                logout();
            });
        }
    });
}

// ============================================
// Post functions با احراز هویت و CSRF
// ============================================
function loadPosts() {
    $.ajax({
        url: '/api/posts/',
        type: 'GET',
        headers: {
            'X-CSRFToken': getCsrfToken(),
            'X-Requested-With': 'XMLHttpRequest'
        },
        success: function(posts) {
            displayPosts(posts);
        },
        error: function(xhr) {
            console.error('Error loading posts:', xhr);
            alert('خطا در بارگذاری پست‌ها');
        }
    });
}

function displayPosts(posts) {
    const container = $('#posts-container');
    container.html('');
    
    $.each(posts, function(index, post) {
        const postElement = createPostElement(post);
        container.append(postElement);
    });
}

function createPostElement(post) {
    const isLiked = post.likes && post.likes.some(like => like.user.username === currentUser);
    const isOwner = post.user.username === currentUser;
    
    const div = $('<div>').addClass('post').data('post-id', post.id);
    
    let commentsHtml = '';
    if (post.comments && post.comments.length > 0) {
        $.each(post.comments, function(i, comment) {
            commentsHtml += `
                <div class="comment" data-comment-id="${comment.id}">
                    <span class="comment-user">${comment.user.username}</span>
                    <span class="comment-text">${comment.text}</span>
                    ${comment.user.username === currentUser ? `
                        <div class="comment-actions">
                            <button onclick="editComment(${comment.id}, '${comment.text.replace(/'/g, "\\'")}')">✏️</button>
                            <button onclick="deleteComment(${comment.id})">🗑️</button>
                        </div>
                    ` : ''}
                </div>
            `;
        });
    }
    
    div.html(`
        <div class="post-header">
            <div>
                <span class="post-username">${post.user.username}</span>
                <span class="post-date">${new Date(post.created_at).toLocaleDateString('fa-IR')}</span>
            </div>
            ${isOwner ? `
                <div>
                    <button onclick="editPost(${post.id})" class="edit-btn">✏️ ویرایش</button>
                    <button onclick="deletePost(${post.id})" class="delete-btn">🗑️ حذف</button>
                </div>
            ` : ''}
        </div>
        <img src="${post.image}" alt="Post image" class="post-image">
        <div class="post-content">
            <p class="post-caption">${post.caption || ''}</p>
            <div class="post-actions">
                <button onclick="toggleLike(${post.id})" class="action-btn like-btn ${isLiked ? 'liked' : ''}">
                    ${post.likes_count} لایک
                </button>
                <span>${post.comments_count} کامنت</span>
            </div>
        </div>
        <div class="comments-section">
            ${commentsHtml}
        </div>
        <div class="add-comment">
            <input type="text" placeholder="کامنت خود را بنویسید..." id="comment-input-${post.id}">
            <button onclick="addComment(${post.id})">ارسال</button>
        </div>
    `);
    
    return div;
}

function createPost() {
    if (!currentUser) {
        alert('لطفاً ابتدا وارد شوید');
        return;
    }
    
    const imageInput = $('#post-image')[0];
    const caption = $('#post-caption').val();
    
    if (!imageInput.files[0]) {
        alert('لطفاً یک تصویر انتخاب کنید');
        return;
    }
    debugger
    const formData = new FormData();
    formData.append('image', imageInput.files[0]);
    formData.append('caption', caption);
    
    const csrfToken = getCsrfToken();
    const token = localStorage.getItem('access_token');
    
    console.log('Sending request with:');
    console.log('CSRF Token:', csrfToken);
    console.log('Access Token:', token);
    
    $.ajax({
        url: '/api/posts/create/',
        type: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        headers: {
            'X-CSRFToken': csrfToken,
            'Authorization': token ? `Bearer ${token}` : '',
            'X-Requested-With': 'XMLHttpRequest'
        },
        beforeSend: function(xhr) {
            // اطمینان از وجود هدرها
            console.log('Request Headers:', xhr);
        },
        success: function(data) {
            alert('پست با موفقیت ایجاد شد');
            $('#post-image').val('');
            $('#post-caption').val('');
            loadPosts();
        },
        error: function(xhr) {
            console.error('Error details:', {
                status: xhr.status,
                statusText: xhr.statusText,
                responseText: xhr.responseText,
                headers: xhr.getAllResponseHeaders()
            });
            
            if (xhr.status === 403) {
                alert('خطای 403: دسترسی غیرمجاز. لطفاً دوباره وارد شوید.');
                logout();
            } else if (xhr.status === 401) {
                refreshAccessToken().then(function() {
                    createPost(); // دوباره امتحان کن
                }).fail(function() {
                    alert('لطفاً دوباره وارد شوید');
                    logout();
                });
            } else {
                alert('خطا در ایجاد پست: ' + (xhr.responseJSON?.detail || xhr.statusText));
            }
        }
    });
}

function deletePost(postId) {
    if (!confirm('آیا از حذف این پست مطمئن هستید؟')) return;
    
    setAuthHeader();
    
    $.ajax({
        url: `/api/posts/${postId}/`,
        type: 'DELETE',
        headers: {
            'X-CSRFToken': getCsrfToken(),
            'X-Requested-With': 'XMLHttpRequest'
        },
        success: function() {
            alert('پست با موفقیت حذف شد');
            loadPosts();
        },
        error: function(xhr) {
            if (xhr.status === 401) {
                refreshAccessToken().then(function() {
                    setAuthHeader();
                    $.ajax({
                        url: `/api/posts/${postId}/`,
                        type: 'DELETE',
                        headers: {
                            'X-CSRFToken': getCsrfToken(),
                            'X-Requested-With': 'XMLHttpRequest'
                        },
                        success: function() {
                            alert('پست با موفقیت حذف شد');
                            loadPosts();
                        },
                        error: function() {
                            alert('خطا در حذف پست');
                        }
                    });
                }).fail(function() {
                    alert('لطفاً دوباره وارد شوید');
                    logout();
                });
            } else {
                alert('خطا در حذف پست');
            }
        }
    });
}

function editPost(postId) {
    const newCaption = prompt('متن جدید پست را وارد کنید:');
    if (newCaption === null) return;
    
    setAuthHeader();
    
    $.ajax({
        url: `/api/posts/${postId}/`,
        type: 'PUT',
        contentType: 'application/json',
        data: JSON.stringify({ caption: newCaption }),
        headers: {
            'X-CSRFToken': getCsrfToken(),
            'X-Requested-With': 'XMLHttpRequest'
        },
        success: function() {
            alert('پست با موفقیت ویرایش شد');
            loadPosts();
        },
        error: function(xhr) {
            if (xhr.status === 401) {
                refreshAccessToken().then(function() {
                    setAuthHeader();
                    $.ajax({
                        url: `/api/posts/${postId}/`,
                        type: 'PUT',
                        contentType: 'application/json',
                        data: JSON.stringify({ caption: newCaption }),
                        headers: {
                            'X-CSRFToken': getCsrfToken(),
                            'X-Requested-With': 'XMLHttpRequest'
                        },
                        success: function() {
                            alert('پست با موفقیت ویرایش شد');
                            loadPosts();
                        },
                        error: function() {
                            alert('خطا در ویرایش پست');
                        }
                    });
                }).fail(function() {
                    alert('لطفاً دوباره وارد شوید');
                    logout();
                });
            } else {
                alert('خطا در ویرایش پست');
            }
        }
    });
}

function toggleLike(postId) {
    if (!currentUser) {
        alert('لطفاً ابتدا وارد شوید');
        return;
    }
    
    setAuthHeader();
    
    $.ajax({
        url: `/api/posts/${postId}/like/`,
        type: 'POST',
        headers: {
            'X-CSRFToken': getCsrfToken(),
            'X-Requested-With': 'XMLHttpRequest'
        },
        success: function() {
            loadPosts();
        },
        error: function(xhr) {
            if (xhr.status === 401) {
                refreshAccessToken().then(function() {
                    setAuthHeader();
                    $.ajax({
                        url: `/api/posts/${postId}/like/`,
                        type: 'POST',
                        headers: {
                            'X-CSRFToken': getCsrfToken(),
                            'X-Requested-With': 'XMLHttpRequest'
                        },
                        success: function() {
                            loadPosts();
                        },
                        error: function() {
                            alert('خطا در تغییر وضعیت لایک');
                        }
                    });
                }).fail(function() {
                    alert('لطفاً دوباره وارد شوید');
                    logout();
                });
            } else {
                alert('خطا در تغییر وضعیت لایک');
            }
        }
    });
}

function addComment(postId) {
    if (!currentUser) {
        alert('لطفاً ابتدا وارد شوید');
        return;
    }
    
    const input = $(`#comment-input-${postId}`);
    const text = input.val().trim();
    
    if (!text) {
        alert('لطفاً متن کامنت را وارد کنید');
        return;
    }
    
    setAuthHeader();
    
    $.ajax({
        url: `/api/posts/${postId}/comment/`,
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ text: text }),
        headers: {
            'X-CSRFToken': getCsrfToken(),
            'X-Requested-With': 'XMLHttpRequest'
        },
        success: function() {
            input.val('');
            loadPosts();
        },
        error: function(xhr) {
            if (xhr.status === 401) {
                refreshAccessToken().then(function() {
                    setAuthHeader();
                    $.ajax({
                        url: `/api/posts/${postId}/comment/`,
                        type: 'POST',
                        contentType: 'application/json',
                        data: JSON.stringify({ text: text }),
                        headers: {
                            'X-CSRFToken': getCsrfToken(),
                            'X-Requested-With': 'XMLHttpRequest'
                        },
                        success: function() {
                            input.val('');
                            loadPosts();
                        },
                        error: function() {
                            alert('خطا در ارسال کامنت');
                        }
                    });
                }).fail(function() {
                    alert('لطفاً دوباره وارد شوید');
                    logout();
                });
            } else {
                alert('خطا در ارسال کامنت');
            }
        }
    });
}

function deleteComment(commentId) {
    if (!confirm('آیا از حذف این کامنت مطمئن هستید؟')) return;
    
    setAuthHeader();
    
    $.ajax({
        url: `/api/comments/${commentId}/`,
        type: 'DELETE',
        headers: {
            'X-CSRFToken': getCsrfToken(),
            'X-Requested-With': 'XMLHttpRequest'
        },
        success: function() {
            alert('کامنت با موفقیت حذف شد');
            loadPosts();
        },
        error: function(xhr) {
            if (xhr.status === 401) {
                refreshAccessToken().then(function() {
                    setAuthHeader();
                    $.ajax({
                        url: `/api/comments/${commentId}/`,
                        type: 'DELETE',
                        headers: {
                            'X-CSRFToken': getCsrfToken(),
                            'X-Requested-With': 'XMLHttpRequest'
                        },
                        success: function() {
                            alert('کامنت با موفقیت حذف شد');
                            loadPosts();
                        },
                        error: function() {
                            alert('خطا در حذف کامنت');
                        }
                    });
                }).fail(function() {
                    alert('لطفاً دوباره وارد شوید');
                    logout();
                });
            } else {
                alert('خطا در حذف کامنت');
            }
        }
    });
}

function editComment(commentId, currentText) {
    const newText = prompt('متن جدید کامنت را وارد کنید:', currentText);
    if (newText === null || newText === currentText) return;
    
    setAuthHeader();
    
    $.ajax({
        url: `/api/comments/${commentId}/`,
        type: 'PUT',
        contentType: 'application/json',
        data: JSON.stringify({ text: newText }),
        headers: {
            'X-CSRFToken': getCsrfToken(),
            'X-Requested-With': 'XMLHttpRequest'
        },
        success: function() {
            alert('کامنت با موفقیت ویرایش شد');
            loadPosts();
        },
        error: function(xhr) {
            if (xhr.status === 401) {
                refreshAccessToken().then(function() {
                    setAuthHeader();
                    $.ajax({
                        url: `/api/comments/${commentId}/`,
                        type: 'PUT',
                        contentType: 'application/json',
                        data: JSON.stringify({ text: newText }),
                        headers: {
                            'X-CSRFToken': getCsrfToken(),
                            'X-Requested-With': 'XMLHttpRequest'
                        },
                        success: function() {
                            alert('کامنت با موفقیت ویرایش شد');
                            loadPosts();
                        },
                        error: function() {
                            alert('خطا در ویرایش کامنت');
                        }
                    });
                }).fail(function() {
                    alert('لطفاً دوباره وارد شوید');
                    logout();
                });
            } else {
                alert('خطا در ویرایش کامنت');
            }
        }
    });
}

// ============================================
// توابع نمایش فرم
// ============================================
function showRegister() {
    $('#register-section').show();
    $('#login-section').hide();
}

function hideRegister() {
    $('#register-section').hide();
    $('#login-section').show();
}

// ============================================
// بارگذاری اولیه
// ============================================
$(document).ready(function() {
    // تنظیم CSRF Token برای همه درخواست‌ها
    $.ajaxSetup({
        headers: {
            'X-CSRFToken': getCsrfToken(),
            'X-Requested-With': 'XMLHttpRequest'
        }
    });
    
    // بررسی توکن ذخیره شده
    const savedToken = localStorage.getItem('access_token');
    const savedUsername = localStorage.getItem('username');
    const savedRefresh = localStorage.getItem('refresh_token');
    
    if (savedToken && savedUsername && savedRefresh) {
        accessToken = savedToken;
        refreshToken = savedRefresh;
        currentUser = savedUsername;
        
        setAuthHeader();
        
        $('#login-section').hide();
        $('#user-info').show();
        $('#username-display').text(currentUser);
        $('#create-post-section').show();
        
        loadPosts();
    }
});

// ============================================
// Event listener برای Enter key
// ============================================
$(document).on('keypress', function(e) {
    if (e.key === 'Enter') {
        const target = e.target;
        if (target.id === 'login-username' || target.id === 'login-password') {
            login();
        } else if (target.id === 'reg-username' || target.id === 'reg-password' || target.id === 'reg-email') {
            register();
        } else if (target.id && target.id.startsWith('comment-input-')) {
            const postId = target.id.replace('comment-input-', '');
            addComment(parseInt(postId));
        }
    }
});