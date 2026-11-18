const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { Pool } = require("pg");
const Graph = require("graphology");

function loadLocalEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, "utf8").split(/\r?\n/).forEach((line) => {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
  });
}
loadLocalEnv();

const app = express();
const port = process.env.PORT || 3000;
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : null;

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use("/vendor", express.static(path.join(__dirname, "node_modules")));
app.use(express.static(path.join(__dirname, "public")));

const demoAccounts = [
  ["BN", "@bruzz_nexus", "@BN", "5.7M", "Target"],
  ["JN", "@joko_nusantara", "@joko_nusantara", "2.45M", "Analyst"],
  ["VK", "@viral_kreator", "@viral_kreator", "189K", "Community"],
  ["RG", "@gerard_walker", "@gerard_walker", "1.4M", "Respondent"],
  ["AF", "@aldiansyah", "@aldiansyah", "880K", "Influencer"],
  ["DA", "@digital_observer", "@digital_observer", "426K", "Observer"],
  ["SN", "@sinar_net", "@sinar_net", "612K", "Responder"],
  ["CP", "@cyber_pilar", "@cyber_pilar", "317K", "Bridge"],
  ["DM", "@demokrasi_muda", "@demokrasi_muda", "950K", "Community"],
  ["NT", "@netizen_target", "@netizen_target", "744K", "Responder"],
  ["IO", "@info_online", "@info_online", "203K", "Observer"],
  ["MX", "@media_x", "@media_x", "535K", "Channel"]
];

function demoGraph(query = "") {
  const nodes = demoAccounts.map(([id, label, handle, reach, role], index) => ({
    id,
    label: query ? `${label}` : label,
    handle,
    reach,
    role,
    followers: parseFloat(reach) * (reach.includes("M") ? 1000000 : 1000)
  }));

  const edges = [
    ["BN", "JN", "MENTION", 8], ["BN", "RG", "REPLY", 7], ["BN", "VK", "SHARE", 6],
    ["JN", "AF", "MENTION", 5], ["JN", "DA", "COMMENT", 4], ["JN", "BN", "REPLY", 7],
    ["RG", "SN", "COMMENT", 5], ["RG", "CP", "SHARE", 4], ["VK", "DM", "MENTION", 6],
    ["VK", "NT", "SHARE", 5], ["AF", "DA", "COMMENT", 6], ["AF", "IO", "MENTION", 4],
    ["DA", "SN", "REPLY", 5], ["SN", "CP", "MENTION", 7], ["CP", "DM", "SHARE", 5],
    ["DM", "NT", "COMMENT", 4], ["NT", "IO", "MENTION", 5], ["IO", "MX", "SHARE", 3],
    ["MX", "BN", "MENTION", 4], ["MX", "RG", "REPLY", 3]
  ].map(([source, target, interactionType, weight]) => ({ source, target, interactionType, weight }));
  return { nodes, edges };
}

function adjacency(graph) {
  const result = {};
  graph.forEachNode((node) => { result[node] = new Map(); });
  graph.forEachEdge((edge, attrs, source, target) => {
    const weight = attrs.weight || 1;
    result[source].set(target, weight);
    if (!graph.isDirected()) result[target].set(source, weight);
  });
  return result;
}

