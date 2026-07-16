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

