import { boolean, entity, int, role, set, text, uuid } from '@microsoft/rayfin-core';

export type LoanerSize = 's' | 'm' | 'l' | 'xl' | 'xxl';
export type LoanerFibre = 'wool' | 'cotton' | 'acrylic' | 'blend';
export type LoanerStatus = 'shelf' | 'on_loan' | 'cleaning' | 'repair' | 'retired';

@entity()
@role('authenticated', 'read')
@role('authenticated', 'create', {
  policy: (claims, item) => claims.sub.eq(item.curatorSub),
})
@role('authenticated', 'update', {
  policy: (claims, item) => claims.sub.eq(item.curatorSub),
  exclude: ['curatorSub'],
})
@role('authenticated', 'delete', {
  policy: (claims, item) => claims.sub.eq(item.curatorSub),
})
export class Loaner {
  @uuid()
  id!: string;

  @text({ min: 2, max: 12 })
  tag!: string;

  @text({ min: 3, max: 80 })
  title!: string;

  @set('s', 'm', 'l', 'xl', 'xxl')
  size!: LoanerSize;

  @int()
  chestCm!: number;

  @set('wool', 'cotton', 'acrylic', 'blend')
  fibre!: LoanerFibre;

  @boolean()
  lights!: boolean;

  @set('shelf', 'on_loan', 'cleaning', 'repair', 'retired')
  status!: LoanerStatus;

  @int()
  wears!: number;

  @int()
  maxWears!: number;

  @text({ max: 100 })
  curatorSub!: string;

  @text({ max: 100 })
  curatorName!: string;
}
