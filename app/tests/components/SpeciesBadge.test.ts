import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import SpeciesBadge from '../../src/components/SpeciesBadge.svelte';

describe('SpeciesBadge', () => {
  afterEach(() => cleanup());

  describe('dog species', () => {
    it('displays "Dog" text', () => {
      const { getByText } = render(SpeciesBadge, { species: 'dog' });
      expect(getByText('Dog')).toBeInTheDocument();
    });

    it('has species-badge CSS class', () => {
      const { container } = render(SpeciesBadge, { species: 'dog' });
      const badge = container.querySelector('.species-badge');
      expect(badge).toBeInTheDocument();
    });

    it('uses dog color and background via CSS variables', () => {
      const { container } = render(SpeciesBadge, { species: 'dog' });
      const badge = container.querySelector('.species-badge') as HTMLElement;
      expect(badge.style.getPropertyValue('--badge-color')).toBe('#ff8c42');
    });
  });

  describe('cat species', () => {
    it('displays "Cat" text', () => {
      const { getByText } = render(SpeciesBadge, { species: 'cat' });
      expect(getByText('Cat')).toBeInTheDocument();
    });

    it('has species-badge CSS class', () => {
      const { container } = render(SpeciesBadge, { species: 'cat' });
      const badge = container.querySelector('.species-badge');
      expect(badge).toBeInTheDocument();
    });

    it('uses cat color and background via CSS variables', () => {
      const { container } = render(SpeciesBadge, { species: 'cat' });
      const badge = container.querySelector('.species-badge') as HTMLElement;
      expect(badge.style.getPropertyValue('--badge-color')).toBe('#42d4ff');
    });

    it('has accessible aria-label', () => {
      const { container } = render(SpeciesBadge, { species: 'cat' });
      const badge = container.querySelector('.species-badge');
      expect(badge).toHaveAttribute('aria-label', 'Cat');
    });
  });

  describe('size variants', () => {
    it('defaults to medium (md) size', () => {
      const { container } = render(SpeciesBadge, { species: 'dog' });
      const badge = container.querySelector('.species-badge');
      expect(badge?.classList.contains('md')).toBe(true);
    });

    it('renders small (sm) size when specified', () => {
      const { container } = render(SpeciesBadge, { species: 'dog', size: 'sm' });
      const badge = container.querySelector('.species-badge');
      expect(badge?.classList.contains('sm')).toBe(true);
      expect(badge?.classList.contains('md')).toBe(false);
    });

    it('shows text label only in md size', () => {
      const { queryByText } = render(SpeciesBadge, { species: 'dog', size: 'sm' });
      expect(queryByText('Dog')).not.toBeInTheDocument();
    });

    it('does not show sm class when size is md', () => {
      const { container } = render(SpeciesBadge, { species: 'dog', size: 'md' });
      const badge = container.querySelector('.species-badge');
      expect(badge?.classList.contains('sm')).toBe(false);
    });
  });
});
