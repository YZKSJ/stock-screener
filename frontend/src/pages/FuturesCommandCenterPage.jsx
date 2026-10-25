import { useEffect, useRef, useState } from 'react';
import ActivityIcon from '@mui/icons-material/Timeline';
import BarChart3Icon from '@mui/icons-material/BarChart';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CircleDotIcon from '@mui/icons-material/FiberManualRecord';
import Code2Icon from '@mui/icons-material/Code';
import CpuIcon from '@mui/icons-material/Memory';
import GaugeIcon from '@mui/icons-material/Speed';
import Layers3Icon from '@mui/icons-material/Layers';
import RadarIcon from '@mui/icons-material/Radar';
import ShieldCheckIcon from '@mui/icons-material/VerifiedUser';
import WavesIcon from '@mui/icons-material/Waves';
import CommodityFuturesPage from './CommodityFuturesPage';
import './FuturesCommandCenterPage.css';

const demoMarkets = [
  { symbol: 'RB', name: '螺纹钢', contract: 'RB · DEMO', price: '3,412', change: '+0.82%', up: true, wave: [22, 26, 19, 32, 28, 38, 30, 43, 36, 48, 45, 54] },
  { symbol: 'MA', name: '甲醇', contract: 'MA · DEMO', price: '2,488', change: '+1.26%', up: true, wave: [18, 16, 25, 20, 30, 27, 38, 32, 42, 40, 50, 56] },
  { symbol: 'I', name: '铁矿石', contract: 'I · DEMO', price: '782.5', change: '−0.34%', up: false, wave: [42, 46, 38, 43, 32, 36, 25, 30, 24, 28, 19, 22] },
  { symbol: 'CU', name: '沪铜', contract: 'CU · DEMO', price: '81,240', change: '+0.47%', up: true, wave: [20, 24, 21, 34, 27, 33, 29, 39, 35, 42, 38, 47] },
  { symbol: 'AG', name: '沪银', contract: 'AG · DEMO', price: '9,842', change: '−0.18%', up: false, wave: [48, 43, 47, 36, 41, 34, 38, 27, 31, 25, 29, 22] },
];

const moduleStates = [
  { name: 'WATCHER', label: '观察', score: 'READY', width: 89 },
  { name: 'ANALYST', label: '分析', score: 'READY', width: 76 },
  { name: 'RISK GATE', label: '风控', score: 'RULES', width: 94 },
  { name: 'SCANNER', label: '扫描', score: 'READY', width: 82 },
  { name: 'REPORTER', label: '研究', score: 'LOCAL', width: 68 },
  { name: 'HUMAN', label: '人工确认', score: 'WAIT', width: 48 },
];

const demoLog = [
  ['09:31:04', 'DATA', '日线研究样例已加载', 'muted'],
  ['09:31:05', 'SCAN', 'MA · 20-bar momentum +1.26%', 'up'],
  ['09:31:06', 'RISK', '仓位 / 止损规则等待用户配置', 'warn'],
  ['09:31:07', 'NOTE', '当前为演示数据，不是实时行情', 'muted'],
  ['09:31:08', 'GATE', '不发送订单 · 研究模式', 'up'],
];

