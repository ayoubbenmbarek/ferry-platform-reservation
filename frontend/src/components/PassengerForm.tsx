import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PassengerInfo, PassengerType, PetType, PASSENGER_AGE_LIMITS } from '../types/ferry';

interface PassengerFormProps {
  passenger?: PassengerInfo;
  passengerNumber: number;
  onSave: (passenger: PassengerInfo) => void;
  onRemove?: (id: string) => void;
  isExpanded?: boolean;
  defaultType?: PassengerType;
}

export const PassengerForm: React.FC<PassengerFormProps> = ({
  passenger,
  passengerNumber,
  onSave,
  onRemove,
  isExpanded = false,
  defaultType = PassengerType.ADULT,
}) => {
  const { t } = useTranslation(['booking', 'common']);
  const [expanded, setExpanded] = useState(isExpanded || !passenger);
  const [formData, setFormData] = useState<Partial<PassengerInfo>>(
    passenger || {
      id: Date.now().toString() + passengerNumber,
      type: defaultType,
      firstName: '',
      lastName: '',
    }
  );

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Track previous expanded state to detect collapse
  const prevExpandedRef = React.useRef(expanded);

  // Sync internal expanded state with parent's isExpanded prop and auto-save on collapse
  React.useEffect(() => {
    // Check if form is being collapsed (was expanded, now not expanded)
    const isCollapsing = prevExpandedRef.current && !isExpanded;

    if (isCollapsing) {
      // Auto-save if required fields are filled
      if (formData.firstName?.trim() && formData.lastName?.trim() && formData.type) {
        // Don't validate strictly on auto-save, just save the data
        onSave(formData as PassengerInfo);
      }
    }

    // Update expanded state
    setExpanded(isExpanded);
    prevExpandedRef.current = isExpanded;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName?.trim()) {
      newErrors.firstName = t('booking:passengerDetails.firstNameRequired');
    }
    if (!formData.lastName?.trim()) {
      newErrors.lastName = t('booking:passengerDetails.lastNameRequired');
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

  const handleCancel = () => {
    // Auto-save before closing if required fields are filled
    if (formData.firstName?.trim() && formData.lastName?.trim() && formData.type) {
      onSave(formData as PassengerInfo);
    }
    setExpanded(false);
  };

  const getPassengerTypeLabel = (type: PassengerType): string => {
    switch (type) {
      case PassengerType.ADULT:
        return t('booking:passengerDetails.adultLabel', { min: PASSENGER_AGE_LIMITS.ADULT_MIN_AGE });
      case PassengerType.CHILD:
        return t('booking:passengerDetails.childLabel', { min: PASSENGER_AGE_LIMITS.INFANT_MAX_AGE + 1, max: PASSENGER_AGE_LIMITS.CHILD_MAX_AGE });
      case PassengerType.INFANT:
        return t('booking:passengerDetails.infantLabel', { max: PASSENGER_AGE_LIMITS.INFANT_MAX_AGE });
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
                {t('booking:passengerDetails.passenger')} {passengerNumber}: {passenger.firstName} {passenger.lastName}
              </h4>
              <p className="text-sm text-gray-600">{getPassengerTypeLabel(passenger.type)}</p>
            </div>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setExpanded(true)}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              {t('common:edit')}
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
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('booking:passengerDetails.passenger')} {passengerNumber}</h3>

      {/* Passenger Type */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('booking:passengerDetails.passengerType')}</label>
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
            {t('booking:passengerDetails.firstName')} <span className="text-red-500">*</span>
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
            {t('booking:passengerDetails.lastName')} <span className="text-red-500">*</span>
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
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('booking:passengerDetails.dateOfBirth')}</label>
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
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('booking:passengerDetails.nationality')}</label>
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
        <h4 className="text-sm font-medium text-gray-700 mb-3">{t('booking:passengerDetails.travelDocuments')}</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">{t('booking:passengerDetails.passportNumber')}</label>
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
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('booking:passengerDetails.specialNeeds')}</label>
        <textarea
          value={formData.specialNeeds || ''}
          onChange={(e) => setFormData({ ...formData, specialNeeds: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          rows={2}
          placeholder={t('booking:passengerDetails.specialNeedsPlaceholder')}
        />
      </div>

      {/* Pet Information */}
      <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-center mb-3">
          <input
            type="checkbox"
            id={`pet-toggle-${passengerNumber}`}
            checked={formData.hasPet || false}
            onChange={(e) => setFormData({
              ...formData,
              hasPet: e.target.checked,
              // Reset pet fields if unchecked
              ...(e.target.checked ? {} : { petType: undefined, petName: '', petWeightKg: undefined, petCarrierProvided: false })
            })}
            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
          />
          <label htmlFor={`pet-toggle-${passengerNumber}`} className="ml-2 text-sm font-medium text-gray-700">
            {t('booking:passengerDetails.travelingWithPet')}
          </label>
        </div>

        {formData.hasPet && (
          <div className="space-y-4 mt-3 pt-3 border-t border-blue-200">
            {/* Pet Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Pet Type <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, petType: PetType.CAT })}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    formData.petType === PetType.CAT
                      ? 'border-primary-500 bg-primary-50 shadow-md'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="text-2xl mb-1">🐱</div>
                  <div className="text-xs font-medium text-gray-700">Cat</div>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, petType: PetType.SMALL_ANIMAL })}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    formData.petType === PetType.SMALL_ANIMAL
                      ? 'border-primary-500 bg-primary-50 shadow-md'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="text-2xl mb-1">🐹</div>
                  <div className="text-xs font-medium text-gray-700">Small Animal</div>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, petType: PetType.DOG })}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    formData.petType === PetType.DOG
                      ? 'border-primary-500 bg-primary-50 shadow-md'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="text-2xl mb-1">🐕</div>
                  <div className="text-xs font-medium text-gray-700">Dog</div>
                </button>
              </div>
            </div>

            {/* Pet Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Pet Name</label>
                <input
                  type="text"
                  value={formData.petName || ''}
                  onChange={(e) => setFormData({ ...formData, petName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Fluffy"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Pet Weight (kg)</label>
                <input
                  type="number"
                  value={formData.petWeightKg || ''}
                  onChange={(e) => setFormData({ ...formData, petWeightKg: e.target.value ? parseFloat(e.target.value) : undefined })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="5"
                  min="0"
                  step="0.1"
                />
              </div>
            </div>

            {/* Pet Carrier */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id={`pet-carrier-${passengerNumber}`}
                checked={formData.petCarrierProvided || false}
                onChange={(e) => setFormData({ ...formData, petCarrierProvided: e.target.checked })}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor={`pet-carrier-${passengerNumber}`} className="ml-2 text-sm text-gray-700">
                I will provide a pet carrier/crate
              </label>
            </div>

            <p className="text-xs text-gray-500 mt-2">
              Note: Pets must remain in their carrier during the journey. Additional fees may apply.
            </p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-3">
        {passenger && (
          <button
            type="button"
            onClick={handleCancel}
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
          {passenger ? t('booking:passengerDetails.saveChanges') : t('booking:passengerDetails.savePassenger')}
        </button>
      </div>
    </div>
  );
};

export default PassengerForm;