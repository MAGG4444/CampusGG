import { DirectMessageEvents } from './direct-message-events';

describe('DirectMessageEvents', () => {
  it('notifies only the two normalized participant identities', () => {
    const events = new DirectMessageEvents();
    const listener = jest.fn();
    events.subscribe(listener);
    events.publish('AAA', 'BBB');
    expect(listener).toHaveBeenCalledWith(['aaa', 'bbb']);
  });

  it('unsubscribes listeners', () => {
    const events = new DirectMessageEvents();
    const listener = jest.fn();
    const unsubscribe = events.subscribe(listener);
    unsubscribe();
    events.publish('a', 'b');
    expect(listener).not.toHaveBeenCalled();
  });

  it('does not turn a committed message into a failed request when notification fails', () => {
    const events = new DirectMessageEvents();
    events.subscribe(() => {
      throw new Error('transport failure');
    });
    const other = jest.fn();
    events.subscribe(other);
    expect(() => events.publish('a', 'b')).not.toThrow();
    expect(other).toHaveBeenCalledWith(['a', 'b']);
  });
});
