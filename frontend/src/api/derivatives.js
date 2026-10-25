import apiClient from './client';

export const scanCommodityFutures = async ({ contracts, start_date, end_date }) => {
  const response = await apiClient.post('/v1/derivatives/scan/daily', {
    contracts, start_date, end_date,
  }, { timeout: 90000 });
  return response.data;
};


export const searchCommodityContracts = async ({ q = '', exchange, limit = 30 } = {}) => {
  const params = { limit };
  if (q.trim()) params.q = q.trim();
  if (exchange) params.exchange = exchange;
  const response = await apiClient.get('/v1/derivatives/directory', {
    params, timeout: 30000,
  });
  return response.data;
};


export const fetchCommodityDailyHistory = async ({ contract, start_date, end_date }) => {
  const response = await apiClient.post('/v1/derivatives/history/daily', {
    contract, start_date, end_date,
  }, { timeout: 60000 });
  return response.data;
};
