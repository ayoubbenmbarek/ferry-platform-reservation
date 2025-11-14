import React, { useState } from 'react';
import { PassengerInfo, PassengerType, PASSENGER_AGE_LIMITS } from '../types/ferry';

interface PassengerFormProps {
  passenger?: PassengerInfo;
  passengerNumber: number;
  onSave: (passenger: PassengerInfo) => void;
  onRemove?: (id: string) => void;
  isExpanded?: boolean;
}

export const PassengerForm: React.FC<PassengerFormProps> = ({
  passenger,
  passengerNumber,
  onSave,
  onRemove,
  isExpanded = false,
}) => {
  const [expanded, setExpanded] = useState(isExpanded || !passenger);
  const [formData, setFormData] = useState<Partial<PassengerInfo>>(
    passenger || {
      id: Date.now().toString() + passengerNumber,
      type: PassengerType.ADULT,
      firstName: '',
      lastName: '',
    }
  );

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName?.trim()) {
      newErrors.firstName = 'First name is required';
    }
    if (!formData.lastName?.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    if (formData.dateOfBirth) {
      const age = calculateAge(formData.dateOfBirth);
      if (formData.type === PassengerType.ADULT && age < PASSENGER_AGE_LIMITS.ADULT_MIN_AGE) {
        newErrors.dateOfBirth = `Adults must be ${PASSENGER_AGE_LIMITS.ADULT_MIN_AGE}+ years old`;
      }
      if (formData.type === PassengerType.CHILD && (age > PASSENGER_AGE_LIMITS.CHILD_MAX_AGE || age < PASSENGER_AGE_LIMITS.INFANT_MAX_AGE + 1)) {
        newErrors.dateOfBirth = `Children must be ${PASSENGER_AGE_LIMITS.INFANT_MAX_AGE + 1}-${PASSENGER_AGE_LIMITS.CHILD_MAX_AGE} years old`;
      }
      if (formData.type === PassengerType.INFANT && age > PASSENGER_AGE_LIMITS.INFANT_MAX_AGE) {
        newErrors.dateOfBirth = `Infants must be 0-${PASSENGER_AGE_LIMITS.INFANT_MAX_AGE} years old`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const calculateAge = (dateOfBirth: string): number => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const handleSave = () => {
    if (validate() && formData.firstName && formData.lastName && formData.type) {
      onSave(formData as PassengerInfo);
      setExpanded(false);
    }
  };

  const getPassengerTypeLabel = (type: PassengerType): string => {
    switch (type) {
      case PassengerType.ADULT:
        return `Adult (${PASSENGER_AGE_LIMITS.ADULT_MIN_AGE}+ years)`;
      case PassengerType.CHILD:
        return `Child (${PASSENGER_AGE_LIMITS.INFANT_MAX_AGE + 1}-${PASSENGER_AGE_LIMITS.CHILD_MAX_AGE} years)`;
      case PassengerType.INFANT:
        return `Infant (0-${PASSENGER_AGE_LIMITS.INFANT_MAX_AGE} years)`;
      default:
        return type;
    }
  };

  const getPassengerIcon = (type: PassengerType): string => {
    switch (type) {
      case PassengerType.ADULT:
        return '👤';
      case PassengerType.CHILD:
        return '🧒';
      case PassengerType.INFANT:
        return '👶';
      default:
        return '👤';
    }
  };

  if (!expanded && passenger && formData.firstName && formData.lastName) {
    // Collapsed view
    return (
      <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200 hover:border-primary-300 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">{getPassengerIcon(passenger.type)}</span>
            <div>
              <h4 className="font-medium text-gray-900">
                Passenger {passengerNumber}: {passenger.firstName} {passenger.lastName}
              </h4>
              <p className="text-sm text-gray-600">{getPassengerTypeLabel(passenger.type)}</p>
            </div>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setExpanded(true)}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              Edit
            </button>
            {onRemove && passengerNumber > 1 && (
              <button
                onClick={() => onRemove(passenger.id)}
                className="text-red-600 hover:text-red-800 text-sm font-medium"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Expanded form view
  return (
    <div className="bg-white rounded-lg shadow-md p-6 border-2 border-primary-300">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Passenger {passengerNumber}</h3>

      {/* Passenger Type */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Passenger Type</label>
        <div className="grid grid-cols-3 gap-3">
          {Object.values(PassengerType).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setFormData({ ...formData, type })}
              className={`p-3 rounded-lg border-2 transition-all ${
                formData.type === type
                  ? 'border-primary-500 bg-primary-50 shadow-md'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <div className="text-2xl mb-1">{getPassengerIcon(type)}</div>
              <div className="text-xs font-medium text-gray-700">{getPassengerTypeLabel(type)}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Personal Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            First Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.firstName || ''}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${
              errors.firstName ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="John"
          />
          {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Last Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.lastName || ''}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${
              errors.lastName ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Doe"
          />
          {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth (optional)</label>
          <input
            type="date"
            value={formData.dateOfBirth || ''}
            onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${
              errors.dateOfBirth ? 'border-red-500' : 'border-gray-300'
            }`}
            max={new Date().toISOString().split('T')[0]}
          />
          {errors.dateOfBirth && <p className="text-red-500 text-xs mt-1">{errors.dateOfBirth}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nationality (optional)</label>
          <input
            type="text"
            value={formData.nationality || ''}
            onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Tunisian"
          />
        </div>
      </div>

      {/* Travel Documents (optional) */}
      <div className="mb-4 p-4 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Travel Documents (Optional)</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Passport Number</label>
            <input
              type="text"
              value={formData.passportNumber || ''}
              onChange={(e) => setFormData({ ...formData, passportNumber: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="AB1234567"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Document Expiry Date</label>
            <input
              type="date"
              value={formData.documentExpiry || ''}
              onChange={(e) => setFormData({ ...formData, documentExpiry: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              min={new Date().toISOString().split('T')[0]}
            />
          </div>
        </div>
      </div>

      {/* Special Needs */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Special Needs (optional)</label>
        <textarea
          value={formData.specialNeeds || ''}
          onChange={(e) => setFormData({ ...formData, specialNeeds: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          rows={2}
          placeholder="Wheelchair access, dietary requirements, etc."
        />
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-3">
        {passenger && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 font-medium"
        >
          {passenger ? 'Save Changes' : 'Save Passenger'}
        </button>
      </div>
    </div>
  );
};

export default PassengerForm;