import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import FuturesCommandCenterPage from './FuturesCommandCenterPage';

vi.mock('./CommodityFuturesPage', () => ({
  default: () => <section id="futures-research-form">Real research form</section>,
}));

describe('FuturesCommandCenterPage', () => {
  it('labels demo data and allows changing market and research mode', () => {
    render(<FuturesCommandCenterPage />);
    expect(screen.getByText(/当前行情数字、指标值、状态条和日志均为样例数据/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /RB 螺纹钢/ }));
    expect(screen.getByText(/RB \/ 螺纹钢/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /波动与风险/ }));
    expect(screen.getByText('VOLATILITY')).toBeInTheDocument();
  });

  it('filters the example event log', () => {
    render(<FuturesCommandCenterPage />);
    fireEvent.click(screen.getByRole('button', { name: 'RISK' }));
    expect(screen.getByText(/仓位 \/ 止损规则等待用户配置/)).toBeInTheDocument();
    expect(screen.queryByText(/日线研究样例已加载/)).not.toBeInTheDocument();
  });
});
