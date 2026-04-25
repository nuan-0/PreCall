
export async function reportError(error: Error | any, userId?: string) {
  try {
    const errorData = {
      message: error.message || String(error),
      stack: error.stack || '',
      url: window.location.href,
      userAgent: navigator.userAgent,
      userId: userId || 'Anonymous'
    };

    console.error('[ErrorReporter]', errorData);

    await fetch('/api/report-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(errorData)
    });
  } catch (err) {
    // Fail silently to avoid infinite error loops
    console.error('Failed to report error:', err);
  }
}

export function setupErrorHandling(userId?: string) {
  window.onerror = (message, source, lineno, colno, error) => {
    reportError(error || { message }, userId || (window as any)._userId);
    return false; // Let default browser handling continue
  };

  window.onunhandledrejection = (event) => {
    reportError(event.reason, userId || (window as any)._userId);
  };
}
