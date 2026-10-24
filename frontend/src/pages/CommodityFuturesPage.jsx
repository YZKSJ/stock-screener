import { useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Divider, Grid, MenuItem, Paper, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SearchIcon from '@mui/icons-material/Search';
import { scanCommodityFutures } from '../api/derivatives';

const EXCHANGES = [
  { value: 'SHFE', label: 'SHFE · Shanghai' }, { value: 'DCE', label: 'DCE · Dalian' },
  { value: 'CZCE', label: 'CZCE · Zhengzhou' }, { value: 'INE', label: 'INE · Energy' },
  { value: 'GFEX', label: 'GFEX · Guangzhou' },
];
const dateText = (d) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const defaults = () => {
  const end = new Date();
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setMonth(start.getMonth() - 4);
  return { start: dateText(start), end: dateText(end) };
};
const emptyContract = () => ({ symbol: '', exchange: 'SHFE', product: '', multiplier: '10', tick_size: '1' });
const pct = (v) => Number.isFinite(v) ? `${v.toFixed(2)}%` : '—';
const fmt = (v) => Number.isFinite(v) ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—';

function CommodityFuturesPage() {
  const dates = useMemo(defaults, []);
  const [contracts, setContracts] = useState([
    { symbol: 'MA701', exchange: 'CZCE', product: 'MA', multiplier: '10', tick_size: '1' },
    { symbol: 'RB2701', exchange: 'SHFE', product: 'RB', multiplier: '10', tick_size: '1' },
  ]);
  const [start, setStart] = useState(dates.start);
  const [end, setEnd] = useState(dates.end);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const update = (idx, key, value) => setContracts((rows) => rows.map(
    (row, i) => (i === idx ? { ...row, [key]: value } : row),
  ));

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setResult(null);
    if (!start || !end || start > end) {
      setError('Please choose a valid date range.');
      return;
    }
    const payload = contracts.map((c) => ({
      symbol: c.symbol.trim().toUpperCase(), exchange: c.exchange,
      product: c.product.trim().toUpperCase(), multiplier: Number(c.multiplier),
      tick_size: Number(c.tick_size), currency: 'CNY',
    }));
    if (payload.some((c) => !c.symbol || !c.product || !Number.isFinite(c.multiplier)
      || c.multiplier <= 0 || !Number.isFinite(c.tick_size) || c.tick_size <= 0)) {
      setError('Complete each contract code and product, and use positive multiplier/tick values.');
      return;
    }
    const ids = payload.map((c) => `${c.symbol}.${c.exchange}`);
    if (new Set(ids).size !== ids.length) {
      setError('Each contract/exchange pair must be unique.');
      return;
    }
    setBusy(true);
    try {
      setResult(await scanCommodityFutures({ contracts: payload, start_date: start, end_date: end }));
    } catch (e) {
      const d = e?.response?.data?.detail;
      setError((typeof d === 'string' ? d : d?.reason) || e?.message || 'Research request failed.');
    } finally {
      setBusy(false);
    }
  };

  const items = result?.items || [];
  const with20 = items.filter((i) => i.analysis?.return_20_bar_pct != null);
  const strongest = with20.reduce((best, item) => (
    best === null || item.analysis.return_20_bar_pct > best.analysis.return_20_bar_pct ? item : best
  ), null);

  return (
    <Stack spacing={2.5} sx={{ pb: 3 }}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 750, letterSpacing: '-0.03em' }}>Commodity Futures Research</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.75 }}>
          Compare historical price action, realized volatility, volume and open-interest changes for selected contracts.
        </Typography>
      </Box>
      <Alert severity="info">
        This first version uses best-effort AKShare/Sina daily history on demand. It is not a real-time exchange feed
        and does not place orders. Contract multipliers and tick sizes are editable examples; verify them before analysis.
      </Alert>
      <Paper component="form" onSubmit={submit} variant="outlined" sx={{ p: { xs: 1.5, md: 2.5 } }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Contracts to scan</Typography>
              <Typography variant="body2" color="text.secondary">Scan your list only; up to 8 contracts per request.</Typography>
            </Box>
            <Button type="button" variant="outlined" startIcon={<AddIcon />}
              disabled={contracts.length >= 8 || busy}
              onClick={() => setContracts((rows) => [...rows, emptyContract()])}>Add contract</Button>
          </Stack>
          {contracts.map((c, i) => (
            <Box key={i} sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 2 }}>
              <Grid container spacing={1.25} alignItems="center">
                <Grid item xs={12} sm={6} md={2.4}>
                  <TextField fullWidth size="small" label="Contract code" value={c.symbol} placeholder="e.g. MA701"
                    inputProps={{ 'aria-label': `Contract code ${i + 1}` }}
                    onChange={(e) => update(i, 'symbol', e.target.value)} />
                </Grid>
                <Grid item xs={12} sm={6} md={2.4}>
                  <TextField fullWidth select size="small" label="Exchange" value={c.exchange}
                    inputProps={{ 'aria-label': `Exchange ${i + 1}` }}
                    onChange={(e) => update(i, 'exchange', e.target.value)}>
                    {EXCHANGES.map((x) => <MenuItem key={x.value} value={x.value}>{x.label}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={6} sm={4} md={2.1}>
                  <TextField fullWidth size="small" label="Product" value={c.product} placeholder="e.g. MA"
                    inputProps={{ 'aria-label': `Product ${i + 1}` }}
                    onChange={(e) => update(i, 'product', e.target.value)} />
                </Grid>
                <Grid item xs={6} sm={4} md={2}>
                  <TextField fullWidth size="small" type="number" label="Multiplier" value={c.multiplier}
                    inputProps={{ min: 0.000001, step: 'any', 'aria-label': `Multiplier ${i + 1}` }}
                    onChange={(e) => update(i, 'multiplier', e.target.value)} />
                </Grid>
                <Grid item xs={6} sm={4} md={2}>
                  <TextField fullWidth size="small" type="number" label="Tick size" value={c.tick_size}
                    inputProps={{ min: 0.000001, step: 'any', 'aria-label': `Tick size ${i + 1}` }}
                    onChange={(e) => update(i, 'tick_size', e.target.value)} />
                </Grid>
                <Grid item xs={6} md={1.1}>
                  <Button type="button" fullWidth color="inherit" startIcon={<DeleteOutlineIcon />}
                    aria-label={`Remove contract ${i + 1}`} disabled={contracts.length <= 1 || busy}
                    onClick={() => setContracts((rows) => rows.filter((_, row) => row !== i))}>Remove</Button>
                </Grid>
              </Grid>
            </Box>
          ))}
          <Divider />
          <Grid container spacing={1.5} alignItems="center">
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" type="date" label="From" value={start}
                onChange={(e) => setStart(e.target.value)} InputLabelProps={{ shrink: true }}
                inputProps={{ 'aria-label': 'From date' }} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" type="date" label="To" value={end}
                onChange={(e) => setEnd(e.target.value)} InputLabelProps={{ shrink: true }}
                inputProps={{ 'aria-label': 'To date' }} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <Button type="submit" fullWidth variant="contained" size="large" disabled={busy}
                startIcon={busy ? <CircularProgress size={18} color="inherit" /> : <SearchIcon />}>
                {busy ? 'Scanning…' : 'Run research scan'}
              </Button>
            </Grid>
          </Grid>
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </Paper>
      {result && (
        <Stack spacing={2}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Scan results</Typography>
            <Typography variant="body2" color="text.secondary">
              Requested {result.requested_count} · returned {result.scanned_count} · failed {result.failed_count}
              {' · '}{result.requested_start_date} to {result.requested_end_date}
            </Typography>
          </Box>
          <Grid container spacing={1.5}>
            <Grid item xs={12} sm={6} md={4}>
              <Paper variant="outlined" sx={{ p: 1.5, height: '100%' }}>
                <Typography variant="caption" color="text.secondary">Strongest 20-bar momentum</Typography>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>{strongest?.symbol || '—'}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {strongest ? pct(strongest.analysis.return_20_bar_pct) : 'Need at least 21 bars'}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Paper variant="outlined" sx={{ p: 1.5, height: '100%' }}>
                <Typography variant="caption" color="text.secondary">Contracts with 20-bar returns</Typography>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>{with20.length}</Typography>
                <Typography variant="caption" color="text.secondary">Incomplete rows remain visible below</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Paper variant="outlined" sx={{ p: 1.5, height: '100%' }}>
                <Typography variant="caption" color="text.secondary">Scan methodology</Typography>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>Momentum rank</Typography>
                <Typography variant="caption" color="text.secondary">Sorted by 20-bar return, not risk-adjusted return</Typography>
              </Paper>
            </Grid>
          </Grid>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small" aria-label="Commodity futures scan results">
              <TableHead><TableRow>
                <TableCell>Rank</TableCell><TableCell>Contract</TableCell><TableCell>Status</TableCell>
                <TableCell align="right">Latest close</TableCell><TableCell align="right">1-bar %</TableCell>
                <TableCell align="right">5-bar %</TableCell><TableCell align="right">20-bar %</TableCell>
                <TableCell>Trend</TableCell><TableCell align="right">20-bar RV ann.</TableCell>
                <TableCell align="right">Volume ratio</TableCell><TableCell align="right">OI change</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {items.map((item) => {
                  const a = item.analysis;
                  const state = item.status === 'ok' ? 'Ready'
                    : item.status === 'provider_error' ? 'Provider error' : 'Insufficient history';
                  return <TableRow hover key={`${item.symbol}.${item.exchange}`}>
                    <TableCell>{item.rank ?? '—'}</TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{item.symbol}</Typography>
                      <Typography variant="caption" color="text.secondary">{item.exchange} · {item.series_kind || '—'}</Typography>
                    </TableCell>
                    <TableCell><Chip size="small" variant="outlined"
                      color={item.status === 'ok' ? 'success' : item.status === 'provider_error' ? 'error' : 'warning'}
                      label={state} /></TableCell>
                    <TableCell align="right">{a ? fmt(a.latest_close) : '—'}</TableCell>
                    <TableCell align="right">{a ? pct(a.return_1_bar_pct) : '—'}</TableCell>
                    <TableCell align="right">{a ? pct(a.return_5_bar_pct) : '—'}</TableCell>
                    <TableCell align="right">{a ? pct(a.return_20_bar_pct) : '—'}</TableCell>
                    <TableCell>{a?.trend_state || item.reason_code || '—'}</TableCell>
                    <TableCell align="right">{a ? pct(a.realized_volatility_20_annualized_pct) : '—'}</TableCell>
                    <TableCell align="right">{a?.volume_ratio_5_to_previous_20 == null ? '—' : `${fmt(a.volume_ratio_5_to_previous_20)}x`}</TableCell>
                    <TableCell align="right">{a ? pct(a.open_interest_change_5_bar_pct) : '—'}</TableCell>
                  </TableRow>;
                })}
                {!items.length && <TableRow><TableCell colSpan={11}>No results were returned.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TableContainer>
          <Alert severity="info">
            Returns use bars in the selected series. Volatility is historical realized volatility, not option implied volatility.
            Missing sessions are not exchange-calendar-adjusted. Continuous contracts can contain roll discontinuities.
          </Alert>
          {items.some((item) => item.status === 'provider_error') && (
            <Alert severity="warning">Some symbols could not be fetched. Check contract codes; other rows remain usable.</Alert>
          )}
        </Stack>
      )}
    </Stack>
  );
}
export default CommodityFuturesPage;
