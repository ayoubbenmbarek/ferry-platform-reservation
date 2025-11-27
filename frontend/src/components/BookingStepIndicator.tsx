import React from 'react';
import { useNavigate } from 'react-router-dom';

export enum BookingStep {
  SEARCH = 'search',
  SELECT_FERRY = 'select_ferry',
  BOOKING_DETAILS = 'booking_details',
  PAYMENT = 'payment',
  CONFIRMATION = 'confirmation',
}

interface BookingStepIndicatorProps {
  currentStep: BookingStep;
  canGoBack?: boolean;
  onBack?: () => void;
}

const BookingStepIndicator: React.FC<BookingStepIndicatorProps> = ({
  currentStep,
  canGoBack = true,
  onBack,
}) => {
  const navigate = useNavigate();

  const steps = [
    {
      key: BookingStep.SEARCH,
      label: 'Search',
      icon: '🔍',
      path: '/',
    },
    {
      key: BookingStep.SELECT_FERRY,
      label: 'Select Ferry',
      icon: '🚢',
      path: '/search',
    },
    {
      key: BookingStep.BOOKING_DETAILS,
      label: 'Details',
      icon: '📝',
      path: '/booking',
    },
    {
      key: BookingStep.PAYMENT,
      label: 'Payment',
      icon: '💳',
      path: '/payment',
    },
    {
      key: BookingStep.CONFIRMATION,
      label: 'Confirmation',
      icon: '✅',
      path: '/booking/confirmation',
    },
  ];

  const currentStepIndex = steps.findIndex((s) => s.key === currentStep);

  const handleStepClick = (step: typeof steps[0], index: number) => {
    // Can only navigate to previous steps or current step
    if (index <= currentStepIndex && step.path && canGoBack) {
      if (onBack && index < currentStepIndex) {
        onBack();
      } else {
        navigate(step.path);
      }
    }
  };

  return (
    <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Back button for mobile */}
        {canGoBack && currentStepIndex > 0 && (
          <button
            onClick={() => {
              const prevStep = steps[currentStepIndex - 1];
              if (onBack) {
                onBack();
              } else if (prevStep.path) {
                navigate(prevStep.path);
              }
            }}
            className="md:hidden mb-4 flex items-center text-blue-600 hover:text-blue-700 font-medium"
          >
            <svg
              className="w-5 h-5 mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back
          </button>
        )}

        {/* Desktop step indicator */}
        <div className="hidden md:flex items-center justify-between">
          {steps.map((step, index) => {
            const isCompleted = index < currentStepIndex;
            const isCurrent = index === currentStepIndex;
            const isClickable = (isCompleted || isCurrent) && canGoBack;

            return (
              <React.Fragment key={step.key}>
                {/* Step */}
                <div
                  className={`flex items-center ${
                    isClickable ? 'cursor-pointer' : 'cursor-not-allowed'
                  }`}
                  onClick={() => handleStepClick(step, index)}
                >
                  <div
                    className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${
                      isCurrent
                        ? 'bg-blue-600 border-blue-600 text-white shadow-lg scale-110'
                        : isCompleted
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'bg-gray-100 border-gray-300 text-gray-400'
                    }`}
                  >
                    {isCompleted ? (
                      <svg
                        className="w-6 h-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : (
                      <span className="text-lg">{step.icon}</span>
                    )}
                  </div>
                  <div className="ml-3">
                    <p
                      className={`text-sm font-medium ${
                        isCurrent
                          ? 'text-blue-600'
                          : isCompleted
                          ? 'text-gray-900'
                          : 'text-gray-400'
                      }`}
                    >
                      {step.label}
                    </p>
                  </div>
                </div>

                {/* Connector line */}
                {index < steps.length - 1 && (
                  <div className="flex-1 mx-4">
                    <div
                      className={`h-1 rounded transition-all ${
                        index < currentStepIndex
                          ? 'bg-green-500'
                          : 'bg-gray-200'
                      }`}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Mobile step indicator */}
        <div className="md:hidden">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600">
              Step {currentStepIndex + 1} of {steps.length}
            </p>
            <p className="text-sm font-semibold text-blue-600">
              {steps[currentStepIndex].icon} {steps[currentStepIndex].label}
            </p>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{
                width: `${((currentStepIndex + 1) / steps.length) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingStepIndicator;
