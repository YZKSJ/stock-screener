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
      const base = Math.min(width * 0.43, height * 0.34);
      const glow = context.createRadialGradient(cx, cy, base * 0.12, cx, cy, base * 1.65);
      glow.addColorStop(0, 'rgba(6, 9, 24, 0.96)');
      glow.addColorStop(0.35, 'rgba(18, 24, 59, 0.6)');
      glow.addColorStop(0.68, 'rgba(72, 46, 191, 0.12)');
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);

      for (let ring = 0; ring < 9; ring += 1) {
        context.beginPath();
        context.ellipse(cx, cy, base * (0.5 + ring * 0.105), base * (0.21 + ring * 0.046), -0.15, 0, Math.PI * 2);
        context.strokeStyle = `rgba(${ring % 2 ? '116, 91, 255' : '70, 192, 255'}, ${0.1 + (ring % 3) * 0.025})`;
        context.lineWidth = ring === 0 ? 1.5 : 0.7;
        context.stroke();
      }

      for (let i = 0; i < 210; i += 1) {
        const angle = i * 2.399963 + frame * (i % 2 ? 1 : -0.72);
        const spread = 0.28 + ((i * 37) % 100) / 100;
        const radial = base * spread * (0.82 + 0.18 * Math.sin(frame * 2 + i));
        const x = cx + Math.cos(angle) * radial;
        const y = cy + Math.sin(angle) * radial * 0.48;
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
      context.ellipse(cx, cy, base * 0.64, base * 0.34, -0.15, 0, Math.PI * 2);
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

export default function FuturesCommandCenterPage() {
  const [selected, setSelected] = useState(demoMarkets[1]);
  const [mode, setMode] = useState('MOMENTUM');
  const [activeLog, setActiveLog] = useState('ALL');

  const openResearch = () => {
    document.getElementById('futures-research-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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
        <div className="fc-top-center"><span className="fc-pulse" /> RESEARCH CORE <b>PREVIEW BUILD</b></div>
        <div className="fc-top-right"><span className="fc-mode-chip">DEMO MODE</span><span>DATA SOURCE: OFFLINE</span></div>
      </header>

      <div className="fc-disclaimer">
        <CircleDotIcon sx={{ fontSize: 14 }} />
        <span><b>演示模式</b> · 当前行情数字、指标值、状态条和日志均为样例数据；中央粒子动画仅为视觉效果。正式研究结果请使用下方已接入后端的研究面板。</span>
      </div>

      <section className="fc-modules" aria-label="研究模块状态演示">
        {moduleStates.map((item, index) => (
          <div className="fc-module" key={item.name}>
            <div className="fc-module-head"><span>0{index + 1} / {item.name}</span><b>{item.score}</b></div>
            <div className="fc-module-wave"><MiniWave points={[16, 26, 20, 42, 29, 34, 25, 46, 31, 40, 52, 44]} /></div>
            <div className="fc-module-foot"><span>{item.label}</span><span>{item.width}%</span></div>
            <div className="fc-meter"><span style={{ width: `${item.width}%` }} /></div>
          </div>
        ))}
      </section>

      <div className="fc-main-grid">
        <aside className="fc-left-rail">
          <section className="fc-panel">
            <div className="fc-panel-title"><span>01 / MARKET WATCH</span><b>DEMO</b></div>
            <div className="fc-market-list">
              {demoMarkets.map((market) => (
                <button key={market.symbol} className={`fc-market-row ${selected.symbol === market.symbol ? 'is-selected' : ''}`}
                  onClick={() => setSelected(market)} type="button">
                  <span className="fc-market-code">{market.symbol}</span>
                  <span className="fc-market-name">{market.name}<small>{market.contract}</small></span>
                  <span className="fc-market-price">{market.price}<small className={market.up ? 'positive' : 'negative'}>{market.change}</small></span>
                  <MiniWave points={market.wave} down={!market.up} />
                </button>
              ))}
            </div>
          </section>

          <section className="fc-panel">
            <div className="fc-panel-title"><span>02 / VOLUME PROFILE</span><b>DEMO</b></div>
            <div className="fc-volume-graph">
              {Array.from({ length: 28 }, (_, i) => (
                <span key={i} style={{ height: `${16 + ((i * 41 + 23) % 78)}%` }} className={i > 19 ? 'hot' : ''} />
              ))}
            </div>
            <div className="fc-panel-foot"><span>量能结构（示意）</span><span>NO LIVE FEED</span></div>
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
            <div className="fc-float-card fc-float-card-a"><span className="fc-float-kicker"><ActivityIcon sx={{ fontSize: 12 }} /> SELECTED CONTRACT</span><strong>{selected.symbol} / {selected.name}</strong><small>{selected.contract} · sample only</small></div>
            <div className="fc-float-card fc-float-card-b"><span className="fc-float-kicker"><ShieldCheckIcon sx={{ fontSize: 12 }} /> RESEARCH STATUS</span><strong>NO ORDER ROUTING</strong><small>仅供研究，不连接交易账户</small></div>
            <div className="fc-core-bottom"><span>VISUAL ENGINE / CANVAS PARTICLES</span><span>UI PREVIEW · V0.2</span></div>
          </section>

          <section className="fc-metric-strip">
            <div className="fc-metric"><span>20-BAR MOMENTUM <i>DEMO</i></span><strong className="positive">+3.8%</strong><MiniWave points={[18, 22, 16, 29, 24, 36, 30, 40, 34, 48, 46, 55]} /></div>
            <div className="fc-metric"><span>REALIZED VOL <i>DEMO</i></span><strong>21.4%</strong><MiniWave points={[42, 28, 35, 24, 47, 30, 43, 28, 38, 22, 32, 26]} down /></div>
            <div className="fc-metric"><span>OPEN INTEREST <i>DEMO</i></span><strong>+1.2%</strong><MiniWave points={[21, 32, 26, 28, 38, 35, 43, 39, 50, 45, 52, 55]} /></div>
            <div className="fc-metric"><span>DATA FRESHNESS <i>STATUS</i></span><strong className="muted-value">OFFLINE</strong><small>尚未载入行情</small></div>
          </section>
          <div className="fc-primary-action">
            <div><b>查看真实研究结果</b><span>使用已连接的合约目录与日线分析接口</span></div>
            <button type="button" onClick={openResearch}>打开研究面板 <ChevronRightIcon sx={{ fontSize: 16 }} /></button>
          </div>
        </main>

        <aside className="fc-right-rail">
          <section className="fc-panel">
            <div className="fc-panel-title"><span>04 / EVIDENCE MATRIX</span><b>DEMO</b></div>
            <div className="fc-evidence-grid">
              {Array.from({ length: 64 }, (_, i) => <span key={i} className={`tone-${(i * 7 + Math.floor(i / 4)) % 5}`} />)}
            </div>
            <div className="fc-panel-foot"><span>信号证据矩阵（装饰）</span><span>NOT COMPUTED</span></div>
          </section>

          <section className="fc-panel">
            <div className="fc-panel-title"><span>05 / RISK GATE</span><b>RULES NEEDED</b></div>
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
            <div className="fc-panel-title"><span>06 / WORKFLOW</span><b>CONCEPT</b></div>
            {moduleStates.slice(0, 5).map((item) => (
              <div className="fc-handoff-row" key={item.name}>
                <span>{item.name}</span><div><span style={{ width: `${item.width}%` }} /></div><small>{item.label}</small>
              </div>
            ))}
            <p>这些条目是界面概念，不代表后台智能体正在运行。</p>
          </section>
        </aside>
      </div>

      <section className="fc-bottom-grid">
        <div className="fc-panel fc-code-panel">
          <div className="fc-panel-title"><span><Code2Icon sx={{ fontSize: 14 }} /> STRATEGY LOGIC / EXAMPLE</span><b>READ ONLY</b></div>
          <pre><code><span className="code-muted">01</span>  series = load_daily_bars(contract)  <span className="code-muted"># requires data</span>{'\n'}<span className="code-muted">02</span>  momentum = return_over(series, bars=20){'\n'}<span className="code-muted">03</span>  volatility = realized_vol(series, window=20){'\n'}<span className="code-muted">04</span>  quality = validate_coverage(series){'\n'}<span className="code-muted">05</span>  if quality.is_stale:{'\n'}<span className="code-muted">06</span>      flag("STALE DATA"){'\n'}<span className="code-muted">07</span>  else:{'\n'}<span className="code-muted">08</span>      report(momentum, volatility){'\n'}<span className="code-muted">09</span>  # no order submission in research mode</code></pre>
        </div>

        <div className="fc-panel fc-log-panel">
          <div className="fc-panel-title"><span><CpuIcon sx={{ fontSize: 14 }} /> EVENT LOG / SAMPLE</span><div className="fc-log-filters">{['ALL', 'DATA', 'RISK'].map((tag) => <button key={tag} type="button" onClick={() => setActiveLog(tag)} className={activeLog === tag ? 'is-active' : ''}>{tag}</button>)}</div></div>
          <div className="fc-log-list">
            {demoLog.filter((row) => activeLog === 'ALL' || row[1] === activeLog).map((row) => (
              <div className="fc-log-row" key={row[0]}><time>{row[0]}</time><b>{row[1]}</b><span>{row[2]}</span><i className={row[3]}>{row[3] === 'up' ? '●' : row[3] === 'warn' ? '!' : '·'}</i></div>
            ))}
          </div>
        </div>
      </section>

      <footer className="fc-footer"><span><Layers3Icon sx={{ fontSize: 13 }} /> ORBITAL FUTURES DESK</span><span>日线研究 · 数据可追溯 · 不自动下单</span><span>BUILD 0.2 / UI CONCEPT</span></footer>

      <section id="futures-research-form" className="fc-real-research">
        <div className="fc-real-heading">
          <div className="fc-section-kicker">LIVE RESEARCH WORKFLOW</div>
          <h2>真实期货研究面板</h2>
          <p>下面的合约搜索与日线扫描沿用项目已有接口。此部分不是模拟面板；接口是否可用取决于当前部署的后端与数据源。</p>
        </div>
        <CommodityFuturesPage />
      </section>
    </div>
  );
}
