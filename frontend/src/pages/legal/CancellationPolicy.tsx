import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

const CancellationPolicy: React.FC = () => {
  // Translation hook for future i18n support
  useTranslation(['legal']);

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Cancellation & Refund Policy</h1>
          <p className="text-gray-500 mb-8">Last updated: December 2024</p>

          <div className="prose prose-blue max-w-none">
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">1. General Cancellation Rules</h2>
              <p className="text-gray-700 mb-4">
                VoilaFerry acts as an intermediary between you and ferry operators. Cancellation policies
                vary depending on the ferry operator, route, and fare type selected at the time of booking.
              </p>
              <p className="text-gray-700">
                The specific cancellation terms applicable to your booking are displayed during the booking
                process and included in your booking confirmation email.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">2. Standard Cancellation Timeframes</h2>
              <div className="bg-gray-50 rounded-lg p-6 mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-semibold">Time Before Departure</th>
                      <th className="text-left py-2 font-semibold">Refund Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-2">More than 30 days</td>
                      <td className="py-2">Full refund minus service fee (5%)</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2">15-30 days</td>
                      <td className="py-2">75% refund</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2">7-14 days</td>
                      <td className="py-2">50% refund</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2">48 hours - 7 days</td>
                      <td className="py-2">25% refund</td>
                    </tr>
                    <tr>
                      <td className="py-2">Less than 48 hours</td>
                      <td className="py-2">No refund</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-gray-600 text-sm">
                * These are general guidelines. Actual refund amounts depend on the operator's specific policy
                and fare type. Flexible fares may offer better cancellation terms.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">3. How to Cancel a Booking</h2>
              <ol className="list-decimal list-inside text-gray-700 space-y-2">
                <li>Log in to your VoilaFerry account</li>
                <li>Go to "My Bookings"</li>
                <li>Select the booking you wish to cancel</li>
                <li>Click "Cancel Booking" and follow the instructions</li>
                <li>You will receive a confirmation email with refund details</li>
              </ol>
              <p className="text-gray-700 mt-4">
                Alternatively, you can contact our customer support team at{' '}
                <a href="mailto:support@voilaferry.com" className="text-blue-600 hover:underline">
                  support@voilaferry.com
                </a>
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">4. Refund Processing</h2>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li>Refunds are processed within 5-10 business days</li>
                <li>Refunds are issued to the original payment method</li>
                <li>Bank processing times may add 3-5 additional business days</li>
                <li>You will receive an email confirmation when the refund is processed</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">5. Non-Refundable Bookings</h2>
              <p className="text-gray-700 mb-4">
                Some fare types are marked as "Non-Refundable" at the time of booking. These bookings:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li>Cannot be cancelled for a refund</li>
                <li>May be eligible for date/time changes (subject to availability and fees)</li>
                <li>May be eligible for credit vouchers in exceptional circumstances</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">6. Operator Cancellations</h2>
              <p className="text-gray-700 mb-4">
                If a ferry operator cancels a sailing due to weather, technical issues, or other reasons:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li>You are entitled to a full refund</li>
                <li>You may choose to rebook on an alternative sailing at no extra cost</li>
                <li>We will notify you as soon as we receive cancellation information from the operator</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">7. Booking Modifications</h2>
              <p className="text-gray-700 mb-4">
                Instead of cancelling, you may be able to modify your booking:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li>Date and time changes are subject to availability</li>
                <li>Modification fees may apply depending on fare type</li>
                <li>Price differences must be paid if the new sailing costs more</li>
                <li>No refund is given if the new sailing costs less</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">8. Cancellation Protection</h2>
              <p className="text-gray-700 mb-4">
                We offer optional Cancellation Protection that provides additional flexibility:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li>Cancel for any reason up to 24 hours before departure</li>
                <li>Receive up to 80% refund regardless of fare type</li>
                <li>Protection must be purchased at the time of booking</li>
                <li>Cost is typically 5-10% of the booking value</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">9. Contact Us</h2>
              <p className="text-gray-700">
                For questions about our cancellation policy or assistance with your booking:
              </p>
              <ul className="list-none text-gray-700 mt-4 space-y-2">
                <li>Email: <a href="mailto:support@voilaferry.com" className="text-blue-600 hover:underline">support@voilaferry.com</a></li>
                <li>Phone: +33 1 XX XX XX XX (Mon-Fri, 9am-6pm CET)</li>
                <li>Live Chat: Available on our website</li>
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

export default CancellationPolicy;
