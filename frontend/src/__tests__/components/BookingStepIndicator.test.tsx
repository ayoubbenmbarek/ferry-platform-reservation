/**
 * Tests for BookingStepIndicator component.
 */

import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../test-utils/testUtils';
import BookingStepIndicator, { BookingStep } from '../../components/BookingStepIndicator';

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

describe('BookingStepIndicator', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  describe('Rendering', () => {
    it('renders all step labels', () => {
      renderWithProviders(<BookingStepIndicator currentStep={BookingStep.SEARCH} />);

      expect(screen.getByText('Search')).toBeInTheDocument();
      expect(screen.getByText('Select Ferry')).toBeInTheDocument();
      expect(screen.getByText('Details')).toBeInTheDocument();
      expect(screen.getByText('Payment')).toBeInTheDocument();
      expect(screen.getByText('Confirmation')).toBeInTheDocument();
    });

    it('renders step count on mobile view', () => {
      renderWithProviders(<BookingStepIndicator currentStep={BookingStep.BOOKING_DETAILS} />);

      // Mobile view shows step count
      expect(screen.getByText(/Step 3 of 5/)).toBeInTheDocument();
    });

    it('shows current step label on mobile', () => {
      renderWithProviders(<BookingStepIndicator currentStep={BookingStep.PAYMENT} />);

      // Mobile view shows current step (multiple Payment elements due to desktop/mobile views)
      expect(screen.getAllByText(/Payment/).length).toBeGreaterThan(0);
    });
  });

  describe('Step States', () => {
    it('marks current step correctly', () => {
      renderWithProviders(<BookingStepIndicator currentStep={BookingStep.BOOKING_DETAILS} />);

      // The step indicator renders with step 3 (index 2) as current
      // Step count should show "Step 3 of 5"
      expect(screen.getByText('Step 3 of 5')).toBeInTheDocument();
    });

    it('highlights current step in mobile progress', () => {
      const { container } = renderWithProviders(
        <BookingStepIndicator currentStep={BookingStep.SELECT_FERRY} />
      );

      // Progress bar should be 40% (step 2 of 5)
      const progressBar = container.querySelector('.bg-blue-600.h-2');
      expect(progressBar).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('calls onBack when clicking previous step', () => {
      const mockOnBack = jest.fn();
      renderWithProviders(
        <BookingStepIndicator
          currentStep={BookingStep.PAYMENT}
          canGoBack={true}
          onBack={mockOnBack}
        />
      );

      // Click on "Details" step (previous step)
      const detailsSteps = screen.getAllByText('Details');
      if (detailsSteps.length > 0) {
        fireEvent.click(detailsSteps[0]);
        expect(mockOnBack).toHaveBeenCalled();
      }
    });

    it('navigates when canGoBack is true and no onBack provided', () => {
      renderWithProviders(
        <BookingStepIndicator currentStep={BookingStep.PAYMENT} canGoBack={true} />
      );

      // Click on "Search" step
      const searchSteps = screen.getAllByText('Search');
      if (searchSteps.length > 0) {
        fireEvent.click(searchSteps[0]);
        expect(mockNavigate).toHaveBeenCalledWith('/');
      }
    });

    it('does not navigate when canGoBack is false', () => {
      const mockOnBack = jest.fn();
      renderWithProviders(
        <BookingStepIndicator
          currentStep={BookingStep.PAYMENT}
          canGoBack={false}
          onBack={mockOnBack}
        />
      );

      // Click on previous step should not trigger navigation
      const searchSteps = screen.getAllByText('Search');
      if (searchSteps.length > 0) {
        fireEvent.click(searchSteps[0]);
        expect(mockOnBack).not.toHaveBeenCalled();
        expect(mockNavigate).not.toHaveBeenCalled();
      }
    });

    it('does not allow clicking future steps', () => {
      renderWithProviders(
        <BookingStepIndicator currentStep={BookingStep.SEARCH} canGoBack={true} />
      );

      // Click on "Payment" step (future step)
      const paymentSteps = screen.getAllByText('Payment');
      if (paymentSteps.length > 0) {
        fireEvent.click(paymentSteps[0]);
        expect(mockNavigate).not.toHaveBeenCalled();
      }
    });
  });

  describe('Mobile Back Button', () => {
    it('renders back button on mobile when not on first step', () => {
      renderWithProviders(
        <BookingStepIndicator currentStep={BookingStep.BOOKING_DETAILS} canGoBack={true} />
      );

      const backButton = screen.getByRole('button', { name: /back/i });
      expect(backButton).toBeInTheDocument();
    });

    it('does not render back button on first step', () => {
      renderWithProviders(
        <BookingStepIndicator currentStep={BookingStep.SEARCH} canGoBack={true} />
      );

      const backButton = screen.queryByRole('button', { name: /back/i });
      expect(backButton).not.toBeInTheDocument();
    });

    it('does not render back button when canGoBack is false', () => {
      renderWithProviders(
        <BookingStepIndicator currentStep={BookingStep.BOOKING_DETAILS} canGoBack={false} />
      );

      const backButton = screen.queryByRole('button', { name: /back/i });
      expect(backButton).not.toBeInTheDocument();
    });

    it('calls onBack when mobile back button is clicked', () => {
      const mockOnBack = jest.fn();
      renderWithProviders(
        <BookingStepIndicator
          currentStep={BookingStep.BOOKING_DETAILS}
          canGoBack={true}
          onBack={mockOnBack}
        />
      );

      const backButton = screen.getByRole('button', { name: /back/i });
      fireEvent.click(backButton);
      expect(mockOnBack).toHaveBeenCalled();
    });

    it('navigates to previous step when mobile back button clicked without onBack', () => {
      renderWithProviders(
        <BookingStepIndicator currentStep={BookingStep.BOOKING_DETAILS} canGoBack={true} />
      );

      const backButton = screen.getByRole('button', { name: /back/i });
      fireEvent.click(backButton);
      // Should navigate to /search (SELECT_FERRY step)
      expect(mockNavigate).toHaveBeenCalledWith('/search');
    });
  });

  describe('Step Progression', () => {
    const testCases = [
      { step: BookingStep.SEARCH, index: 1, total: 5 },
      { step: BookingStep.SELECT_FERRY, index: 2, total: 5 },
      { step: BookingStep.BOOKING_DETAILS, index: 3, total: 5 },
      { step: BookingStep.PAYMENT, index: 4, total: 5 },
      { step: BookingStep.CONFIRMATION, index: 5, total: 5 },
    ];

    testCases.forEach(({ step, index, total }) => {
      it(`shows correct step count for ${step}`, () => {
        renderWithProviders(<BookingStepIndicator currentStep={step} />);
        expect(screen.getByText(`Step ${index} of ${total}`)).toBeInTheDocument();
      });
    });
  });
});
