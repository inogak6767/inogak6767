const cyContainer = document.getElementById("cy");
let cy;
let currentData = null;
let currentMetric = "betweenness";
let selectedPlatform = "tiktok";

function toast(message) {
  const element = document.getElementById("toast");
  element.textContent = message;
  element.classList.add("show");
  setTimeout(() => element.classList.remove("show"), 2200);
}

async function checkHealth() {
  try {
    const response = await fetch("/api/health");
    const health = await response.json();
    document.getElementById("databaseStatus").textContent = health.database === "connected" ? "Active" : "Standby";
    document.getElementById("apiStatus").textContent = health.ensembleData ? "API Ready" : "Demo Ready";
    document.getElementById("footerApiStatus").textContent = health.ensembleData ? "Ready" : "Demo";
  } catch {
    document.getElementById("databaseStatus").textContent = "Standby";
  }
}

function initCytoscape(data) {
  if (!window.cytoscape) {
    toast("Cytoscape tidak berhasil dimuat");
    return;
  }
  if (cy) cy.destroy();
  const elements = [];
  data.nodes.forEach((node) => {
    const score = node.metrics[currentMetric] || 0;
    elements.push({
      data: {
        id: node.id,
        label: node.label,
        handle: node.handle,
        followers: node.followers,
        role: node.role,
        score,
        metrics: node.metrics
      }
    });
  });
  data.edges.forEach((edge, index) => {
    elements.push({
      data: {
        id: `e${index}`,
        source: edge.source,
        target: edge.target,
        label: edge.interactionType,
        weight: edge.weight
      }
    });
  });

  cy = cytoscape({
    container: cyContainer,
    elements,
    layout: {
      name: "concentric",
      fit: true,
      padding: 52,
      concentric: (node) => node.data("score") || 0.1,
      levelWidth: () => 0.22,
      animate: true,
      animationDuration: 700
    },
    style: [
      {
        selector: "node",
        style: {
          "shape": "ellipse",
          "background-color": "#0b2738",
          "border-width": 2,
          "border-color": "#32bcca",
          "label": "data(label)",
          "color": "#9cb9c9",
          "font-size": "8px",
          "text-valign": "bottom",
          "text-margin-y": "7px",
          "text-outline-width": 2,
          "text-outline-color": "#091521",
          "width": "mapData(score, 0, 1, 24, 62)",
          "height": "mapData(score, 0, 1, 24, 62)"
        }
      },
      {
        selector: "node:selected",
        style: { "border-width": 4, "border-color": "#59e6ee", "background-color": "#16485a" }
      },
      {
        selector: "edge",
        style: {
          "width": "mapData(weight, 1, 8, 1, 3)",
          "line-color": "#267895",
          "target-arrow-color": "#267895",
          "target-arrow-shape": "triangle",
          "curve-style": "bezier",
          "opacity": 0.72,
          "label": "data(label)",
          "font-size": "6px",
          "color": "#3a6e82",
          "text-opacity": 0
        }
      },
      {
        selector: "edge:selected",
        style: { "line-color": "#40cbd7", "target-arrow-color": "#40cbd7", "width": 3 }
      }
    ],
    wheelSensitivity: 0.18,
    userZoomingEnabled: true
  });
  cy.on("tap", "node", (event) => selectActor(event.target.data()));
  cy.ready(() => {
    const top = data.nodes.reduce((best, node) => (node.metrics[currentMetric] > (best?.metrics[currentMetric] || -1) ? node : best), null);
    if (top) selectActor({ id: top.id, label: top.label, handle: top.handle, followers: top.followers, role: top.role, metrics: top.metrics });
  });
}

function selectActor(actor) {
  const nodeId = actor.id;
  if (cy) cy.nodes().unselect(); 
  if (cy && cy.getElementById(nodeId)) cy.getElementById(nodeId).select();
  document.getElementById("actorAvatar").textContent = String(actor.label).replace("@", "").substring(0, 2).toUpperCase();
  document.getElementById("actorName").textContent = `${actor.label} ◎ ${(actor.metrics?.[currentMetric] || 0).toFixed(3)}`;
  document.getElementById("actorHandle").textContent = actor.role ? `${actor.role} Node` : "Network Node";
  document.getElementById("actorFollowers").textContent = formatFollowers(actor.followers);
  const degree = actor.metrics?.degree || 0;
  document.getElementById("actorDegree").textContent = `${Math.round(degree * 189)} In/Out`;
  document.getElementById("actorCommunity").textContent = actor.role === "Target" ? "Aktif Individu" : "Komunitas Aktif";
  document.getElementById("actorInteraction").textContent = degree > 0.55 ? "High Retweet" : "Normal Retweet";

  const values = [
    ["betweenness", "betweennessValue", "betweennessBar"],
    ["degree", "degreeValue", "degreeBar"],
    ["closeness", "closenessValue", "closenessBar"],
    ["pagerank", "pagerankValue", "pagerankBar"]
  ];
  values.forEach(([key, valueId, barId]) => {
    const value = actor.metrics?.[key] || 0;
    document.getElementById(valueId).textContent = value.toFixed(3);
    document.getElementById(barId).style.width = `${Math.max(5, value * 100)}%`;
  });
}

