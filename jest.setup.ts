import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from 'util';

class ResizeObserverMock implements ResizeObserver {
  public observe = jest.fn();
  public unobserve = jest.fn();
  public disconnect = jest.fn();
}

Object.defineProperty(global, 'ResizeObserver', {
  configurable: true,
  value: ResizeObserverMock,
});

Object.defineProperty(global, 'TextEncoder', {
  configurable: true,
  value: TextEncoder,
});

Object.defineProperty(global, 'TextDecoder', {
  configurable: true,
  value: TextDecoder,
});

Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
  configurable: true,
  value: jest.fn(),
});

Object.defineProperty(URL, 'createObjectURL', {
  configurable: true,
  value: jest.fn(() => 'blob:mock-url'),
});

Object.defineProperty(URL, 'revokeObjectURL', {
  configurable: true,
  value: jest.fn(),
});
