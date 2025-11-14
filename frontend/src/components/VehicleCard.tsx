import React, { useState } from 'react';
import { VehicleType, VehicleInfo, VEHICLE_PRESETS } from '../types/ferry';

interface VehicleCardProps {
  vehicle?: VehicleInfo;
  onSave: (vehicle: VehicleInfo) => void;
  onCancel?: () => void;
  onRemove?: (id: string) => void;
}

export const VehicleCard: React.FC<VehicleCardProps> = ({ vehicle, onSave, onCancel, onRemove }) => {
  const [isEditing, setIsEditing] = useState(!vehicle);
  const [formData, setFormData] = useState<Partial<VehicleInfo>>(
    vehicle || {
      id: Date.now().toString(),
      type: VehicleType.CAR,
      length: VEHICLE_PRESETS[VehicleType.CAR].length,
      width: VEHICLE_PRESETS[VehicleType.CAR].width,
      height: VEHICLE_PRESETS[VehicleType.CAR].height,
    }
  );

  const handleTypeChange = (type: VehicleType) => {
    const preset = VEHICLE_PRESETS[type];
    setFormData({
      ...formData,
      type,
      length: preset.length,
      width: preset.width,
      height: preset.height,
    });
  };

  const handleSave = () => {
    if (formData.type && formData.length && formData.width && formData.height) {
      onSave(formData as VehicleInfo);
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    if (vehicle) {
      setFormData(vehicle);
      setIsEditing(false);
    } else if (onCancel) {
      onCancel();
    }
  };

  if (!isEditing && vehicle) {
    // Display mode
    const preset = VEHICLE_PRESETS[vehicle.type];
    return (
      <div className="bg-white rounded-lg shadow-md p-4 border-2 border-gray-200 hover:border-primary-500 transition-colors">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <span className="text-3xl">{preset.icon}</span>
            <div>
              <h3 className="font-semibold text-gray-900">{preset.label}</h3>
              <p className="text-sm text-gray-600">
                {vehicle.length}m × {vehicle.width}m × {vehicle.height}m
              </p>
            </div>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setIsEditing(true)}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              Edit
            </button>
            {onRemove && (
              <button
                onClick={() => onRemove(vehicle.id)}
                className="text-red-600 hover:text-red-800 text-sm font-medium"
              >
                Remove
              </button>
            )}
          </div>
        </div>
        {vehicle.registration && (
          <p className="text-sm text-gray-600">
            <span className="font-medium">Registration:</span> {vehicle.registration}
          </p>
        )}
        {vehicle.make && vehicle.model && (
          <p className="text-sm text-gray-600">
            <span className="font-medium">Vehicle:</span> {vehicle.make} {vehicle.model}
          </p>
        )}
      </div>
    );
  }

  // Edit mode
  return (
    <div className="bg-white rounded-lg shadow-md p-6 border-2 border-primary-300">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        {vehicle ? 'Edit Vehicle' : 'Add Vehicle'}
      </h3>

      {/* Vehicle Type Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">Vehicle Type</label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(VEHICLE_PRESETS).map(([type, preset]) => (
            <button
              key={type}
              type="button"
              onClick={() => handleTypeChange(type as VehicleType)}
              className={`p-3 rounded-lg border-2 transition-all ${
                formData.type === type
                  ? 'border-primary-500 bg-primary-50 shadow-md'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <div className="text-2xl mb-1">{preset.icon}</div>
              <div className="text-xs font-medium text-gray-700">{preset.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Dimensions */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Dimensions</label>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Length (m)</label>
            <input
              type="number"
              step="0.1"
              value={formData.length}
              onChange={(e) => setFormData({ ...formData, length: parseFloat(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Width (m)</label>
            <input
              type="number"
              step="0.1"
              value={formData.width}
              onChange={(e) => setFormData({ ...formData, width: parseFloat(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Height (m)</label>
            <input
              type="number"
              step="0.1"
              value={formData.height}
              onChange={(e) => setFormData({ ...formData, height: parseFloat(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      </div>

      {/* Optional Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm text-gray-700 mb-1">Registration (optional)</label>
          <input
            type="text"
            value={formData.registration || ''}
            onChange={(e) => setFormData({ ...formData, registration: e.target.value })}
            placeholder="ABC-1234"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">Weight (kg, optional)</label>
          <input
            type="number"
            value={formData.weight || ''}
            onChange={(e) => setFormData({ ...formData, weight: parseFloat(e.target.value) })}
            placeholder="1500"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">Make (optional)</label>
          <input
            type="text"
            value={formData.make || ''}
            onChange={(e) => setFormData({ ...formData, make: e.target.value })}
            placeholder="Toyota"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">Model (optional)</label>
          <input
            type="text"
            value={formData.model || ''}
            onChange={(e) => setFormData({ ...formData, model: e.target.value })}
            placeholder="Camry"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={handleCancel}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 font-medium"
        >
          {vehicle ? 'Save Changes' : 'Add Vehicle'}
        </button>
      </div>
    </div>
  );
};

export default VehicleCard;