"use client"

import { useState, useRef, useEffect } from "react"
import { FaPaperPlane, FaRobot, FaUser } from "react-icons/fa"

const ChatBox = ({ onSendMessage }) => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "Hi there! I can help you improve your 3D model. Just tell me what changes you'd like to make.",
      sender: "ai",
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef(null)

  const handleSend = async () => {
    if (!input.trim()) return

    const userMessage = {
      id: messages.length + 1,
      text: input,
      sender: "user",
    }

    setMessages([...messages, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      // Send message to backend
      await onSendMessage(input)

      // Add AI response
      const aiMessage = {
        id: messages.length + 2,
        text: "I've updated your 3D model based on your instructions. Take a look!",
        sender: "ai",
      }

      setMessages((prev) => [...prev, aiMessage])
    } catch (error) {
      console.error("Error sending message:", error)

      // Add error message
      const errorMessage = {
        id: messages.length + 2,
        text: "Sorry, I couldn't update the model. Please try again with different instructions.",
        sender: "ai",
        isError: true,
      }

      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  return (
    <div className="chat-box">
      <div className="chat-header">
        <FaRobot className="chat-icon" />
        <h3>AI Assistant</h3>
      </div>

      <div className="chat-messages">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`message ${message.sender === "user" ? "user-message" : "ai-message"} ${message.isError ? "error-message" : ""}`}
          >
            <div className="message-icon">{message.sender === "user" ? <FaUser /> : <FaRobot />}</div>
            <div className="message-content">
              <p>{message.text}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="message ai-message loading">
            <div className="message-icon">
              <FaRobot />
            </div>
            <div className="message-content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your instructions here..."
          disabled={isLoading}
        />
        <button onClick={handleSend} disabled={!input.trim() || isLoading} className="send-button">
          <FaPaperPlane />
        </button>
      </div>
    </div>
  )
}

export default ChatBox

