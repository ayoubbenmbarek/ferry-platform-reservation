import React, { useState, useRef, useEffect, useCallback, Component, ErrorInfo, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState } from '../store';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Error boundary specifically for the chatbot - fails silently
class ChatbotErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Chatbot error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Return null to hide the chatbot on error - don't break the whole app
      return null;
    }
    return this.props.children;
  }
}

// Simple markdown link renderer - converts [text](url) to clickable links
const renderMessageContent = (content: string, onLinkClick: (path: string) => void): React.ReactNode => {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = linkRegex.exec(content)) !== null) {
    // Add text before the link
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }

    const [, linkText, linkUrl] = match;
    const isInternalLink = linkUrl.startsWith('/');

    parts.push(
      <button
        key={key++}
        onClick={() => isInternalLink ? onLinkClick(linkUrl) : window.open(linkUrl, '_blank')}
        className="text-blue-600 hover:text-blue-800 underline font-medium"
      >
        {linkText}
      </button>
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts.length > 0 ? parts : content;
};

const SupportChatbotInner: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Safely access auth state
  const authState = useSelector((state: RootState) => state.auth);
  const user = authState?.user;
  const isAuthenticated = authState?.isAuthenticated ?? false;

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const CHATBOT_API_URL = process.env.REACT_APP_CHATBOT_URL || 'http://localhost:3100';

  // Handle internal link clicks - use window.location as fallback
  const handleLinkClick = useCallback((path: string) => {
    setIsOpen(false); // Close chat when navigating
    try {
      navigate(path);
    } catch (e) {
      // Fallback to window.location if navigate fails
      window.location.href = path;
    }
  }, [navigate]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Add welcome message when opened
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: t('chatbot.welcome', 'Hi! I\'m your VoilaFerry assistant. How can I help you today? You can ask me about bookings, routes, cancellations, or any other questions.'),
          timestamp: new Date(),
        },
      ]);
    }
  }, [isOpen, messages.length, t]);

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch(`${CHATBOT_API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          session_id: sessionId,
          user_context: isAuthenticated && user ? {
            email: user.email,
            first_name: user.firstName,
            last_name: user.lastName,
            is_authenticated: true,
          } : {
            is_authenticated: false,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();

      if (data.session_id && !sessionId) {
        setSessionId(data.session_id);
      }

      const assistantMessage: Message = {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: `error_${Date.now()}`,
          role: 'assistant',
          content: t('chatbot.error', 'Sorry, I\'m having trouble connecting. Please try again or contact support@voilaferry.com'),
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = async () => {
    if (sessionId) {
      try {
        await fetch(`${CHATBOT_API_URL}/api/chat/clear`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId }),
        });
      } catch (e) {
        // Ignore error
      }
    }
    setMessages([]);
    setSessionId(null);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Quick action buttons
  const quickActions = [
    { label: t('chatbot.quickBooking', 'Check my booking'), message: 'I want to check my booking status' },
    { label: t('chatbot.quickRoutes', 'Available routes'), message: 'What ferry routes are available?' },
    { label: t('chatbot.quickCancel', 'How to cancel'), message: 'How do I cancel my booking?' },
    { label: t('chatbot.quickPayment', 'Payment help'), message: 'I have a question about payment' },
  ];

  return (
    <>
      {/* Chat Toggle Button - Maritime themed with label */}
      <div className="fixed bottom-24 right-6 z-[9999] flex items-center gap-3" style={{ zIndex: 9999 }}>
        {/* Attractive label - only show when closed */}
        {!isOpen && (
          <div className="bg-white px-4 py-2 rounded-full shadow-lg border border-gray-100">
            <span className="text-sm font-medium text-gray-700">Need help?</span>
          </div>
        )}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110"
          aria-label={isOpen ? 'Close chat' : 'Open chat'}
        >
          {isOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            /* Captain assistant icon with hat */
            <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none">
              {/* Captain hat */}
              <ellipse cx="12" cy="6" rx="7" ry="2.5" fill="#1e3a5f"/>
              <path d="M5 6c0 0 0-3 7-3s7 3 7 3" fill="#1e3a5f"/>
              <rect x="6" y="4" width="12" height="2.5" fill="#2563eb"/>
              {/* Hat emblem/anchor */}
              <circle cx="12" cy="5" r="1.5" fill="#fbbf24"/>
              {/* Face circle */}
              <circle cx="12" cy="14" r="6" fill="currentColor"/>
              {/* Eyes */}
              <circle cx="10" cy="13" r="1" fill="#1e3a5f"/>
              <circle cx="14" cy="13" r="1" fill="#1e3a5f"/>
              {/* Smile */}
              <path d="M9.5 16c0 0 1.2 1.5 2.5 1.5s2.5-1.5 2.5-1.5" stroke="#1e3a5f" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          )}
        </button>
      </div>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-40 right-6 z-[9999] w-96 h-[500px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200" style={{ zIndex: 9999 }}>
          {/* Header - Maritime themed */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                {/* Anchor icon for maritime theme */}
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17 15l-3-3V8c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2H8c-2.21 0-4 1.79-4 4s1.79 4 4 4v4H6l4 4 4-4h-2v-4c1.68 0 3.22-.83 4.14-2.22L17 15z"/>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold">{t('chatbot.title', 'VoilaFerry Assistant')}</h3>
                <p className="text-xs text-blue-100 flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  {t('chatbot.online', 'Online')}
                </p>
              </div>
            </div>
            <button
              onClick={clearChat}
              className="text-blue-100 hover:text-white text-sm"
              title={t('chatbot.clearChat', 'Clear chat')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-md'
                      : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-md'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{renderMessageContent(message.content, handleLinkClick)}</p>
                  <p
                    className={`text-xs mt-1 ${
                      message.role === 'user' ? 'text-blue-100' : 'text-gray-400'
                    }`}
                  >
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white text-gray-800 shadow-sm border border-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions */}
          {messages.length <= 1 && (
            <div className="px-4 py-2 bg-white border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-2">{t('chatbot.quickActions', 'Quick actions:')}</p>
              <div className="flex flex-wrap gap-2">
                {quickActions.map((action, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setInputValue(action.message);
                      setTimeout(sendMessage, 100);
                    }}
                    className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded-full hover:bg-blue-100 transition-colors"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="p-4 bg-white border-t border-gray-200">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={t('chatbot.placeholder', 'Type your message...')}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-full text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                disabled={isLoading}
              />
              <button
                onClick={sendMessage}
                disabled={!inputValue.trim() || isLoading}
                className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Wrap the chatbot in its own error boundary so it doesn't crash the whole app
const SupportChatbot: React.FC = () => (
  <ChatbotErrorBoundary>
    <SupportChatbotInner />
  </ChatbotErrorBoundary>
);

export default SupportChatbot;
