import React from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  ChartOptions,
  ChartData,
} from "chart.js";

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

// TypeScript interface for the props
interface BarChartProps {
  data: number[];
  values: [number, number];
  domain: [number, number];
  numBins: number;
}

const BarChart = ({ data, values, domain, numBins }: BarChartProps) => {
  // Helper to round to "nice" bin sizes
  const roundToNiceNumber = (value: number) => {
    const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
    return Math.ceil(value / magnitude) * magnitude;
  };

  // Define bins for histogram
  const minValue = Math.min(...data);
  const maxValue = Math.max(...data);

  // Calculate an appropriate bin size
  let rawBinSize = (maxValue - minValue) / numBins;
  const binSize = roundToNiceNumber(rawBinSize);

  // Initialize bins
  const bins = Array(numBins).fill(0);
  const labels: string[] = [];

  // Calculate bin frequencies
  data.forEach((value) => {
    const binIndex = Math.min(
      Math.floor((value - minValue) / binSize),
      bins.length - 1
    );
    bins[binIndex]++;
  });

  // Create labels for bins
  for (let i = 0; i < bins.length; i++) {
    const rangeStart = minValue + i * binSize;
    const rangeEnd = rangeStart + binSize - 1;
    labels.push(`${rangeStart}-${rangeEnd}`);
  }

  // Create chart data object
  const barData: ChartData<"bar"> = {
    labels: labels,
    datasets: [
      {
        backgroundColor: bins.map((_, i) => {
          const rangeStart = minValue + i * binSize;
          const rangeEnd = rangeStart + binSize - 1;

          // Check if the bin range overlaps with the selected values
          const isHighlighted =
            (rangeStart >= values[0] && rangeStart <= values[1]) ||
            (rangeEnd >= values[0] && rangeEnd <= values[1]) ||
            (rangeStart <= values[0] && rangeEnd >= values[1]);

          return isHighlighted
            ? "rgba(78, 143, 255, 0.4)" // Highlight color
            : "rgba(206, 206, 206, 0.2)"; // Default color
        }),
        hoverBackgroundColor: "rgba(55, 135, 254, 0.7)",
        data: bins,
      },
    ],
  };

  // Chart options
  const options: ChartOptions<"bar"> = {
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: true,
        backgroundColor: "black",
        titleColor: "white",
        bodyColor: "white",
        displayColors: false,
        callbacks: {
          label: function (context) {
            return `Count: ${context.raw}`;
          },
        },
      },
    },
    scales: {
      x: {
        display: false,
      },
      y: {
        display: true,
        // beginAtZero: true,
      },
    },
  };
  return (
    <>
      <Bar data={barData} options={options} />
    </>
  );
};

export default BarChart;
