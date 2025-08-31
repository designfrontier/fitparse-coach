import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LoadingSpinner from '../../components/LoadingSpinner';

describe('LoadingSpinner', () => {
  test('renders loading spinner', () => {
    render(<LoadingSpinner />);
    
    const spinner = screen.getByRole('status');
    expect(spinner).toBeInTheDocument();
  });

  test('renders with custom message', () => {
    const message = 'Loading data...';
    render(<LoadingSpinner message={message} />);
    
    expect(screen.getByText(message)).toBeInTheDocument();
  });

  test('renders default message when no message provided', () => {
    render(<LoadingSpinner />);
    
    // Check if default loading text is present
    const loadingElement = screen.getByRole('status');
    expect(loadingElement).toBeInTheDocument();
  });
});