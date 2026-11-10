import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createAppServer } from "./src/app/server.mjs";
import { launchAppBrowser } from "./src/services/integrations/browser.mjs";
import { naukriSnapshot } from "./src/services/integrations/naukri/naukri-page.mjs";
import { makeNaukriCapture } from "./src/services/integrations/naukri/naukri-capture.mjs";

const resumePath = process.env.JOB_APPLIER_TEST_RESUME;
if (!resumePath) throw new Error("Set JOB_APPLIER_TEST_RESUME before testing.");
const report = {
  workflowPassed: false,
  realNaukriVerified: false,
  source:
    "Controlled browser page; Chrome extension APIs simulated. No live-source claim.",
  checks: [],
};
const output = resolve(".qa/browser-helper-test");
await mkdir(output, { recursive: true });
const server = createAppServer();
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`,
  requests = [];
server.on("request", (req) => requests.push(req.url));
const browser = await launchAppBrowser(),
  context = await browser.newContext();
const errors = [];
context.on("page", (page) =>
  page.on("pageerror", (error) => errors.push(error.message)),
);
const source = await context.newPage(),
  app = await context.newPage(),
  popup = await context.newPage();
const jobUrl = "https://www.naukri.com/job-listings-helper-fixture-123456";
const fullDescription =
  "Controlled test job, not a vacancy. Develop C# and .NET web applications using SQL and REST APIs. Work with the development team and review software requirements in Baner, Pune.";
await source.route("https://www.naukri.com/**", (route) =>
  route.fulfill({
    contentType: "text/html; charset=utf-8",
    body: new URL(route.request().url()).pathname.startsWith("/job-listings-")
      ? `<h1>.NET Software Developer</h1><p class="company-name">Browser Helper Fixture</p><p class="location">Baner, Pune</p><h2>Job description</h2><div id="job-description">${fullDescription}</div>`
      : `<article><a href="${jobUrl}">.NET Software Developer</a><span class="comp-name">Browser Helper Fixture</span><span class="locWdth">Baner, Pune</span><span class="expwdth">3-5 Yrs</span><p class="job-desc">Partial summary for controlled testing.</p></article>`,
  }),
);
try {
  await app.goto(base);
  await app.locator("#upload:not([disabled])").waitFor();
  await app.locator("#upload").setInputFiles(resumePath);
  await app.locator("#resume-submit").click();
  await app.waitForFunction(
    () =>
      !document.getElementById("refresh").disabled &&
      !document.getElementById("profile-summary").hidden,
  );
  const original = await app.evaluate(
    () => JSON.parse(localStorage.getItem("job-applier")).resume,
  );
  await source.goto("https://www.naukri.com/jobs-in-pune");
  let openedUrl;
  await popup.exposeFunction("qaReadChosenPage", () =>
    source.evaluate(naukriSnapshot),
  );
  await popup.exposeFunction("qaOpenLocalApp", (url) => {
    openedUrl = url;
  });
  await popup.addInitScript(() => {
    window.chrome = {
      tabs: {
        query: async () => [
          { id: 42, url: "https://www.naukri.com/jobs-in-pune" },
        ],
        create: async ({ url }) => window.qaOpenLocalApp(url),
      },
      scripting: {
        executeScript: async () => [
          { result: await window.qaReadChosenPage() },
        ],
      },
    };
  });
  for (const name of ["popup.html", "popup.mjs", "popup.css"])
    await popup.route(`${base}/${name}`, async (route) =>
      route.fulfill({
        contentType: name.endsWith("html")
          ? "text/html; charset=utf-8"
          : name.endsWith("css")
            ? "text/css"
            : "text/javascript; charset=utf-8",
        body: await readFile("browser-helper/" + name),
      }),
    );
  await popup.goto(base + "/popup.html");
  await popup.locator("#capture").click();
  await popup.locator("#send").waitFor();
  assert.equal(await popup.locator("#preview li").count(), 1);
  await popup.locator("#destination").fill("https://unrelated.example");
  await popup.locator("#open").click();
  assert.equal(openedUrl, undefined);
  await popup.locator("#destination").fill(base);
  await popup.locator("#open").click();
  await popup.waitForFunction(() =>
    document
      .getElementById("status")
      .textContent.startsWith("Job Applier opened"),
  );
  assert.ok(openedUrl.startsWith(base + "/#naukri-import="));
  await app.goto(openedUrl);
  await app.locator("#capture-preview").waitFor();
  assert.equal(new URL(app.url()).hash, "");
  assert.equal(
    requests.some((url) => url.includes("naukri-import")),
    false,
  );
  assert.equal(
    await app.evaluate(() =>
      JSON.parse(localStorage.getItem("job-applier")).jobs.some(
        (x) => x.company === "Browser Helper Fixture",
      ),
    ),
    false,
  );
  await app.locator("#capture-confirm").click();
  let saved = await app.evaluate(() =>
    JSON.parse(localStorage.getItem("job-applier")),
  );
  const imported = saved.jobs.find(
    (x) => x.company === "Browser Helper Fixture",
  );
  assert.ok(imported);
  assert.equal(imported.partialDescription, true);
  assert.equal(saved.resume, original);
  report.checks.push(
    "Actual popup code reads chosen-page data through simulated Chrome APIs",
    "External transfer destinations rejected",
    "URL fragment removed before preview and never sent to local server",
    "Import requires confirmation and preserves the original resume",
  );
  async function importCapture(capture) {
    await app
      .locator("#naukri-capture")
      .setInputFiles({
        name: "capture.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(capture)),
      });
    await app.locator("#capture-preview").waitFor();
    await app.locator("#capture-confirm").click();
  }
  const partial = makeNaukriCapture(
    await source.evaluate(naukriSnapshot),
    source.url(),
  );
  await app
    .locator("summary")
    .filter({ hasText: "Import jobs from your Naukri browser" })
    .click();
  await importCapture(partial);
  saved = await app.evaluate(() =>
    JSON.parse(localStorage.getItem("job-applier")),
  );
  assert.equal(
    saved.jobs.filter((x) => x.company === "Browser Helper Fixture").length,
    1,
  );
  await source.goto(jobUrl);
  const full = makeNaukriCapture(
    await source.evaluate(naukriSnapshot),
    source.url(),
  );
  await importCapture(full);
  await app.locator("#job-search").fill("Browser Helper Fixture");
  await app
    .locator("#results")
    .getByRole("button", { name: "Select & tailor resume", exact: true })
    .click();
  await app.locator("#tailor[open]").waitFor();
  await app.locator("#approved").check();
  await app.locator("#close").click();
  const changed = structuredClone(full);
  changed.jobs[0].description +=
    " Additional requirement: review deployment processes.";
  await importCapture(changed);
  saved = await app.evaluate(() =>
    JSON.parse(localStorage.getItem("job-applier")),
  );
  const updated = saved.jobs.find(
    (x) => x.company === "Browser Helper Fixture",
  );
  assert.equal(updated.id, imported.id);
  assert.equal(updated.partialDescription, false);
  assert.equal(updated.tailored, undefined);
  assert.equal(updated.previousTailored.length, 1);
  report.checks.push(
    "Duplicate capture reuses the existing job ID",
    "Full-JD capture upgrades partial jobs",
    "Changed JD archives the old draft and invalidates approval",
  );
  await app
    .locator("#naukri-capture")
    .setInputFiles({
      name: "hostile.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          ...full,
          jobs: [{ ...full.jobs[0], url: "javascript:alert(1)" }],
        }),
      ),
    });
  await app.waitForFunction(() =>
    /invalid/.test(document.getElementById("capture-status").textContent),
  );
  assert.equal(await app.locator("#capture-preview").isVisible(), false);
  report.checks.push(
    "Invalid capture cancels pending preview without changing saved jobs",
  );
  await app.screenshot({
    path: resolve(output, "import-workflow.png"),
    fullPage: false,
  });
  assert.deepEqual(errors, []);
  report.workflowPassed = true;
} catch (error) {
  report.failure = error.message;
  throw error;
} finally {
  await writeFile(
    resolve(output, "report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
  await context.close();
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
