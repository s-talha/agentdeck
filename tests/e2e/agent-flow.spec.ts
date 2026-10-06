import { expect, test, type Page } from "@playwright/test";

// These tests run against the offline demo model (no ANTHROPIC_API_KEY), so results are deterministic.

async function signUp(page: Page) {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Name").fill("E2E Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/agents$/);
  return email;
}

test("visitors are sent to sign in", async ({ page }) => {
  await page.goto("/agents");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("sign up, build an agent, run it, and find the run in history", async ({ page }) => {
  await signUp(page);

  await page.getByRole("link", { name: "Create your first agent" }).click();
  await page.getByLabel("Name").fill("Quote calculator");
  await page.getByLabel("Instructions").fill("Always use the calculator for arithmetic.");
  // Calculator is ticked by default.
  await page.getByRole("button", { name: "Create agent" }).click();

  await expect(page.getByRole("heading", { name: "Quote calculator" })).toBeVisible();

  await page.getByLabel("Give it a task").fill("What is 12 * (3 + 4)?");
  await page.getByRole("button", { name: "Run agent" }).click();

  const trace = page.getByTestId("run-trace");
  await expect(trace.getByText("Calls Calculator")).toBeVisible();
  await expect(trace.getByText("The answer is 84.")).toBeVisible();

  await page.getByRole("link", { name: "Open saved run" }).click();
  await expect(page.getByText("Succeeded")).toBeVisible();
  await expect(page.getByText("The answer is 84.")).toBeVisible();

  await page.getByRole("link", { name: "Quote calculator" }).click();
  await expect(page.getByTestId("run-history").getByText("What is 12 * (3 + 4)?")).toBeVisible();
});

test("validation errors are shown next to the field", async ({ page }) => {
  await signUp(page);
  await page.goto("/agents/new");
  await page.getByRole("button", { name: "Create agent" }).click();
  await expect(page.getByText("Give the agent a name.")).toBeVisible();
  await expect(page.getByLabel("Name")).toHaveAttribute("aria-invalid", "true");
});

test("one user cannot open another user's agent", async ({ page, browser }) => {
  await signUp(page);
  await page.getByRole("link", { name: "Create your first agent" }).click();
  await page.getByLabel("Name").fill("Private agent");
  await page.getByLabel("Instructions").fill("Keep this to yourself, please.");
  await page.getByRole("button", { name: "Create agent" }).click();
  await expect(page.getByRole("heading", { name: "Private agent" })).toBeVisible();
  const agentUrl = page.url();

  const other = await browser.newPage();
  await signUp(other);
  await other.goto(agentUrl);
  await expect(other.getByRole("heading", { name: "Nothing here" })).toBeVisible();

  const res = await other.request.post(`${agentUrl.replace("/agents/", "/api/agents/")}/runs`, {
    data: { input: "leak it" },
  });
  expect(res.status()).toBe(404);
  await other.close();
});
