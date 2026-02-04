interface SparklineChartProps {
  data: number[];
  color?: string;
}

export function SparklineChart({ data, color = "#2563EB" }: SparklineChartProps) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min;
  
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = 100 - ((value - min) / range) * 100;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg 
      width="80" 
      height="24" 
      viewBox="0 0 100 100" 
      preserveAspectRatio="none"
      className="inline-block"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
