import React from 'react';
import { Link } from 'react-router-dom';

const CookiePolicy: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Cookie Policy</h1>
          <p className="text-gray-500 mb-8">Last updated: December 2024</p>

          <div className="prose prose-blue max-w-none">
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">1. What Are Cookies?</h2>
              <p className="text-gray-700">
                Cookies are small text files that are stored on your device when you visit a website.
                They help websites remember your preferences, understand how you use the site, and
                provide a better user experience.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">2. How We Use Cookies</h2>
              <p className="text-gray-700 mb-4">VoilaFerry uses cookies for the following purposes:</p>

              <h3 className="text-lg font-medium text-gray-900 mb-2">2.1 Essential Cookies</h3>
              <p className="text-gray-700 mb-4">
                These cookies are necessary for the website to function properly. They enable core
                functionality such as security, network management, and account access.
              </p>
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Cookie</th>
                      <th className="text-left py-2">Purpose</th>
                      <th className="text-left py-2">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-2">session_id</td>
                      <td className="py-2">User authentication</td>
                      <td className="py-2">Session</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2">csrf_token</td>
                      <td className="py-2">Security protection</td>
                      <td className="py-2">Session</td>
                    </tr>
                    <tr>
                      <td className="py-2">cookie_consent</td>
                      <td className="py-2">Store consent preferences</td>
                      <td className="py-2">1 year</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 className="text-lg font-medium text-gray-900 mb-2">2.2 Functional Cookies</h3>
              <p className="text-gray-700 mb-4">
                These cookies enable enhanced functionality and personalization, such as remembering
                your language preference and recent searches.
              </p>
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Cookie</th>
                      <th className="text-left py-2">Purpose</th>
                      <th className="text-left py-2">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-2">language</td>
                      <td className="py-2">Language preference</td>
                      <td className="py-2">1 year</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2">recent_searches</td>
                      <td className="py-2">Store recent route searches</td>
                      <td className="py-2">30 days</td>
                    </tr>
                    <tr>
                      <td className="py-2">currency</td>
                      <td className="py-2">Currency preference</td>
                      <td className="py-2">1 year</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 className="text-lg font-medium text-gray-900 mb-2">2.3 Analytics Cookies</h3>
              <p className="text-gray-700 mb-4">
                These cookies help us understand how visitors interact with our website by collecting
                and reporting information anonymously.
              </p>
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Cookie</th>
                      <th className="text-left py-2">Purpose</th>
                      <th className="text-left py-2">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-2">_ga</td>
                      <td className="py-2">Google Analytics - distinguish users</td>
                      <td className="py-2">2 years</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2">_gid</td>
                      <td className="py-2">Google Analytics - distinguish users</td>
                      <td className="py-2">24 hours</td>
                    </tr>
                    <tr>
                      <td className="py-2">_gat</td>
                      <td className="py-2">Google Analytics - throttle requests</td>
                      <td className="py-2">1 minute</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 className="text-lg font-medium text-gray-900 mb-2">2.4 Marketing Cookies</h3>
              <p className="text-gray-700 mb-4">
                These cookies are used to track visitors across websites to display relevant
                advertisements. We only use these with your consent.
              </p>
              <div className="bg-gray-50 rounded-lg p-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Cookie</th>
                      <th className="text-left py-2">Purpose</th>
                      <th className="text-left py-2">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-2">_fbp</td>
                      <td className="py-2">Facebook Pixel</td>
                      <td className="py-2">3 months</td>
                    </tr>
                    <tr>
                      <td className="py-2">ads_session</td>
                      <td className="py-2">Google Ads conversion tracking</td>
                      <td className="py-2">Session</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">3. Third-Party Cookies</h2>
              <p className="text-gray-700 mb-4">
                Some cookies are placed by third-party services that appear on our pages:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li><strong>Stripe:</strong> For secure payment processing</li>
                <li><strong>Google:</strong> Analytics and sign-in functionality</li>
                <li><strong>Sentry:</strong> Error tracking and performance monitoring</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">4. Managing Cookies</h2>
              <p className="text-gray-700 mb-4">
                You can control and manage cookies in several ways:
              </p>

              <h3 className="text-lg font-medium text-gray-900 mb-2">4.1 Cookie Consent Banner</h3>
              <p className="text-gray-700 mb-4">
                When you first visit our website, you can choose which cookie categories to accept
                through our cookie consent banner. You can change these preferences at any time by
                clicking the "Cookie Settings" link in our footer.
              </p>

              <h3 className="text-lg font-medium text-gray-900 mb-2">4.2 Browser Settings</h3>
              <p className="text-gray-700 mb-4">
                Most browsers allow you to manage cookies through their settings. Here's how to
                access cookie settings in popular browsers:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google Chrome</a></li>
                <li><a href="https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Mozilla Firefox</a></li>
                <li><a href="https://support.apple.com/guide/safari/manage-cookies-and-website-data-sfri11471/mac" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Safari</a></li>
                <li><a href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Microsoft Edge</a></li>
              </ul>

              <h3 className="text-lg font-medium text-gray-900 mb-2 mt-4">4.3 Opt-Out Links</h3>
              <p className="text-gray-700 mb-4">
                You can opt out of certain third-party cookies:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li><a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google Analytics Opt-out</a></li>
                <li><a href="https://www.facebook.com/help/568137493302217" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Facebook Ads Preferences</a></li>
                <li><a href="https://www.youronlinechoices.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Your Online Choices (EU)</a></li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">5. Impact of Disabling Cookies</h2>
              <p className="text-gray-700 mb-4">
                If you disable certain cookies, some parts of our website may not function properly:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li>You may need to log in more frequently</li>
                <li>Your preferences may not be saved</li>
                <li>Some features may be unavailable</li>
                <li>The booking process may be affected</li>
              </ul>
              <p className="text-gray-700 mt-4">
                Essential cookies cannot be disabled as they are necessary for the website to function.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">6. Updates to This Policy</h2>
              <p className="text-gray-700">
                We may update this Cookie Policy from time to time to reflect changes in our practices
                or for operational, legal, or regulatory reasons. The "Last updated" date at the top
                of this page indicates when this policy was last revised.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">7. Contact Us</h2>
              <p className="text-gray-700">
                If you have questions about our use of cookies, please contact us:
              </p>
              <ul className="list-none text-gray-700 mt-4 space-y-2">
                <li>Email: <a href="mailto:privacy@voilaferry.com" className="text-blue-600 hover:underline">privacy@voilaferry.com</a></li>
              </ul>
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

export default CookiePolicy;