function calculateMetrics(graph) {
  const nodes = graph.nodes();
  const degree = {};
  const closeness = {};
  const betweenness = {};
  const pagerank = {};
  nodes.forEach((node) => { betweenness[node] = 0; degree[node] = graph.degree(node); });

  nodes.forEach((source) => {
    const distances = { [source]: 0 };
    const queue = [source];
    const paths = { [source]: 1 };
    const predecessors = {};
    nodes.forEach((node) => { predecessors[node] = []; });
    for (let i = 0; i < queue.length; i++) {
      const current = queue[i];
      graph.forEachNeighbor(current, (neighbor) => {
        if (distances[neighbor] === undefined) {
          distances[neighbor] = distances[current] + 1;
          queue.push(neighbor);
        }
        if (distances[neighbor] === distances[current] + 1) {
          paths[neighbor] = (paths[neighbor] || 0) + (paths[current] || 1);
          predecessors[neighbor].push(current);
        }
      });
    }

    const reachNodes = Object.keys(distances).filter((node) => node !== source);
    const reachableDistance = reachNodes.reduce((sum, node) => sum + distances[node], 0);
    closeness[source] = reachableDistance ? reachNodes.length / reachableDistance : 0;

    const dependency = {};
    nodes.forEach((node) => { dependency[node] = 0; });
    while (queue.length) {
      const current = queue.pop();
      predecessors[current].forEach((predecessor) => {
        const share = ((paths[predecessor] || 1) / (paths[current] || 1)) * (1 + dependency[current]);
        dependency[predecessor] += share;
      });
      if (current !== source) betweenness[current] += dependency[current];
    }
  });

  const maxBetweenness = Math.max(...Object.values(betweenness), 1);
  nodes.forEach((node) => {
    betweenness[node] = betweenness[node] / maxBetweenness;
  });

  const maxDegree = Math.max(...Object.values(degree), 1);
  let rank = Object.fromEntries(nodes.map((node) => [node, 1 / nodes.length]));
  for (let iteration = 0; iteration < 30; iteration++) {
    const next = {};
    nodes.forEach((node) => {
      let inbound = 0;
      graph.forEachNeighbor(node, (neighbor) => {
        inbound += rank[neighbor] / Math.max(graph.degree(neighbor), 1);
      });
      next[node] = 0.15 / nodes.length + 0.85 * inbound;
    });
    rank = next;
  }
  const maxPageRank = Math.max(...Object.values(rank), 1);
  nodes.forEach((node) => {
    degree[node] = degree[node] / maxDegree;
    pagerank[node] = rank[node] / maxPageRank;
  });

  return { betweenness, degree, closeness, pagerank };
}

