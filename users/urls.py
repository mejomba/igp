from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.register, name='register'),
    path('login/', views.login, name='login'),
    path('logout/', views.logout, name='logout'),
    path('profile/<str:username>/', views.user_profile, name='profile'),
    path('profile/<str:username>/update/', views.update_profile, name='update_profile'),
    path('csrf-token/', views.get_csrf_token, name='csrf_token'),  # اضافه کردن این خط
]