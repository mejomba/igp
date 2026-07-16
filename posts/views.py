from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from django.contrib.auth.models import User
from django.views.decorators.csrf import csrf_exempt  # اضافه کردن این خط
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from .models import Post, Like, Comment
from .serializers import PostSerializer, PostCreateSerializer, CommentSerializer

# لیست پست‌ها (عمومی)
@swagger_auto_schema(
    method='get',
    responses={200: PostSerializer(many=True)},
    operation_description='دریافت لیست تمام پست‌ها به ترتیب جدیدترین'
)
@api_view(['GET'])
@permission_classes([AllowAny])
def post_list(request):
    posts = Post.objects.all().order_by('-created_at')
    serializer = PostSerializer(posts, many=True)
    return Response(serializer.data)

# پست‌های یک کاربر (عمومی)
@swagger_auto_schema(
    method='get',
    responses={
        200: PostSerializer(many=True),
        404: 'کاربر یافت نشد'
    },
    operation_description='دریافت لیست پست‌های یک کاربر خاص'
)
@api_view(['GET'])
@permission_classes([AllowAny])
def user_posts(request, username):
    try:
        user = User.objects.get(username=username)
        posts = Post.objects.filter(user=user).order_by('-created_at')
        serializer = PostSerializer(posts, many=True)
        return Response(serializer.data)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

# ایجاد پست جدید (نیاز به احراز هویت) - اضافه کردن csrf_exempt
@swagger_auto_schema(
    method='post',
    request_body=PostCreateSerializer,
    responses={
        201: PostSerializer,
        400: 'اطلاعات نامعتبر',
        401: 'نیاز به ورود'
    },
    operation_description='ایجاد پست جدید (نیاز به احراز هویت)'
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
@csrf_exempt  # اضافه کردن این خط برای غیرفعال کردن CSRF
def create_post(request):
    serializer = PostCreateSerializer(data=request.data, context={'request': request})
    if serializer.is_valid():
        post = serializer.save()
        return Response(PostSerializer(post).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# جزئیات، ویرایش و حذف پست
@swagger_auto_schema(
    method='get',
    responses={
        200: PostSerializer,
        404: 'پست یافت نشد'
    },
    operation_description='دریافت جزئیات یک پست'
)
@swagger_auto_schema(
    method='put',
    request_body=PostCreateSerializer,
    responses={
        200: PostSerializer,
        400: 'اطلاعات نامعتبر',
        401: 'نیاز به ورود',
        403: 'دسترسی غیرمجاز',
        404: 'پست یافت نشد'
    },
    operation_description='ویرایش پست (فقط صاحب پست)'
)
@swagger_auto_schema(
    method='delete',
    responses={
        204: 'پست حذف شد',
        401: 'نیاز به ورود',
        403: 'دسترسی غیرمجاز',
        404: 'پست یافت نشد'
    },
    operation_description='حذف پست (فقط صاحب پست)'
)
@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticatedOrReadOnly])
@csrf_exempt  # اضافه کردن این خط
def post_detail(request, pk):
    try:
        post = Post.objects.get(pk=pk)
    except Post.DoesNotExist:
        return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)
    
    if request.method == 'GET':
        serializer = PostSerializer(post)
        return Response(serializer.data)
    
    # برای PUT و DELETE نیاز به احراز هویت داریم
    if not request.user.is_authenticated:
        return Response({'error': 'Please login first'}, status=status.HTTP_401_UNAUTHORIZED)
    
    if request.user != post.user:
        return Response({'error': 'You are not the owner of this post'}, status=status.HTTP_403_FORBIDDEN)
    
    if request.method == 'PUT':
        serializer = PostCreateSerializer(post, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(PostSerializer(post).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    if request.method == 'DELETE':
        post.delete()
        return Response({'message': 'Post deleted successfully'}, status=status.HTTP_204_NO_CONTENT)

# لایک/آنلایک (نیاز به احراز هویت)
@swagger_auto_schema(
    method='post',
    responses={
        200: openapi.Response(
            description='وضعیت لایک تغییر کرد',
            examples={
                'application/json': {
                    'message': 'Post liked',
                    'likes_count': 10
                }
            }
        ),
        401: 'نیاز به ورود',
        404: 'پست یافت نشد'
    },
    operation_description='تغییر وضعیت لایک (اگر لایک داشته باشد حذف و اگر نداشته باشد اضافه می‌کند)'
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
@csrf_exempt  # اضافه کردن این خط
def toggle_like(request, post_id):
    try:
        post = Post.objects.get(pk=post_id)
    except Post.DoesNotExist:
        return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)
    
    like, created = Like.objects.get_or_create(user=request.user, post=post)
    
    if not created:
        like.delete()
        message = 'Like removed'
    else:
        message = 'Post liked'
    
    return Response({
        'message': message,
        'likes_count': post.likes.count()
    })

# ایجاد کامنت (نیاز به احراز هویت)
@swagger_auto_schema(
    method='post',
    request_body=openapi.Schema(
        type=openapi.TYPE_OBJECT,
        properties={
            'text': openapi.Schema(type=openapi.TYPE_STRING, description='متن کامنت'),
        },
        required=['text']
    ),
    responses={
        201: CommentSerializer,
        400: 'اطلاعات نامعتبر',
        401: 'نیاز به ورود',
        404: 'پست یافت نشد'
    },
    operation_description='ایجاد کامنت جدید برای یک پست'
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
@csrf_exempt  # اضافه کردن این خط
def create_comment(request, post_id):
    try:
        post = Post.objects.get(pk=post_id)
    except Post.DoesNotExist:
        return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)
    
    serializer = CommentSerializer(data=request.data)
    if serializer.is_valid():
        comment = serializer.save(user=request.user, post=post)
        return Response(CommentSerializer(comment).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# ویرایش و حذف کامنت (فقط صاحب کامنت)
@swagger_auto_schema(
    method='put',
    request_body=openapi.Schema(
        type=openapi.TYPE_OBJECT,
        properties={
            'text': openapi.Schema(type=openapi.TYPE_STRING, description='متن جدید کامنت'),
        }
    ),
    responses={
        200: CommentSerializer,
        400: 'اطلاعات نامعتبر',
        401: 'نیاز به ورود',
        403: 'دسترسی غیرمجاز',
        404: 'کامنت یافت نشد'
    },
    operation_description='ویرایش کامنت (فقط صاحب کامنت)'
)
@swagger_auto_schema(
    method='delete',
    responses={
        204: 'کامنت حذف شد',
        401: 'نیاز به ورود',
        403: 'دسترسی غیرمجاز',
        404: 'کامنت یافت نشد'
    },
    operation_description='حذف کامنت (فقط صاحب کامنت)'
)
@api_view(['PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
@csrf_exempt  # اضافه کردن این خط
def comment_detail(request, pk):
    try:
        comment = Comment.objects.get(pk=pk)
    except Comment.DoesNotExist:
        return Response({'error': 'Comment not found'}, status=status.HTTP_404_NOT_FOUND)
    
    if request.user != comment.user:
        return Response({'error': 'You are not the owner of this comment'}, status=status.HTTP_403_FORBIDDEN)
    
    if request.method == 'PUT':
        serializer = CommentSerializer(comment, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    if request.method == 'DELETE':
        comment.delete()
        return Response({'message': 'Comment deleted successfully'}, status=status.HTTP_204_NO_CONTENT)