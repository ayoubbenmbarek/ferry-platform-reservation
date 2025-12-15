import React from 'react';
import { Link } from 'react-router-dom';

const PrivacyPolicy: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-gray-500 mb-8">Last updated: December 2024</p>

          <div className="prose prose-blue max-w-none">
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">1. Introduction</h2>
              <p className="text-gray-700 mb-4">
                VoilaFerry ("we", "us", "our") is committed to protecting your privacy. This Privacy Policy
                explains how we collect, use, disclose, and safeguard your information when you use our
                website and services.
              </p>
              <p className="text-gray-700">
                We comply with the General Data Protection Regulation (GDPR) and other applicable data
                protection laws in the European Union.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">2. Data Controller</h2>
              <p className="text-gray-700">
                The data controller responsible for your personal data is:
              </p>
              <ul className="list-none text-gray-700 mt-4 space-y-1">
                <li>[Company Name]</li>
                <li>[Address]</li>
                <li>Email: <a href="mailto:privacy@voilaferry.com" className="text-blue-600 hover:underline">privacy@voilaferry.com</a></li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">3. Information We Collect</h2>

              <h3 className="text-lg font-medium text-gray-900 mb-2">3.1 Information You Provide</h3>
              <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
                <li>Account information (name, email, password)</li>
                <li>Booking details (passenger names, contact information)</li>
                <li>Payment information (processed securely by Stripe)</li>
                <li>Communication preferences</li>
                <li>Customer support inquiries</li>
              </ul>

              <h3 className="text-lg font-medium text-gray-900 mb-2">3.2 Information Collected Automatically</h3>
              <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
                <li>Device information (browser type, operating system)</li>
                <li>IP address and approximate location</li>
                <li>Usage data (pages visited, features used)</li>
                <li>Cookies and similar technologies (see our <Link to="/cookie-policy" className="text-blue-600 hover:underline">Cookie Policy</Link>)</li>
              </ul>

              <h3 className="text-lg font-medium text-gray-900 mb-2">3.3 Information from Third Parties</h3>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li>Social login data (if you sign in with Google)</li>
                <li>Ferry operators (booking updates, schedule changes)</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">4. How We Use Your Information</h2>
              <p className="text-gray-700 mb-4">We use your information to:</p>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li>Process and manage your bookings</li>
                <li>Send booking confirmations and travel updates</li>
                <li>Provide customer support</li>
                <li>Process payments and refunds</li>
                <li>Send marketing communications (with your consent)</li>
                <li>Improve our services and user experience</li>
                <li>Detect and prevent fraud</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">5. Legal Basis for Processing (GDPR)</h2>
              <p className="text-gray-700 mb-4">We process your data based on:</p>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li><strong>Contract:</strong> Processing necessary to fulfill your booking</li>
                <li><strong>Consent:</strong> For marketing communications and non-essential cookies</li>
                <li><strong>Legitimate interests:</strong> Service improvement, fraud prevention, analytics</li>
                <li><strong>Legal obligation:</strong> Compliance with applicable laws</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">6. Data Sharing</h2>
              <p className="text-gray-700 mb-4">We share your data with:</p>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li><strong>Ferry operators:</strong> To process and manage your bookings</li>
                <li><strong>Payment processors:</strong> Stripe, for secure payment processing</li>
                <li><strong>Service providers:</strong> Hosting, email, customer support tools</li>
                <li><strong>Analytics providers:</strong> To improve our services</li>
                <li><strong>Legal authorities:</strong> When required by law</li>
              </ul>
              <p className="text-gray-700 mt-4">
                We do not sell your personal data to third parties.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">7. International Data Transfers</h2>
              <p className="text-gray-700">
                Your data may be transferred to countries outside the European Economic Area (EEA).
                When this happens, we ensure appropriate safeguards are in place, such as Standard
                Contractual Clauses approved by the European Commission.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">8. Data Retention</h2>
              <p className="text-gray-700 mb-4">We retain your data for:</p>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li><strong>Account data:</strong> Until you delete your account</li>
                <li><strong>Booking data:</strong> 7 years for legal/tax compliance</li>
                <li><strong>Marketing data:</strong> Until you unsubscribe</li>
                <li><strong>Analytics data:</strong> 26 months</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">9. Your Rights (GDPR)</h2>
              <p className="text-gray-700 mb-4">Under GDPR, you have the right to:</p>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li><strong>Access:</strong> Request a copy of your personal data</li>
                <li><strong>Rectification:</strong> Correct inaccurate or incomplete data</li>
                <li><strong>Erasure:</strong> Request deletion of your data ("right to be forgotten")</li>
                <li><strong>Restriction:</strong> Limit how we process your data</li>
                <li><strong>Portability:</strong> Receive your data in a portable format</li>
                <li><strong>Object:</strong> Object to processing based on legitimate interests</li>
                <li><strong>Withdraw consent:</strong> Withdraw consent at any time</li>
              </ul>
              <p className="text-gray-700 mt-4">
                To exercise your rights, contact us at{' '}
                <a href="mailto:privacy@voilaferry.com" className="text-blue-600 hover:underline">
                  privacy@voilaferry.com
                </a>
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">10. Data Security</h2>
              <p className="text-gray-700 mb-4">
                We implement appropriate security measures to protect your data:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li>SSL/TLS encryption for all data transmission</li>
                <li>Secure payment processing through Stripe (PCI DSS compliant)</li>
                <li>Access controls and authentication</li>
                <li>Regular security audits and updates</li>
                <li>Employee training on data protection</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">11. Children's Privacy</h2>
              <p className="text-gray-700">
                Our services are not directed to children under 16. We do not knowingly collect personal
                data from children under 16. If you believe we have collected data from a child under 16,
                please contact us immediately.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">12. Changes to This Policy</h2>
              <p className="text-gray-700">
                We may update this Privacy Policy from time to time. We will notify you of significant
                changes by email or through our website. The "Last updated" date at the top indicates
                when this policy was last revised.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">13. Contact Us</h2>
              <p className="text-gray-700">
                For questions about this Privacy Policy or to exercise your data rights:
              </p>
              <ul className="list-none text-gray-700 mt-4 space-y-2">
                <li>Email: <a href="mailto:privacy@voilaferry.com" className="text-blue-600 hover:underline">privacy@voilaferry.com</a></li>
                <li>Data Protection Officer: <a href="mailto:dpo@voilaferry.com" className="text-blue-600 hover:underline">dpo@voilaferry.com</a></li>
              </ul>
              <p className="text-gray-700 mt-4">
                You also have the right to lodge a complaint with your local data protection authority
                (in France: CNIL - Commission Nationale de l'Informatique et des Libertés).
              </p>
            </section>
          </div>

          <div className="mt-8 pt-8 border-t border-gray-200">
            <Link to="/" className="text-blue-600 hover:underline">
              &larr; Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
