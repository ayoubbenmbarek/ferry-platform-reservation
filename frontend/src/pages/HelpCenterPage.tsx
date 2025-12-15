import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

const HelpCenterPage: React.FC = () => {
  const { t } = useTranslation('common');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const categories = [
    { id: 'all', label: t('help.categories.all', 'All Questions'), icon: '📋' },
    { id: 'booking', label: t('help.categories.booking', 'Booking'), icon: '🎫' },
    { id: 'payment', label: t('help.categories.payment', 'Payment'), icon: '💳' },
    { id: 'cancellation', label: t('help.categories.cancellation', 'Cancellation'), icon: '❌' },
    { id: 'travel', label: t('help.categories.travel', 'Travel Info'), icon: '🚢' },
    { id: 'account', label: t('help.categories.account', 'Account'), icon: '👤' },
  ];

  const faqs: FAQItem[] = [
    // Booking
    {
      category: 'booking',
      question: t('help.faq.booking1.q', 'How do I book a ferry ticket?'),
      answer: t('help.faq.booking1.a', 'Simply use our search form on the homepage. Enter your departure and arrival ports, select your travel date, specify the number of passengers, and click Search. You\'ll see available ferries from multiple operators. Select your preferred option and follow the booking process.'),
    },
    {
      category: 'booking',
      question: t('help.faq.booking2.q', 'Can I book a round trip?'),
      answer: t('help.faq.booking2.a', 'Yes! When searching for ferries, you can select the "Round Trip" option and specify your return date. This allows you to book both outbound and return journeys in a single transaction.'),
    },
    {
      category: 'booking',
      question: t('help.faq.booking3.q', 'How far in advance can I book?'),
      answer: t('help.faq.booking3.a', 'You can typically book ferry tickets up to 12 months in advance, depending on the operator. We recommend booking early, especially during peak season (summer months), to secure the best prices and availability.'),
    },
    {
      category: 'booking',
      question: t('help.faq.booking4.q', 'Can I book for a vehicle?'),
      answer: t('help.faq.booking4.a', 'Yes, you can book with a vehicle. During the booking process, you\'ll be asked if you\'re traveling with a vehicle. You\'ll need to provide details such as vehicle type, dimensions, and registration number.'),
    },
    // Payment
    {
      category: 'payment',
      question: t('help.faq.payment1.q', 'What payment methods do you accept?'),
      answer: t('help.faq.payment1.a', 'We accept major credit and debit cards including Visa, Mastercard, and American Express. All payments are processed securely through Stripe.'),
    },
    {
      category: 'payment',
      question: t('help.faq.payment2.q', 'Is my payment information secure?'),
      answer: t('help.faq.payment2.a', 'Absolutely. We use Stripe, a PCI DSS Level 1 certified payment processor. Your card details are encrypted and never stored on our servers.'),
    },
    {
      category: 'payment',
      question: t('help.faq.payment3.q', 'What currency are prices shown in?'),
      answer: t('help.faq.payment3.a', 'All prices are displayed in Euros (EUR). If your card is in a different currency, your bank may apply currency conversion fees.'),
    },
    // Cancellation
    {
      category: 'cancellation',
      question: t('help.faq.cancel1.q', 'Can I cancel my booking?'),
      answer: t('help.faq.cancel1.a', 'Yes, most bookings can be cancelled. The refund amount depends on how far in advance you cancel and the fare type you booked. Check our Cancellation Policy for detailed information.'),
    },
    {
      category: 'cancellation',
      question: t('help.faq.cancel2.q', 'How do I cancel my booking?'),
      answer: t('help.faq.cancel2.a', 'Log in to your account, go to "My Bookings", select the booking you wish to cancel, and click "Cancel Booking". You can also contact our customer support for assistance.'),
    },
    {
      category: 'cancellation',
      question: t('help.faq.cancel3.q', 'How long does a refund take?'),
      answer: t('help.faq.cancel3.a', 'Refunds are typically processed within 5-10 business days. The time it takes to appear in your account may vary depending on your bank.'),
    },
    // Travel
    {
      category: 'travel',
      question: t('help.faq.travel1.q', 'What documents do I need to travel?'),
      answer: t('help.faq.travel1.a', 'You\'ll need a valid passport or national ID card. If traveling between EU and non-EU countries (like Tunisia), check visa requirements. Vehicle travelers need registration documents.'),
    },
    {
      category: 'travel',
      question: t('help.faq.travel2.q', 'How early should I arrive at the port?'),
      answer: t('help.faq.travel2.a', 'We recommend arriving at least 90 minutes before departure for foot passengers, and 2-3 hours if traveling with a vehicle. Check-in typically closes 45-60 minutes before sailing.'),
    },
    {
      category: 'travel',
      question: t('help.faq.travel3.q', 'Can I bring pets on the ferry?'),
      answer: t('help.faq.travel3.a', 'Most operators allow pets, but rules vary. You\'ll need a pet passport and up-to-date vaccinations. Pets may need to stay in designated areas or your vehicle during the crossing.'),
    },
    // Account
    {
      category: 'account',
      question: t('help.faq.account1.q', 'Do I need an account to book?'),
      answer: t('help.faq.account1.a', 'No, you can book as a guest. However, creating an account allows you to manage bookings, save payment methods, and access your booking history easily.'),
    },
    {
      category: 'account',
      question: t('help.faq.account2.q', 'How do I find my booking without an account?'),
      answer: t('help.faq.account2.a', 'Use the "Find My Booking" feature in the navigation. Enter your booking reference number and the email address used during booking to access your booking details.'),
    },
  ];

  const filteredFAQs = faqs.filter((faq) => {
    const matchesCategory = activeCategory === 'all' || faq.category === activeCategory;
    const matchesSearch = searchQuery === '' ||
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h1 className="text-4xl font-bold mb-4">
            {t('help.title', 'Help Center')}
          </h1>
          <p className="text-xl text-blue-100 mb-6">
            {t('help.subtitle', 'Find answers to common questions or get in touch with our support team.')}
          </p>

          {/* Search */}
          <div className="max-w-xl">
            <div className="relative">
              <input
                type="text"
                placeholder={t('help.searchPlaceholder', 'Search for answers...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 pl-12 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <svg className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Help Links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Link to="/contact" className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="text-3xl mb-3">📧</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {t('help.quickLinks.contact.title', 'Contact Us')}
            </h3>
            <p className="text-gray-600 text-sm">
              {t('help.quickLinks.contact.desc', 'Get in touch with our support team')}
            </p>
          </Link>
          <Link to="/find-booking" className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="text-3xl mb-3">🔍</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {t('help.quickLinks.findBooking.title', 'Find Booking')}
            </h3>
            <p className="text-gray-600 text-sm">
              {t('help.quickLinks.findBooking.desc', 'Look up your booking details')}
            </p>
          </Link>
          <Link to="/cancellation-policy" className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="text-3xl mb-3">📋</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {t('help.quickLinks.cancellation.title', 'Cancellation Policy')}
            </h3>
            <p className="text-gray-600 text-sm">
              {t('help.quickLinks.cancellation.desc', 'Learn about refunds and cancellations')}
            </p>
          </Link>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2 mb-8">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeCategory === category.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span className="mr-1">{category.icon}</span>
              {category.label}
            </button>
          ))}
        </div>

        {/* FAQ List */}
        <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-200">
          {filteredFAQs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {t('help.noResults', 'No results found. Try a different search term.')}
            </div>
          ) : (
            filteredFAQs.map((faq, index) => (
              <div key={index} className="p-4">
                <button
                  onClick={() => setOpenFAQ(openFAQ === index ? null : index)}
                  className="w-full text-left flex items-center justify-between"
                >
                  <span className="font-medium text-gray-900 pr-4">{faq.question}</span>
                  <svg
                    className={`w-5 h-5 text-gray-500 flex-shrink-0 transition-transform ${
                      openFAQ === index ? 'transform rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openFAQ === index && (
                  <p className="mt-3 text-gray-600 pl-0">{faq.answer}</p>
                )}
              </div>
            ))
          )}
        </div>

        {/* Still Need Help */}
        <div className="mt-12 bg-blue-50 rounded-xl p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            {t('help.stillNeedHelp.title', 'Still Need Help?')}
          </h2>
          <p className="text-gray-600 mb-6">
            {t('help.stillNeedHelp.desc', 'Our support team is here to help you with any questions or issues.')}
          </p>
          <Link
            to="/contact"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            {t('help.stillNeedHelp.button', 'Contact Support')}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default HelpCenterPage;
