import { create } from "zustand"
import axios from "axios"
import toast from "react-hot-toast"

// Use Vite environment variables
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api"

const usePostStore = create((set, get) => ({
  posts: [],
  currentPost: null,
  comments: [],
  postLikes: [],
  commentLikes: [],
  loading: false,
  hasMore: true,
  page: 1,

  loadFeed: async (page = 1, reset = false) => {
    set({ loading: true })
    try {
      const response = await axios.get(`${API_URL}/posts?page=${page}&limit=10`)
      const { posts, totalPages, currentPage } = response.data

      set((state) => ({
        posts: reset ? posts : [...state.posts, ...posts],
        hasMore: currentPage < totalPages,
        page: currentPage,
        loading: false,
      }))
    } catch (error) {
      set({ loading: false })
      toast.error("Failed to load posts")
    }
  },

  createPost: async (content, mediaFiles) => {
    try {
      const formData = new FormData()
      formData.append("content", content)

      if (mediaFiles) {
        Array.from(mediaFiles).forEach((file) => {
          formData.append("media", file)
        })
      }

      const response = await axios.post(`${API_URL}/posts`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      })

      const { post } = response.data

      set((state) => ({
        posts: [post, ...state.posts],
      }))

      toast.success("Post created successfully!")
      return { success: true }
    } catch (error) {
      const message = error.response?.data?.message || "Failed to create post"
      toast.error(message)
      return { success: false, message }
    }
  },

  deletePost: async (postId) => {
    try {
      await axios.delete(`${API_URL}/posts/${postId}`)

      set((state) => ({
        posts: state.posts.filter((post) => post._id !== postId),
      }))

      toast.success("Post deleted successfully")
      return { success: true }
    } catch (error) {
      const message = error.response?.data?.message || "Failed to delete post"
      toast.error(message)
      return { success: false }
    }
  },

  likePost: async (postId) => {
    try {
      const response = await axios.post(`${API_URL}/posts/${postId}/like`)
      const { liked, likesCount } = response.data

      set((state) => ({
        posts: state.posts.map((post) =>
          post._id === postId
            ? {
                ...post,
                likesCount,
                isLiked: liked,
              }
            : post,
        ),
        currentPost:
          state.currentPost?._id === postId ? { ...state.currentPost, likesCount, isLiked: liked } : state.currentPost,
      }))

      return { success: true }
    } catch (error) {
      toast.error("Failed to like post")
      return { success: false }
    }
  },

  loadPost: async (postId) => {
    set({ loading: true })
    try {
      const response = await axios.get(`${API_URL}/posts/${postId}`)
      const { post, comments } = response.data

      set({
        currentPost: post,
        comments,
        loading: false,
      })
    } catch (error) {
      set({ loading: false })
      toast.error("Failed to load post")
    }
  },

  loadPostLikes: async (postId) => {
    try {
      const response = await axios.get(`${API_URL}/posts/${postId}/likes`)
      set({ postLikes: response.data.likes })
      return response.data.likes
    } catch (error) {
      toast.error("Failed to load likes")
      return []
    }
  },

  loadCommentLikes: async (commentId) => {
    try {
      const response = await axios.get(`${API_URL}/posts/comments/${commentId}/likes`)
      set({ commentLikes: response.data.likes })
      return response.data.likes
    } catch (error) {
      toast.error("Failed to load comment likes")
      return []
    }
  },

  addComment: async (postId, text, parentComment = null) => {
    try {
      const response = await axios.post(`${API_URL}/posts/${postId}/comments`, { text, parentComment })
      const { comment } = response.data

      if (parentComment) {
        // Add reply to existing comment
        set((state) => ({
          comments: state.comments.map((c) =>
            c._id === parentComment
              ? {
                  ...c,
                  replies: [...(c.replies || []), { ...comment, isLiked: false }],
                  repliesCount: (c.repliesCount || 0) + 1,
                }
              : c,
          ),
        }))
      } else {
        // Add new top-level comment
        set((state) => ({
          comments: [...state.comments, { ...comment, isLiked: false, replies: [] }],
          posts: state.posts.map((post) =>
            post._id === postId ? { ...post, commentsCount: post.commentsCount + 1 } : post,
          ),
          currentPost:
            state.currentPost?._id === postId
              ? { ...state.currentPost, commentsCount: state.currentPost.commentsCount + 1 }
              : state.currentPost,
        }))
      }

      return { success: true }
    } catch (error) {
      const message = error.response?.data?.message || "Failed to add comment"
      toast.error(message)
      return { success: false }
    }
  },

  editComment: async (commentId, text) => {
    try {
      const response = await axios.put(`${API_URL}/posts/comments/${commentId}`, { text })
      const { comment } = response.data

      set((state) => ({
        comments: state.comments.map((c) => {
          if (c._id === commentId) {
            return { ...c, ...comment }
          }
          if (c.replies) {
            return {
              ...c,
              replies: c.replies.map((r) => (r._id === commentId ? { ...r, ...comment } : r)),
            }
          }
          return c
        }),
      }))

      toast.success("Comment updated")
      return { success: true }
    } catch (error) {
      toast.error("Failed to update comment")
      return { success: false }
    }
  },

  likeComment: async (commentId) => {
    try {
      const response = await axios.post(`${API_URL}/posts/comments/${commentId}/like`)
      const { liked, likesCount } = response.data

      set((state) => ({
        comments: state.comments.map((c) => {
          if (c._id === commentId) {
            return { ...c, isLiked: liked, likesCount }
          }
          if (c.replies) {
            return {
              ...c,
              replies: c.replies.map((r) => (r._id === commentId ? { ...r, isLiked: liked, likesCount } : r)),
            }
          }
          return c
        }),
      }))

      return { success: true }
    } catch (error) {
      toast.error("Failed to like comment")
      return { success: false }
    }
  },

  deleteComment: async (commentId, postId, parentComment = null) => {
    try {
      await axios.delete(`${API_URL}/posts/comments/${commentId}`)

      if (parentComment) {
        // Remove reply from parent comment
        set((state) => ({
          comments: state.comments.map((c) =>
            c._id === parentComment
              ? {
                  ...c,
                  replies: c.replies.filter((r) => r._id !== commentId),
                  repliesCount: Math.max(0, (c.repliesCount || 0) - 1),
                }
              : c,
          ),
        }))
      } else {
        // Remove top-level comment
        set((state) => ({
          comments: state.comments.filter((comment) => comment._id !== commentId),
          posts: state.posts.map((post) =>
            post._id === postId ? { ...post, commentsCount: Math.max(0, post.commentsCount - 1) } : post,
          ),
          currentPost:
            state.currentPost?._id === postId
              ? { ...state.currentPost, commentsCount: Math.max(0, state.currentPost.commentsCount - 1) }
              : state.currentPost,
        }))
      }

      toast.success("Comment deleted")
      return { success: true }
    } catch (error) {
      toast.error("Failed to delete comment")
      return { success: false }
    }
  },

  reset: () => {
    set({
      posts: [],
      currentPost: null,
      comments: [],
      postLikes: [],
      commentLikes: [],
      loading: false,
      hasMore: true,
      page: 1,
    })
  },
}))

export { usePostStore }
