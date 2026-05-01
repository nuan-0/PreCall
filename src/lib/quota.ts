
const QUOTA_KEY = 'precall_quota_exceeded';
const QUOTA_TIME_KEY = 'precall_quota_time';

let isQuotaExceeded = localStorage.getItem(QUOTA_KEY) === 'true';

// Check if quota should be reset (if it was set > 24 hours ago)
const quotaTime = localStorage.getItem(QUOTA_TIME_KEY);
if (quotaTime && Date.now() - parseInt(quotaTime) > 1000 * 60 * 60 * 24) {
  isQuotaExceeded = false;
  localStorage.removeItem(QUOTA_KEY);
  localStorage.removeItem(QUOTA_TIME_KEY);
}

export function getQuotaStatus() {
  return isQuotaExceeded;
}

export function setQuotaStatus(status: boolean) {
  isQuotaExceeded = status;
  if (status) {
    localStorage.setItem(QUOTA_KEY, 'true');
    localStorage.setItem(QUOTA_TIME_KEY, Date.now().toString());
  } else {
    localStorage.removeItem(QUOTA_KEY);
    localStorage.removeItem(QUOTA_TIME_KEY);
  }
  window.dispatchEvent(new CustomEvent('precall_quota_change', { detail: status }));
}
