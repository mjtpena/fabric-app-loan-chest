import type { DemoScript } from '@x10/shared/demo';

export const script: DemoScript = {
  title: 'Loan Chest — Loaner Sweater Library',
  scenes: [
    {
      name: 'The loan chest',
      say: [
        'Every December, new starters and remote colleagues need a holiday sweater, while the shared cupboard turns into an unwashed free-for-all.',
        'Loan Chest puts the whole wardrobe in a tall wooden chest of drawers: brass tags show code and size, and each folded knit peeks over the lip.',
        'Drawers slide out as loans progress; overdue drawers pull askew in amber, and garments in the two-day cleaning gap carry a steam tag.',
      ],
      act: async (page) => {
        await page.goto('/#/');
        await page.getByTestId('loan-chest-svg').waitFor();
      },
    },
    {
      name: 'Wear lens & Today',
      say: [
        'Switch to the Wear lens and click the Today alert for LC-03.',
        'At eleven of twelve wears, its next return will retire the sweater automatically.',
      ],
      act: async (page) => {
        await page.getByRole('radiogroup', { name: 'Lens' }).getByRole('radio', { name: /Wear/ }).click();
        await page.getByRole('button', { name: /LC-03 near retirement/ }).click();
      },
    },
    {
      name: 'View as borrower',
      say: [
        'Flip View As to Borrower and every drawer that fits your chest measurement within zero to twenty centimetres of ease lights up.',
      ],
      act: async (page) => {
        await page.getByRole('radio', { name: 'Borrower' }).click();
      },
    },
    {
      name: 'Fair waiting list',
      say: [
        'When three colleagues want the same sweater, the Waiting list ranks by days since last loan—so a never-borrowed newcomer wins first.',
      ],
      act: async (page) => {
        await page.goto('/#/waiting-list');
        await page.getByRole('heading', { name: 'Waiting list' }).waitFor();
      },
    },
    {
      name: 'Return slip & retirement',
      say: [
        'On the Return slip, a three-day overdue loan logs a two-dollar charity-jar donation after the one-day grace period, without ever blocking check-in.',
        'Checking in LC-03 records its twelfth wear and retires it from the chest.',
      ],
      act: async (page) => {
        await page.goto('/#/return-slip');
        await page.getByRole('row', { name: /LC-03/ }).getByRole('button', { name: 'Check in' }).click();
      },
    },
  ],
};
