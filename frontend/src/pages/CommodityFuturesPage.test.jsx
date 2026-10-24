import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CommodityFuturesPage from './CommodityFuturesPage';

const scanMock = vi.hoisted(() => ({ scan: vi.fn() }));
vi.mock('../api/derivatives', () => ({ scanCommodityFutures: scanMock.scan }));

describe('CommodityFuturesPage', () => {
  beforeEach(() => scanMock.scan.mockReset());

  it('submits the selected contracts and shows scan results', async () => {
    scanMock.scan.mockResolvedValue({
      requested_count: 2, scanned_count: 2, failed_count: 0,
      requested_start_date: '2026-06-01', requested_end_date: '2026-10-24',
      items: [{
        symbol: 'MA701', exchange: 'CZCE', status: 'ok', rank: 1,
        series_kind: 'single_contract',
        analysis: {
          latest_close: 2500, return_1_bar_pct: 0.5, return_5_bar_pct: 2.1,
          return_20_bar_pct: 8.2, realized_volatility_20_annualized_pct: 25.4,
          volume_ratio_5_to_previous_20: 1.5, open_interest_change_5_bar_pct: 4.3,
          trend_state: 'uptrend',
        },
      }],
    });
    render(<CommodityFuturesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Run research scan' }));
    await screen.findByText('Scan results');
    expect(scanMock.scan).toHaveBeenCalledTimes(1);
    expect(scanMock.scan.mock.calls[0][0].contracts).toHaveLength(2);
    expect(screen.getByText('MA701')).toBeInTheDocument();
    expect(screen.getByText('8.20%')).toBeInTheDocument();
  });

  it('prevents duplicate contract/exchange pairs', async () => {
    scanMock.scan.mockResolvedValue({ items: [] });
    render(<CommodityFuturesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Run research scan' }));
    await waitFor(() => expect(scanMock.scan).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getAllByLabelText(/Contract code/)[1], { target: { value: 'MA701' } });
    fireEvent.change(screen.getAllByLabelText(/Exchange/)[1], { target: { value: 'CZCE' } });
    fireEvent.click(screen.getByRole('button', { name: 'Run research scan' }));
    expect(await screen.findByText(/must be unique/)).toBeInTheDocument();
    expect(scanMock.scan).toHaveBeenCalledTimes(1);
  });
});
