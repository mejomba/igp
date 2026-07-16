from django.urls import path
from . import views

urlpatterns = [
    path('posts/', views.post_list, name='post_list'),
    path('posts/user/<str:username>/', views.user_posts, name='user_posts'),
    path('posts/create/', views.create_post, name='create_post'),
    path('posts/<int:pk>/', views.post_detail, name='post_detail'),
    path('posts/<int:post_id>/like/', views.toggle_like, name='toggle_like'),
    path('posts/<int:post_id>/comment/', views.create_comment, name='create_comment'),
    path('comments/<int:pk>/', views.comment_detail, name='comment_detail'),
]