function MiniWave({ points, down = false }) {
  const coords = points.map((point, i) => `${(i / (points.length - 1)) * 100},${60 - point}`).join(' ');
  return (
    <svg className={`mini-wave ${down ? 'is-down' : ''}`} viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={coords} fill="none" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function ParticleCore({ mode }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return undefined;

    let raf = 0;
    let width = 0;
    let height = 0;
    let frame = 0;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const resize = () => {
      const box = canvas.getBoundingClientRect();
      width = Math.max(1, box.width);
      height = Math.max(1, box.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    observer?.observe(canvas);

    const draw = () => {
      frame += reducedMotion ? 0 : 0.006;
      context.clearRect(0, 0, width, height);
      const cx = width * 0.5;
      const cy = height * 0.51;
      const base = Math.min(width * 0.52, height * 0.62);
      const glow = context.createRadialGradient(cx, cy, base * 0.12, cx, cy, base * 1.65);
      glow.addColorStop(0, 'rgba(6, 9, 24, 0.96)');
      glow.addColorStop(0.35, 'rgba(18, 24, 59, 0.6)');
      glow.addColorStop(0.68, 'rgba(72, 46, 191, 0.12)');
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);

      for (let ring = 0; ring < 11; ring += 1) {
        context.beginPath();
        context.ellipse(cx, cy, base * (0.5 + ring * 0.085), base * (0.21 + ring * 0.036), -0.15, 0, Math.PI * 2);
        context.strokeStyle = `rgba(${ring % 2 ? '116, 91, 255' : '70, 192, 255'}, ${0.1 + (ring % 3) * 0.025})`;
        context.lineWidth = ring === 0 ? 1.5 : 0.7;
        context.stroke();
      }

      for (let i = 0; i < 360; i += 1) {
        const angle = i * 2.399963 + frame * (i % 2 ? 1 : -0.72);
        const spread = 0.28 + ((i * 37) % 100) / 100;
        const radial = base * spread * (0.82 + 0.18 * Math.sin(frame * 2 + i));
        const x = cx + Math.cos(angle) * radial;
        const y = cy + Math.sin(angle) * radial * 0.54;
        const alpha = 0.2 + (((i * 13) % 70) / 100);
        context.beginPath();
        context.arc(x, y, i % 13 === 0 ? 1.55 : 0.7 + ((i % 3) * 0.25), 0, Math.PI * 2);
        context.fillStyle = i % 4 === 0 ? `rgba(82, 202, 255, ${alpha})` : `rgba(153, 116, 255, ${alpha})`;
        context.fill();
      }

      const hole = context.createRadialGradient(cx, cy, base * 0.08, cx, cy, base * 0.62);
      hole.addColorStop(0, 'rgba(0, 0, 4, 1)');
      hole.addColorStop(0.72, 'rgba(0, 1, 9, 0.98)');
      hole.addColorStop(0.9, 'rgba(9, 10, 29, 0.85)');
      hole.addColorStop(1, 'rgba(52, 39, 126, 0)');
      context.fillStyle = hole;
      context.beginPath();
      context.ellipse(cx, cy, base * 0.64, base * 0.40, -0.15, 0, Math.PI * 2);
      context.fill();

      const rim = context.createLinearGradient(cx - base, cy, cx + base, cy);
      rim.addColorStop(0, 'rgba(74, 160, 255, 0.02)');
      rim.addColorStop(0.35, 'rgba(94, 119, 255, 0.85)');
      rim.addColorStop(0.55, 'rgba(176, 132, 255, 0.75)');
      rim.addColorStop(1, 'rgba(73, 198, 255, 0.08)');
      context.beginPath();
      context.ellipse(cx, cy, base * 0.66, base * 0.35, -0.15, 0.04, Math.PI * 0.96);
      context.strokeStyle = rim;
      context.lineWidth = 2.2;
      context.shadowBlur = 22;
      context.shadowColor = '#7954ff';
      context.stroke();
      context.shadowBlur = 0;

      if (!reducedMotion) raf = window.requestAnimationFrame(draw);
    };

    draw();
    return () => {
      window.cancelAnimationFrame(raf);
      observer?.disconnect();
    };
  }, []);

  return (
    <div className="orbital-core" aria-label="装饰性动态粒子引擎">
      <canvas ref={canvasRef} className="orbital-canvas" />
      <div className="core-hud core-hud-left">
        <span className="hud-dot" /> RESEARCH CORE
        <strong>{mode}</strong>
        <small>视觉演示 · 非交易引擎</small>
      </div>
      <div className="core-hud core-hud-right">
        <span className="hud-dot hud-dot-blue" /> DATA LINK
        <strong>STATIC SAMPLE</strong>
        <small>没有连接实时行情</small>
      </div>
      <div className="core-label">
        <RadarIcon sx={{ fontSize: 16 }} />
        <span>ORBITAL SIGNAL SPACE</span>
      </div>
    </div>
  );
}

function SignalBars({ count = 10, className = '' }) {
  return (
    <div className={`signal-bars ${className}`} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} style={{ height: `${18 + ((i * 29 + 17) % 63)}%` }} />
      ))}
    </div>
  );
}

function toDirectoryMarket(item) {
  return {
    ...item,
    name: item.product_name || item.contract_name || item.product,
    contract: item.contract_name || item.symbol,
    price: '—',
    change: '目录',
    up: null,
    wave: [],
    isDirectory: true,
  };
}

