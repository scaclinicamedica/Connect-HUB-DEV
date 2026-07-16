import type { Page, TestInfo } from '@playwright/test';

export async function installTimingRecorder(page: Page){
  await page.evaluate(() => {
    const started = performance.now();
    const timeline: Array<Record<string, unknown>> = [];
    const capture = (type: string, target?: EventTarget | null) => {
      const element = target instanceof Element ? target : null;
      const panel = document.getElementById('arrhythmiasCleanWrap');
      const catalog = document.getElementById('alertChecks');
      timeline.push({
        at: Math.round((performance.now() - started) * 10) / 10,
        type,
        target: element?.id || element?.getAttribute('data-arr-clean-action') || element?.tagName || '',
        drawerOpen: document.getElementById('drawer')?.classList.contains('open') || false,
        assistantOpen: catalog?.classList.contains('show') || false,
        catalogOpen: catalog?.classList.contains('rc122-catalog-open') || false,
        mode: panel?.dataset.rc122Mode || '',
        panelVisible: Boolean(panel && getComputedStyle(panel).display !== 'none' && !panel.hidden)
      });
    };
    for(const type of ['pointerdown', 'pointerup', 'click', 'change']) {
      document.addEventListener(type, event => capture(type, event.target), true);
    }
    const observer = new MutationObserver(() => capture('mutation'));
    observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'hidden', 'data-rc122-mode'] });
    window.__timingTimeline = timeline;
  });
}

export async function attachTimingRecorder(page: Page, testInfo: TestInfo){
  const timeline = await page.evaluate(() => window.__timingTimeline || []);
  await testInfo.attach('timing-timeline.json', {
    body: Buffer.from(JSON.stringify(timeline, null, 2)),
    contentType: 'application/json'
  });
}

declare global {
  interface Window { __timingTimeline: Array<Record<string, unknown>>; }
}

