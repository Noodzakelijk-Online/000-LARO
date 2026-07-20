import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const ROUTES = [
  "/",
  "/cases",
  "/evidence",
  "/lawyers",
  "/outreach",
  "/help",
  "/settings",
  "/email-settings",
  "/email-preferences",
  "/privacy",
  "/admin",
  "/admin-analytics",
  "/messages",
  "/email",
  "/analytics",
] as const;

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const;

async function createAccount(page: Page) {
  const email = `a11y-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
  await page.goto("/");
  await page.getByRole("button", { name: "Don't have an account? Sign up" }).click();
  await page.getByLabel("Full Name").fill("Accessibility Audit");
  await page.getByLabel("Email Address").fill(email);
  await page.getByLabel("Password").fill("A11yAudit!2026");
  await page.getByRole("button", { name: "Sign Up", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForLoadState("networkidle");
}

function formatViolations(
  route: string,
  viewport: string,
  violations: Array<{ id: string; impact: string | null; help: string; nodes: Array<{ target: unknown }> }>,
) {
  return violations
    .map((violation) => {
      const targets = violation.nodes.map((node) => JSON.stringify(node.target)).join(", ");
      return `${viewport} ${route}: ${violation.id} (${violation.impact}) ${violation.help}; ${targets}`;
    })
    .join("\n");
}

test("all supported routes pass the blocking renderer accessibility audit", async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const requestFailures: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown failure";
    if (!failure.includes("ERR_ABORTED")) requestFailures.push(`${request.method()} ${request.url()}: ${failure}`);
  });

  await createAccount(page);

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);

    for (const route of ROUTES) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.waitForLoadState("networkidle");
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
        .toBe(true);

      const visibleUnnamedControls = await page.locator("button:visible, input:visible, textarea:visible, select:visible").evaluateAll(
        (elements) => elements
          .filter((element) => {
            const labelledBy = element.getAttribute("aria-labelledby");
            const label = element.getAttribute("aria-label")?.trim();
            const id = element.getAttribute("id");
            const associatedLabel = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
            return !label && !labelledBy && !associatedLabel && !element.textContent?.trim() && !element.getAttribute("title");
          })
          .map((element) => element.outerHTML.slice(0, 240)),
      );
      expect(visibleUnnamedControls, `${viewport.name} ${route} has unnamed visible controls`).toEqual([]);

      const analysis = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      const blocking = analysis.violations.filter(
        (violation) => violation.impact === "serious" || violation.impact === "critical",
      );
      expect(blocking, formatViolations(route, viewport.name, blocking)).toEqual([]);
    }
  }

  expect(pageErrors, "renderer page errors").toEqual([]);
  expect(requestFailures, "renderer request failures").toEqual([]);
  expect(consoleErrors, "renderer console errors").toEqual([]);
});
