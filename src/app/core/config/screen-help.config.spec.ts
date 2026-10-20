import { resolveScreenHelpKey } from './screen-help.config';

describe('resolveScreenHelpKey', () => {
  it('maps home hub', () => {
    expect(resolveScreenHelpKey('/tabs/home')).toBe('screen.help.home');
    expect(resolveScreenHelpKey('/tabs/peladas')).toBe('screen.help.home');
  });

  it('maps peladas lista', () => {
    expect(resolveScreenHelpKey('/tabs/peladas/lista')).toBe('screen.help.peladas');
  });

  it('maps directory doors', () => {
    expect(resolveScreenHelpKey('/tabs/peladas/confrontos')).toBe('screen.help.events');
    expect(resolveScreenHelpKey('/tabs/peladas/times')).toBe('screen.help.search');
    expect(resolveScreenHelpKey('/tabs/peladas/usuarios/u1')).toBe('screen.help.search');
  });

  it('strips query string', () => {
    expect(resolveScreenHelpKey('/tabs/home?wizard=foo')).toBe('screen.help.home');
  });
});
