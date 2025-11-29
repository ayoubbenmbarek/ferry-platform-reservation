/**
 * Tests for VehicleCard component.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VehicleCard } from '../../components/VehicleCard';
import { VehicleType, VehicleInfo, VEHICLE_PRESETS } from '../../types/ferry';

describe('VehicleCard', () => {
  const mockOnSave = jest.fn();
  const mockOnCancel = jest.fn();
  const mockOnRemove = jest.fn();

  const sampleVehicle: VehicleInfo = {
    id: '1',
    type: VehicleType.CAR,
    length: 4.5,
    width: 1.8,
    height: 1.5,
    registration: 'ABC-123',
    make: 'Toyota',
    model: 'Camry',
  };

  beforeEach(() => {
    mockOnSave.mockClear();
    mockOnCancel.mockClear();
    mockOnRemove.mockClear();
  });

  describe('Display Mode (Collapsed)', () => {
    it('renders vehicle details in display mode', () => {
      render(
        <VehicleCard
          vehicle={sampleVehicle}
          onSave={mockOnSave}
        />
      );

      expect(screen.getByText('Standard Car')).toBeInTheDocument();
      expect(screen.getByText('4.5m × 1.8m × 1.5m')).toBeInTheDocument();
    });

    it('shows registration when provided', () => {
      render(
        <VehicleCard
          vehicle={sampleVehicle}
          onSave={mockOnSave}
        />
      );

      expect(screen.getByText(/Registration:/)).toBeInTheDocument();
      expect(screen.getByText(/ABC-123/)).toBeInTheDocument();
    });

    it('shows make and model when provided', () => {
      render(
        <VehicleCard
          vehicle={sampleVehicle}
          onSave={mockOnSave}
        />
      );

      expect(screen.getByText(/Vehicle:/)).toBeInTheDocument();
      expect(screen.getByText(/Toyota Camry/)).toBeInTheDocument();
    });

    it('shows Edit button', () => {
      render(
        <VehicleCard
          vehicle={sampleVehicle}
          onSave={mockOnSave}
        />
      );

      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    it('shows Remove button when onRemove is provided', () => {
      render(
        <VehicleCard
          vehicle={sampleVehicle}
          onSave={mockOnSave}
          onRemove={mockOnRemove}
        />
      );

      expect(screen.getByText('Remove')).toBeInTheDocument();
    });

    it('does not show Remove button when onRemove is not provided', () => {
      render(
        <VehicleCard
          vehicle={sampleVehicle}
          onSave={mockOnSave}
        />
      );

      expect(screen.queryByText('Remove')).not.toBeInTheDocument();
    });

    it('calls onRemove when Remove button is clicked', () => {
      render(
        <VehicleCard
          vehicle={sampleVehicle}
          onSave={mockOnSave}
          onRemove={mockOnRemove}
        />
      );

      fireEvent.click(screen.getByText('Remove'));

      expect(mockOnRemove).toHaveBeenCalledWith(sampleVehicle.id);
    });

    it('switches to edit mode when Edit is clicked', () => {
      render(
        <VehicleCard
          vehicle={sampleVehicle}
          onSave={mockOnSave}
        />
      );

      fireEvent.click(screen.getByText('Edit'));

      // Should now show form elements
      expect(screen.getByText('Edit Vehicle')).toBeInTheDocument();
      expect(screen.getByText('Vehicle Type')).toBeInTheDocument();
    });
  });

  describe('Edit Mode (Expanded)', () => {
    it('renders in edit mode for new vehicle', () => {
      render(
        <VehicleCard
          onSave={mockOnSave}
        />
      );

      // "Add Vehicle" appears as both h3 title and button text
      expect(screen.getByRole('heading', { name: 'Add Vehicle' })).toBeInTheDocument();
      expect(screen.getByText('Vehicle Type')).toBeInTheDocument();
    });

    it('renders all vehicle type options', () => {
      render(
        <VehicleCard
          onSave={mockOnSave}
        />
      );

      expect(screen.getByText('Standard Car')).toBeInTheDocument();
      expect(screen.getByText('SUV / 4x4')).toBeInTheDocument();
      expect(screen.getByText('Van / Minibus')).toBeInTheDocument();
      expect(screen.getByText('Motorcycle')).toBeInTheDocument();
      expect(screen.getByText('Motorhome / Camper')).toBeInTheDocument();
      expect(screen.getByText('Caravan / Trailer')).toBeInTheDocument();
      expect(screen.getByText('Truck / Lorry')).toBeInTheDocument();
    });

    it('shows dimension inputs', () => {
      render(
        <VehicleCard
          onSave={mockOnSave}
        />
      );

      expect(screen.getByText('Length (m)')).toBeInTheDocument();
      expect(screen.getByText('Width (m)')).toBeInTheDocument();
      expect(screen.getByText('Height (m)')).toBeInTheDocument();
    });

    it('shows optional detail inputs', () => {
      render(
        <VehicleCard
          onSave={mockOnSave}
        />
      );

      expect(screen.getByPlaceholderText('ABC-1234')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('1500')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Toyota')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Camry')).toBeInTheDocument();
    });

    it('defaults to CAR type with preset dimensions', () => {
      render(
        <VehicleCard
          onSave={mockOnSave}
        />
      );

      const carPreset = VEHICLE_PRESETS[VehicleType.CAR];

      // Check that Standard Car button is selected
      const carButton = screen.getByText('Standard Car').closest('button');
      expect(carButton).toHaveClass('border-primary-500');

      // Check dimension inputs have preset values
      const lengthInput = screen.getByDisplayValue(carPreset.length.toString());
      expect(lengthInput).toBeInTheDocument();
    });
  });

  describe('Vehicle Type Selection', () => {
    it('updates dimensions when vehicle type changes', () => {
      render(
        <VehicleCard
          onSave={mockOnSave}
        />
      );

      // Click on SUV type
      const suvButton = screen.getByText('SUV / 4x4').closest('button');
      if (suvButton) {
        fireEvent.click(suvButton);
      }

      const suvPreset = VEHICLE_PRESETS[VehicleType.SUV];

      // Check dimensions updated to SUV preset
      expect(screen.getByDisplayValue(suvPreset.length.toString())).toBeInTheDocument();
      expect(screen.getByDisplayValue(suvPreset.width.toString())).toBeInTheDocument();
      expect(screen.getByDisplayValue(suvPreset.height.toString())).toBeInTheDocument();
    });

    it('highlights selected vehicle type', () => {
      render(
        <VehicleCard
          onSave={mockOnSave}
        />
      );

      const vanButton = screen.getByText('Van / Minibus').closest('button');
      if (vanButton) {
        fireEvent.click(vanButton);
        expect(vanButton).toHaveClass('border-primary-500');
      }

      // Car should no longer be selected
      const carButton = screen.getByText('Standard Car').closest('button');
      expect(carButton).not.toHaveClass('border-primary-500');
    });
  });

  describe('Form Inputs', () => {
    it('allows editing length', async () => {
      render(
        <VehicleCard
          onSave={mockOnSave}
        />
      );

      const lengthInput = screen.getByDisplayValue('4.5');
      await userEvent.clear(lengthInput);
      await userEvent.type(lengthInput, '5.2');

      expect(lengthInput).toHaveValue(5.2);
    });

    it('allows editing width', async () => {
      render(
        <VehicleCard
          onSave={mockOnSave}
        />
      );

      const widthInput = screen.getByDisplayValue('1.8');
      await userEvent.clear(widthInput);
      await userEvent.type(widthInput, '2.1');

      expect(widthInput).toHaveValue(2.1);
    });

    it('allows editing height', async () => {
      render(
        <VehicleCard
          onSave={mockOnSave}
        />
      );

      const heightInput = screen.getByDisplayValue('1.5');
      await userEvent.clear(heightInput);
      await userEvent.type(heightInput, '1.7');

      expect(heightInput).toHaveValue(1.7);
    });

    it('allows entering registration', async () => {
      render(
        <VehicleCard
          onSave={mockOnSave}
        />
      );

      const regInput = screen.getByPlaceholderText('ABC-1234');
      await userEvent.type(regInput, 'XYZ-9876');

      expect(regInput).toHaveValue('XYZ-9876');
    });

    it('allows entering weight', async () => {
      render(
        <VehicleCard
          onSave={mockOnSave}
        />
      );

      const weightInput = screen.getByPlaceholderText('1500');
      await userEvent.type(weightInput, '1800');

      expect(weightInput).toHaveValue(1800);
    });

    it('allows entering make', async () => {
      render(
        <VehicleCard
          onSave={mockOnSave}
        />
      );

      const makeInput = screen.getByPlaceholderText('Toyota');
      await userEvent.type(makeInput, 'Honda');

      expect(makeInput).toHaveValue('Honda');
    });

    it('allows entering model', async () => {
      render(
        <VehicleCard
          onSave={mockOnSave}
        />
      );

      const modelInput = screen.getByPlaceholderText('Camry');
      await userEvent.type(modelInput, 'Civic');

      expect(modelInput).toHaveValue('Civic');
    });
  });

  describe('Save Behavior', () => {
    it('calls onSave with vehicle data when Add Vehicle is clicked', () => {
      render(
        <VehicleCard
          onSave={mockOnSave}
        />
      );

      // Use getByRole to specifically target the button
      const addButton = screen.getByRole('button', { name: 'Add Vehicle' });
      fireEvent.click(addButton);

      expect(mockOnSave).toHaveBeenCalled();
      const savedData = mockOnSave.mock.calls[0][0];
      expect(savedData.type).toBe(VehicleType.CAR);
      expect(savedData.length).toBe(VEHICLE_PRESETS[VehicleType.CAR].length);
      expect(savedData.width).toBe(VEHICLE_PRESETS[VehicleType.CAR].width);
      expect(savedData.height).toBe(VEHICLE_PRESETS[VehicleType.CAR].height);
    });

    it('calls onSave with updated data when Save Changes is clicked', async () => {
      render(
        <VehicleCard
          vehicle={sampleVehicle}
          onSave={mockOnSave}
        />
      );

      // Enter edit mode
      fireEvent.click(screen.getByText('Edit'));

      // Change registration
      const regInput = screen.getByDisplayValue('ABC-123');
      await userEvent.clear(regInput);
      await userEvent.type(regInput, 'NEW-456');

      // Save
      fireEvent.click(screen.getByText('Save Changes'));

      expect(mockOnSave).toHaveBeenCalled();
      const savedData = mockOnSave.mock.calls[0][0];
      expect(savedData.registration).toBe('NEW-456');
    });

    it('switches back to display mode after saving', () => {
      render(
        <VehicleCard
          vehicle={sampleVehicle}
          onSave={mockOnSave}
        />
      );

      // Enter edit mode
      fireEvent.click(screen.getByText('Edit'));

      // Save
      fireEvent.click(screen.getByText('Save Changes'));

      // Should be back in display mode
      expect(screen.queryByText('Save Changes')).not.toBeInTheDocument();
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });
  });

  describe('Cancel Behavior', () => {
    it('shows Cancel button in edit mode', () => {
      render(
        <VehicleCard
          onSave={mockOnSave}
        />
      );

      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('restores original values when Cancel is clicked on existing vehicle', async () => {
      render(
        <VehicleCard
          vehicle={sampleVehicle}
          onSave={mockOnSave}
        />
      );

      // Enter edit mode
      fireEvent.click(screen.getByText('Edit'));

      // Change registration
      const regInput = screen.getByDisplayValue('ABC-123');
      await userEvent.clear(regInput);
      await userEvent.type(regInput, 'CHANGED');

      // Cancel
      fireEvent.click(screen.getByText('Cancel'));

      // Should be back in display mode with original registration
      expect(screen.getByText(/ABC-123/)).toBeInTheDocument();
    });

    it('calls onCancel when provided for new vehicle', () => {
      render(
        <VehicleCard
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      fireEvent.click(screen.getByText('Cancel'));

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  describe('Vehicle Type Icons', () => {
    const iconTests = [
      { type: VehicleType.CAR, label: 'Standard Car', icon: '🚗' },
      { type: VehicleType.SUV, label: 'SUV / 4x4', icon: '🚙' },
      { type: VehicleType.MOTORCYCLE, label: 'Motorcycle', icon: '🏍️' },
    ];

    iconTests.forEach(({ type, label, icon }) => {
      it(`shows correct icon for ${type}`, () => {
        const vehicle: VehicleInfo = {
          ...sampleVehicle,
          type,
        };

        render(
          <VehicleCard
            vehicle={vehicle}
            onSave={mockOnSave}
          />
        );

        expect(screen.getByText(icon)).toBeInTheDocument();
      });
    });
  });

  describe('Different Vehicle Types', () => {
    Object.entries(VEHICLE_PRESETS).forEach(([type, preset]) => {
      it(`correctly displays ${preset.label}`, () => {
        const vehicle: VehicleInfo = {
          id: '1',
          type: type as VehicleType,
          length: preset.length,
          width: preset.width,
          height: preset.height,
        };

        render(
          <VehicleCard
            vehicle={vehicle}
            onSave={mockOnSave}
          />
        );

        expect(screen.getByText(preset.label)).toBeInTheDocument();
        expect(screen.getByText(`${preset.length}m × ${preset.width}m × ${preset.height}m`)).toBeInTheDocument();
      });
    });
  });
});
