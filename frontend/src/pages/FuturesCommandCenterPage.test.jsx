import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FuturesCommandCenterPage from './FuturesCommandCenterPage';

const apiMocks = vi.hoisted(() => ({
  search: vi.fn(),
  history: vi.fn(),
  scan: vi.fn(),
}));

vi.mock('../api/derivatives', () => ({
  searchCommodityContracts: apiMocks.search,
  fetchCommodityDailyHistory: apiMocks.history,
  scanCommodityFutures: apiMocks.scan,
}));

vi.mock('./CommodityFuturesPage', () => ({
  default: () => <section id="futures-research-form">Real research form</section>,
}));

describe('FuturesCommandCenterPage', () => {
  beforeEach(() => {
    apiMocks.search.mockReset().mockResolvedValue({ items: [] });
    apiMocks.history.mockReset();
    apiMocks.scan.mockReset();
  });

  it('labels offline demo data and allows changing market and research mode', async () => {
    render(<FuturesCommandCenterPage />);
    expect(screen.getByText(/演示模式/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Select contract RB 螺纹钢/ }));
    expect(screen.getByText(/RB \/ 螺纹钢/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /波动与风险/ }));
    expect(screen.getAllByText('VOLATILITY').length).toBeGreaterThan(0);
    await waitFor(() => expect(apiMocks.search).toHaveBeenCalledTimes(1));
  });

  it('uses the real contract directory and daily-history endpoint when available', async () => {
    apiMocks.search.mockResolvedValue({
      items: [{
        symbol: 'RB2601', exchange: 'SHFE', product: 'RB', product_name: '螺纹钢',
        contract_name: '螺纹钢2601', multiplier: 10, tick_size: 1,
      }],
    });
    apiMocks.history.mockResolvedValue({
      symbol: 'RB2601', exchange: 'SHFE', provider: 'akshare:futures_zh_daily_sina',
      fetched_at: '2026-10-25T00:00:00Z', last_date: '2026-10-24', row_count: 21,
      end_date_lag_days: 1, notes: [], bars: Array.from({ length: 21 }, (_, i) => ({
        trading_date: `2026-10-${String(i + 1).padStart(2, '0')}`,
        close_price: 3000 + i * 2, volume: 100 + i, open_interest: 500 + i,
      })),
      analysis: {
        as_of_date: '2026-10-24', bar_count: 21, latest_close: 3040,
        return_20_bar_pct: 1.34, realized_volatility_20_annualized_pct: 12.5,
        open_interest_change_5_bar_pct: 1.8, trend_state: 'uptrend',
      },
    });
    render(<FuturesCommandCenterPage />);
    const contract = await screen.findByRole('button', { name: /Select contract RB2601/ });
    fireEvent.click(contract);
    expect(screen.getByText(/SHFE · multiplier 10 · tick 1/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /加载日线研究/ }));
    await screen.findByText(/akshare:futures_zh_daily_sina/);
    expect(apiMocks.history).toHaveBeenCalledTimes(1);
    expect(screen.getByText('+1.34%')).toBeInTheDocument();
    expect(screen.getByText(/12\\.5/)).toBeInTheDocument();
    expect(screen.getByText(/实际历史收盘价计算/)).toBeInTheDocument();
  });

  it('filters the example event log', () => {
    render(<FuturesCommandCenterPage />);
    fireEvent.click(screen.getByRole('button', { name: 'RISK' }));
    expect(screen.getByText(/仓位 \/ 止损规则等待用户配置/)).toBeInTheDocument();
    expect(screen.queryByText(/日线研究样例已加载/)).not.toBeInTheDocument();
  });
});
