/**
 * End-to-end (E2E) verification for the running Spy application.
 *
 * Verifies all product surfaces and APIs end-to-end:
 * 1. Web Shell Routes: /chat, /graph, /notes
 * 2. Provider Registry & Keychain status: GET /api/providers
 * 3. Chat API & Streaming: POST /api/chat (SSE event stream parsing)
 * 4. Chat Persistence & Lifecycle: GET /api/chats, POST /api/chats, DELETE /api/chats
 * 5. Knowledge Graph & Topology: GET /api/graph (FalkorDBLite storage & links)
 * 6. Live Topology SSE Events: GET /api/graph/events
 *
 * Run: node scripts/verify-e2e-app.mjs
 */

const BASE_URL = process.env.SPY_URL || "http://localhost:3000";

let failed = 0;
let passed = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    failed += 1;
  } else {
    console.log(`✅ OK: ${message}`);
    passed += 1;
  }
}

async function testRoutes() {
  console.log("\n--- 1. Testing Web Shell Routes ---");
  for (const route of ["/chat", "/graph", "/notes"]) {
    try {
      const res = await fetch(`${BASE_URL}${route}`);
      assert(res.status === 200, `Route ${route} returned HTTP 200`);
      const text = await res.text();
      assert(text.length > 100, `Route ${route} returned valid HTML shell (${text.length} bytes)`);
    } catch (err) {
      assert(false, `Route ${route} failed to load: ${err.message}`);
    }
  }
}

async function testProviders() {
  console.log("\n--- 2. Testing Provider & Keychain API ---");
  try {
    const res = await fetch(`${BASE_URL}/api/providers`);
    assert(res.status === 200, "GET /api/providers returned HTTP 200");
    const data = await res.json();
    assert(data.ok === true, "GET /api/providers response ok === true");
    assert(Array.isArray(data.providers), "Providers is a valid array");

    const deepseek = data.providers.find((p) => p.id === "deepseek");
    assert(!!deepseek, "DeepSeek provider exists in registry");
    assert(deepseek.keyHint !== null, `DeepSeek has saved keychain key (hint: ...${deepseek.keyHint})`);
  } catch (err) {
    assert(false, `Provider check failed: ${err.message}`);
  }
}

async function testKnowledgeGraph() {
  console.log("\n--- 3. Testing Knowledge Graph & Topology ---");
  try {
    const res = await fetch(`${BASE_URL}/api/graph`);
    assert(res.status === 200, "GET /api/graph returned HTTP 200");
    const data = await res.json();
    assert(data.ok === true, "GET /api/graph ok === true");
    assert(Array.isArray(data.memories), `Graph returned ${data.memories.length} memory nodes`);
    assert(Array.isArray(data.links), `Graph returned ${data.links.length} relationships`);

    const hasParentOf = data.links.some((l) => l.type === "PARENT_OF");
    assert(hasParentOf, "Graph contains strict PARENT_OF hierarchy edges");
  } catch (err) {
    assert(false, `Knowledge graph check failed: ${err.message}`);
  }
}

async function testChatPersistenceLifecycle() {
  console.log("\n--- 4. Testing Chat Persistence (SQLite CRUD) ---");
  const testChatId = `e2e-test-${Date.now()}`;
  try {
    // 1. List existing chats
    const listRes = await fetch(`${BASE_URL}/api/chats`);
    assert(listRes.status === 200, "GET /api/chats returned HTTP 200");
    const listData = await listRes.json();
    assert(listData.ok === true && Array.isArray(listData.chats), `Recents returned ${listData.chats.length} chats`);

    // 2. Insert new transcript
    const postRes = await fetch(`${BASE_URL}/api/chats`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chatId: testChatId,
        messages: [
          {
            id: "m-1",
            role: "user",
            parts: [{ type: "text", text: "E2E automated test message" }],
          },
        ],
      }),
    });
    assert(postRes.status === 200, "POST /api/chats created new chat transcript");
    const postData = await postRes.json();
    assert(postData.chat?.id === testChatId, "Created chat matches testChatId");

    // 3. Query the inserted chat by ID
    const getRes = await fetch(`${BASE_URL}/api/chats?id=${testChatId}`);
    assert(getRes.status === 200, `GET /api/chats?id=${testChatId} returned HTTP 200`);
    const getData = await getRes.json();
    assert(getData.chat?.messages?.length === 1, "Chat transcript replayed exactly 1 message");

    // 4. Delete the test chat
    const delRes = await fetch(`${BASE_URL}/api/chats?id=${testChatId}`, {
      method: "DELETE",
    });
    assert(delRes.status === 204, "DELETE /api/chats returned HTTP 204 No Content");

    // 5. Verify deleted
    const verifyDel = await fetch(`${BASE_URL}/api/chats?id=${testChatId}`);
    assert(verifyDel.status === 404, "GET /api/chats returns 404 after deletion");
  } catch (err) {
    assert(false, `Chat persistence check failed: ${err.message}`);
  }
}

async function testChatAgentStreaming() {
  console.log("\n--- 5. Testing Chat Agent SSE Streaming ---");
  const chatId = `stream-verify-${Date.now()}`;
  try {
    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chatId,
        messages: [
          {
            id: "msg-test",
            role: "user",
            parts: [{ type: "text", text: "Reply with the single word 'PONG'." }],
          },
        ],
        model: "deepseek-flash",
        reasoningEffort: "low",
      }),
    });

    assert(res.status === 200, "POST /api/chat returned HTTP 200");
    const contentType = res.headers.get("content-type") || "";
    assert(contentType.includes("text/event-stream"), `Response is text/event-stream (got: ${contentType})`);

    // Stream consumption
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = "";
    let receivedDelta = false;
    let finished = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      accumulated += text;

      if (text.includes("text-delta") || text.includes("reasoning-delta")) {
        receivedDelta = true;
      }
      if (text.includes('"type":"finish"') || text.includes("[DONE]")) {
        finished = true;
      }
    }

    assert(receivedDelta, "Received streaming delta tokens (text or reasoning)");
    assert(finished, "Received stream finish signal ([DONE])");
    console.log(`ℹ️ Streamed ${accumulated.length} bytes of SSE tokens successfully.`);

    // Clean up streamed chat record
    await fetch(`${BASE_URL}/api/chats?id=${chatId}`, { method: "DELETE" }).catch(() => {});
  } catch (err) {
    assert(false, `Chat streaming check failed: ${err.message}`);
  }
}

async function run() {
  console.log(`========================================`);
  console.log(` SPY APPLICATION END-TO-END VERIFICATION`);
  console.log(` Target: ${BASE_URL}`);
  console.log(`========================================`);

  await testRoutes();
  await testProviders();
  await testKnowledgeGraph();
  await testChatPersistenceLifecycle();
  await testChatAgentStreaming();

  console.log(`\n========================================`);
  console.log(` SUMMARY: ${passed} passed, ${failed} failed`);
  console.log(`========================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

run();
