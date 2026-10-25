import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CommodityFuturesPage from './CommodityFuturesPage';

const apiMocks = vi.hoisted(() => ({ scan: vi.fn(), directory: vi.fn() }));
vi.mock('../api/derivatives', () => ({
  scanCommodityFutures: apiMocks.scan,
  searchCommodityContracts: apiMocks.directory,
}));

const directoryResult = {
  provider: 'akshare:futures_fees_info/openctp',
  fetched_at: '2026-10-25T00:00:00Z',
  source_updated_at: '2026-10-24T12:30:00Z',
  result_count: 1,
  total_count: 1,
  rows_skipped: 0,
  notes: ['Reference only'],
  items: [{
    symbol: 'MA701', exchange: 'CZCE', product: 'MA',
    product_name: '甲醇', contract_name: '甲醇701',
    multiplier: 10, tick_size: 1,
  }],
};

describe('CommodityFuturesPage', () => {
  beforeEach(() => {
    apiMocks.scan.mockReset();
    apiMocks.directory.mockReset();
  });

  it('uses directory metadata to fill a contract and then scans it', async () => {
    apiMocks.directory.mockResolvedValue(directoryResult);
    apiMocks.scan.mockResolvedValue({
      requested_count: 1, scanned_count: 1, failed_count: 0,
      requested_start_date: '2026-06-01', requested_end_date: '2026-10-24',
      items: [{
        symbol: 'MA701', exchange: 'CZCE', status: 'ok', rank: 1,
        series_kind: 'single_contract', quality_warnings: [],
        analysis: {
          latest_close: 2500, return_1_bar_pct: 0.5, return_5_bar_pct: 2.1,
          return_20_bar_pct: 8.2, realized_volatility_20_annualized_pct: 25.4,
          volume_ratio_5_to_previous_20: 1.5, open_interest_change_5_bar_pct: 4.3,
          trend_state: 'uptrend',
        },
      }],
    });
    render(<CommodityFuturesPage />);
    fireEvent.change(screen.getByLabelText('Search contract directory'), { target: { value: 'MA' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search directory' }));
    expect(await screen.findByText(/甲醇701/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Use MA701' }));
    expect(screen.getByLabelText('Contract code 1')).toHaveValue('MA701');
    expect(screen.getByText(/tick value 10 CNY\/lot/)).toBeInTheDocument();
    expect(screen.getByText(/akshare:futures_fees_info\/openctp/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Run research scan' }));
    await screen.findByText('Scan results');
    expect(apiMocks.scan).toHaveBeenCalledTimes(1);
    expect(apiMocks.scan.mock.calls[0][0].contracts).toEqual([{
      symbol: 'MA701', exchange: 'CZCE', product: 'MA',
      multiplier: 10, tick_size: 1, currency: 'CNY',
    }]);
    expect(screen.getAllByText('8.20%')).toHaveLength(2);
  });

  it('prevents duplicate contract/exchange pairs', async () => {
    apiMocks.directory.mockResolvedValue(directoryResult);
    apiMocks.scan.mockResolvedValue({ items: [] });
    render(<CommodityFuturesPage />);
    fireEvent.change(screen.getByLabelText('Search contract directory'), { target: { value: 'MA' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search directory' }));
    await screen.findByText(/甲醇701/);
    fireEvent.click(screen.getByRole('button', { name: 'Use MA701' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add contract' }));
    fireEvent.change(screen.getByLabelText('Contract code 2'), { target: { value: 'MA701' } });
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Exchange 2' }));
    fireEvent.click(await screen.findByRole('option', { name: 'CZCE · Zhengzhou' }));
    fireEvent.change(screen.getByLabelText('Product 2'), { target: { value: 'MA' } });
    fireEvent.change(screen.getByLabelText('Multiplier 2'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Tick size 2'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Run research scan' }));
    expect(await screen.findByText(/must be unique/)).toBeInTheDocument();
    expect(apiMocks.scan).not.toHaveBeenCalled();
  });

  it('does not scan an empty contract form', async () => {
    render(<CommodityFuturesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Run research scan' }));
    expect(await screen.findByText(/Complete each contract code/)).toBeInTheDocument();
    expect(apiMocks.scan).not.toHaveBeenCalled();
  });
});
