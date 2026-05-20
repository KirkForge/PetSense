import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import ActivitySparkline from '../../src/components/ActivitySparkline.svelte';

describe('ActivitySparkline', () => {
  afterEach(() => cleanup());

  const defaultProps = {
    data: [10, 20, 15, 30, 25, 40, 35] as number[],
    color: '#ff8c42',
    width: 400,
    height: 100,
  };

  it('renders an SVG element with correct viewBox', () => {
    const { container } = render(ActivitySparkline, defaultProps);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('viewBox', '0 0 400 100');
  });

  it('renders a polyline element when data is provided', () => {
    const { container } = render(ActivitySparkline, defaultProps);
    const polyline = container.querySelector('polyline');
    expect(polyline).toBeInTheDocument();
    expect(polyline).toHaveAttribute('stroke', '#ff8c42');
    expect(polyline).toHaveAttribute('fill', 'none');
  });

  it('handles empty data gracefully — renders fallback text', () => {
    const { container, getByText } = render(ActivitySparkline, {
      ...defaultProps,
      data: [],
    });
    expect(container.querySelector('svg')).not.toBeInTheDocument();
    expect(getByText('No activity data yet')).toBeInTheDocument();
  });

  it('handles a single data point — renders SVG', () => {
    const { container } = render(ActivitySparkline, {
      ...defaultProps,
      data: [42],
    });
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    // With single point, polyline should still render (1 point polyline)
    expect(container.querySelector('polyline')).toBeInTheDocument();
  });

  it('renders with different colors', () => {
    const { container } = render(ActivitySparkline, {
      data: [1, 2, 3],
      color: '#42d4ff',
      width: 300,
      height: 80,
    });
    const polyline = container.querySelector('polyline');
    expect(polyline).toHaveAttribute('stroke', '#42d4ff');
  });

  it('has accessible role and label', () => {
    const { container } = render(ActivitySparkline, {
      data: [10, 20, 30],
      color: '#ff8c42',
      width: 300,
      height: 80,
    });
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-label', 'Activity sparkline chart');
    expect(svg).toHaveAttribute('role', 'img');
  });
});
