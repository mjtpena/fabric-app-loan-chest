import { date, entity, int, role, text, uuid } from '@microsoft/rayfin-core';

@entity()
@role('authenticated', 'read')
@role('authenticated', 'create', {
  policy: (claims, item) => claims.sub.eq(item.personSub),
})
@role('authenticated', 'update', {
  policy: (claims, item) => claims.sub.eq(item.personSub),
  exclude: ['personSub'],
})
@role('authenticated', 'delete', {
  policy: (claims, item) => claims.sub.eq(item.personSub),
})
export class BorrowerProfile {
  @uuid()
  id!: string;

  @text({ max: 100 })
  personSub!: string;

  @int()
  chestCm!: number;

  @date({ optional: true })
  lastLoanOn?: Date;
}
