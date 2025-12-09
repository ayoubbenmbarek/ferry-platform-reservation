import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

interface Meal {
  id: number;
  name: string;
  description: string;
  meal_type: string;
  price: number;
  currency: string;
  is_available: boolean;
  dietary_types: string | null;
  operator: string | null;
}

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

const MealSelector: React.FC<MealSelectorProps> = ({
  selectedMeals,
  onMealSelect,
  passengerCount,
  isRoundTrip = false,
}) => {
  const { t } = useTranslation(['booking', 'common']);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedMeal, setExpandedMeal] = useState<number | null>(null);
  const [selectedJourney, setSelectedJourney] = useState<'outbound' | 'return'>('outbound');

  useEffect(() => {
    fetchMeals();
  }, []);

  const fetchMeals = async () => {
    try {
      setLoading(true);
      const response = await api.get('/meals', {
        params: {
          is_available: true,
        },
      });
      setMeals(response.data);
    } catch (err: any) {
      setError('Failed to load meal options');
      console.error('Error fetching meals:', err);
    } finally {
      setLoading(false);
    }
  };

  const getMealIcon = (mealType: string) => {
    switch (mealType.toUpperCase()) {
      case 'BREAKFAST':
        return '🍳';
      case 'LUNCH':
        return '🍽️';
      case 'DINNER':
        return '🍷';
      case 'SNACK':
        return '🍿';
      case 'BUFFET':
        return '🍱';
      default:
        return '🍴';
    }
  };

  const getMealTypeName = (mealType: string) => {
    const names: { [key: string]: string } = {
      BREAKFAST: 'Breakfast',
      LUNCH: 'Lunch',
      DINNER: 'Dinner',
      SNACK: 'Snack',
      BUFFET: 'Buffet',
    };
    return names[mealType.toUpperCase()] || mealType;
  };

  const getQuantity = (mealId: number): number => {
    const selection = selectedMeals.find((m) =>
      m.meal_id === mealId && (m.journey_type === selectedJourney || (!isRoundTrip && !m.journey_type))
    );
    return selection ? selection.quantity : 0;
  };

  const getDietaryType = (mealId: number): string => {
    const selection = selectedMeals.find((m) =>
      m.meal_id === mealId && (m.journey_type === selectedJourney || (!isRoundTrip && !m.journey_type))
    );
    return selection?.dietary_type || 'REGULAR';
  };

  const getSpecialRequests = (mealId: number): string => {
    const selection = selectedMeals.find((m) =>
      m.meal_id === mealId && (m.journey_type === selectedJourney || (!isRoundTrip && !m.journey_type))
    );
    return selection?.special_requests || '';
  };

  const updateMealSelection = (
    mealId: number,
    quantity: number,
    dietaryType?: string,
    specialRequests?: string
  ) => {
    let newSelections = [...selectedMeals];

    // Remove existing selection for this meal and journey
    newSelections = newSelections.filter((m) => !(m.meal_id === mealId && m.journey_type === selectedJourney));

    if (quantity > 0) {
      // Add new selection
      const updatedSelection: MealSelection = {
        meal_id: mealId,
        quantity,
        dietary_type: dietaryType,
        special_requests: specialRequests,
        journey_type: isRoundTrip ? selectedJourney : 'outbound',  // Default to outbound for one-way trips
      };
      newSelections.push(updatedSelection);
    }

    // Calculate total price
    const totalPrice = newSelections.reduce((sum, selection) => {
      const meal = meals.find((m) => m.id === selection.meal_id);
      return sum + (meal ? meal.price * selection.quantity : 0);
    }, 0);

    onMealSelect(newSelections, totalPrice);
  };

  const groupMealsByType = () => {
    const grouped: { [key: string]: Meal[] } = {};
    meals.forEach((meal) => {
      const type = meal.meal_type.toUpperCase();
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type].push(meal);
    });
    return grouped;
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading meal options...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  const groupedMeals = groupMealsByType();
  const mealTypes = ['BREAKFAST', 'LUNCH', 'DINNER', 'BUFFET', 'SNACK'];

  const currentJourneyMeals = selectedMeals.filter((m) => m.journey_type === selectedJourney);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">{t('booking:meals.title')}</h3>
        {currentJourneyMeals.length > 0 && (
          <button
            onClick={() => {
              // Clear only current journey meals
              const otherJourneyMeals = selectedMeals.filter((m) => m.journey_type !== selectedJourney);
              const totalPrice = otherJourneyMeals.reduce((sum, selection) => {
                const meal = meals.find((m) => m.id === selection.meal_id);
                return sum + (meal ? meal.price * selection.quantity : 0);
              }, 0);
              onMealSelect(otherJourneyMeals, totalPrice);
            }}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Journey Tabs for Round Trip */}
      {isRoundTrip && (
        <div className="flex border-b border-gray-200 mb-4">
          <button
            onClick={() => setSelectedJourney('outbound')}
            className={`px-4 py-2 font-medium transition-colors ${
              selectedJourney === 'outbound'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            🚢 Outbound (Aller)
          </button>
          <button
            onClick={() => setSelectedJourney('return')}
            className={`px-4 py-2 font-medium transition-colors ${
              selectedJourney === 'return'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            🔙 Return (Retour)
          </button>
        </div>
      )}

      {mealTypes.map((mealType) => {
        const mealsOfType = groupedMeals[mealType];
        if (!mealsOfType || mealsOfType.length === 0) return null;

        return (
          <div key={mealType} className="space-y-3">
            <h4 className="font-medium text-gray-700 flex items-center gap-2">
              <span className="text-xl">{getMealIcon(mealType)}</span>
              {getMealTypeName(mealType)}
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mealsOfType.map((meal) => {
                const quantity = getQuantity(meal.id);
                const isSelected = quantity > 0;

                return (
                  <div
                    key={meal.id}
                    className={`border-2 rounded-lg p-4 transition-all ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-300 hover:border-blue-400'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h5 className="font-semibold">{meal.name}</h5>
                        {meal.description && (
                          <p className="text-sm text-gray-600 mt-1">{meal.description}</p>
                        )}
                      </div>
                      <span className="text-lg font-bold text-blue-600 ml-4">
                        €{meal.price.toFixed(2)}
                      </span>
                    </div>

                    {/* Dietary types */}
                    {meal.dietary_types && (
                      <div className="text-xs text-gray-500 mb-3">
                        Available: {meal.dietary_types}
                      </div>
                    )}

                    {/* Quantity selector */}
                    <div className="flex items-center gap-3 mb-3">
                      <label className="text-sm font-medium text-gray-700">Quantity:</label>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            updateMealSelection(
                              meal.id,
                              Math.max(0, quantity - 1),
                              getDietaryType(meal.id),
                              getSpecialRequests(meal.id)
                            )
                          }
                          className="w-8 h-8 rounded border border-gray-300 hover:bg-gray-100 flex items-center justify-center"
                        >
                          -
                        </button>
                        <span className="w-8 text-center font-medium">{quantity}</span>
                        <button
                          onClick={() =>
                            updateMealSelection(
                              meal.id,
                              Math.min(passengerCount * 3, quantity + 1),
                              getDietaryType(meal.id),
                              getSpecialRequests(meal.id)
                            )
                          }
                          className="w-8 h-8 rounded border border-gray-300 hover:bg-gray-100 flex items-center justify-center"
                        >
                          +
                        </button>
                      </div>
                      {quantity > 0 && (
                        <span className="text-sm text-gray-600 ml-2">
                          = €{(meal.price * quantity).toFixed(2)}
                        </span>
                      )}
                    </div>

                    {/* Dietary preference - only show when selected */}
                    {isSelected && (
                      <div className="space-y-2">
                        <div>
                          <label className="text-sm font-medium text-gray-700 block mb-1">
                            Dietary Preference:
                          </label>
                          <select
                            value={getDietaryType(meal.id)}
                            onChange={(e) =>
                              updateMealSelection(
                                meal.id,
                                quantity,
                                e.target.value,
                                getSpecialRequests(meal.id)
                              )
                            }
                            className="w-full text-sm border border-gray-300 rounded px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="REGULAR">Regular</option>
                            <option value="VEGETARIAN">Vegetarian</option>
                            <option value="VEGAN">Vegan</option>
                            <option value="HALAL">Halal</option>
                            <option value="KOSHER">Kosher</option>
                            <option value="GLUTEN_FREE">Gluten Free</option>
                            <option value="DAIRY_FREE">Dairy Free</option>
                            <option value="NUT_FREE">Nut Free</option>
                          </select>
                        </div>

                        {/* Special requests toggle */}
                        <button
                          onClick={() => setExpandedMeal(expandedMeal === meal.id ? null : meal.id)}
                          className="text-xs text-blue-600 hover:text-blue-700"
                        >
                          {expandedMeal === meal.id
                            ? 'Hide special requests'
                            : 'Add special requests'}
                        </button>

                        {expandedMeal === meal.id && (
                          <div>
                            <textarea
                              value={getSpecialRequests(meal.id)}
                              onChange={(e) =>
                                updateMealSelection(
                                  meal.id,
                                  quantity,
                                  getDietaryType(meal.id),
                                  e.target.value
                                )
                              }
                              placeholder="Any allergies or special requests?"
                              className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              rows={2}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {meals.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>No meal options available at this time.</p>
        </div>
      )}
    </div>
  );
};

export default MealSelector;
