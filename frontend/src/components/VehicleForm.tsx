import React, { useState, useEffect } from 'react';

export interface VehicleFormData {
  id: string;
  type: string;
  registration?: string;
  make?: string;
  model?: string;
  owner?: string;
  length: number;
  width: number;
  height: number;
  hasTrailer?: boolean;
  hasCaravan?: boolean;
  hasRoofBox?: boolean;
  hasBikeRack?: boolean;
}

interface VehicleFormProps {
  vehicle: VehicleFormData;
  vehicleNumber: number;
  onSave: (vehicle: VehicleFormData) => void;
  onRemove?: (vehicleId: string) => void;
  isExpanded?: boolean;
}

const VehicleForm: React.FC<VehicleFormProps> = ({
  vehicle,
  vehicleNumber,
  onSave,
  onRemove,
  isExpanded = false,
}) => {
  const [expanded, setExpanded] = useState(isExpanded);
  const [formData, setFormData] = useState<VehicleFormData>(vehicle);
  const [hasChanges, setHasChanges] = useState(false);

  // Track if form was just collapsed
  const prevExpandedRef = React.useRef(expanded);

  useEffect(() => {
    const isCollapsing = prevExpandedRef.current && !expanded;

    // Auto-save when collapsing if there are required fields filled
    if (isCollapsing && formData.registration?.trim()) {
      onSave(formData);
      setHasChanges(false);
    }

    prevExpandedRef.current = expanded;
  }, [expanded, formData, onSave]);

  const handleChange = (field: keyof VehicleFormData, value: any) => {
    setFormData({ ...formData, [field]: value });
    setHasChanges(true);
  };

  const handleSave = () => {
    onSave(formData);
    setHasChanges(false);
    setExpanded(false);
  };

  const handleRemove = () => {
    if (onRemove) {
      onRemove(vehicle.id);
    }
  };

  const isComplete = formData.registration?.trim();

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header - Always visible */}
      <div
        className={`p-4 cursor-pointer transition-colors ${
          expanded ? 'bg-blue-50 border-b border-blue-200' : 'bg-gray-50 hover:bg-gray-100'
        }`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold ${
                isComplete ? 'bg-green-500' : 'bg-gray-400'
              }`}
            >
              {vehicleNumber}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">
                🚗 Vehicle {vehicleNumber}
                {isComplete && <span className="ml-2 text-green-600">✓</span>}
              </h3>
              {formData.registration && (
                <p className="text-sm text-gray-600">
                  {formData.registration} • {formData.make} {formData.model}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {isComplete && !expanded && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded(true);
                }}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                Edit
              </button>
            )}
            {onRemove && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove();
                }}
                className="text-red-600 hover:text-red-700 text-sm font-medium"
              >
                Remove
              </button>
            )}
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${
                expanded ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Form Content - Expandable */}
      {expanded && (
        <div className="p-6 bg-white space-y-6">
          {/* Vehicle Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vehicle Type <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.type}
              onChange={(e) => handleChange('type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="car">🚗 Car</option>
              <option value="suv">🚙 SUV / 4x4</option>
              <option value="van">🚐 Van / Utility</option>
              <option value="motorcycle">🏍️ Motorcycle</option>
              <option value="camper">🚌 Camper</option>
              <option value="caravan">🏕️ Caravan</option>
              <option value="truck">🚚 Truck</option>
            </select>
          </div>

          {/* Registration & Owner */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Registration Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.registration || ''}
                onChange={(e) => handleChange('registration', e.target.value)}
                placeholder="ABC-123"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Owner Name
              </label>
              <input
                type="text"
                value={formData.owner || ''}
                onChange={(e) => handleChange('owner', e.target.value)}
                placeholder="John Doe"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Make & Model */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Make
              </label>
              <input
                type="text"
                value={formData.make || ''}
                onChange={(e) => handleChange('make', e.target.value)}
                placeholder="Toyota"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Model
              </label>
              <input
                type="text"
                value={formData.model || ''}
                onChange={(e) => handleChange('model', e.target.value)}
                placeholder="Camry"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Dimensions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Vehicle Dimensions (cm)
            </label>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Length</label>
                <input
                  type="number"
                  value={formData.length}
                  onChange={(e) => handleChange('length', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Width</label>
                <input
                  type="number"
                  value={formData.width}
                  onChange={(e) => handleChange('width', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Height</label>
                <input
                  type="number"
                  value={formData.height}
                  onChange={(e) => handleChange('height', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Accessories */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Accessories
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.hasTrailer || false}
                  onChange={(e) => handleChange('hasTrailer', e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">🚚 Trailer</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.hasCaravan || false}
                  onChange={(e) => handleChange('hasCaravan', e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">🏕️ Caravan</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.hasRoofBox || false}
                  onChange={(e) => handleChange('hasRoofBox', e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">📦 Roof Box</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.hasBikeRack || false}
                  onChange={(e) => handleChange('hasBikeRack', e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">🚴 Bike Rack</span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              <span className="text-red-500">*</span> Required fields
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setFormData(vehicle);
                  setExpanded(false);
                  setHasChanges(false);
                }}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.registration?.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {hasChanges ? 'Save Vehicle' : 'Saved ✓'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VehicleForm;
