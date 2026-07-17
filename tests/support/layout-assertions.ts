import { expect, type Locator, type Page } from '@playwright/test';

export async function expectNoHorizontalOverflow(page: Page){
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth
  }));
  expect(dimensions.document, JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(dimensions.body, JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.viewport + 1);
}

export async function expectInside(container: Locator, child: Locator){
  const [outer, inner] = await Promise.all([container.boundingBox(), child.boundingBox()]);
  expect(outer).not.toBeNull();
  expect(inner).not.toBeNull();
  if(!outer || !inner) return;
  expect(inner.x).toBeGreaterThanOrEqual(outer.x - 1);
  expect(inner.x + inner.width).toBeLessThanOrEqual(outer.x + outer.width + 1);
  expect(inner.y + Math.min(inner.height, 40)).toBeLessThanOrEqual(outer.y + outer.height + 1);
}

export async function expectOrderedVertically(elements: Locator[]){
  const boxes = await Promise.all(elements.map(element => element.boundingBox()));
  for(let index = 1; index < boxes.length; index += 1) {
    expect(boxes[index - 1]).not.toBeNull();
    expect(boxes[index]).not.toBeNull();
    if(boxes[index - 1] && boxes[index]) expect(boxes[index]!.y).toBeGreaterThanOrEqual(boxes[index - 1]!.y);
  }
}

type Rect = { x: number; y: number; width: number; height: number };

function right(rect: Rect){ return rect.x + rect.width; }
function bottom(rect: Rect){ return rect.y + rect.height; }

export async function expectFullyInside(container: Locator, children: Locator[]){
  const outer = await container.boundingBox();
  expect(outer, `${container} must have a bounding box`).not.toBeNull();
  if(!outer) return;

  for(const child of children) {
    const inner = await child.boundingBox();
    expect(inner, `${child} must have a bounding box`).not.toBeNull();
    if(!inner) continue;
    expect(inner.x, `${child} left edge`).toBeGreaterThanOrEqual(outer.x - 1);
    expect(inner.y, `${child} top edge`).toBeGreaterThanOrEqual(outer.y - 1);
    expect(right(inner), `${child} right edge`).toBeLessThanOrEqual(right(outer) + 1);
    expect(bottom(inner), `${child} bottom edge`).toBeLessThanOrEqual(bottom(outer) + 1);
  }
}

export async function expectNoOverlap(elements: Locator[]){
  const boxes = await Promise.all(elements.map(element => element.boundingBox()));
  for(let first = 0; first < boxes.length; first += 1) {
    expect(boxes[first], `${elements[first]} must have a bounding box`).not.toBeNull();
    if(!boxes[first]) continue;
    for(let second = first + 1; second < boxes.length; second += 1) {
      expect(boxes[second], `${elements[second]} must have a bounding box`).not.toBeNull();
      if(!boxes[second]) continue;
      const horizontalIntersection = Math.min(right(boxes[first]!), right(boxes[second]!)) - Math.max(boxes[first]!.x, boxes[second]!.x);
      const verticalIntersection = Math.min(bottom(boxes[first]!), bottom(boxes[second]!)) - Math.max(boxes[first]!.y, boxes[second]!.y);
      expect(
        horizontalIntersection > 0.5 && verticalIntersection > 0.5,
        `${elements[first]} overlaps ${elements[second]}`
      ).toBe(false);
    }
  }
}

export async function expectVisualOrder(elements: Locator[]){
  const boxes = await Promise.all(elements.map(element => element.boundingBox()));
  for(let index = 1; index < boxes.length; index += 1) {
    const previous = boxes[index - 1];
    const current = boxes[index];
    expect(previous, `${elements[index - 1]} must have a bounding box`).not.toBeNull();
    expect(current, `${elements[index]} must have a bounding box`).not.toBeNull();
    if(!previous || !current) continue;
    const sameRow = Math.abs(current.y - previous.y) <= 1;
    if(sameRow) expect(current.x, `${elements[index]} visual order`).toBeGreaterThanOrEqual(right(previous) - 1);
    else expect(current.y, `${elements[index]} visual order`).toBeGreaterThanOrEqual(bottom(previous) - 1);
  }
}

export async function expectTextNotClipped(element: Locator){
  const metrics = await element.evaluate(node => {
    const htmlElement = node as HTMLElement;
    const rect = htmlElement.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      clientWidth: htmlElement.clientWidth,
      clientHeight: htmlElement.clientHeight,
      scrollWidth: htmlElement.scrollWidth,
      scrollHeight: htmlElement.scrollHeight
    };
  });
  expect(metrics.width, `${element} visible width`).toBeGreaterThan(0);
  expect(metrics.height, `${element} visible height`).toBeGreaterThan(0);
  if(metrics.clientWidth) expect(metrics.scrollWidth, `${element} horizontal clipping`).toBeLessThanOrEqual(metrics.clientWidth + 1);
  if(metrics.clientHeight) expect(metrics.scrollHeight, `${element} vertical clipping`).toBeLessThanOrEqual(metrics.clientHeight + 1);
}

export async function expectHorizontalClinicalCardLayout(card: Locator){
  const head = card.locator('.card-head');
  const hypothesis = card.locator('.hypothesis-block');
  const pending = card.locator('.pending-block');
  const copilot = card.locator('.clinical-copilot-card-summary');
  const actions = card.locator('.card-actions');
  const sections = [head, hypothesis, pending, copilot, actions];

  await expectVisualOrder(sections);
  await expectNoOverlap(sections);
  await expectFullyInside(head, [head.locator('.patient-identification'), head.locator('.card-head-right')]);
  await expectFullyInside(hypothesis, [hypothesis.locator('.section-label'), hypothesis.locator('.text')]);
  await expectFullyInside(pending, [pending.locator('.section-label'), pending.locator('.text')]);

  const copilotHead = copilot.locator('.clinical-copilot-card-head');
  const module = copilot.locator('.clinical-copilot-module');
  const moduleHead = module.locator('.clinical-copilot-module-head');
  const title = moduleHead.locator(':scope > strong');
  const state = module.locator('.clinical-copilot-module-state');
  const summary = module.locator('.clinical-copilot-module-lines');
  await expect(copilotHead.locator('strong')).toHaveText('Clinical Copilot');
  await expect(title).toHaveText('Arritmias');
  await expect(state).toContainText('Concluído');
  await expect(summary).toContainText('Fibrilação atrial');
  await expect(copilotHead).toBeVisible();
  await expect(title).toBeVisible();
  await expect(state).toBeVisible();
  await expect(summary).toBeVisible();
  await expectFullyInside(copilot, [copilotHead, copilot.locator('.clinical-copilot-card-modules')]);
  await expectFullyInside(module, [module.locator('.clinical-copilot-module-icon'), module.locator('.clinical-copilot-module-content'), module.locator('.clinical-copilot-module-chevron')]);
  await expectFullyInside(moduleHead, [title, state]);
  await expectFullyInside(module.locator('.clinical-copilot-module-content'), [moduleHead, summary]);
  await expectFullyInside(actions, await actions.locator('button').all());
  await expectNoOverlap(await actions.locator('button').all());
  await expectTextNotClipped(copilotHead.locator('strong'));
  await expectTextNotClipped(title);
  await expectTextNotClipped(state);
  await expectTextNotClipped(summary);
}