async function saveSession(platform, queryType, queryValue, data) {
  if (!pool) return null;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const session = await client.query(
      "INSERT INTO search_sessions (platform, query_type, query_value) VALUES ($1,$2,$3) RETURNING id",
      [platform, queryType, queryValue]
    );
    const sessionId = session.rows[0].id;
    const nodeIds = {};
    for (const node of data.nodes) {
      const inserted = await client.query(
        "INSERT INTO sna_nodes (session_id, external_id, node_type, label, metadata, metrics) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id",
        [sessionId, node.id, node.role || "ACCOUNT", node.label, JSON.stringify(node), JSON.stringify(node.metrics || {})]
      );
      nodeIds[node.id] = inserted.rows[0].id;
    }
    for (const edge of data.edges) {
      await client.query(
        "INSERT INTO sna_edges (session_id, source_node_id, target_node_id, interaction_type, weight) VALUES ($1,$2,$3,$4,$5)",
        [sessionId, nodeIds[edge.source], nodeIds[edge.target], edge.interactionType, edge.weight]
      );
    }
    await client.query("COMMIT");
    return sessionId;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function tryEnsembleData(params) {
  const apiKey = process.env.ENSEMBLEDATA_API_KEY;
  const baseUrl = process.env.ENSEMBLEDATA_API_URL;
  if (!apiKey || !baseUrl) return null;
  try {
    const hashtag = params.query.replace(/^[@#]+/, "").trim();
    const url = new URL(`${baseUrl.replace(/\/$/, "")}/tt/hashtag/posts`);
    url.searchParams.set("token", apiKey);
    url.searchParams.set("name", hashtag || "magic");
    url.searchParams.set("cursor", "0");
    const response = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    if (!response.ok) return null;
    const payload = await response.json();
    const posts = payload.data?.data;
    if (!Array.isArray(posts) || posts.length === 0) return null;

    const nodeMap = new Map();
    const edgeMap = new Map();
    const hashtagMap = new Map();
    const safeNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
    const addNode = (id, node) => {
      if (!id) return;
      if (!nodeMap.has(id)) nodeMap.set(id, node);
      else {
        const existing = nodeMap.get(id);
        existing.followers = Math.max(existing.followers, node.followers);
        existing.reach = Math.max(existing.reach || 0, node.reach || 0);
        existing.postCount = (existing.postCount || 0) + 1;
      }
    };
    const addEdge = (source, target, interactionType, weight) => {
      const id = `${source}|${target}|${interactionType}`;
      const previous = edgeMap.get(id);
      edgeMap.set(id, {
        source,
        target,
        interactionType,
        weight: (previous?.weight || 0) + Math.max(1, safeNumber(weight))
      });
    };

    const topicId = `HASHTAG:${hashtag || "magic"}`;
    hashtagMap.set(topicId, {
      id: topicId,
      label: `#${hashtag || "magic"}`,
      handle: `#${hashtag || "magic"}`,
      reach: posts.length,
      role: "Hashtag",
      followers: posts.length,
      postCount: posts.length
    });

    posts.forEach((post) => {
      const author = post.author || {};
      const authorId = String(author.uid || author.unique_id || post.author_user_id || "");
      if (!authorId) return;
      const stats = post.statistics || {};
      const engagement = safeNumber(stats.digg_count) + safeNumber(stats.comment_count) + safeNumber(stats.share_count);
      addNode(authorId, {
        id: authorId,
        label: author.nickname || author.unique_id || `@actor_${authorId.slice(-6)}`,
        handle: author.unique_id ? `@${author.unique_id}` : `@actor_${authorId.slice(-6)}`,
        reach: safeNumber(author.follower_count),
        role: "Account",
        followers: safeNumber(author.follower_count),
        postCount: 1,
        engagement
      });
      addEdge(authorId, topicId, "POSTED_IN", Math.max(1, engagement || stats.play_count || 1));

      (post.text_extra || []).forEach((item) => {
        if (item.type !== 1) return;
        const mentionedHashtag = String(item.hashtag_name || "").replace(/^#/, "");
        if (!mentionedHashtag) return;
        const mentionedId = `HASHTAG:${mentionedHashtag}`;
        if (!hashtagMap.has(mentionedId)) {
          hashtagMap.set(mentionedId, {
            id: mentionedId,
            label: `#${mentionedHashtag}`,
            handle: `#${mentionedHashtag}`,
            reach: 1,
            role: "Hashtag",
            followers: 1,
            postCount: 1
          });
        } else {
          const existing = hashtagMap.get(mentionedId);
          existing.postCount = (existing.postCount || 0) + 1;
          existing.reach = existing.postCount;
          existing.followers = existing.postCount;
        }
        addEdge(authorId, mentionedId, "USES_HASHTAG", 1);
      });
    });

    hashtagMap.forEach((node) => nodeMap.set(node.id, node));
    return {
      nodes: [...nodeMap.values()],
      edges: [...edgeMap.values()],
      nextCursor: payload.data?.nextCursor
    };
  } catch (error) {
    console.warn("EnsembleData request failed; using demo data:", error.message);
    return null;
  }
}

app.get("/api/health", async (_req, res) => {
  let database = "not configured";
  if (pool) {
    try {
      await pool.query("SELECT 1");
      database = "connected";
    } catch {
      database = "unavailable";
    }
  }
  res.json({ status: "online", database, ensembleData: Boolean(process.env.ENSEMBLEDATA_API_KEY) });
});

app.post("/api/analyze", async (req, res) => {
  const platform = String(req.body.platform || "tiktok");
  const queryType = String(req.body.queryType || "TARGET").toUpperCase();
  const query = String(req.body.query || "bruzz nexus").trim();
  const remoteData = await tryEnsembleData({ platform, queryType, query });
  const data = remoteData || demoGraph(query);
  const graph = new Graph({ type: "mixed", allowSelfLoops: false });
  data.nodes.forEach((node) => graph.addNode(node.id, node));
  data.edges.forEach((edge) => {
    if (graph.hasNode(edge.source) && graph.hasNode(edge.target) && !graph.hasEdge(edge.source, edge.target)) {
      graph.addDirectedEdge(edge.source, edge.target, { weight: edge.weight, interactionType: edge.interactionType });
    }
  });

  const metrics = calculateMetrics(graph);
  const enrichedNodes = data.nodes.map((node) => ({
    ...node,
    metrics: {
      betweenness: Number(metrics.betweenness[node.id].toFixed(3)),
      degree: Number(metrics.degree[node.id].toFixed(3)),
      closeness: Number(metrics.closeness[node.id].toFixed(3)),
      pagerank: Number(metrics.pagerank[node.id].toFixed(3))
    }
  }));

  let sessionId = null;
  try {
    sessionId = await saveSession(platform, queryType, query, { nodes: enrichedNodes, edges: data.edges });
  } catch (error) {
    console.warn("Database save failed:", error.message);
  }

  res.json({
    sessionId,
    source: remoteData ? "ensembledata" : "demo",
    platform,
    queryType,
    query,
    nodes: enrichedNodes,
    edges: data.edges
  });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, () => console.log(`SNA dashboard listening at http://localhost:${port}`));
