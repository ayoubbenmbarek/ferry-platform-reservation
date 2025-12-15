import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

const AboutPage: React.FC = () => {
  const { t } = useTranslation('common');

  const teamMembers = [
    { name: 'Mediterranean Expertise', icon: '🌊', description: t('about.team.mediterranean', 'Deep knowledge of Mediterranean ferry routes and operators') },
    { name: 'Customer First', icon: '💙', description: t('about.team.customer', 'Dedicated support team available to assist you') },
    { name: 'Tech Innovation', icon: '🚀', description: t('about.team.tech', 'Modern platform with real-time availability and pricing') },
  ];

  const stats = [
    { value: '4+', label: t('about.stats.operators', 'Ferry Operators') },
    { value: '20+', label: t('about.stats.routes', 'Routes') },
    { value: '1000+', label: t('about.stats.bookings', 'Bookings') },
    { value: '24/7', label: t('about.stats.support', 'Support') },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            {t('about.hero.title', 'About VoilaFerry')}
          </h1>
          <p className="text-xl text-blue-100 max-w-3xl">
            {t('about.hero.subtitle', 'Your trusted partner for Mediterranean ferry bookings. We connect travelers with the best ferry services across Tunisia, Italy, and France.')}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Mission Section */}
        <section className="mb-16">
          <div className="bg-white rounded-xl shadow-sm p-8 md:p-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">
              {t('about.mission.title', 'Our Mission')}
            </h2>
            <div className="prose prose-lg max-w-none text-gray-600">
              <p className="mb-4">
                {t('about.mission.p1', 'VoilaFerry was founded with a simple mission: to make ferry travel in the Mediterranean as easy and accessible as possible. We believe that booking a ferry should be straightforward, transparent, and stress-free.')}
              </p>
              <p className="mb-4">
                {t('about.mission.p2', 'We aggregate ferry services from multiple operators including CTN, GNV, Corsica Lines, and more, allowing you to compare prices, schedules, and amenities all in one place.')}
              </p>
              <p>
                {t('about.mission.p3', 'Whether you\'re traveling for business, leisure, or visiting family, we\'re here to help you find the perfect crossing.')}
              </p>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="mb-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat, index) => (
              <div key={index} className="bg-white rounded-xl shadow-sm p-6 text-center">
                <div className="text-3xl md:text-4xl font-bold text-blue-600 mb-2">
                  {stat.value}
                </div>
                <div className="text-gray-600">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* What Sets Us Apart */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            {t('about.features.title', 'What Sets Us Apart')}
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {teamMembers.map((member, index) => (
              <div key={index} className="bg-white rounded-xl shadow-sm p-6 text-center">
                <div className="text-4xl mb-4">{member.icon}</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{member.name}</h3>
                <p className="text-gray-600">{member.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Our Partners */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            {t('about.partners.title', 'Our Ferry Partners')}
          </h2>
          <div className="bg-white rounded-xl shadow-sm p-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 items-center justify-items-center">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-800 mb-1">CTN</div>
                <div className="text-sm text-gray-500">Compagnie Tunisienne de Navigation</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600 mb-1">GNV</div>
                <div className="text-sm text-gray-500">Grandi Navi Veloci</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600 mb-1">Corsica Lines</div>
                <div className="text-sm text-gray-500">Mediterranean Ferries</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-700 mb-1">La Méridionale</div>
                <div className="text-sm text-gray-500">French Ferry Operator</div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="text-center">
          <div className="bg-blue-600 rounded-xl p-8 md:p-12 text-white">
            <h2 className="text-3xl font-bold mb-4">
              {t('about.cta.title', 'Ready to Book Your Ferry?')}
            </h2>
            <p className="text-blue-100 mb-6 max-w-2xl mx-auto">
              {t('about.cta.subtitle', 'Compare prices from multiple operators and find the best deal for your Mediterranean crossing.')}
            </p>
            <Link
              to="/"
              className="inline-block bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
            >
              {t('about.cta.button', 'Search Ferries')}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AboutPage;
