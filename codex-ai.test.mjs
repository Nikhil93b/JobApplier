import test from 'node:test';
import assert from 'node:assert/strict';
import { codexEnvironment, createAIService, subscriptionAccess, validateAIInput, validateAIResult } from './src/services/integrations/codex-ai.mjs';
const resume = 'Example Candidate\nSkills: React, SQL\nBuilt internal reporting applications using React and SQL.';
const analysis = { summary: 'Review', supportedFacts: ['React and SQL'], gaps: [], questions: [], suggestions: [{ original: 'Built internal reporting applications using React and SQL.', suggested: 'Developed internal reporting applications with React and SQL.', evidence: 'Built internal reporting applications using React and SQL.', reason: 'Clear wording' }] };
const allowed = { ordinaryUsageAllowed: true, rateLimits: { primary: { usedPercent: 15 }, secondary: { usedPercent: 20 } } };

function connection({ account = { type: 'chatgpt', planType: 'plus' }, usage = allowed, status = 'completed', result = analysis, webItems = [] } = {}) {
  const calls = []; let listener, closed = false;
  return { calls, get closed() { return closed; }, cwd: process.cwd(), close() { closed = true; }, subscribe(fn) { listener = fn; return () => { listener = null; }; },
    async request(method, params) {
      calls.push({ method, params });
      if (method === 'account/read') return { account };
      if (method === 'account/rateLimits/read') return usage;
      if (method === 'config/read') return { config: { mcp_servers: { example: {} }, plugins: { example: {} } } };
      if (method === 'model/list') return { data: [{ model: 'account-default', isDefault: true }] };
      if (method === 'thread/start') return { thread: { id: 'thread-1' } };
      if (method === 'turn/start') {
        queueMicrotask(() => {
          for (const item of webItems) listener({ method: 'item/completed', params: { threadId: 'thread-1', item } });
          listener({ method: 'item/completed', params: { threadId: 'different-thread', item: { type: 'agentMessage', text: 'Wrong thread' } } });
          listener({ method: 'item/completed', params: { threadId: 'thread-1', item: { type: 'agentMessage', text: JSON.stringify(result) } } });
          listener({ method: 'turn/completed', params: { threadId: 'thread-1', turn: { status } } });
        });
        return { turn: { id: 'turn-1' } };
      }
      throw new Error('Unexpected request');
    }
  };
}

test('only Plus with confirmed included usage is allowed; unknown quota and API-key billing fail closed', () => {
  for (const account of [null, { type: 'apiKey' }, { type: 'chatgpt', planType: 'free' }]) assert.equal(subscriptionAccess(account, allowed).ready, false);
  const plus = { type: 'chatgpt', planType: 'plus' };
  for (const usage of [null, {}, { ...allowed, ordinaryUsageAllowed: false }, { ...allowed, rateLimits: { primary: { usedPercent: 100 } } }, { ...allowed, rateLimits: { spendControlReached: true } }]) assert.equal(subscriptionAccess(plus, usage).ready, false);
  assert.equal(subscriptionAccess(plus, allowed).ready, true);
});

test('AI subprocess strips API keys and alternate endpoint variables without altering the parent environment', () => {
  const env = { PATH: 'keep', OPENAI_API_KEY: 'secret', CODEX_API_KEY: 'secret', CODEX_ACCESS_TOKEN: 'secret', OPENAI_BASE_URL: 'https://elsewhere', CHATGPT_BASE_URL: 'https://elsewhere', LOCALAPPDATA: 'keep' };
  assert.deepEqual(codexEnvironment(env), { PATH: 'keep', LOCALAPPDATA: 'keep' }); assert.equal(env.OPENAI_API_KEY, 'secret');
});

