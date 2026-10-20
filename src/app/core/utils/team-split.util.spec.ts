import { TeamSplitAthlete } from '../models/team-split.model';
import { presetBinarySplit } from './team-split.util';

function athlete(
  userId: string,
  overrides: Partial<TeamSplitAthlete> = {}
): TeamSplitAthlete {
  return {
    userId,
    registrationId: userId,
    apelido: userId,
    userName: userId,
    accumulatedPoints: 0,
    membershipType: 'convidado',
    isSocio: false,
    ...overrides,
  };
}

describe('presetBinarySplit', () => {
  it('marital: solteiros no time 0 e casados no time 1', () => {
    const athletes = [
      athlete('s1', { maritalStatus: 'solteiro' }),
      athlete('s2', { maritalStatus: 'solteiro' }),
      athlete('c1', { maritalStatus: 'casado' }),
      athlete('c2', { maritalStatus: 'casado' }),
    ];
    const { teams, pool } = presetBinarySplit(athletes, 10, 'marital');
    expect(teams[0].map((a) => a.userId).sort()).toEqual(['s1', 's2']);
    expect(teams[1].map((a) => a.userId).sort()).toEqual(['c1', 'c2']);
    expect(pool.length).toBe(0);
  });

  it('age: menores e maiores conforme corte', () => {
    const athletes = [
      athlete('young', { age: 29 }),
      athlete('old', { age: 31 }),
    ];
    const { teams, pool } = presetBinarySplit(athletes, 10, 'age', { ageThreshold: 30 });
    expect(teams[0].map((a) => a.userId)).toEqual(['young']);
    expect(teams[1].map((a) => a.userId)).toEqual(['old']);
    expect(pool.length).toBe(0);
  });

  it('favoriteTeam: reparte grupos entre os dois times', () => {
    const athletes = [
      athlete('f1', { favoriteProTeam: 'Flamengo' }),
      athlete('f2', { favoriteProTeam: 'Flamengo' }),
      athlete('p1', { favoriteProTeam: 'Palmeiras' }),
      athlete('p2', { favoriteProTeam: 'Palmeiras' }),
    ];
    const { teams, pool } = presetBinarySplit(athletes, 10, 'favoriteTeam');
    expect(teams[0].length + teams[1].length).toBe(4);
    expect(pool.length).toBe(0);
    const flamengoTogether =
      teams[0].every((a) => a.favoriteProTeam === 'Flamengo') ||
      teams[1].every((a) => a.favoriteProTeam === 'Flamengo');
    expect(flamengoTogether).toBeTrue();
  });

  it('respeita athletesPerTeam e manda excedente para reserva', () => {
    const athletes = [
      athlete('s1', { maritalStatus: 'solteiro' }),
      athlete('s2', { maritalStatus: 'solteiro' }),
      athlete('s3', { maritalStatus: 'solteiro' }),
    ];
    const { teams, pool } = presetBinarySplit(athletes, 2, 'marital');
    expect(teams[0].length).toBe(2);
    expect(pool.map((a) => a.userId)).toEqual(['s3']);
  });

  it('sem idade vai para reserva no modo age', () => {
    const { pool } = presetBinarySplit([athlete('x')], 5, 'age', { ageThreshold: 30 });
    expect(pool.map((a) => a.userId)).toEqual(['x']);
  });
});
