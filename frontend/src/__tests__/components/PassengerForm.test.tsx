/**
 * Tests for PassengerForm component.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PassengerForm } from '../../components/PassengerForm';
import { PassengerType, PassengerInfo, PASSENGER_AGE_LIMITS } from '../../types/ferry';

// Mock react-i18next - use hardcoded values since we can't reference out-of-scope variables
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, any>) => {
      const translations: Record<string, string> = {
        'booking:passengerDetails.passenger': 'Passenger',
        'booking:passengerDetails.firstName': 'First Name',
        'booking:passengerDetails.lastName': 'Last Name',
        'booking:passengerDetails.dateOfBirth': 'Date of Birth',
        'booking:passengerDetails.nationality': 'Nationality',
        'booking:passengerDetails.passengerType': 'Passenger Type',
        'booking:passengerDetails.travelDocuments': 'Travel Documents (Optional)',
        'booking:passengerDetails.passportNumber': 'Passport Number',
        'booking:passengerDetails.specialNeeds': 'Special Needs',
        'booking:passengerDetails.specialNeedsPlaceholder': 'Wheelchair, dietary requirements, etc.',
        'booking:passengerDetails.travelingWithPet': 'Traveling with a pet',
        'booking:passengerDetails.saveChanges': 'Save Changes',
        'booking:passengerDetails.savePassenger': 'Save Passenger',
        'booking:passengerDetails.firstNameRequired': 'First name is required',
        'booking:passengerDetails.lastNameRequired': 'Last name is required',
        'booking:passengerDetails.adultLabel': `Adult (${params?.min || 13}+)`,
        'booking:passengerDetails.childLabel': `Child (${params?.min || 3}-${params?.max || 12})`,
        'booking:passengerDetails.infantLabel': `Infant (0-${params?.max || 2})`,
        'common:edit': 'Edit',
      };
      return translations[key] || key;
    },
  }),
}));

describe('PassengerForm', () => {
  const mockOnSave = jest.fn();
  const mockOnRemove = jest.fn();

  const samplePassenger: PassengerInfo = {
    id: '1',
    type: PassengerType.ADULT,
    firstName: 'John',
    lastName: 'Doe',
    dateOfBirth: '1990-05-15',
    nationality: 'US',
  };

  beforeEach(() => {
    mockOnSave.mockClear();
    mockOnRemove.mockClear();
  });

  describe('Rendering', () => {
    it('renders expanded form for new passenger', () => {
      render(
        <PassengerForm
          passengerNumber={1}
          onSave={mockOnSave}
          isExpanded={true}
        />
      );

      expect(screen.getByText('Passenger 1')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('John')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Doe')).toBeInTheDocument();
    });

    it('renders collapsed view for existing passenger', () => {
      render(
        <PassengerForm
          passenger={samplePassenger}
          passengerNumber={1}
          onSave={mockOnSave}
        />
      );

      expect(screen.getByText(/Passenger 1: John Doe/)).toBeInTheDocument();
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    it('renders all passenger type buttons', () => {
      render(
        <PassengerForm
          passengerNumber={1}
          onSave={mockOnSave}
          isExpanded={true}
        />
      );

      // Check for passenger type options
      expect(screen.getByText(/Adult/)).toBeInTheDocument();
      expect(screen.getByText(/Child/)).toBeInTheDocument();
      expect(screen.getByText(/Infant/)).toBeInTheDocument();
    });

    it('shows remove button for non-first passengers', () => {
      render(
        <PassengerForm
          passenger={samplePassenger}
          passengerNumber={2}
          onSave={mockOnSave}
          onRemove={mockOnRemove}
        />
      );

      expect(screen.getByText('Remove')).toBeInTheDocument();
    });

    it('does not show remove button for first passenger', () => {
      render(
        <PassengerForm
          passenger={samplePassenger}
          passengerNumber={1}
          onSave={mockOnSave}
          onRemove={mockOnRemove}
        />
      );

      expect(screen.queryByText('Remove')).not.toBeInTheDocument();
    });
  });

  describe('Form Interaction', () => {
    it('expands form when Edit button is clicked', () => {
      render(
        <PassengerForm
          passenger={samplePassenger}
          passengerNumber={1}
          onSave={mockOnSave}
        />
      );

      fireEvent.click(screen.getByText('Edit'));

      // Should now show the form fields
      expect(screen.getByPlaceholderText('John')).toBeInTheDocument();
    });

    it('allows entering first name', async () => {
      render(
        <PassengerForm
          passengerNumber={1}
          onSave={mockOnSave}
          isExpanded={true}
        />
      );

      const firstNameInput = screen.getByPlaceholderText('John');
      await userEvent.type(firstNameInput, 'Jane');

      expect(firstNameInput).toHaveValue('Jane');
    });

    it('allows entering last name', async () => {
      render(
        <PassengerForm
          passengerNumber={1}
          onSave={mockOnSave}
          isExpanded={true}
        />
      );

      const lastNameInput = screen.getByPlaceholderText('Doe');
      await userEvent.type(lastNameInput, 'Smith');

      expect(lastNameInput).toHaveValue('Smith');
    });

    it('allows selecting passenger type', () => {
      render(
        <PassengerForm
          passengerNumber={1}
          onSave={mockOnSave}
          isExpanded={true}
        />
      );

      // Click on Child type
      const childButton = screen.getByText(/Child/).closest('button');
      if (childButton) {
        fireEvent.click(childButton);
      }

      // Button should be selected (has primary styling)
      expect(childButton).toHaveClass('border-primary-500');
    });

    it('calls onRemove when Remove button is clicked', () => {
      render(
        <PassengerForm
          passenger={samplePassenger}
          passengerNumber={2}
          onSave={mockOnSave}
          onRemove={mockOnRemove}
        />
      );

      fireEvent.click(screen.getByText('Remove'));

      expect(mockOnRemove).toHaveBeenCalledWith(samplePassenger.id);
    });
  });

  describe('Form Validation', () => {
    it('shows error when first name is empty on save', async () => {
      render(
        <PassengerForm
          passengerNumber={1}
          onSave={mockOnSave}
          isExpanded={true}
        />
      );

      // Fill only last name
      const lastNameInput = screen.getByPlaceholderText('Doe');
      await userEvent.type(lastNameInput, 'Smith');

      // Click save
      fireEvent.click(screen.getByText('Save Passenger'));

      expect(screen.getByText('First name is required')).toBeInTheDocument();
      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('shows error when last name is empty on save', async () => {
      render(
        <PassengerForm
          passengerNumber={1}
          onSave={mockOnSave}
          isExpanded={true}
        />
      );

      // Fill only first name
      const firstNameInput = screen.getByPlaceholderText('John');
      await userEvent.type(firstNameInput, 'Jane');

      // Click save
      fireEvent.click(screen.getByText('Save Passenger'));

      expect(screen.getByText('Last name is required')).toBeInTheDocument();
      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('calls onSave with valid data', async () => {
      render(
        <PassengerForm
          passengerNumber={1}
          onSave={mockOnSave}
          isExpanded={true}
        />
      );

      // Fill required fields
      await userEvent.type(screen.getByPlaceholderText('John'), 'Jane');
      await userEvent.type(screen.getByPlaceholderText('Doe'), 'Smith');

      // Click save
      fireEvent.click(screen.getByText('Save Passenger'));

      expect(mockOnSave).toHaveBeenCalled();
      const savedData = mockOnSave.mock.calls[0][0];
      expect(savedData.firstName).toBe('Jane');
      expect(savedData.lastName).toBe('Smith');
      expect(savedData.type).toBe(PassengerType.ADULT);
    });
  });

  describe('Age Validation', () => {
    it('validates adult age limit', async () => {
      const { container } = render(
        <PassengerForm
          passengerNumber={1}
          onSave={mockOnSave}
          isExpanded={true}
          defaultType={PassengerType.ADULT}
        />
      );

      // Fill required fields
      await userEvent.type(screen.getByPlaceholderText('John'), 'Jane');
      await userEvent.type(screen.getByPlaceholderText('Doe'), 'Smith');

      // Set date of birth for a 10-year-old (too young for adult)
      const tenYearsAgo = new Date();
      tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
      // Find the date input by its type attribute
      const dateInputs = container.querySelectorAll('input[type="date"]');
      const dobInput = dateInputs[0]; // First date input is date of birth
      if (dobInput) {
        fireEvent.change(dobInput, { target: { value: tenYearsAgo.toISOString().split('T')[0] } });
      }

      // Click save
      fireEvent.click(screen.getByText('Save Passenger'));

      // Should show age validation error
      expect(screen.getByText(/Adults must be \d+\+ years old/)).toBeInTheDocument();
    });
  });

  describe('Pet Information', () => {
    it('shows pet fields when pet checkbox is checked', async () => {
      render(
        <PassengerForm
          passengerNumber={1}
          onSave={mockOnSave}
          isExpanded={true}
        />
      );

      // Check pet checkbox
      const petCheckbox = screen.getByLabelText(/Traveling with a pet/i);
      fireEvent.click(petCheckbox);

      // Should show pet fields
      expect(screen.getByText('Pet Type')).toBeInTheDocument();
      expect(screen.getByText('Cat')).toBeInTheDocument();
      expect(screen.getByText('Dog')).toBeInTheDocument();
      expect(screen.getByText('Small Animal')).toBeInTheDocument();
    });

    it('hides pet fields when pet checkbox is unchecked', () => {
      render(
        <PassengerForm
          passengerNumber={1}
          onSave={mockOnSave}
          isExpanded={true}
        />
      );

      // Pet fields should not be visible initially
      expect(screen.queryByText('Pet Type')).not.toBeInTheDocument();
    });

    it('allows selecting pet type', () => {
      render(
        <PassengerForm
          passengerNumber={1}
          onSave={mockOnSave}
          isExpanded={true}
        />
      );

      // Enable pet
      fireEvent.click(screen.getByLabelText(/Traveling with a pet/i));

      // Select cat
      const catButton = screen.getByText('Cat').closest('button');
      if (catButton) {
        fireEvent.click(catButton);
        expect(catButton).toHaveClass('border-primary-500');
      }
    });
  });

  describe('Optional Fields', () => {
    it('allows entering passport number', async () => {
      render(
        <PassengerForm
          passengerNumber={1}
          onSave={mockOnSave}
          isExpanded={true}
        />
      );

      const passportInput = screen.getByPlaceholderText('AB1234567');
      await userEvent.type(passportInput, 'XX9876543');

      expect(passportInput).toHaveValue('XX9876543');
    });

    it('allows entering special needs', async () => {
      render(
        <PassengerForm
          passengerNumber={1}
          onSave={mockOnSave}
          isExpanded={true}
        />
      );

      const specialNeedsInput = screen.getByPlaceholderText(/Wheelchair/);
      await userEvent.type(specialNeedsInput, 'Requires wheelchair assistance');

      expect(specialNeedsInput).toHaveValue('Requires wheelchair assistance');
    });

    it('allows entering nationality', async () => {
      render(
        <PassengerForm
          passengerNumber={1}
          onSave={mockOnSave}
          isExpanded={true}
        />
      );

      const nationalityInput = screen.getByPlaceholderText('Tunisian');
      await userEvent.type(nationalityInput, 'French');

      expect(nationalityInput).toHaveValue('French');
    });
  });

  describe('Default Type', () => {
    it('uses provided defaultType for new passenger', () => {
      render(
        <PassengerForm
          passengerNumber={1}
          onSave={mockOnSave}
          isExpanded={true}
          defaultType={PassengerType.CHILD}
        />
      );

      // Child button should be selected
      const childButton = screen.getByText(/Child/).closest('button');
      expect(childButton).toHaveClass('border-primary-500');
    });

    it('defaults to ADULT when no defaultType provided', () => {
      render(
        <PassengerForm
          passengerNumber={1}
          onSave={mockOnSave}
          isExpanded={true}
        />
      );

      // Adult button should be selected by default
      const adultButton = screen.getByText(/Adult/).closest('button');
      expect(adultButton).toHaveClass('border-primary-500');
    });
  });

  describe('Cancel Behavior', () => {
    it('shows Cancel button when editing existing passenger', () => {
      render(
        <PassengerForm
          passenger={samplePassenger}
          passengerNumber={1}
          onSave={mockOnSave}
          isExpanded={true}
        />
      );

      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('auto-saves on cancel if required fields are filled', async () => {
      render(
        <PassengerForm
          passenger={samplePassenger}
          passengerNumber={1}
          onSave={mockOnSave}
          isExpanded={true}
        />
      );

      // Modify name
      const firstNameInput = screen.getByPlaceholderText('John');
      await userEvent.clear(firstNameInput);
      await userEvent.type(firstNameInput, 'Jane');

      // Click cancel
      fireEvent.click(screen.getByText('Cancel'));

      expect(mockOnSave).toHaveBeenCalled();
    });
  });
});
