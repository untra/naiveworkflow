import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/audit.html');
});

test('interactive mode preserves pointer selection and keyboard focus', async ({ page }) => {
  await page.getByLabel('Read only').uncheck();
  const node = page.getByTestId('rf__node-a');
  await node.click();
  await expect(page.getByLabel('Click count', { exact: true })).toHaveText('1');
  await expect(node).toHaveClass(/selected/);
  await expect(node).toHaveAttribute('tabindex', '0');
  await page.keyboard.press('Tab');
  await node.focus();
  await expect(node).toBeFocused();
});

test('read-only removes editing, preserves custom actions and keyboard navigation', async ({
  page,
}) => {
  const node = page.getByTestId('rf__node-a');
  await expect(node).not.toHaveAttribute('tabindex', '0');
  const position = await node.getAttribute('style');
  await node.click();
  await node.dblclick();
  await expect(page.getByLabel('Click count', { exact: true })).toHaveText('0');
  await expect(page.getByLabel('Double click count')).toHaveText('0');
  await node.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Delete');
  await page.keyboard.press('Backspace');
  await expect(node).toHaveAttribute('style', position ?? '');
  await expect(page.getByTestId('rf__node-b')).toBeVisible();
  await expect(page.getByText(/Press enter or space to select/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Custom action' }).click();
  await expect(page.getByLabel('Custom action count')).toHaveText('1');
  const viewport = page.getByLabel('Viewport', { exact: true });
  const initial = await viewport.textContent();
  await page.getByRole('button', { name: 'Pan right', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(viewport).not.toHaveText(initial ?? '');
  await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await page.getByRole('button', { name: 'Fit workflow' }).click();
});

test('pointer drag cannot move a read-only node, but can pan the graph', async ({ page }) => {
  const node = page.getByTestId('rf__node-b');
  const position = await node.getAttribute('style');
  const box = await node.boundingBox();
  if (!box) throw new Error('Node missing');
  await page.mouse.move(box.x + 30, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 100, box.y + 50, { steps: 10 });
  await page.mouse.up();
  await expect(node).toHaveAttribute('style', position ?? '');
  const viewport = page.getByLabel('Viewport', { exact: true });
  const before = await viewport.textContent();
  const graph = page.getByRole('region', { name: 'Workflow graph', exact: true });
  const graphBox = await graph.boundingBox();
  if (!graphBox) throw new Error('Graph missing');
  await page.mouse.move(graphBox.x + 10, graphBox.y + 10);
  await page.mouse.down();
  await page.mouse.move(graphBox.x + 80, graphBox.y + 50, { steps: 10 });
  await page.mouse.up();
  await expect(viewport).not.toHaveText(before ?? '');
});

test('switching modes discards internal selection and preserves controlled highlighting', async ({
  page,
}) => {
  await page.getByLabel('Read only').uncheck();
  await page.getByTestId('rf__node-b').click();
  await expect(page.getByTestId('rf__node-b')).toHaveClass(/selected/);
  await page.getByLabel('Read only').check();
  await page.getByLabel('Read only').uncheck();
  await expect(page.getByTestId('rf__node-b')).not.toHaveClass(/selected/);
  await page.getByLabel('Controlled selection').check();
  await page.getByLabel('Read only').check();
  await expect(page.getByTestId('rf__node-a')).toHaveClass(/selected/);
  await page.getByTestId('rf__node-b').click();
  await expect(page.getByTestId('rf__node-a')).toHaveClass(/selected/);
  await page.getByRole('button', { name: 'Rerender' }).click();
  await expect(page.getByTestId('rf__node-a')).toHaveClass(/selected/);
});

test('removed internal selections do not return with reused IDs', async ({ page }) => {
  await page.getByLabel('Read only').uncheck();
  await page.getByTestId('rf__node-b').click();
  await page.getByLabel('Fixture').selectOption('empty');
  await expect(page.getByTestId('rf__node-b')).toHaveCount(0);
  await page.getByLabel('Fixture').selectOption('basic');
  await expect(page.getByTestId('rf__node-b')).not.toHaveClass(/selected/);
});

test('Tab skips static nodes and edges while preserving custom controls', async ({ page }) => {
  await page.getByRole('button', { name: 'Rerender' }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Custom action' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Pan left' })).toBeFocused();
  const outline = await page
    .getByRole('button', { name: 'Pan left' })
    .evaluate((element) => getComputedStyle(element).outlineStyle);
  expect(outline).toBe('solid');
});

test('consumer controls cannot restore node selection or connections in read-only mode', async ({
  page,
}) => {
  await page.getByLabel('Consumer controls').check();
  await page.getByRole('button', { name: 'Toggle Interactivity' }).click();
  await page.getByTestId('rf__node-b').click();
  await expect(page.getByTestId('rf__node-b')).not.toHaveClass(/selected|draggable/);
  await expect(page.getByLabel('Click count', { exact: true })).toHaveText('0');
  const handles = page.getByTestId('rf__node-b').locator('[data-handlepos]');
  for (const handle of await handles.all())
    await expect(handle).not.toHaveClass(/connectablestart|connectableend/);
});

test('IR wrapper exposes metadata and full relationships without node editing', async ({
  page,
}) => {
  await page.getByLabel('Wrapper').selectOption('graph');
  await page.getByTestId('rf__node-b').click();
  await expect(page.getByLabel('Click count', { exact: true })).toHaveText('0');
  await page.getByText('Workflow details', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Connections' })).toBeVisible();
  await expect(page.getByText('Instructions for Find sources', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Synthesize (d) → Synthesize (d) (loop)', { exact: true }),
  ).toBeVisible();
});

test('reduced motion disables node and edge animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByLabel('Wrapper').selectOption('graph');
  const animation = await page
    .getByTestId('rf__node-d')
    .evaluate((element) =>
      Array.from(element.children).map((child) => getComputedStyle(child).animationName),
    );
  expect(animation.every((name) => name === 'none')).toBe(true);
  const edge = page.getByRole('img', { name: /Synthesize \(d\) to Synthesize/ });
  const animations = await edge.evaluate((element) =>
    Array.from(element.children).map((child) => getComputedStyle(child).animationName),
  );
  expect(animations.every((name) => name === 'none')).toBe(true);
});

for (const theme of ['light', 'dark']) {
  test(`axe: ${theme}, interactive keyboard focus and selection`, async ({ page }) => {
    await page.getByLabel('Theme').selectOption(theme);
    await page.getByLabel('Read only').uncheck();
    await page.keyboard.press('Tab');
    await page.getByTestId('rf__node-b').focus();
    await page.getByTestId('rf__node-b').click();
    await page.keyboard.press('Tab');
    await page.getByTestId('rf__node-b').focus();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
    expect(
      await page
        .getByTestId('rf__node-b')
        .evaluate((element) => getComputedStyle(element).outlineStyle),
    ).toBe('solid');
  });
}

for (const theme of ['light', 'dark']) {
  for (const fixture of ['basic', 'long', 'empty']) {
    test(`axe: ${theme}, ${fixture}, narrow vertical graph and expanded details`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 320, height: 800 });
      await page.getByLabel('Theme').selectOption(theme);
      await page.getByLabel('Fixture').selectOption(fixture);
      await page.getByLabel('Vertical').check();
      await page.getByText('Workflow details', { exact: true }).click();
      if (fixture === 'empty') await expect(page.getByText('No workflow nodes.')).toBeVisible();
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        320,
      );
    });
  }
}
