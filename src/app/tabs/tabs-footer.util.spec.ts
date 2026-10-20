import { isFooterTabActive } from './tabs-footer.util';

describe('isFooterTabActive', () => {
  it('does not highlight peladas on home hub', () => {
    expect(isFooterTabActive('/tabs/home', 'peladas')).toBe(false);
  });

  it('highlights peladas on lista', () => {
    expect(isFooterTabActive('/tabs/peladas/lista', 'peladas')).toBe(true);
  });

  it('does not highlight peladas on directory doors', () => {
    expect(isFooterTabActive('/tabs/peladas/confrontos', 'peladas')).toBe(false);
    expect(isFooterTabActive('/tabs/peladas/times', 'peladas')).toBe(false);
  });

  it('highlights search on search tab', () => {
    expect(isFooterTabActive('/tabs/search', 'search')).toBe(true);
  });

  it('highlights events on events tab', () => {
    expect(isFooterTabActive('/tabs/events', 'events')).toBe(true);
  });
});
