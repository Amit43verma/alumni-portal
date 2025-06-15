"use client"

import { useState } from "react"
import { ImageIcon, Video, X } from "lucide-react"
import { usePostStore } from "../store/postStore"
import { useAuthStore } from "../store/authStore"

const PostComposer = () => {
  const { createPost } = usePostStore()
  const { user } = useAuthStore()
  const [content, setContent] = useState("")
  const [mediaFiles, setMediaFiles] = useState([])
  const [mediaPreviews, setMediaPreviews] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleMediaSelect = (e) => {
    const files = Array.from(e.target.files)
    const newFiles = [...mediaFiles, ...files]
    setMediaFiles(newFiles)

    // Create previews
    const newPreviews = [...mediaPreviews]
    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        newPreviews.push({
          file,
          url: e.target.result,
          type: file.type.startsWith("image/") ? "image" : "video",
        })
        setMediaPreviews([...newPreviews])
      }
      reader.readAsDataURL(file)
    })
  }

  const removeMedia = (index) => {
    const newFiles = mediaFiles.filter((_, i) => i !== index)
    const newPreviews = mediaPreviews.filter((_, i) => i !== index)
    setMediaFiles(newFiles)
    setMediaPreviews(newPreviews)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!content.trim() && mediaFiles.length === 0) {
      return
    }

    setIsSubmitting(true)

    const result = await createPost(content, mediaFiles)

    if (result.success) {
      setContent("")
      setMediaFiles([])
      setMediaPreviews([])
    }

    setIsSubmitting(false)
  }

  return (
    <div className="card bg-base-100 shadow-lg">
      <div className="card-body">
        <form onSubmit={handleSubmit}>
          {/* User Info */}
          <div className="flex items-center space-x-3 mb-4">
            <div className="avatar">
              <div className="w-10 h-10 rounded-full">
                <img src={user?.avatarUrl || "/placeholder.svg?height=40&width=40"} alt={user?.name} />
              </div>
            </div>
            <div>
              <div className="font-semibold">{user?.name}</div>
              <div className="text-sm text-base-content/60">
                {user?.batch} • {user?.center}
              </div>
            </div>
          </div>

          {/* Content Input */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's on your mind?"
            className="textarea textarea-bordered w-full min-h-[100px] resize-none"
            maxLength={2000}
          />

          {/* Character Count */}
          <div className="text-right text-sm text-base-content/60 mt-1">{content.length}/2000</div>

          {/* Media Previews */}
          {mediaPreviews.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-4">
              {mediaPreviews.map((preview, index) => (
                <div key={index} className="relative">
                  {preview.type === "image" ? (
                    <img
                      src={preview.url || "/placeholder.svg"}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                  ) : (
                    <video src={preview.url} className="w-full h-32 object-cover rounded-lg" />
                  )}
                  <button
                    type="button"
                    onClick={() => removeMedia(index)}
                    className="absolute -top-2 -right-2 btn btn-circle btn-sm btn-error"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center space-x-2">
              {/* Image Upload */}
              <label className="btn btn-ghost btn-sm">
                <ImageIcon size={18} />
                <input type="file" accept="image/*" multiple onChange={handleMediaSelect} className="hidden" />
              </label>

              {/* Video Upload */}
              <label className="btn btn-ghost btn-sm">
                <Video size={18} />
                <input type="file" accept="video/*" multiple onChange={handleMediaSelect} className="hidden" />
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={(!content.trim() && mediaFiles.length === 0) || isSubmitting}
              className="btn btn-primary"
            >
              {isSubmitting ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  Posting...
                </>
              ) : (
                "Post"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default PostComposer
