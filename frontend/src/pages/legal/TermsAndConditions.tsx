import React from 'react';
import { Link } from 'react-router-dom';

const TermsAndConditions: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms and Conditions</h1>
          <p className="text-gray-500 mb-8">Last updated: December 2024</p>

          <div className="prose prose-blue max-w-none">
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">1. Introduction</h2>
              <p className="text-gray-700 mb-4">
                Welcome to VoilaFerry. These Terms and Conditions ("Terms") govern your use of our website,
                mobile application, and services (collectively, the "Service"). By accessing or using our
                Service, you agree to be bound by these Terms.
              </p>
              <p className="text-gray-700">
                VoilaFerry is operated by [Company Name], registered in [Country], with registration number
                [Number] ("we", "us", "our").
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">2. Service Description</h2>
              <p className="text-gray-700 mb-4">
                VoilaFerry provides an online platform for comparing and booking ferry tickets across
                multiple operators serving Mediterranean routes. We act as an intermediary between you
                and the ferry operators.
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li>We do not operate any ferries ourselves</li>
                <li>The contract of carriage is between you and the ferry operator</li>
                <li>We facilitate the booking process and provide customer support</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">3. Account Registration</h2>
              <p className="text-gray-700 mb-4">
                To use certain features of our Service, you may need to create an account. You agree to:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li>Provide accurate, current, and complete information</li>
                <li>Maintain and update your information to keep it accurate</li>
                <li>Maintain the security of your account credentials</li>
                <li>Accept responsibility for all activities under your account</li>
                <li>Notify us immediately of any unauthorized use</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">4. Booking Process</h2>
              <h3 className="text-lg font-medium text-gray-900 mb-2">4.1 Making a Booking</h3>
              <p className="text-gray-700 mb-4">
                When you make a booking through our Service:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
                <li>You confirm that all passenger information provided is accurate</li>
                <li>You accept the fare rules and conditions displayed at booking</li>
                <li>You authorize payment for the total amount shown</li>
                <li>A binding contract is formed when you receive booking confirmation</li>
              </ul>

              <h3 className="text-lg font-medium text-gray-900 mb-2">4.2 Pricing</h3>
              <p className="text-gray-700 mb-4">
                All prices are displayed in Euros (EUR) and include applicable taxes unless otherwise stated.
                Prices may change until a booking is confirmed. We reserve the right to correct any pricing
                errors, even after a booking is made.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">5. Payment</h2>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li>Payment is due at the time of booking</li>
                <li>We accept major credit/debit cards (Visa, Mastercard, American Express)</li>
                <li>All payments are processed securely through our payment provider (Stripe)</li>
                <li>Your card will be charged in EUR</li>
                <li>Currency conversion fees may apply if your card is in a different currency</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">6. Cancellations and Refunds</h2>
              <p className="text-gray-700 mb-4">
                Cancellation and refund policies vary depending on the ferry operator and fare type.
                Please refer to our{' '}
                <Link to="/cancellation-policy" className="text-blue-600 hover:underline">
                  Cancellation Policy
                </Link>{' '}
                for detailed information.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">7. Passenger Responsibilities</h2>
              <p className="text-gray-700 mb-4">As a passenger, you are responsible for:</p>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li>Arriving at the port with sufficient time before departure (minimum 90 minutes recommended)</li>
                <li>Carrying valid travel documents (passport, ID, visa if required)</li>
                <li>Complying with vehicle requirements if traveling with a vehicle</li>
                <li>Declaring any dangerous goods or special requirements</li>
                <li>Following the ferry operator's rules and crew instructions</li>
                <li>Ensuring children are supervised at all times</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">8. Travel Documents</h2>
              <p className="text-gray-700 mb-4">
                You are solely responsible for ensuring you have all necessary travel documents:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li>Valid passport or national ID card</li>
                <li>Visas where required</li>
                <li>Vehicle registration documents (if applicable)</li>
                <li>Pet passports and health certificates (if traveling with pets)</li>
              </ul>
              <p className="text-gray-700 mt-4">
                We are not responsible for any denial of boarding due to inadequate documentation.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">9. Limitation of Liability</h2>
              <p className="text-gray-700 mb-4">
                To the maximum extent permitted by law:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li>We are not liable for the acts or omissions of ferry operators</li>
                <li>We are not liable for delays, cancellations, or changes to ferry services</li>
                <li>Our liability is limited to the amount you paid for your booking</li>
                <li>We are not liable for indirect, consequential, or special damages</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">10. Intellectual Property</h2>
              <p className="text-gray-700">
                All content on our Service, including text, graphics, logos, and software, is our property
                or licensed to us and is protected by intellectual property laws. You may not reproduce,
                distribute, or create derivative works without our express written consent.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">11. Privacy</h2>
              <p className="text-gray-700">
                Your use of our Service is also governed by our{' '}
                <Link to="/privacy-policy" className="text-blue-600 hover:underline">
                  Privacy Policy
                </Link>
                , which describes how we collect, use, and protect your personal information.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">12. Modifications to Terms</h2>
              <p className="text-gray-700">
                We reserve the right to modify these Terms at any time. Changes will be effective when
                posted on our website. Your continued use of the Service after changes constitutes
                acceptance of the modified Terms.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">13. Governing Law</h2>
              <p className="text-gray-700">
                These Terms are governed by the laws of France. Any disputes shall be subject to the
                exclusive jurisdiction of the courts of Paris, France, unless EU consumer protection
                regulations provide otherwise.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">14. Contact Information</h2>
              <p className="text-gray-700">
                For questions about these Terms, please contact us:
              </p>
              <ul className="list-none text-gray-700 mt-4 space-y-2">
                <li>Email: <a href="mailto:legal@voilaferry.com" className="text-blue-600 hover:underline">legal@voilaferry.com</a></li>
                <li>Address: [Company Address]</li>
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

export default TermsAndConditions;