test('validates full JD and exact resume evidence before suggestions can be used', () => {
  assert.throws(() => validateAIInput({ task: 'profile', resume: 'short' }));
  assert.throws(() => validateAIInput({ task: 'job', resume, job: { title: 'Developer', company: 'Employer', description: 'x'.repeat(80), partialDescription: true } }));
  assert.equal(validateAIResult(analysis, resume), analysis);
  assert.throws(() => validateAIResult({ ...analysis, suggestions: [{ ...analysis.suggestions[0], evidence: 'Invented achievement' }] }, resume), /exact resume evidence/);
});

test('no model request occurs for API-key auth or unavailable included allowance', async () => {
  for (const options of [{ account: { type: 'apiKey' } }, { usage: { ...allowed, ordinaryUsageAllowed: false } }]) {
    const c = connection(options), ai = createAIService(async () => c);
    await assert.rejects(ai.analyze({ task: 'profile', resume }));
    assert.equal(c.calls.some(x => x.method === 'thread/start' || x.method === 'turn/start'), false); assert.equal(c.closed, true);
  }
});

test('subscription analysis selects account model, isolates the thread and returns reviewable suggestions', async () => {
  const c = connection(), ai = createAIService(async () => c);
  const result = await ai.analyze({ task: 'profile', resume });
  assert.equal(result.billing, 'subscription-only'); assert.equal(result.model, 'account-default'); assert.equal(result.suggestions.length, 1);
  const thread = c.calls.find(x => x.method === 'thread/start').params;
  assert.equal(thread.sandbox, 'read-only'); assert.equal(thread.ephemeral, true); assert.equal(thread.modelProvider, 'openai');
  assert.equal(thread.config['mcp_servers.example.enabled'], false); assert.equal(thread.config['plugins.example.enabled'], false);
  assert.equal(c.closed, true);
});

test('interrupted AI turns never return successful suggestions and the service recovers', async () => {
  let c = connection({ status: 'interrupted' }); const ai = createAIService(async () => c);
  await assert.rejects(ai.analyze({ task: 'profile', resume }), /could not finish/); assert.equal(c.closed, true);
  c = connection(); assert.equal((await ai.analyze({ task: 'profile', resume })).billing, 'subscription-only');
});


test('resume search analysis is offline, but signed job search enables live web only and sends no resume text', async () => {
  const plan = { summary: 'React development', roles: [{ title: 'React Developer', reason: 'Recent work', evidence: 'Built internal reporting applications using React and SQL.' }], keywords: [{ name: 'React', kind: 'technical', source: 'skills', evidence: 'React' }], experienceYears: null, experienceEvidence: '' };
  let c = connection({ result: plan }); const ai = createAIService(async () => c);
  const analyzed = await ai.planSearch({ resume });
  assert.equal(c.calls.find(x => x.method === 'thread/start').params.config.web_search, 'disabled');
  c = connection({ result: { summary: 'No supported openings', jobs: [] }, webItems: [{ type: 'webSearch', action: { type: 'search', query: 'React Developer Pune' } }] });
  const result = await ai.searchJobs(analyzed);
  assert.equal(result.jobs.length, 0); assert.equal(result.webSearches, 1);
  const thread = c.calls.find(x => x.method === 'thread/start').params;
  assert.equal(thread.config.web_search, 'live'); assert.equal(thread.config['features.shell_tool'], false); assert.equal(thread.config['mcp_servers.example.enabled'], false);
  const payload = JSON.parse(c.calls.find(x => x.method === 'turn/start').params.input[0].text);
  assert.deepEqual(payload.roles, ['React Developer']); assert.equal('resume' in payload, false); assert.equal('evidence' in payload, false);
  await assert.rejects(ai.searchJobs({ ...analyzed, plan: { ...plan, experienceYears: 10 } }), /no longer valid/);
  // A client-supplied mode must not enable tools on the existing review endpoint.
  c = connection(); await ai.analyze({ task: 'profile', resume, mode: 'web-search' });
  assert.equal(c.calls.find(x => x.method === 'thread/start').params.config.web_search, 'disabled');
});
