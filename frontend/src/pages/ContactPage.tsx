import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  category: string;
  message: string;
  bookingReference?: string;
}

const ContactPage: React.FC = () => {
  const { t } = useTranslation(['common']);
  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    email: '',
    subject: '',
    category: 'general',
    message: '',
    bookingReference: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const categories = [
    { value: 'general', label: t('contact.categories.general', 'General Inquiry') },
    { value: 'booking', label: t('contact.categories.booking', 'Booking Support') },
    { value: 'refund', label: t('contact.categories.refund', 'Refunds & Cancellations') },
    { value: 'technical', label: t('contact.categories.technical', 'Technical Issue') },
    { value: 'feedback', label: t('contact.categories.feedback', 'Feedback & Suggestions') },
    { value: 'other', label: t('contact.categories.other', 'Other') },
  ];

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');
    setErrorMessage('');

    try {
      await api.post('/contact', formData);
      setSubmitStatus('success');
      setFormData({
        name: '',
        email: '',
        subject: '',
        category: 'general',
        message: '',
        bookingReference: '',
      });
    } catch (error: unknown) {
      setSubmitStatus('error');
      const err = error as { response?: { data?: { message?: string } } };
      setErrorMessage(err.response?.data?.message || 'Failed to send message. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold mb-4">{t('contact.title', 'Contact Us')}</h1>
          <p className="text-xl text-blue-100 max-w-2xl">
            {t('contact.subtitle', "Have a question or need assistance? We're here to help. Reach out to our team and we'll get back to you as soon as possible.")}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Contact Information */}
          <div className="lg:col-span-1 space-y-6">
            {/* Contact Cards */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('contact.getInTouch', 'Get in Touch')}</h2>

              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-xl">
                    📧
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{t('contact.email', 'Email')}</p>
                    <a href="mailto:support@ferryreservation.com" className="text-blue-600 hover:underline">
                      support@ferryreservation.com
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-xl">
                    📞
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{t('contact.phone', 'Phone')}</p>
                    <a href="tel:+21671123456" className="text-blue-600 hover:underline">
                      +216 71 123 456
                    </a>
                    <p className="text-sm text-gray-500">{t('contact.phoneHours', 'Mon-Fri, 8am-6pm CET')}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-xl">
                    📍
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{t('contact.address', 'Address')}</p>
                    <p className="text-gray-600">
                      123 Marina Boulevard<br />
                      La Goulette, Tunis 2060<br />
                      Tunisia
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-xl">
                    🕐
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{t('contact.businessHours', 'Business Hours')}</p>
                    <p className="text-gray-600">
                      {t('contact.hours.weekdays', 'Monday - Friday: 8:00 AM - 6:00 PM')}<br />
                      {t('contact.hours.saturday', 'Saturday: 9:00 AM - 2:00 PM')}<br />
                      {t('contact.hours.sunday', 'Sunday: Closed')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('contact.quickHelp', 'Quick Help')}</h2>
              <div className="space-y-3">
                <a href="/faq" className="flex items-center gap-3 text-gray-600 hover:text-blue-600 transition-colors">
                  <span>❓</span>
                  <span>{t('contact.links.faq', 'Frequently Asked Questions')}</span>
                </a>
                <a href="/terms" className="flex items-center gap-3 text-gray-600 hover:text-blue-600 transition-colors">
                  <span>📄</span>
                  <span>{t('contact.links.terms', 'Terms & Conditions')}</span>
                </a>
                <a href="/privacy" className="flex items-center gap-3 text-gray-600 hover:text-blue-600 transition-colors">
                  <span>🔒</span>
                  <span>{t('contact.links.privacy', 'Privacy Policy')}</span>
                </a>
              </div>
            </div>

            {/* Live Chat Info */}
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-sm p-6 text-white">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">💬</span>
                <h2 className="text-lg font-semibold">{t('contact.liveChat', 'Live Chat')}</h2>
              </div>
              <p className="text-blue-100 text-sm mb-4">
                {t('contact.liveChatDesc', 'Need immediate assistance? Our AI-powered support chatbot is available 24/7 to help you.')}
              </p>
              <p className="text-sm text-blue-200">
                {t('contact.liveChatHint', 'Look for the chat icon in the bottom right corner of your screen.')}
              </p>
            </div>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm p-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">{t('contact.sendMessage', 'Send us a Message')}</h2>
              <p className="text-gray-600 mb-6">
                {t('contact.sendMessageDesc', "Fill out the form below and we'll get back to you within 24 hours.")}
              </p>

              {submitStatus === 'success' && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
                  <span className="text-green-600 text-xl">✓</span>
                  <div>
                    <p className="font-medium text-green-800">{t('contact.success.title', 'Message sent successfully!')}</p>
                    <p className="text-sm text-green-700">
                      {t('contact.success.message', "Thank you for contacting us. We'll respond to your inquiry within 24 hours.")}
                    </p>
                  </div>
                </div>
              )}

              {submitStatus === 'error' && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <span className="text-red-600 text-xl">⚠</span>
                  <div>
                    <p className="font-medium text-red-800">{t('contact.error.title', 'Failed to send message')}</p>
                    <p className="text-sm text-red-700">{errorMessage}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                      {t('contact.form.fullName', 'Full Name')} *
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder={t('contact.form.fullNamePlaceholder', 'John Doe')}
                    />
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                      {t('contact.form.emailAddress', 'Email Address')} *
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder="john@example.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                      {t('contact.form.category', 'Category')} *
                    </label>
                    <select
                      id="category"
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    >
                      {categories.map((cat) => (
                        <option key={cat.value} value={cat.value}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="bookingReference" className="block text-sm font-medium text-gray-700 mb-1">
                      {t('contact.form.bookingReference', 'Booking Reference')} ({t('contact.form.optional', 'optional')})
                    </label>
                    <input
                      type="text"
                      id="bookingReference"
                      name="bookingReference"
                      value={formData.bookingReference}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder="e.g., BK-ABC123"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('contact.form.subject', 'Subject')} *
                  </label>
                  <input
                    type="text"
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder={t('contact.form.subjectPlaceholder', 'Brief description of your inquiry')}
                  />
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('contact.form.message', 'Message')} *
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleInputChange}
                    required
                    rows={6}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
                    placeholder={t('contact.form.messagePlaceholder', 'Please provide as much detail as possible...')}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    * {t('contact.form.requiredFields', 'Required fields')}
                  </p>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        {t('contact.form.sending', 'Sending...')}
                      </>
                    ) : (
                      <>
                        <span>📤</span>
                        {t('contact.form.sendButton', 'Send Message')}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Map Section */}
        <div className="mt-12">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('contact.ourLocation', 'Our Location')}</h2>
            <div className="aspect-video bg-gray-200 rounded-lg overflow-hidden">
              <iframe
                title="Office Location"
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3194.8091073687!2d10.3076!3d36.8142!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMzbCsDQ4JzUxLjEiTiAxMMKwMTgnMjcuNCJF!5e0!3m2!1sen!2stn!4v1699999999999!5m2!1sen!2stn"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
