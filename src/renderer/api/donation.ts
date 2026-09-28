import axios from 'axios';

export interface Donor {
  id: number;
  name: string;
  amount: number;
  date: string;
  message?: string;
  avatar?: string;
  badge: string;
  badgeColor: string;
}

export const getDonationList = async (): Promise<Donor[]> => {
  const { data } = await axios.get('http://donate.alger.fun/api/donations');
  return data;
};
