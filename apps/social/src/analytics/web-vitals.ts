import type { Metric } from 'web-vitals';
import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals';

type AnalyticsOptions = {
  debug?: boolean;
  endpoint?: string;
};

export function reportWebVitals(options: AnalyticsOptions = {}) {
  const { debug = import.meta.env.DEV, endpoint } = options;

  const sendToAnalytics = (metric: Metric) => {
    if (debug) {
      console.log('[Web Vitals]', metric);
    }

    if (endpoint) {
      // Use `navigator.sendBeacon()` if available, falling back to `fetch()`.
      const body = JSON.stringify(metric);
      if (navigator.sendBeacon) {
        navigator.sendBeacon(endpoint, body);
      } else {
        fetch(endpoint, { body, method: 'POST', keepalive: true }).catch(console.error);
      }
    }
  };

  onCLS(sendToAnalytics);
  onLCP(sendToAnalytics);
  onFCP(sendToAnalytics);
  onTTFB(sendToAnalytics);
  onINP(sendToAnalytics);
}