function todayText(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dateDaysAgo(days) {
  const value = new Date();
  value.setDate(value.getDate() - days);
  return todayText(value);
}

function percentText(value) {
  return Number.isFinite(value) ? `${value > 0 ? '+' : ''}${value.toFixed(2)}%` : '—';
}

function numberText(value) {
  return Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—';
}

function linePoints(values, width = 100, height = 60, padding = 4) {
  if (!values || values.length < 2) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values.map((value, index) => {
    const x = padding + (index / (values.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((value - min) / range) * (height - 2 * padding);
    return `${x},${y}`;
  }).join(' ');
}

export default function FuturesCommandCenterPage() {
  const [selected, setSelected] = useState(demoMarkets[1]);
  const [mode, setMode] = useState('MOMENTUM');
  const [activeLog, setActiveLog] = useState('ALL');
  const [directoryItems, setDirectoryItems] = useState([]);
  const [directoryQuery, setDirectoryQuery] = useState('');
  const [directoryBusy, setDirectoryBusy] = useState(false);
  const [directoryStatus, setDirectoryStatus] = useState('loading');
  const [directoryError, setDirectoryError] = useState('');
  const [dailyHistory, setDailyHistory] = useState(null);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyError, setHistoryError] = useState('');

  const directoryAvailable = directoryStatus === 'connected' && directoryItems.length > 0;
  const selectedIsDirectory = Boolean(selected.isDirectory);
  const analysis = dailyHistory && dailyHistory.symbol === selected.symbol
    && dailyHistory.exchange === selected.exchange ? dailyHistory.analysis : null;
  const bars = analysis ? (dailyHistory.bars || []) : [];
  const latestBar = bars.length ? bars[bars.length - 1] : null;
  const displayMarkets = directoryAvailable
    ? directoryItems.slice(0, 8).map(toDirectoryMarket)
    : demoMarkets;

  useEffect(() => {
    let alive = true;
    setDirectoryStatus('loading');
    searchCommodityContracts({ q: '', limit: 30 })
      .then((result) => {
        if (!alive) return;
        const items = Array.isArray(result?.items) ? result.items : [];
        setDirectoryItems(items);
        setDirectoryStatus(items.length ? 'connected' : 'empty');
        if (items.length) {
          setSelected((current) => current.isDirectory
            ? current
            : toDirectoryMarket(items[0]));
        }
      })
      .catch(() => {
        if (alive) setDirectoryStatus('offline');
      });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    setDailyHistory(null);
    setHistoryError('');
  }, [selected.symbol, selected.exchange]);

  const searchDirectory = async (event) => {
    event.preventDefault();
    setDirectoryBusy(true);
    setDirectoryError('');
    try {
      const result = await searchCommodityContracts({ q: directoryQuery, limit: 30 });
      const items = Array.isArray(result?.items) ? result.items : [];
      setDirectoryItems(items);
      setDirectoryStatus(items.length ? 'connected' : 'empty');
      if (!items.length) {
        setDirectoryError('没有找到匹配合约。可以尝试品种代码、合约代码或中文品种名。');
      } else if (!selected.isDirectory || !items.some((item) => (
        item.symbol === selected.symbol && item.exchange === selected.exchange
      ))) {
        setSelected(toDirectoryMarket(items[0]));
      }
    } catch (error) {
      setDirectoryStatus('offline');
      const detail = error?.response?.data?.detail;
      setDirectoryError((typeof detail === 'string' ? detail : detail?.reason)
        || '合约目录接口暂不可用。请确认后端已部署且当前会话已登录。');
    } finally {
      setDirectoryBusy(false);
    }
  };

  const loadDailyHistory = async () => {
    if (!selected.isDirectory) {
      openResearch();
      return;
    }
    setHistoryBusy(true);
    setHistoryError('');
    setDailyHistory(null);
    try {
      const response = await fetchCommodityDailyHistory({
        contract: {
          symbol: selected.symbol,
          exchange: selected.exchange,
          product: selected.product,
          multiplier: Number(selected.multiplier),
          tick_size: Number(selected.tick_size),
          currency: 'CNY',
        },
        start_date: dateDaysAgo(180),
        end_date: todayText(),
      });
      setDailyHistory(response);
      if (!response?.bars?.length) {
        setHistoryError('数据源没有返回该合约的日线。合约目录可能包含暂不可查询或已过期的代码。');
      }
    } catch (error) {
      const detail = error?.response?.data?.detail;
      setHistoryError((typeof detail === 'string' ? detail : detail?.reason)
        || error?.message
        || '日线读取失败。请检查后端会话、数据源连接和合约代码覆盖。');
    } finally {
      setHistoryBusy(false);
    }
  };

  const openResearch = () => {
    document.getElementById('futures-research-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const liveLogs = dailyHistory ? [
    [dailyHistory.fetched_at ? new Date(dailyHistory.fetched_at).toLocaleTimeString() : '--:--:--',
      'DATA', `已加载 ${dailyHistory.row_count ?? dailyHistory.bars?.length ?? 0} 根日线 · ${dailyHistory.provider || 'provider'}`, 'up'],
    [dailyHistory.last_date || '--', 'SCAN',
      `收盘价 ${numberText(analysis?.latest_close)} · 趋势 ${analysis?.trend_state || '历史不足'}`, 'up'],
    [dailyHistory.last_date || '--', 'QUALITY',
      `样本数 ${dailyHistory.row_count ?? 0} · 缺失差 ${dailyHistory.end_date_lag_days ?? '未知'} 天`, 
      dailyHistory.end_date_lag_days > 7 ? 'warn' : 'muted'],
  ] : demoLog;
  const chartValues = bars.map((bar) => bar.close_price).filter(Number.isFinite);
  const liveChartPoints = linePoints(chartValues, 100, 60, 4);
  const selectedPrice = analysis?.latest_close;
  const selectedDate = analysis?.as_of_date || dailyHistory?.last_date;

  return (
    <div className="futures-command">
      <header className="fc-topbar">
        <div className="fc-brand">
          <div className="fc-brand-mark"><WavesIcon fontSize="small" /></div>
          <div>
            <div className="fc-brand-title">ORBITAL <span>FUTURES DESK</span></div>
            <div className="fc-brand-sub">DOMESTIC COMMODITY RESEARCH TERMINAL</div>
          </div>
        </div>
        <div className="fc-top-center"><span className="fc-pulse" /> RESEARCH CORE <b>{directoryAvailable ? 'DIRECTORY CONNECTED' : 'PREVIEW BUILD'}</b></div>
        <div className="fc-top-right">
          <span className="fc-mode-chip">{directoryAvailable ? 'DAILY DATA MODE' : 'DEMO MODE'}</span>
          <span>DATA SOURCE: {directoryAvailable ? 'DIRECTORY READY' : 'OFFLINE / SAMPLE'}</span>
        </div>
      </header>

      <div className="fc-disclaimer">
        <CircleDotIcon sx={{ fontSize: 14 }} />
        <span>
          {directoryAvailable
            ? <><b>已连接合约目录</b> · 合约代码和规格来自第三方参考表；选中合约后点击“加载日线研究”才会请求日线数据。此页面没有实时行情和下单功能。</>
            : <><b>演示模式</b> · 当前行情数字、指标值、状态条和日志均为样例数据；中央粒子动画仅为视觉效果。未检测到可用的后端合约目录。</>}
        </span>
      </div>

      <section className="fc-modules" aria-label="研究模块状态演示">
        {moduleStates.map((item, index) => (
          <div className="fc-module" key={item.name}>
            <div className="fc-module-head"><span>0{index + 1} / {item.name}</span><b>{item.name === 'WATCHER' && directoryAvailable ? 'CONNECTED' : item.name === 'ANALYST' && analysis ? 'LOADED' : item.score}</b></div>
            <div className="fc-module-wave"><MiniWave points={[16, 26, 20, 42, 29, 34, 25, 46, 31, 40, 52, 44]} /></div>
            <div className="fc-module-foot"><span>{item.label}</span><span>{item.name === 'WATCHER' && directoryAvailable ? 'API' : item.width + '%'}</span></div>
            <div className="fc-meter"><span style={{ width: `${item.width}%` }} /></div>
          </div>
        ))}
      </section>

      <div className="fc-main-grid">
        <aside className="fc-left-rail">
          <section className="fc-panel">
            <div className="fc-panel-title"><span>01 / MARKET WATCH</span><b>{directoryAvailable ? 'API' : 'DEMO'}</b></div>
            <form className="fc-directory-search" onSubmit={searchDirectory}>
              <input
                aria-label="Search commodity contracts"
                value={directoryQuery}
                onChange={(event) => setDirectoryQuery(event.target.value)}
                placeholder="搜索合约 / 品种代码 / 中文名"
                maxLength={64}
              />
              <button type="submit" disabled={directoryBusy}>{directoryBusy ? '...' : '搜索'}</button>
            </form>
            {directoryStatus === 'loading' && <div className="fc-inline-status">正在尝试连接后端合约目录…</div>}
            {directoryStatus === 'offline' && <div className="fc-inline-status is-warning">后端离线或未登录；以下列表为界面样例。</div>}
            {directoryError && <div className="fc-inline-status is-warning" role="status">{directoryError}</div>}
            <div className="fc-market-list">
              {displayMarkets.map((market) => (
                <button
                  key={`${market.exchange || 'DEMO'}.${market.symbol}`}
                  className={`fc-market-row ${selected.symbol === market.symbol && selected.exchange === market.exchange ? 'is-selected' : ''}`}
                  onClick={() => setSelected(market)}
                  type="button"
                  aria-label={`Select contract ${market.symbol} ${market.name}`}
                >
                  <span className="fc-market-code">{market.symbol}</span>
                  <span className="fc-market-name">{market.name}<small>{market.isDirectory ? `${market.exchange} · ${market.contract}` : market.contract}</small></span>
                  <span className="fc-market-price">
                    {market.isDirectory ? (selected.symbol === market.symbol && Number.isFinite(selectedPrice) ? numberText(selectedPrice) : '—') : market.price}
                    <small className={market.isDirectory ? 'muted-value' : market.up ? 'positive' : 'negative'}>
                      {market.isDirectory ? (selected.symbol === market.symbol && selectedDate ? selectedDate : '未加载日线') : market.change}
                    </small>
                  </span>
                  {market.wave?.length ? <MiniWave points={market.wave} down={!market.up} /> : <span className="fc-no-quote">NO QUOTE</span>}
                </button>
              ))}
            </div>
            <div className="fc-panel-foot">
              <span>{directoryAvailable ? `${directoryItems.length} 个合约目录匹配项` : '离线样例观察列表'}</span>
              <span>{directoryAvailable ? 'REF DATA' : 'DEMO ONLY'}</span>
            </div>
          </section>

          <section className="fc-panel">
            <div className="fc-panel-title"><span>02 / VOLUME PROFILE</span><b>{analysis ? 'DAILY BARS' : 'DEMO'}</b></div>
            <div className="fc-volume-graph">
              {(analysis && bars.length
                ? bars.slice(-28).map((bar) => bar.volume || 0)
                : Array.from({ length: 28 }, (_, i) => 16 + ((i * 41 + 23) % 78))
              ).map((volume, i, values) => {
                const maxVolume = Math.max(...values, 1);
                return <span key={i} style={{ height: `${Math.max(4, (volume / maxVolume) * 100)}%` }} className={i > values.length - 9 ? 'hot' : ''} />;
              })}
            </div>
            <div className="fc-panel-foot"><span>{analysis ? '所选日期区间的成交量' : '量能结构（示意）'}</span><span>{analysis ? dailyHistory.last_date : 'NO LIVE FEED'}</span></div>
          </section>

          <section className="fc-panel">
            <div className="fc-panel-title"><span>03 / RESEARCH MODES</span><b>SELECT</b></div>
            <div className="fc-mode-list">
              {[
                ['MOMENTUM', '趋势与动能', <ActivityIcon sx={{ fontSize: 15 }} />],
                ['VOLATILITY', '波动与风险', <GaugeIcon sx={{ fontSize: 15 }} />],
                ['VOLUME/OI', '成交量与持仓', <BarChart3Icon sx={{ fontSize: 15 }} />],
              ].map(([value, label, icon]) => (
                <button key={value} type="button" onClick={() => setMode(value)}
                  className={`fc-mode-button ${mode === value ? 'is-active' : ''}`}>
                  {icon}<span>{label}</span><small>{value}</small>
                </button>
              ))}
            </div>
          </section>
        </aside>

        <main className="fc-center">
          <section className="fc-core-frame">
            <div className="fc-core-top"><span><span className="fc-live-dot" /> CORE VISUALIZER</span><span>CONTRACT / {selected.symbol}</span></div>
            <ParticleCore mode={mode} />
            <div className="fc-float-card fc-float-card-a">
              <span className="fc-float-kicker"><ActivityIcon sx={{ fontSize: 12 }} /> SELECTED CONTRACT</span>
              <strong>{selected.symbol} / {selected.name}</strong>
              <small>{selected.isDirectory ? `${selected.exchange} · multiplier ${selected.multiplier} · tick ${selected.tick_size}` : `${selected.contract} · sample only`}</small>
              {selected.isDirectory && <small>最近日线：{selectedDate || '尚未加载'}</small>}
            </div>
            <div className="fc-float-card fc-float-card-b"><span className="fc-float-kicker"><ShieldCheckIcon sx={{ fontSize: 12 }} /> RESEARCH STATUS</span><strong>NO ORDER ROUTING</strong><small>仅供研究，不连接交易账户</small></div>
            <div className="fc-core-bottom"><span>VISUAL ENGINE / CANVAS PARTICLES</span><span>UI PREVIEW · V0.3</span></div>
          </section>

          <section className="fc-metric-strip">
            <div className="fc-metric">
              <span>20-BAR MOMENTUM <i>{analysis ? 'CALCULATED' : selected.isDirectory ? 'NO DATA' : 'DEMO'}</i></span>
              <strong className={analysis ? (analysis.return_20_bar_pct >= 0 ? 'positive' : 'negative') : selected.isDirectory ? 'muted-value' : 'positive'}>
                {analysis ? percentText(analysis.return_20_bar_pct) : selected.isDirectory ? '—' : '+3.8%'}
              </strong>
              {analysis && chartValues.length > 1
                ? <svg className="mini-wave" viewBox="0 0 100 60" preserveAspectRatio="none"><polyline points={liveChartPoints} fill="none" vectorEffect="non-scaling-stroke" /></svg>
                : <MiniWave points={selected.isDirectory ? [30, 30, 30, 30, 30, 30] : [18, 22, 16, 29, 24, 36, 30, 40, 34, 48, 46, 55]} />}
            </div>
            <div className="fc-metric">
              <span>REALIZED VOL <i>{analysis ? 'CALCULATED' : selected.isDirectory ? 'NO DATA' : 'DEMO'}</i></span>
              <strong>{analysis ? percentText(analysis.realized_volatility_20_annualized_pct) : selected.isDirectory ? '—' : '21.4%'}</strong>
              <MiniWave points={selected.isDirectory && !analysis ? [30, 30, 30, 30, 30, 30] : [42, 28, 35, 24, 47, 30, 43, 28, 38, 22, 32, 26]} down />
            </div>
            <div className="fc-metric">
              <span>OPEN INTEREST <i>{analysis ? 'CALCULATED' : selected.isDirectory ? 'NO DATA' : 'DEMO'}</i></span>
              <strong>{analysis ? percentText(analysis.open_interest_change_5_bar_pct) : selected.isDirectory ? '—' : '+1.2%'}</strong>
              <MiniWave points={selected.isDirectory && !analysis ? [30, 30, 30, 30, 30, 30] : [21, 32, 26, 28, 38, 35, 43, 39, 50, 45, 52, 55]} />
            </div>
            <div className="fc-metric">
              <span>DATA FRESHNESS <i>STATUS</i></span>
              <strong className="muted-value">{analysis ? 'DAILY' : selected.isDirectory ? 'WAITING' : 'OFFLINE'}</strong>
              <small>{analysis ? `最后一根：${dailyHistory.last_date || '未知'}` : selected.isDirectory ? '点击加载日线研究' : '尚未载入行情'}</small>
            </div>
          </section>
          {historyError && <div className="fc-inline-status is-warning" role="status">{historyError}</div>}
          {dailyHistory?.notes?.length > 0 && (
            <div className="fc-inline-status">{dailyHistory.notes.join(' ')}</div>
          )}
          <div className="fc-primary-action">
            <div>
              <b>{selected.isDirectory ? '加载真实日线研究' : '查看研究功能'}</b>
              <span>{selected.isDirectory
                ? '请求最近 180 天日线，计算收益、均线、波动率与持仓变化'
                : '先通过目录搜索选择真实合约，或使用下方研究面板'}</span>
            </div>
            <button type="button" disabled={historyBusy} onClick={loadDailyHistory}>
              {historyBusy ? '加载中…' : selected.isDirectory ? '加载日线研究' : '打开研究面板'}
              {historyBusy ? null : <ChevronRightIcon sx={{ fontSize: 16 }} />}
            </button>
          </div>

          <section className="fc-bottom-grid">
            <div className="fc-panel fc-code-panel">
              <div className="fc-panel-title"><span><Code2Icon sx={{ fontSize: 14 }} /> STRATEGY LOGIC / EXAMPLE</span><b>READ ONLY</b></div>
              <pre><code><span className="code-muted">01</span>  series = load_daily_bars(contract)  <span className="code-muted"># requires data</span>{'\n'}<span className="code-muted">02</span>  momentum = return_over(series, bars=20){'\n'}<span className="code-muted">03</span>  volatility = realized_vol(series, window=20){'\n'}<span className="code-muted">04</span>  quality = validate_coverage(series){'\n'}<span className="code-muted">05</span>  if quality.is_stale:{'\n'}<span className="code-muted">06</span>      flag("STALE DATA"){'\n'}<span className="code-muted">07</span>  else:{'\n'}<span className="code-muted">08</span>      report(momentum, volatility){'\n'}<span className="code-muted">09</span>  # no order submission in research mode</code></pre>
            </div>

            <div className="fc-panel fc-log-panel">
              <div className="fc-panel-title"><span><CpuIcon sx={{ fontSize: 14 }} /> EVENT LOG / {dailyHistory ? 'RESEARCH' : 'SAMPLE'}</span><div className="fc-log-filters">{['ALL', 'DATA', 'RISK'].map((tag) => <button key={tag} type="button" onClick={() => setActiveLog(tag)} className={activeLog === tag ? 'is-active' : ''}>{tag}</button>)}</div></div>
              <div className="fc-log-list">
                {liveLogs.filter((row) => activeLog === 'ALL' || row[1] === activeLog).map((row, index) => (
                  <div className="fc-log-row" key={`${row[0]}-${row[1]}-${index}`}><time>{row[0]}</time><b>{row[1]}</b><span>{row[2]}</span><i className={row[3]}>{row[3] === 'up' ? '●' : row[3] === 'warn' ? '!' : '·'}</i></div>
                ))}
              </div>
            </div>
          </section>
        </main>

        <aside className="fc-right-rail">
          <section className="fc-panel">
            <div className="fc-panel-title"><span>04 / EVIDENCE MATRIX</span><b>{analysis ? 'METRICS ONLY' : 'DEMO'}</b></div>
            <div className="fc-evidence-grid">
              {Array.from({ length: 64 }, (_, i) => <span key={i} className={`tone-${(i * 7 + Math.floor(i / 4)) % 5}`} />)}
            </div>
            <div className="fc-panel-foot"><span>信号证据矩阵（演示）</span><span>NOT COMPUTED</span></div>
          </section>

          <section className="fc-panel fc-related-panel">
            <div className="fc-panel-title"><span>05 / RELATED CONTRACTS</span><b>{directoryAvailable ? 'DIRECTORY' : 'SAMPLE'}</b></div>
            <div className="fc-related-list">
              {(directoryAvailable ? directoryItems.slice(0, 6).map(toDirectoryMarket) : demoMarkets)
                .filter((market) => market.symbol !== selected.symbol || market.exchange !== selected.exchange)
                .map((market) => (
                  <button
                    type="button"
                    className="fc-related-row"
                    key={`${market.exchange || 'DEMO'}.${market.symbol}`}
                    aria-label={`Select related contract ${market.symbol}`}
                    onClick={() => setSelected(market)}
                  >
                    <span className="fc-related-code">{market.symbol}</span>
                    <span className="fc-related-name">{market.name}</span>
                    <span className={market.isDirectory ? 'muted-value' : market.up ? 'positive' : 'negative'}>
                      {market.isDirectory ? market.exchange : market.change}
                    </span>
                    <ChevronRightIcon sx={{ fontSize: 14 }} />
                  </button>
                ))}
            </div>
            <div className="fc-panel-foot"><span>{directoryAvailable ? '目录规格 · 未代表活跃挂牌状态' : '点击切换演示合约'}</span><span>{directoryAvailable ? 'REFERENCE' : 'NOT LIVE DATA'}</span></div>
          </section>

          <section className="fc-panel fc-backtest-panel">
            <div className="fc-panel-title"><span>06 / STRATEGY RESEARCH</span><b>NOT RUN</b></div>
            <div className="fc-backtest-summary">
              <span>策略回测 / 示例布局</span>
              <strong>未运行</strong>
              <small>此处将在接入历史数据后显示回测结果</small>
            </div>
            <svg className="fc-backtest-chart" viewBox="0 0 320 100" role="img" aria-label="装饰性曲线，非真实回测结果">
              <defs>
                <linearGradient id="fc-backtest-area" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#8b65ff" stopOpacity=".35" />
                  <stop offset="100%" stopColor="#8b65ff" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0 82 L20 77 L38 81 L55 65 L73 69 L95 57 L111 61 L130 44 L151 53 L173 36 L194 41 L216 27 L233 32 L256 18 L277 25 L297 12 L320 8 L320 100 L0 100 Z" fill="url(#fc-backtest-area)" />
              <polyline points="0,82 20,77 38,81 55,65 73,69 95,57 111,61 130,44 151,53 173,36 194,41 216,27 233,32 256,18 277,25 297,12 320,8" fill="none" stroke="#9e7dff" strokeWidth="2.4" />
              <polyline points="0,88 20,86 38,85 55,82 73,84 95,78 111,80 130,71 151,75 173,67 194,70 216,62 233,64 256,56 277,58 297,50 320,47" fill="none" stroke="#5ad9ff" strokeWidth="1.5" opacity=".82" />
              {[20,55,90,125,160,195,230,265,300].map((x) => <line key={x} x1={x} y1="0" x2={x} y2="100" stroke="rgba(111,139,214,.10)" />)}
            </svg>
            <div className="fc-backtest-stats">
              <div><small>总收益率</small><b>未计算</b></div>
              <div><small>最大回撤</small><b>未计算</b></div>
              <div><small>胜率</small><b>未计算</b></div>
            </div>
            <div className="fc-panel-foot"><span>装饰曲线 · 非结果</span><span>DEMO ONLY</span></div>
          </section>

          <section className="fc-panel">
            <div className="fc-panel-title"><span>07 / RISK GATE</span><b>RULES NEEDED</b></div>
            <div className="fc-gauge">
              <div className="fc-gauge-ring"><div className="fc-gauge-needle" /></div>
              <strong>未评估</strong>
              <span>风险指标需要真实数据和用户规则</span>
            </div>
            <div className="fc-risk-stats">
              <div><small>止损</small><b>未配置</b></div>
              <div><small>敞口</small><b>未计算</b></div>
              <div><small>保证金</small><b>未计算</b></div>
            </div>
          </section>

          <section className="fc-panel fc-handoff-panel">
            <div className="fc-panel-title"><span>08 / WORKFLOW</span><b>CONCEPT</b></div>
            {moduleStates.slice(0, 5).map((item) => (
              <div className="fc-handoff-row" key={item.name}>
                <span>{item.name}</span><div><span style={{ width: `${item.width}%` }} /></div><small>{item.label}</small>
              </div>
            ))}
            <p>这些条目是界面概念，不代表后台智能体正在运行。</p>
          </section>
        </aside>
      </div>

      <footer className="fc-footer"><span><Layers3Icon sx={{ fontSize: 13 }} /> ORBITAL FUTURES DESK</span><span>日线研究 · 数据可追溯 · 不自动下单</span><span>BUILD 0.3 / API-READY</span></footer>

      <section id="futures-research-form" className="fc-real-research">
        <div className="fc-real-heading">
          <div className="fc-section-kicker">LIVE RESEARCH WORKFLOW</div>
          <h2>合约扫描与研究</h2>
          <p>下面保留完整的合约目录和多合约日线扫描。当前顶层面板可单独请求一个合约的真实日线；若后端不可用，会明确显示离线状态。</p>
        </div>
        <CommodityFuturesPage />
      </section>
    </div>
  );
}
