from rest_framework import serializers
from .models import Post, Like, Comment
from users.serializers import UserSerializer

class CommentSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = Comment
        fields = ['id', 'user', 'text', 'created_at', 'updated_at']
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']

class LikeSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = Like
        fields = ['id', 'user', 'post', 'created_at']

class PostSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    likes_count = serializers.IntegerField(read_only=True)
    comments_count = serializers.IntegerField(read_only=True)
    comments = CommentSerializer(many=True, read_only=True)
    
    class Meta:
        model = Post
        fields = ['id', 'user', 'image', 'caption', 'created_at', 'updated_at', 
                 'likes_count', 'comments_count', 'comments']
        read_only_fields = ['id', 'user', 'created_at', 'updated_at', 'likes_count', 'comments_count']

class PostCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Post
        fields = ['image', 'caption']
    
    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)