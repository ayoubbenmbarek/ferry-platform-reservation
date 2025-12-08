import RunningBear from './RunningBear';

// Simple loading spinner component - now uses the running bear!
const LoadingSpinner = () => {
  return <RunningBear message="Loading" size="medium" fullScreen={true} />;
};

export default LoadingSpinner;
