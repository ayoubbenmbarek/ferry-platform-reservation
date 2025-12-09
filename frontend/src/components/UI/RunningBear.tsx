import React from 'react';

interface RunningBearProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
  fullScreen?: boolean;
}

const RunningBear: React.FC<RunningBearProps> = ({
  message = 'Loading...',
  size = 'medium',
  fullScreen = true
}) => {
  const containerClasses = fullScreen
    ? 'min-h-screen flex items-center justify-center bg-gradient-to-b from-sky-100 to-blue-50'
    : 'flex items-center justify-center py-8 bg-gradient-to-b from-sky-50 to-blue-50 rounded-lg';

  return (
    <div className={containerClasses}>
      <div className="text-center">
        {/* Scene container */}
        <div className="relative w-80 h-36 mx-auto overflow-hidden">

          {/* Ship sailing in background */}
          <div className="ship-sailing absolute bottom-8">
            <span className="text-5xl">🚢</span>
          </div>

          {/* Captain bear with luggage - stationary in center */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-end gap-1">
            <span className="text-4xl luggage-bounce">🧳</span>
            <div className="relative">
              <span className="text-5xl bear-waiting">🐻</span>
              {/* Captain hat */}
              <span className="absolute -top-3 left-1/2 transform -translate-x-1/2 text-2xl">🎩</span>
            </div>
          </div>

          {/* Water/waves at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-blue-400/40 to-transparent">
            <div className="wave-pattern absolute bottom-0 left-0 right-0 h-3"></div>
          </div>

          {/* Seagulls */}
          <div className="seagull-1 absolute top-2 text-xl">🕊️</div>
          <div className="seagull-2 absolute top-6 text-lg">🕊️</div>
        </div>

        {/* Loading text */}
        <p className="mt-4 text-gray-600 font-medium text-lg">
          {message}
          <span className="loading-dots"></span>
        </p>

        {/* Wave decorations */}
        <div className="flex justify-center gap-3 mt-2">
          <span className="wave-1 text-xl opacity-60">🌊</span>
          <span className="wave-2 text-xl opacity-60">🌊</span>
          <span className="wave-3 text-xl opacity-60">🌊</span>
        </div>
      </div>

      <style>{`
        /* Ship sailing across */
        .ship-sailing {
          animation: sailShip 6s ease-in-out infinite;
        }

        @keyframes sailShip {
          0% { left: -60px; }
          100% { left: calc(100% + 60px); }
        }

        /* Bear waiting animation - slight movement */
        .bear-waiting {
          display: inline-block;
          animation: bearLookAround 3s ease-in-out infinite;
        }

        @keyframes bearLookAround {
          0%, 100% { transform: rotate(0deg); }
          30% { transform: rotate(-5deg); }
          60% { transform: rotate(5deg); }
        }

        /* Luggage slight bounce */
        .luggage-bounce {
          display: inline-block;
          animation: luggageBounce 2s ease-in-out infinite;
        }

        @keyframes luggageBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }

        /* Seagulls flying */
        .seagull-1 {
          animation: flyBird1 8s linear infinite;
        }

        .seagull-2 {
          animation: flyBird2 10s linear infinite;
          animation-delay: -3s;
        }

        @keyframes flyBird1 {
          0% { left: -30px; transform: scaleX(1); }
          49% { transform: scaleX(1); }
          50% { left: calc(100% + 30px); transform: scaleX(-1); }
          100% { left: -30px; transform: scaleX(-1); }
        }

        @keyframes flyBird2 {
          0% { right: -30px; transform: scaleX(-1); }
          49% { transform: scaleX(-1); }
          50% { right: calc(100% + 30px); transform: scaleX(1); }
          100% { right: -30px; transform: scaleX(1); }
        }

        /* Wave pattern */
        .wave-pattern {
          background: repeating-linear-gradient(
            90deg,
            rgba(59, 130, 246, 0.3) 0px,
            rgba(59, 130, 246, 0.5) 10px,
            rgba(59, 130, 246, 0.3) 20px
          );
          animation: waveScroll 2s linear infinite;
        }

        @keyframes waveScroll {
          0% { background-position: 0 0; }
          100% { background-position: 40px 0; }
        }

        /* Loading dots */
        .loading-dots::after {
          content: '';
          animation: dots 1.5s steps(4, end) infinite;
        }

        @keyframes dots {
          0%, 20% { content: ''; }
          40% { content: '.'; }
          60% { content: '..'; }
          80%, 100% { content: '...'; }
        }

        /* Wave decorations */
        .wave-1, .wave-2, .wave-3 {
          animation: waveFloat 1.5s ease-in-out infinite;
        }

        .wave-1 { animation-delay: 0s; }
        .wave-2 { animation-delay: 0.2s; }
        .wave-3 { animation-delay: 0.4s; }

        @keyframes waveFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
};

export default RunningBear;
