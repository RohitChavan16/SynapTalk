import React from 'react'

const Loading = ({ 
  size = 'md', 
  color = 'blue', 
  text = 'Loading...', 
  showText = true,
}) => {

    const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-20 h-20'
  };

  const colorClasses = {
    blue: 'border-blue-500',
    purple: 'border-purple-500',
    green: 'border-green-500',
    red: 'border-red-500',
    yellow: 'border-yellow-500',
    pink: 'border-pink-500'
  };

  const bgColorClasses = {
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
  green: 'bg-green-500',
  red: 'bg-red-500',
  yellow: 'bg-yellow-500',
  pink: 'bg-pink-500'
};


  
  const MorphingSquares = () => (
    <div className="flex items-center justify-center space-x-1">
      <div className={`${sizeClasses[size]} relative`}>
        <div className={`absolute inset-0 ${colorClasses[color]} border-2 rounded-lg animate-pulse`}></div>
        <div className={`absolute inset-1 ${colorClasses[color]} border-2 rounded animate-spin`}></div>
        <div className={`absolute inset-2 ${bgColorClasses[color]} rounded-sm animate-ping`}></div>
      </div>
    </div>
  );


  const textColorClasses = {
    blue: 'text-blue-600',
    purple: 'text-purple-600',
    green: 'text-green-600',
    red: 'text-red-600',
    yellow: 'text-yellow-600',
    pink: 'text-pink-600'
  };


  return (
    <div className="flex flex-col items-center justify-center space-y-4">
      <MorphingSquares />
      {showText && (
        <p className={`text-sm font-medium ${textColorClasses[color]} animate-pulse`}>
          {text}
        </p>
      )}
    </div>
  )
}

export default Loading;
