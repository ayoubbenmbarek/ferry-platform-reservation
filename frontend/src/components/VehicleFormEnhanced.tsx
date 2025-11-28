import React, { useState, useEffect } from 'react';
import axios from 'axios';

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

interface VehicleMake {
  id: number;
  name: string;
}

interface VehicleModel {
  id: number;
  make_id: number;
  name: string;
  avg_length_cm?: number;
  avg_width_cm?: number;
  avg_height_cm?: number;
}

const VehicleFormEnhanced: React.FC<VehicleFormProps> = ({
  vehicle,
  vehicleNumber,
  onSave,
  onRemove,
  isExpanded = false,
}) => {
  const [expanded, setExpanded] = useState(isExpanded);
  const [formData, setFormData] = useState<VehicleFormData>(vehicle);
  const [hasChanges, setHasChanges] = useState(false);

  // License plate lookup state
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Make/Model state
  const [makes, setMakes] = useState<VehicleMake[]>([]);
  const [models, setModels] = useState<VehicleModel[]>([]);
  const [selectedMakeId, setSelectedMakeId] = useState<number | null>(null);
  const [useDropdowns, setUseDropdowns] = useState(false);

  // Track if form was just collapsed
  const prevExpandedRef = React.useRef(expanded);

  // Fetch vehicle makes on component mount
  useEffect(() => {
    const fetchMakes = async () => {
      try {
        const response = await axios.get('/api/v1/vehicles/makes');
        setMakes(response.data);
      } catch (error) {
        console.error('Failed to fetch vehicle makes:', error);
      }
    };
    fetchMakes();
  }, []);

  // Fetch models when make is selected
  useEffect(() => {
    const fetchModels = async () => {
      if (selectedMakeId) {
        try {
          const response = await axios.get(`/api/v1/vehicles/makes/${selectedMakeId}/models`);
          setModels(response.data);
        } catch (error) {
          console.error('Failed to fetch vehicle models:', error);
        }
      } else {
        setModels([]);
      }
    };
    fetchModels();
  }, [selectedMakeId]);

  // Auto-save on collapse
  useEffect(() => {
    const isCollapsing = prevExpandedRef.current && !expanded;
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

  const handleLicensePlateLookup = async () => {
    if (!formData.registration?.trim()) {
      setLookupError('Please enter a registration number first');
      return;
    }

    setLookupLoading(true);
    setLookupError(null);

    try {
      const response = await axios.get(`/api/v1/vehicles/lookup/${formData.registration}`);
      const data = response.data;

      // Update form with looked up data
      if (data.make) {
        handleChange('make', data.make);
      }
      if (data.model) {
        handleChange('model', data.model);
      }
      if (data.suggested_length_cm) {
        handleChange('length', data.suggested_length_cm);
      }
      if (data.suggested_width_cm) {
        handleChange('width', data.suggested_width_cm);
      }
      if (data.suggested_height_cm) {
        handleChange('height', data.suggested_height_cm);
      }

      setLookupError(null);
    } catch (error: any) {
      setLookupError('Failed to lookup license plate. Please enter details manually.');
      console.error('License plate lookup error:', error);
    } finally {
      setLookupLoading(false);
    }
  };

  const handleMakeChange = (makeId: number) => {
    setSelectedMakeId(makeId);
    const make = makes.find(m => m.id === makeId);
    if (make) {
      handleChange('make', make.name);
    }
    // Reset model when make changes
    handleChange('model', '');
  };

  const handleModelChange = (modelId: number) => {
    const model = models.find(m => m.id === modelId);
    if (model) {
      handleChange('model', model.name);

      // Auto-fill dimensions if available
      if (model.avg_length_cm) {
        handleChange('length', model.avg_length_cm);
      }
      if (model.avg_width_cm) {
        handleChange('width', model.avg_width_cm);
      }
      if (model.avg_height_cm) {
        handleChange('height', model.avg_height_cm);
      }
    }
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

          {/* Registration Number with Lookup */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Registration Number <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={formData.registration || ''}
                onChange={(e) => handleChange('registration', e.target.value.toUpperCase())}
                placeholder="ABC-123"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleLicensePlateLookup}
                disabled={lookupLoading || !formData.registration?.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {lookupLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Looking up...
                  </>
                ) : (
                  <>
                    🔍 Lookup
                  </>
                )}
              </button>
            </div>
            {lookupError && (
              <p className="text-sm text-yellow-600 mt-1">ℹ️ {lookupError}</p>
            )}
          </div>

          {/* Owner */}
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

          {/* Make/Model Selection Toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id={`use-dropdowns-${vehicle.id}`}
              checked={useDropdowns}
              onChange={(e) => setUseDropdowns(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor={`use-dropdowns-${vehicle.id}`} className="text-sm text-gray-700">
              Select from vehicle database (auto-fills dimensions)
            </label>
          </div>

          {/* Make & Model - Dropdown or Text Input */}
          {useDropdowns ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Make
                </label>
                <select
                  value={selectedMakeId || ''}
                  onChange={(e) => handleMakeChange(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select make...</option>
                  {makes.map((make) => (
                    <option key={make.id} value={make.id}>
                      {make.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Model
                </label>
                <select
                  value={formData.model || ''}
                  onChange={(e) => {
                    const modelId = parseInt(e.target.value);
                    if (modelId) handleModelChange(modelId);
                  }}
                  disabled={!selectedMakeId}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                >
                  <option value="">Select model...</option>
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
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
          )}

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
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!formData.registration?.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Save Vehicle
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VehicleFormEnhanced;
