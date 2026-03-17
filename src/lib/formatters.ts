// UK English formatting utilities for Truckwys

export const formatCurrency = (
  amount: number | null | undefined,
  options: Intl.NumberFormatOptions = {}
): string => {
  if (amount == null || isNaN(Number(amount))) {
    return 'R0.00';
  }
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    ...options
  }).format(Number(amount));
};

export const formatNumber = (
  value: number | null | undefined,
  options: Intl.NumberFormatOptions = {}
): string => {
  if (value == null || isNaN(Number(value))) {
    return '0';
  }
  return new Intl.NumberFormat('en-GB', options).format(Number(value));
};

export const formatPercentage = (
  value: number | null | undefined,
  decimals: number = 1
): string => {
  if (value == null || isNaN(Number(value))) {
    return '0.0%';
  }
  return new Intl.NumberFormat('en-GB', {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(Number(value));
};

export const formatDistance = (kilometres: number): string => {
  return `${formatNumber(kilometres)} km`;
};

export const formatDuration = (hours: number): string => {
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  
  if (wholeHours === 0) {
    return `${minutes}m`;
  }
  
  if (minutes === 0) {
    return `${wholeHours}h`;
  }
  
  return `${wholeHours}h ${minutes}m`;
};

export const formatDate = (
  date: string | Date,
  options: Intl.DateTimeFormatOptions = {}
): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options
  }).format(dateObj);
};

export const formatDateTime = (date: string | Date): string => {
  return formatDate(date, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

export const formatRelativeTime = (date: string | Date): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  
  return formatDate(dateObj);
};

export const formatConfidence = (confidence: number): string => {
  return `${Math.round(confidence * 100)}%`;
};

export const getConfidenceLevel = (confidence: number): 'high' | 'medium' | 'low' => {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.6) return 'medium';
  return 'low';
};

export const formatCompactNumber = (value: number): string => {
  if (value >= 1000000) {
    return `${formatNumber(value / 1000000, { maximumFractionDigits: 1 })}M`;
  }
  if (value >= 1000) {
    return `${formatNumber(value / 1000, { maximumFractionDigits: 1 })}K`;
  }
  return formatNumber(value);
};

export const formatPercent = (value: number | null | undefined, decimals: number = 1): string => {
  if (value == null || isNaN(Number(value))) {
    return '0.0%';
  }
  return `${Number(value).toFixed(decimals)}%`;
};