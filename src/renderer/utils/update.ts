import { useDateFormat } from '@vueuse/core';
import axios from 'axios';

import config from '../../../package.json';

interface GithubReleaseInfo {
  tag_name: string;
  body: string;
  published_at: string;
  html_url: string;
  assets: Array<{
    browser_download_url: string;
    name: string;
    size: number;
  }>;
}

interface ProxyNode {
  url: string;
  server: string;
  ip: string;
  location: string;
  latency: number;
  speed: number;
}

interface ProxyResponse {
  code: number;
  msg: string;
  data: ProxyNode[];
  total: number;
  update_time: string;
}

export interface UpdateResult {
  hasUpdate: boolean;
  latestVersion: string;
  currentVersion: string;
  releaseInfo: {
    tag_name: string;
    body: string;
    html_url: string;
    assets: Array<{
      browser_download_url: string;
      name: string;
    }>;
  } | null;
}

const CACHE_KEY = 'github_proxy_nodes';
const CACHE_EXPIRE_TIME = 1000 * 60 * 10;

const REQUEST_TIMEOUT = 2000;

const getCachedProxyNodes = (): { nodes: string[]; timestamp: number } | null => {
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    const { nodes, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < CACHE_EXPIRE_TIME) {
      return { nodes, timestamp };
    }
  }
  return null;
};

const cacheProxyNodes = (nodes: string[]) => {
  localStorage.setItem(
    CACHE_KEY,
    JSON.stringify({
      nodes,
      timestamp: Date.now()
    })
  );
};

export const getProxyNodes = async (): Promise<string[]> => {
  const cached = getCachedProxyNodes();
  if (cached) {
    return cached.nodes;
  }

  try {
    const { data } = await axios.get<ProxyResponse>('https://api.akams.cn/github', {
      timeout: REQUEST_TIMEOUT
    });
    if (data.code === 200) {
      const nodes = data.data
        .sort((a, b) => b.speed - a.speed)
        .slice(0, 10)
        .map((node) => node.url);

      cacheProxyNodes(nodes);
      return nodes;
    }
  } catch (error) {
    console.error('Failed to obtain agent node:', error);
  }

  return [
    'https://gh.lk.cc',
    'https://ghproxy.cn',
    'https://ghproxy.net',
    'https://gitproxy.click',
    'https://github.tbedu.top',
    'https://github.moeyy.xyz'
  ];
};

export const getLatestReleaseInfo = async (): Promise<GithubReleaseInfo | null> => {
  try {
    const token = '';
    const headers: Record<string, string> = {};

    const apiUrls = [
      'https://api.github.com/repos/algerkong/AlgerMusicPlayer/releases/latest',

      'http://music.alger.fun/package.json'
    ];

    if (token) {
      headers['Authorization'] = `token ${token}`;
    }

    for (const url of apiUrls) {
      try {
        const response = await axios.get(url, {
          headers,
          timeout: REQUEST_TIMEOUT
        });

        if (url.includes('package.json')) {
          const changelogUrl = url.replace('package.json', 'CHANGELOG.md');
          const changelogResponse = await axios.get(changelogUrl, {
            timeout: REQUEST_TIMEOUT
          });

          return {
            tag_name: response.data.version,
            body: changelogResponse.data,
            html_url: 'https://github.com/algerkong/AlgerMusicPlayer/releases/latest',
            assets: []
          } as unknown as GithubReleaseInfo;
        }
        return response.data;
      } catch (err) {
        console.warn(`Try to access ${url} fail:`, err);
        continue;
      }
    }
    throw new Error('all API None of the addresses can be accessed');
  } catch (error) {
    console.error('Get GitHub Release Message failed:', error);
    return null;
  }
};

export const formatDate = (dateStr: string): string => {
  return useDateFormat(new Date(dateStr), 'YYYY-MM-DD HH:mm').value;
};

export const compareVersions = (v1: string, v2: string): number => {
  const v1Parts = v1.split('.').map(Number);
  const v2Parts = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
    const v1Part = v1Parts[i] || 0;
    const v2Part = v2Parts[i] || 0;

    if (v1Part > v2Part) return 1;
    if (v1Part < v2Part) return -1;
  }

  return 0;
};

export const checkUpdate = async (
  currentVersion: string = config.version
): Promise<UpdateResult | null> => {
  return null;
};
