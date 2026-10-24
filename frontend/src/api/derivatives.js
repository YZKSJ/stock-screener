import apiClient from './client';

export const scanCommodityFutures = async ({ contracts, start_date, end_date }) => {
  const response = await apiClient.post('/v1/derivatives/scan/daily', {
    contracts, start_date, end_date,
  });
  return response.data;
};
