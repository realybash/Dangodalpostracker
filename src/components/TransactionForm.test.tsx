import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TransactionForm } from './TransactionForm';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('TransactionForm', () => {
  const dummySettings = {
    language: 'en',
    regulatoryConfig: {
      emtlThreshold: 10000,
      emtlCharge: 50,
      vatRate: 7.5
    },
    providerConfigs: [
      {
        id: 'OPay', name: 'OPay', 
        withdrawal: { type: 'percent', value: 0.5, threshold: 20000, aboveThresholdValue: 100, aboveThresholdType: 'flat' },
        transfer: { type: 'flat', value: 20 },
        deposit: { type: 'flat', value: 20 },
        airtime: { type: 'percent', value: 0 },
        bills: { type: 'flat', value: 0 }
      }
    ]
  } as any;

  const activeUser = { id: 'user-1', name: 'Tester', role: 'Manager' } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits with 0 profit when Waive Charge is selected', () => {
    const onAddTransaction = vi.fn();
    
    render(
      <TransactionForm 
        onSave={onAddTransaction}
        availableEmployees={[]}
        terminalFeeRate={0.5}
        onClose={vi.fn()}
        settings={dummySettings}
        currentUser={activeUser}
      />
    );

    // 1. Enter amount
    const amountInput = screen.getByPlaceholderText("0.00");
    fireEvent.change(amountInput, { target: { value: '15000' } });

    // 2. Click Waive Charge
    const waiveButton = screen.getByText(/Waive Charge/i);
    fireEvent.click(waiveButton);

    // 3. Submit
    const submitButton = screen.getByText(/Confirm Receipt/i);
    fireEvent.click(submitButton);

    expect(onAddTransaction).toHaveBeenCalled();
    const submittedTx = onAddTransaction.mock.calls[0][0];
    
    // Waived transaction yields 0 profit (prevents decreasing Realized Gain)
    expect(submittedTx.profit).toBe(0);
    expect(submittedTx.customerFee).toBe(0);
  });
});
