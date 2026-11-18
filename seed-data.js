'use strict';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function getCurrentMonth(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

function shiftMonth(monthStr, offset) {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(y, m - 1 + offset, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function createEmptyState() {
  return {
    version: 1,
    settings: {
      currency: 'GBP',
      weeklyCalcMode: 'exact',
      safetyBuffer: 250,
      householdName: 'Household Finance Hub'
    },
    entries: [],
    monthOverrides: {},
    savingsAccounts: [],
    savingsTransactions: []
  };
}

function createSeedState(anchorMonth = getCurrentMonth()) {
  const mMinus3 = shiftMonth(anchorMonth, -3);
  const mMinus2 = shiftMonth(anchorMonth, -2);
  const mMinus1 = shiftMonth(anchorMonth, -1);
  const mNow = anchorMonth;
  const mPlus1 = shiftMonth(anchorMonth, 1);
  const mPlus2 = shiftMonth(anchorMonth, 2);
  const mPlus3 = shiftMonth(anchorMonth, 3);
  const mPlus4 = shiftMonth(anchorMonth, 4);

  const entries = [
    // --- MONTHLY RECURRING INCOMES ---
    {
      id: 'inc_primary_salary',
      kind: 'income',
      title: 'Primary Household Salary',
      category: 'Salary',
      frequency: 'monthly',
      amount: 3250,
      dayOfMonth: 28,
      dayOfWeek: null,
      month: null,
      date: null,
      startMonth: mMinus3,
      endMonth: null,
      essential: true,
      notes: 'Net monthly take-home pay',
      createdAt: `${mMinus3}-01T09:00:00.000Z`
    },
    {
      id: 'inc_partner_salary',
      kind: 'income',
      title: 'Partner Monthly Salary',
      category: 'Salary',
      frequency: 'monthly',
      amount: 2180,
      dayOfMonth: 25,
      dayOfWeek: null,
      month: null,
      date: null,
      startMonth: mMinus3,
      endMonth: null,
      essential: true,
      notes: 'Net monthly salary transfer',
      createdAt: `${mMinus3}-01T09:05:00.000Z`
    },
    // --- WEEKLY INCOME ---
    {
      id: 'inc_weekly_freelance',
      kind: 'income',
      title: 'Weekend Design Retainer',
      category: 'Freelance',
      frequency: 'weekly',
      amount: 110,
      dayOfMonth: null,
      dayOfWeek: 5, // Friday
      month: null,
      date: null,
      startMonth: mMinus3,
      endMonth: null,
      essential: false,
      notes: 'Paid every Friday',
      createdAt: `${mMinus3}-02T10:00:00.000Z`
    },
    // --- ONE-OFF INCOMES (PAST, CURRENT, FUTURE) ---
    {
      id: 'inc_oneoff_tax_rebate',
      kind: 'income',
      title: 'HMRC Tax Rebate',
      category: 'Refund / Rebate',
      frequency: 'one-off',
      amount: 340,
      dayOfMonth: 14,
      dayOfWeek: null,
      month: mMinus2,
      date: `${mMinus2}-14`,
      startMonth: null,
      endMonth: null,
      essential: false,
      notes: 'Overpaid tax refund received in bank',
      createdAt: `${mMinus2}-14T11:00:00.000Z`
    },
    {
      id: 'inc_oneoff_vinted',
      kind: 'income',
      title: 'Spare Room Clearout Sales',
      category: 'Side Income',
      frequency: 'one-off',
      amount: 165,
      dayOfMonth: 9,
      dayOfWeek: null,
      month: mNow,
      date: `${mNow}-09`,
      startMonth: null,
      endMonth: null,
      essential: false,
      notes: 'Sold unused tech & winter gear',
      createdAt: `${mNow}-09T14:20:00.000Z`
    },
    {
      id: 'inc_oneoff_year_bonus',
      kind: 'income',
      title: 'Annual Performance Bonus',
      category: 'Bonus',
      frequency: 'one-off',
      amount: 950,
      dayOfMonth: 20,
      dayOfWeek: null,
      month: mPlus2,
      date: `${mPlus2}-20`,
      startMonth: null,
      endMonth: null,
      essential: false,
      notes: 'Expected net year-end bonus',
      createdAt: `${mNow}-01T09:00:00.000Z`
    },

    // --- MONTHLY DIRECT DEBITS (OUTGOINGS) ---
    {
      id: 'out_dd_mortgage',
      kind: 'outgoing',
      title: 'Mortgage / Rent Direct Debit',
      category: 'Housing',
      frequency: 'monthly',
      amount: 1450,
      dayOfMonth: 1,
      dayOfWeek: null,
      month: null,
      date: null,
      startMonth: mMinus3,
      endMonth: null,
      essential: true,
      notes: 'Fixed monthly housing payment',
      createdAt: `${mMinus3}-01T09:00:00.000Z`
    },
    {
      id: 'out_dd_council_tax',
      kind: 'outgoing',
      title: 'Council Tax DD',
      category: 'Bills & Utilities',
      frequency: 'monthly',
      amount: 186,
      dayOfMonth: 3,
      dayOfWeek: null,
      month: null,
      date: null,
      startMonth: mMinus3,
      endMonth: null,
      essential: true,
      notes: 'Local authority monthly DD',
      createdAt: `${mMinus3}-01T09:10:00.000Z`
    },
    {
      id: 'out_dd_energy',
      kind: 'outgoing',
      title: 'Gas & Electricity Direct Debit',
      category: 'Bills & Utilities',
      frequency: 'monthly',
      amount: 168,
      dayOfMonth: 8,
      dayOfWeek: null,
      month: null,
      date: null,
      startMonth: mMinus3,
      endMonth: null,
      essential: true,
      notes: 'Dual fuel fixed monthly DD',
      createdAt: `${mMinus3}-01T09:15:00.000Z`
    },
    {
      id: 'out_dd_water',
      kind: 'outgoing',
      title: 'Water Utility DD',
      category: 'Bills & Utilities',
      frequency: 'monthly',
      amount: 46,
      dayOfMonth: 12,
      dayOfWeek: null,
      month: null,
      date: null,
      startMonth: mMinus3,
      endMonth: null,
      essential: true,
      notes: 'Monthly water & sewerage',
      createdAt: `${mMinus3}-01T09:20:00.000Z`
    },
    {
      id: 'out_dd_broadband',
      kind: 'outgoing',
      title: 'Fibre Broadband & Mobile DD',
      category: 'Subscriptions & Telecoms',
      frequency: 'monthly',
      amount: 64,
      dayOfMonth: 15,
      dayOfWeek: null,
      month: null,
      date: null,
      startMonth: mMinus3,
      endMonth: null,
      essential: true,
      notes: 'Gigabit broadband + SIM plans',
      createdAt: `${mMinus3}-01T09:25:00.000Z`
    },
    {
      id: 'out_dd_home_ins',
      kind: 'outgoing',
      title: 'Home & Contents Insurance DD',
      category: 'Insurance',
      frequency: 'monthly',
      amount: 34,
      dayOfMonth: 18,
      dayOfWeek: null,
      month: null,
      date: null,
      startMonth: mMinus3,
      endMonth: null,
      essential: true,
      notes: 'Buildings and contents cover',
      createdAt: `${mMinus3}-01T09:30:00.000Z`
    },
    {
      id: 'out_dd_streaming',
      kind: 'outgoing',
      title: 'Streaming & Cloud Bundle',
      category: 'Subscriptions & Telecoms',
      frequency: 'monthly',
      amount: 29,
      dayOfMonth: 22,
      dayOfWeek: null,
      month: null,
      date: null,
      startMonth: mMinus3,
      endMonth: null,
      essential: false,
      notes: 'Family music, TV & iCloud storage',
      createdAt: `${mMinus3}-01T09:35:00.000Z`
    },

    // --- WEEKLY DIRECT DEBITS (OUTGOINGS) ---
    {
      id: 'out_wdd_groceries',
      kind: 'outgoing',
      title: 'Weekly Supermarket Delivery DD',
      category: 'Groceries',
      frequency: 'weekly',
      amount: 125,
      dayOfMonth: null,
      dayOfWeek: 5, // Friday
      month: null,
      date: null,
      startMonth: mMinus3,
      endMonth: null,
      essential: true,
      notes: 'Recurring Friday household food shop',
      createdAt: `${mMinus3}-01T10:00:00.000Z`
    },
    {
      id: 'out_wdd_childcare',
      kind: 'outgoing',
      title: 'Weekly Clubs & Childcare DD',
      category: 'Family & Childcare',
      frequency: 'weekly',
      amount: 85,
      dayOfMonth: null,
      dayOfWeek: 1, // Monday
      month: null,
      date: null,
      startMonth: mMinus3,
      endMonth: null,
      essential: true,
      notes: 'Every Monday morning direct debit',
      createdAt: `${mMinus3}-01T10:05:00.000Z`
    },
    {
      id: 'out_wdd_fuel_gym',
      kind: 'outgoing',
      title: 'Weekly Transport & Fitness Pot DD',
      category: 'Transport & Health',
      frequency: 'weekly',
      amount: 42,
      dayOfMonth: null,
      dayOfWeek: 3, // Wednesday
      month: null,
      date: null,
      startMonth: mMinus3,
      endMonth: null,
      essential: false,
      notes: 'Wednesday commuter rail & swim pass',
      createdAt: `${mMinus3}-01T10:10:00.000Z`
    },

    // --- ONE-OFF OUTGOINGS (PAST, CURRENT, FUTURE) ---
    {
      id: 'out_oneoff_summer_trip',
      kind: 'outgoing',
      title: 'Summer Coastal Weekend',
      category: 'Leisure & Travel',
      frequency: 'one-off',
      amount: 410,
      dayOfMonth: 19,
      dayOfWeek: null,
      month: mMinus3,
      date: `${mMinus3}-19`,
      startMonth: null,
      endMonth: null,
      essential: false,
      notes: 'Cottage booking & fuel',
      createdAt: `${mMinus3}-19T12:00:00.000Z`
    },
    {
      id: 'out_oneoff_school_uniform',
      kind: 'outgoing',
      title: 'Autumn Gear & Shoes',
      category: 'Shopping',
      frequency: 'one-off',
      amount: 195,
      dayOfMonth: 7,
      dayOfWeek: null,
      month: mMinus2,
      date: `${mMinus2}-07`,
      startMonth: null,
      endMonth: null,
      essential: true,
      notes: 'Seasonal clothing & raincoats',
      createdAt: `${mMinus2}-07T15:00:00.000Z`
    },
    {
      id: 'out_oneoff_boiler',
      kind: 'outgoing',
      title: 'Annual Boiler Service',
      category: 'Housing',
      frequency: 'one-off',
      amount: 115,
      dayOfMonth: 16,
      dayOfWeek: null,
      month: mMinus1,
      date: `${mMinus1}-16`,
      startMonth: null,
      endMonth: null,
      essential: true,
      notes: 'Gas Safe annual check',
      createdAt: `${mMinus1}-16T11:30:00.000Z`
    },
    {
      id: 'out_oneoff_car_mot',
      kind: 'outgoing',
      title: 'Car MOT & Full Service',
      category: 'Transport & Health',
      frequency: 'one-off',
      amount: 285,
      dayOfMonth: 12,
      dayOfWeek: null,
      month: mNow,
      date: `${mNow}-12`,
      startMonth: null,
      endMonth: null,
      essential: true,
      notes: 'Annual garage service + brake fluid',
      createdAt: `${mNow}-12T10:15:00.000Z`
    },
    {
      id: 'out_oneoff_winter_coat',
      kind: 'outgoing',
      title: 'Winter Waterproof Coat & Boots',
      category: 'Shopping',
      frequency: 'one-off',
      amount: 145,
      dayOfMonth: 21,
      dayOfWeek: null,
      month: mNow,
      date: `${mNow}-21`,
      startMonth: null,
      endMonth: null,
      essential: false,
      notes: 'Scheduled one-off purchase',
      createdAt: `${mNow}-10T16:00:00.000Z`
    },
    {
      id: 'out_oneoff_christmas',
      kind: 'outgoing',
      title: 'Christmas Gifts & Family Hosting',
      category: 'Gifts & Celebrations',
      frequency: 'one-off',
      amount: 680,
      dayOfMonth: 15,
      dayOfWeek: null,
      month: mPlus1,
      date: `${mPlus1}-15`,
      startMonth: null,
      endMonth: null,
      essential: false,
      notes: 'Planned December holiday budget',
      createdAt: `${mNow}-05T09:00:00.000Z`
    },
    {
      id: 'out_oneoff_car_ins',
      kind: 'outgoing',
      title: 'Annual Car Insurance Renewal',
      category: 'Insurance',
      frequency: 'one-off',
      amount: 540,
      dayOfMonth: 10,
      dayOfWeek: null,
      month: mPlus2,
      date: `${mPlus2}-10`,
      startMonth: null,
      endMonth: null,
      essential: true,
      notes: 'Paid annually to avoid monthly APR',
      createdAt: `${mNow}-05T09:15:00.000Z`
    },
    {
      id: 'out_oneoff_dentist',
      kind: 'outgoing',
      title: 'Dental Checkup & Hygiene',
      category: 'Transport & Health',
      frequency: 'one-off',
      amount: 130,
      dayOfMonth: 8,
      dayOfWeek: null,
      month: mPlus3,
      date: `${mPlus3}-08`,
      startMonth: null,
      endMonth: null,
      essential: true,
      notes: 'Routine 6-month checkup',
      createdAt: `${mNow}-05T09:30:00.000Z`
    },
    {
      id: 'out_oneoff_spring_holiday',
      kind: 'outgoing',
      title: 'Spring Holiday Flight Deposit',
      category: 'Leisure & Travel',
      frequency: 'one-off',
      amount: 520,
      dayOfMonth: 14,
      dayOfWeek: null,
      month: mPlus4,
      date: `${mPlus4}-14`,
      startMonth: null,
      endMonth: null,
      essential: false,
      notes: 'Easter getaway advance deposit',
      createdAt: `${mNow}-05T09:45:00.000Z`
    }
  ];

  const monthOverrides = {
    [`out_dd_energy_${mMinus3}`]: { status: 'paid', amount: 142, note: 'Summer lower direct debit' },
    [`out_dd_energy_${mMinus2}`]: { status: 'paid', amount: 148, note: 'Early autumn rate' },
    [`out_dd_mortgage_${mNow}`]: { status: 'paid' },
    [`out_dd_council_tax_${mNow}`]: { status: 'paid' },
    [`out_dd_energy_${mNow}`]: { status: 'paid' },
    [`out_dd_water_${mNow}`]: { status: 'paid' },
    [`out_dd_broadband_${mNow}`]: { status: 'paid' },
    [`out_oneoff_car_mot_${mNow}`]: { status: 'paid' },
    [`inc_oneoff_vinted_${mNow}`]: { status: 'paid' }
  };

  const savingsAccounts = [
    {
      id: 'sav_emergency',
      name: 'Emergency Fund (Easy Access)',
      type: 'savings',
      openingBalance: 7400,
      targetAmount: 12000,
      interestRate: 4.65,
      allocationWeight: 40,
      color: '#10b981',
      notes: '6-month household safety cushion',
      createdAt: `${mMinus3}-01T08:00:00.000Z`
    },
    {
      id: 'sav_isa',
      name: 'Stocks & Shares ISA',
      type: 'isa',
      openingBalance: 14200,
      targetAmount: 25000,
      interestRate: 7.2,
      allocationWeight: 35,
      color: '#6366f1',
      notes: 'Long-term global index tracker',
      createdAt: `${mMinus3}-01T08:05:00.000Z`
    },
    {
      id: 'sav_holiday',
      name: 'Holiday & Travel Pot',
      type: 'cash',
      openingBalance: 1150,
      targetAmount: 3000,
      interestRate: 3.8,
      allocationWeight: 15,
      color: '#f59e0b',
      notes: 'Sinking fund for trips & flights',
      createdAt: `${mMinus3}-01T08:10:00.000Z`
    },
    {
      id: 'sav_home',
      name: 'Home Improvement Reserve',
      type: 'savings',
      openingBalance: 3200,
      targetAmount: 8000,
      interestRate: 4.4,
      allocationWeight: 10,
      color: '#06b6d4',
      notes: 'Kitchen & garden upgrade fund',
      createdAt: `${mMinus3}-01T08:15:00.000Z`
    },
    {
      id: 'asset_family_car',
      name: 'Family Car (Estimated Asset)',
      type: 'asset',
      openingBalance: 11500,
      targetAmount: 0,
      interestRate: 0,
      allocationWeight: 0,
      color: '#8b5cf6',
      notes: 'Tracked physical asset value',
      createdAt: `${mMinus3}-01T08:20:00.000Z`
    }
  ];

  const savingsTransactions = [
    {
      id: 'stx_1',
      accountId: 'sav_emergency',
      type: 'deposit',
      amount: 600,
      date: `${mMinus3}-29`,
      month: mMinus3,
      category: 'Monthly Allocation',
      note: 'Monthly surplus allocation',
      createdAt: `${mMinus3}-29T18:00:00.000Z`
    },
    {
      id: 'stx_2',
      accountId: 'sav_isa',
      type: 'deposit',
      amount: 550,
      date: `${mMinus3}-29`,
      month: mMinus3,
      category: 'Monthly Allocation',
      note: 'Automated ISA transfer',
      createdAt: `${mMinus3}-29T18:05:00.000Z`
    },
    {
      id: 'stx_3',
      accountId: 'sav_holiday',
      type: 'withdrawal',
      amount: 280,
      date: `${mMinus3}-20`,
      month: mMinus3,
      category: 'Withdrawal',
      note: 'Covered summer weekend extras',
      createdAt: `${mMinus3}-20T12:00:00.000Z`
    },
    {
      id: 'stx_4',
      accountId: 'sav_emergency',
      type: 'deposit',
      amount: 700,
      date: `${mMinus2}-29`,
      month: mMinus2,
      category: 'Monthly Allocation',
      note: 'Allocated tax rebate + surplus',
      createdAt: `${mMinus2}-29T18:00:00.000Z`
    },
    {
      id: 'stx_5',
      accountId: 'sav_isa',
      type: 'deposit',
      amount: 600,
      date: `${mMinus2}-29`,
      month: mMinus2,
      category: 'Monthly Allocation',
      note: 'ISA monthly contribution',
      createdAt: `${mMinus2}-29T18:05:00.000Z`
    },
    {
      id: 'stx_6',
      accountId: 'sav_holiday',
      type: 'deposit',
      amount: 350,
      date: `${mMinus2}-29`,
      month: mMinus2,
      category: 'Monthly Allocation',
      note: 'Replenish travel pot',
      createdAt: `${mMinus2}-29T18:10:00.000Z`
    },
    {
      id: 'stx_7',
      accountId: 'sav_emergency',
      type: 'deposit',
      amount: 550,
      date: `${mMinus1}-29`,
      month: mMinus1,
      category: 'Monthly Allocation',
      note: 'October surplus transfer',
      createdAt: `${mMinus1}-29T18:00:00.000Z`
    },
    {
      id: 'stx_8',
      accountId: 'sav_isa',
      type: 'deposit',
      amount: 550,
      date: `${mMinus1}-29`,
      month: mMinus1,
      category: 'Monthly Allocation',
      note: 'ISA monthly contribution',
      createdAt: `${mMinus1}-29T18:05:00.000Z`
    },
    {
      id: 'stx_9',
      accountId: 'sav_home',
      type: 'deposit',
      amount: 450,
      date: `${mMinus1}-29`,
      month: mMinus1,
      category: 'Monthly Allocation',
      note: 'Home reserve addition',
      createdAt: `${mMinus1}-29T18:10:00.000Z`
    },
    {
      id: 'stx_10',
      accountId: 'sav_home',
      type: 'withdrawal',
      amount: 190,
      date: `${mNow}-05`,
      month: mNow,
      category: 'Withdrawal',
      note: 'Bought hallway radiator valve & tools',
      createdAt: `${mNow}-05T11:30:00.000Z`
    },
    {
      id: 'stx_11',
      accountId: 'sav_isa',
      type: 'deposit',
      amount: 400,
      date: `${mNow}-02`,
      month: mNow,
      category: 'Monthly Allocation',
      note: 'Early-month standing ISA order',
      createdAt: `${mNow}-02T09:00:00.000Z`
    },
    {
      id: 'stx_12',
      accountId: 'asset_family_car',
      type: 'adjustment',
      amount: -250,
      date: `${mNow}-01`,
      month: mNow,
      category: 'Valuation Update',
      note: 'Quarterly car depreciation check',
      createdAt: `${mNow}-01T09:00:00.000Z`
    }
  ];

  return {
    version: 1,
    settings: {
      currency: 'GBP',
      weeklyCalcMode: 'exact',
      safetyBuffer: 250,
      householdName: 'Household Finance Hub'
    },
    entries,
    monthOverrides,
    savingsAccounts,
    savingsTransactions
  };
}

module.exports = {
  createSeedState,
  createEmptyState,
  getCurrentMonth,
  shiftMonth
};
