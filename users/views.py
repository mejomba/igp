from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from rest_framework_simplejwt.tokens import RefreshToken
from .serializers import RegisterSerializer, UserSerializer, ProfileSerializer
from .models import Profile

# دریافت توکن برای کاربر
def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }

# ثبت نام
@swagger_auto_schema(
    method='post',
    request_body=RegisterSerializer,
    responses={
        201: openapi.Response(
            description='ثبت نام موفق',
            examples={
                'application/json': {
                    'message': 'User created successfully',
                    'user': {
                        'id': 1,
                        'username': 'testuser',
                        'email': 'test@example.com',
                        'first_name': '',
                        'last_name': ''
                    },
                    'tokens': {
                        'refresh': 'refresh_token_here',
                        'access': 'access_token_here'
                    }
                }
            }
        ),
        400: 'اطلاعات نامعتبر'
    },
    operation_description='ثبت نام کاربر جدید در سیستم'
)
@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        tokens = get_tokens_for_user(user)
        return Response({
            'message': 'User created successfully',
            'user': UserSerializer(user).data,
            'tokens': tokens
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# ورود
@swagger_auto_schema(
    method='post',
    request_body=openapi.Schema(
        type=openapi.TYPE_OBJECT,
        properties={
            'username': openapi.Schema(type=openapi.TYPE_STRING, description='نام کاربری'),
            'password': openapi.Schema(type=openapi.TYPE_STRING, description='رمز عبور'),
        },
        required=['username', 'password']
    ),
    responses={
        200: openapi.Response(
            description='ورود موفق',
            examples={
                'application/json': {
                    'message': 'Login successful',
                    'user': {
                        'id': 1,
                        'username': 'testuser',
                        'email': 'test@example.com'
                    },
                    'tokens': {
                        'refresh': 'refresh_token_here',
                        'access': 'access_token_here'
                    }
                }
            }
        ),
        401: 'نام کاربری یا رمز عبور اشتباه'
    },
    operation_description='ورود به سیستم و دریافت توکن'
)
@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    username = request.data.get('username')
    password = request.data.get('password')
    
    if not username or not password:
        return Response(
            {'error': 'لطفاً نام کاربری و رمز عبور را وارد کنید'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    user = authenticate(username=username, password=password)
    
    if user is not None:
        tokens = get_tokens_for_user(user)
        return Response({
            'message': 'Login successful',
            'user': UserSerializer(user).data,
            'tokens': tokens
        })
    else:
        return Response(
            {'error': 'نام کاربری یا رمز عبور اشتباه است'}, 
            status=status.HTTP_401_UNAUTHORIZED
        )

# خروج
@swagger_auto_schema(
    method='post',
    request_body=openapi.Schema(
        type=openapi.TYPE_OBJECT,
        properties={
            'refresh': openapi.Schema(type=openapi.TYPE_STRING, description='توکن رفرش'),
        }
    ),
    responses={
        205: 'خروج موفق',
        400: 'اطلاعات نامعتبر'
    },
    operation_description='خروج از سیستم و غیرفعال کردن توکن رفرش'
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout(request):
    try:
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response(
                {'error': 'لطفاً توکن رفرش را وارد کنید'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        token = RefreshToken(refresh_token)
        token.blacklist()  # نیاز به اضافه کردن 'rest_framework_simplejwt.token_blacklist' در INSTALLED_APPS
        return Response({'message': 'Logout successful'}, status=status.HTTP_205_RESET_CONTENT)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

# پروفایل کاربر
@swagger_auto_schema(
    method='get',
    responses={
        200: ProfileSerializer,
        404: 'کاربر یافت نشد'
    },
    operation_description='دریافت اطلاعات پروفایل کاربر'
)
@api_view(['GET'])
@permission_classes([AllowAny])
def user_profile(request, username):
    try:
        user = User.objects.get(username=username)
        profile = Profile.objects.get(user=user)
        serializer = ProfileSerializer(profile)
        return Response(serializer.data)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

# آپدیت پروفایل
@swagger_auto_schema(
    method='put',
    request_body=ProfileSerializer,
    responses={
        200: ProfileSerializer,
        400: 'اطلاعات نامعتبر',
        404: 'کاربر یافت نشد'
    },
    operation_description='به‌روزرسانی پروفایل کاربر (فقط خود کاربر)'
)
@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_profile(request, username):
    try:
        user = User.objects.get(username=username)
        
        # بررسی اینکه کاربر فقط پروفایل خودش رو ویرایش کنه
        if request.user != user:
            return Response(
                {'error': 'شما نمی‌توانید پروفایل کاربر دیگری را ویرایش کنید'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        profile = Profile.objects.get(user=user)
        serializer = ProfileSerializer(profile, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

from django.http import JsonResponse
from django.middleware.csrf import get_token

def get_csrf_token(request):
    """دریافت CSRF Token برای استفاده در فرانت‌اند"""
    csrf_token = get_token(request)
    return JsonResponse({'csrfToken': csrf_token})