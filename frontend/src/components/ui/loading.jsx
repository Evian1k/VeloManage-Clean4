import React from 'react';
import { Loader2, Car } from 'lucide-react';
import { cn } from '@/lib/utils';

// Simple spinner component
export const Spinner = ({ className, size = 'default' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    default: 'w-6 h-6', 
    lg: 'w-8 h-8',
    xl: 'w-12 h-12'
  };

  return (
    <Loader2 
      className={cn('animate-spin', sizeClasses[size], className)} 
    />
  );
};

// Loading overlay for components
export const LoadingOverlay = ({ isLoading, children, className }) => {
  if (!isLoading) return children;

  return (
    <div className={cn('relative', className)}>
      {children}
      <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50 rounded-md">
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
          <Spinner className="text-white" size="lg" />
        </div>
      </div>
    </div>
  );
};

// Full page loading component
export const PageLoading = ({ message = 'Loading...' }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-red-900/10 to-black">
      <div className="text-center space-y-4">
        <div className="relative">
          <Car className="w-16 h-16 text-red-500 mx-auto animate-pulse" />
          <Spinner className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white" size="lg" />
        </div>
        <p className="text-white text-lg font-medium">{message}</p>
        <div className="flex space-x-1 justify-center">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        </div>
      </div>
    </div>
  );
};

// Skeleton loading for content
export const Skeleton = ({ className, ...props }) => {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-gray-300/20',
        className
      )}
      {...props}
    />
  );
};

// Card skeleton
export const CardSkeleton = () => {
  return (
    <div className="bg-black/40 border border-red-900/30 rounded-lg p-6 space-y-4">
      <div className="flex items-center space-x-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="flex space-x-2">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-20" />
      </div>
    </div>
  );
};

// List skeleton
export const ListSkeleton = ({ items = 3 }) => {
  return (
    <div className="space-y-4">
      {Array.from({ length: items }).map((_, index) => (
        <CardSkeleton key={index} />
      ))}
    </div>
  );
};

// Button loading state
export const LoadingButton = ({ 
  isLoading, 
  children, 
  disabled, 
  className,
  loadingText = 'Loading...',
  ...props 
}) => {
  return (
    <button
      disabled={isLoading || disabled}
      className={cn(
        'inline-flex items-center justify-center',
        isLoading && 'cursor-not-allowed opacity-70',
        className
      )}
      {...props}
    >
      {isLoading && <Spinner className="mr-2" size="sm" />}
      {isLoading ? loadingText : children}
    </button>
  );
};

// Progress bar component
export const ProgressBar = ({ progress = 0, className, showPercentage = false }) => {
  const clampedProgress = Math.min(Math.max(progress, 0), 100);
  
  return (
    <div className={cn('w-full', className)}>
      <div className="flex justify-between items-center mb-1">
        {showPercentage && (
          <span className="text-sm text-gray-300">{Math.round(clampedProgress)}%</span>
        )}
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2">
        <div
          className="bg-red-600 h-2 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
};

export default {
  Spinner,
  LoadingOverlay,
  PageLoading,
  Skeleton,
  CardSkeleton,
  ListSkeleton,
  LoadingButton,
  ProgressBar
};