import { boolean, date, entity, role, set, text, uuid } from '@microsoft/rayfin-core';

export type LoanStatus = 'reserved' | 'out' | 'returned' | 'cancelled';
export type LoanCondition = 'clean' | 'worn' | 'stained' | 'damaged';

@entity()
@role('authenticated', 'read')
@role('authenticated', 'create', {
  policy: (claims, item) => claims.sub.eq(item.borrowerSub),
})
@role('authenticated', 'update', {
  policy: (claims, item) => claims.sub.eq(item.borrowerSub).or(claims.sub.eq(item.curatorSub)),
  exclude: ['curatorSub', 'loanerId', 'createdAt'],
})
@role('authenticated', 'delete', {
  policy: (claims, item) => claims.sub.eq(item.borrowerSub).or(claims.sub.eq(item.curatorSub)),
})
export class Loan {
  @uuid()
  id!: string;

  @uuid()
  loanerId!: string;

  @text({ max: 100 })
  borrowerSub!: string;

  @text({ max: 100 })
  borrowerName!: string;

  @date()
  startsOn!: Date;

  @date()
  dueOn!: Date;

  @date({ optional: true })
  returnedOn?: Date;

  @set('reserved', 'out', 'returned', 'cancelled')
  status!: LoanStatus;

  @text({ max: 20, optional: true })
  condition?: LoanCondition;

  @boolean()
  extended!: boolean;

  @text({ max: 100 })
  curatorSub!: string;

  @date()
  createdAt!: Date;
}
