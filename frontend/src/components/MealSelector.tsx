import React from 'react';
import { useTranslation } from 'react-i18next';

interface MealSelection {
  meal_id: number;
  quantity: number;
  dietary_type?: string;
  special_requests?: string;
  journey_type?: 'outbound' | 'return';
}

interface MealSelectorProps {
  selectedMeals: MealSelection[];
  onMealSelect: (meals: MealSelection[], totalPrice: number) => void;
  passengerCount: number;
  isRoundTrip?: boolean;
}

/**
 * MealSelector - Informational component about onboard dining
 *
 * Note: Meal pre-booking is not available through FerryHopper API.
 * Passengers can purchase meals directly on board the ferry.
 */
const MealSelector: React.FC<MealSelectorProps> = ({
  selectedMeals,
  onMealSelect,
  passengerCount,
  isRoundTrip = false,
}) => {
  const { t } = useTranslation(['booking', 'common']);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{t('booking:meals.title', 'Meals & Dining')}</h3>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🍽️</span>
          <div>
            <h4 className="font-medium text-blue-900 mb-1">Onboard Dining Available</h4>
            <p className="text-sm text-blue-800">
              A variety of dining options are available on board, including restaurants, cafeterias, and bars.
              Meals can be purchased directly during your journey.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <span className="text-3xl mb-2 block">🍳</span>
          <h5 className="font-medium text-gray-900">Breakfast</h5>
          <p className="text-xs text-gray-600 mt-1">Continental & hot options</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <span className="text-3xl mb-2 block">🍽️</span>
          <h5 className="font-medium text-gray-900">Lunch & Dinner</h5>
          <p className="text-xs text-gray-600 mt-1">Restaurant & self-service</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <span className="text-3xl mb-2 block">☕</span>
          <h5 className="font-medium text-gray-900">Snacks & Drinks</h5>
          <p className="text-xs text-gray-600 mt-1">Bars & cafeterias</p>
        </div>
      </div>

      <p className="text-xs text-gray-500 text-center">
        Dietary requirements (vegetarian, halal, gluten-free, etc.) can usually be accommodated.
        Please inquire at the onboard restaurant.
      </p>
    </div>
  );
};

export default MealSelector;
