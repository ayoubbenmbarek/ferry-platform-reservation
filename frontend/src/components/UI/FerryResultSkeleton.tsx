import React from 'react';

interface FerryResultSkeletonProps {
  count?: number;
}

/**
 * Skeleton loading component for ferry search results.
 * Shows animated placeholder cards while actual results are loading.
 */
const FerryResultSkeleton: React.FC<FerryResultSkeletonProps> = ({ count = 3 }) => {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="bg-white rounded-lg shadow-md p-6 animate-pulse"
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between">
            <div className="flex-1">
              {/* Operator and vessel name */}
              <div className="flex items-center space-x-4 mb-4">
                <div className="bg-gray-200 rounded-full h-6 w-24"></div>
                <div className="bg-gray-200 rounded h-4 w-32"></div>
              </div>

              {/* Availability badges */}
              <div className="flex items-center gap-2 mb-3">
                <div className="bg-gray-200 rounded-full h-6 w-20"></div>
                <div className="bg-gray-200 rounded-full h-6 w-24"></div>
                <div className="bg-gray-200 rounded-full h-6 w-20"></div>
              </div>

              {/* Time grid */}
              <div className="grid grid-cols-3 gap-4">
                {/* Departure */}
                <div>
                  <div className="bg-gray-200 rounded h-3 w-16 mb-2"></div>
                  <div className="bg-gray-200 rounded h-6 w-14 mb-1"></div>
                  <div className="bg-gray-200 rounded h-3 w-24"></div>
                </div>

                {/* Duration */}
                <div className="flex flex-col items-center">
                  <div className="bg-gray-200 rounded h-3 w-16 mb-2"></div>
                  <div className="bg-gray-200 rounded h-5 w-12 mb-2"></div>
                  <div className="flex items-center justify-center w-full">
                    <div className="h-px bg-gray-200 flex-1"></div>
                    <div className="mx-2 bg-gray-200 rounded h-4 w-4"></div>
                    <div className="h-px bg-gray-200 flex-1"></div>
                  </div>
                </div>

                {/* Arrival */}
                <div className="flex flex-col items-end">
                  <div className="bg-gray-200 rounded h-3 w-16 mb-2"></div>
                  <div className="bg-gray-200 rounded h-6 w-14 mb-1"></div>
                  <div className="bg-gray-200 rounded h-3 w-24"></div>
                </div>
              </div>
            </div>

            {/* Price and button */}
            <div className="mt-4 md:mt-0 md:ml-6 md:text-right flex flex-col items-end">
              <div className="bg-gray-200 rounded h-3 w-16 mb-2"></div>
              <div className="bg-gray-200 rounded h-8 w-24 mb-2"></div>
              <div className="bg-gray-200 rounded h-3 w-20 mb-3"></div>
              <div className="bg-gray-200 rounded-lg h-10 w-28"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Compact skeleton for inline loading states
 */
export const FerryResultSkeletonCompact: React.FC = () => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-gray-200 rounded-full h-5 w-16"></div>
          <div className="bg-gray-200 rounded h-4 w-20"></div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="bg-gray-200 rounded h-5 w-24"></div>
          <div className="bg-gray-200 rounded-lg h-8 w-20"></div>
        </div>
      </div>
    </div>
  );
};

export default FerryResultSkeleton;