function formatFollowers(value) {
  if (!value) return "245.8K";
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return String(value);
}

function updateRanking(data) {
  const ranked = [...data.nodes].sort((a, b) => b.metrics[currentMetric] - a.metrics[currentMetric]).slice(0, 5);
  document.getElementById("rankingMetric").textContent = currentMetric.toUpperCase();
  document.getElementById("rankingList").innerHTML = ranked.map((node, index) => `
    <div class="rank-item" data-node-id="${node.id}">
      <span class="rank-number">${index + 1}</span>
      <span class="rank-avatar">${String(node.label).replace("@", "").substring(0, 2).toUpperCase()}</span>
      <span class="rank-name"><strong>${node.label}</strong><span>@ ${node.role || "Actor"} · Bridge: ${node.metrics.betweenness.toFixed(3)}</span></span>
      <span class="rank-score">${node.metrics[currentMetric].toFixed(3)}</span>
    </div>
  `).join("");
  document.querySelectorAll(".rank-item").forEach((item) => {
    item.addEventListener("click", () => {
      const node = data.nodes.find((candidate) => candidate.id === item.dataset.nodeId);
      if (node) selectActor(node);
    });
  });
}

async function analyze() {
  const button = document.getElementById("analyzeButton");
  button.disabled = true;
  button.textContent = "⟳ Menarik data...";
  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform: selectedPlatform,
        queryType: document.querySelector(".mode-button.active")?.dataset.queryType || "TARGET",
        query: document.getElementById("queryInput").value
      })
    });
    if (!response.ok) throw new Error("Analisis gagal");
    currentData = await response.json();
    document.getElementById("sessionId").textContent = currentData.sessionId ? `SNA-${String(currentData.sessionId).padStart(3, "0")}` : "SNA-DEMO";
    document.getElementById("edgeCount").textContent = `${currentData.edges.length} Edge`;
    initCytoscape(currentData);
    updateRanking(currentData);
    toast(currentData.source === "demo" ? "Analisis demo berhasil dimuat" : "Data EnsembleData berhasil dianalisis");
  } catch (error) {
    toast(error.message);
  } finally {
    button.disabled = false;
    button.innerHTML = "<span>♺</span> Tarik Data (EnsembleData)";
  }
}

document.getElementById("analyzeButton").addEventListener("click", analyze);
document.querySelectorAll(".mode-button").forEach((button, index) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".mode-button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    selectedPlatform = ["tiktok", "instagram", "threads", "x"][index];
  });
});
document.querySelectorAll(".metric-button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".metric-button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    currentMetric = button.dataset.metric;
    if (cy) {
      cy.nodes().forEach((node) => {
        const score = node.data("metrics")[currentMetric] || 0;
        node.data("score", score);
      });
      cy.layout({
        name: "concentric",
        fit: false,
        concentric: (node) => node.data("score") || 0.1,
        levelWidth: () => 0.22,
        animate: true,
        animationDuration: 500
      }).run();
      const selected = cy.nodes(":selected").data();
      if (selected?.metrics) selectActor(selected);
    }
    if (currentData) updateRanking(currentData);
  });
});
document.getElementById("zoomIn").addEventListener("click", () => cy && cy.zoom(cy.zoom() * 1.2));
document.getElementById("zoomOut").addEventListener("click", () => cy && cy.zoom(cy.zoom() / 1.2));
document.getElementById("fitGraph").addEventListener("click", () => cy && cy.fit(undefined, 45));
document.getElementById("fitNetwork").addEventListener("click", () => cy && cy.fit(undefined, 45));
document.getElementById("goRealtime").addEventListener("click", () => toast("Fokus grafik dipusatkan"));
document.getElementById("exportButton").addEventListener("click", () => {
  if (!currentData) return toast("Belum ada data untuk diekspor");
  const blob = new Blob([JSON.stringify(currentData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "sna-analysis.json";
  link.click();
  URL.revokeObjectURL(url);
});
document.getElementById("settingsButton").addEventListener("click", () => {
  if (!cy) return;
  const png = cy.png({ output: "blob", full: true, scale: 2 });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(png);
  link.download = "sna-network.png";
  link.click();
});

checkHealth();
analyze();
