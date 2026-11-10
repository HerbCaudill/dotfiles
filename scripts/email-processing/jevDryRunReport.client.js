// Browser side of the Jev dry-run HTML report. renderJevDryRunHtml.ts inlines this file and the
// report data; nothing is fetched.
;(() => {
  const { summary, records, errors } = JSON.parse(
    document.getElementById("report-data").textContent,
  )
  const app = document.getElementById("app")

  /** Mail kinds in fixed palette order. */
  const KINDS = [
    "marketing",
    "transactional",
    "notification",
    "editorial",
    "cold_outreach",
    "personal",
    "government",
  ]

  const KIND_LABELS = {
    marketing: "Marketing",
    transactional: "Transactional",
    notification: "Notification",
    editorial: "Editorial",
    cold_outreach: "Cold outreach",
    personal: "Personal",
    government: "Government",
  }

  const ACTIONS = [
    { key: "all", label: "Threads", test: () => true },
    { key: "unsubscribe", label: "Would unsubscribe", test: record => record.unsubscribe },
    { key: "archive", label: "Would archive", test: record => record.decision === "archive" },
    { key: "promote", label: "Would promote", test: record => record.decision === "promote" },
    {
      key: "blocked",
      label: "Marketing kept",
      hint: "Marketing the job would leave in the inbox",
      test: record =>
        record.decision !== "archive" &&
        (record.kinds.marketing ?? 0) >= summary.thresholds.marketing,
    },
    {
      key: "none",
      label: "No action",
      test: record => record.decision === "none" && !record.unsubscribe,
    },
  ]

  const REASON_LABELS = {
    "not-marketing": "Not clearly marketing",
    "no-one-click": "No one-click unsubscribe",
    "devresults-list": "DevResults list",
    devResultsSender: "Protected: DevResults sender",
    priorReply: "Protected: you've written to them",
    archiveReversal: "Protected: you undid an archive",
    protectedCorrespondent: "Protected: correspondent keywords",
    activeConversation: "Protected: active conversation",
    requestedWork: "Protected: requested work",
    herbInitiated: "Protected: you started the thread",
  }

  const GROUPINGS = {
    sender: {
      label: "Sender",
      keysOf: record => [record.address],
      title: group => group.records[0].name || group.key,
      sub: group => (group.records[0].name ? group.key : ""),
    },
    kind: {
      label: "Mail kind",
      keysOf: record => [record.kind],
      title: group => KIND_LABELS[group.key] ?? group.key,
      sub: () => "",
    },
    action: {
      label: "What the job would do",
      keysOf: record => [actionLabel(record)],
      title: group => group.key,
      sub: () => "",
    },
    reason: {
      label: "Why not unsubscribed",
      keysOf: record => (record.unsubscribe ? ["Would unsubscribe"] : record.blockedBy),
      title: group => REASON_LABELS[group.key] ?? group.key,
      sub: () => "",
    },
    category: {
      label: "Gmail category",
      keysOf: record => [record.category],
      title: group => capitalize(group.key),
      sub: () => "",
    },
    none: {
      label: "Nothing (flat list)",
      keysOf: () => ["All matching threads"],
      title: group => group.key,
      sub: () => "",
    },
  }

  const state = {
    action: "all",
    kinds: new Set(),
    search: "",
    groupBy: "sender",
    disagreements: false,
    uncertain: false,
  }

  renderShell()
  update()

  /** Build the parts of the page that never re-render, and wire up the controls. */
  function renderShell() {
    const date = new Date(summary.createdAt).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })
    app.innerHTML = `
      <h1>Jev dry run</h1>
      <p class="lede">${escape(summary.account)}, last ${summary.windowDays} days, run ${escape(date)}. Read-only: nothing in Gmail was changed and nothing was unsubscribed. One row per thread, judged on its newest message. Decisions use the current rules.</p>
      <div class="tiles" id="tiles"></div>
      <section class="panel">
        <h2>Mail kinds</h2>
        <div class="kind-bar" id="kind-bar"></div>
        <div class="legend" id="kind-legend"></div>
      </section>
      <section class="panel">
        <div class="controls">
          <input type="search" id="search" placeholder="Search subjects and senders" autocomplete="off">
          <label>Group by <select id="group-by">${Object.entries(GROUPINGS)
            .map(([key, grouping]) => `<option value="${key}">${grouping.label}</option>`)
            .join("")}</select></label>
          <label title="Threads from senders labeled in the earlier review where Jev disagrees about marketing"><input type="checkbox" id="disagreements"> Disagrees with earlier label</label>
          <label title="Jev's top mail kind is below 0.6"><input type="checkbox" id="uncertain"> Uncertain kind</label>
        </div>
        <div class="result-line" id="result-line"></div>
        <div id="results"></div>
      </section>
      <section class="panel">
        <h2>Run details</h2>
        <dl class="facts" id="run-details"></dl>
      </section>
    `
    renderRunDetails()

    const search = document.getElementById("search")
    search.addEventListener("input", () => {
      state.search = search.value.trim().toLowerCase()
      update()
    })
    document.getElementById("group-by").addEventListener("change", event => {
      state.groupBy = event.target.value
      update()
    })
    for (const name of ["disagreements", "uncertain"])
      document.getElementById(name).addEventListener("change", event => {
        state[name] = event.target.checked
        update()
      })

    app.addEventListener("click", event => {
      const actionButton = event.target.closest("[data-action]")
      if (actionButton) {
        state.action = actionButton.dataset.action
        update()
        return
      }
      const kindButton = event.target.closest("[data-kind]")
      if (kindButton) {
        const kind = kindButton.dataset.kind
        if (state.kinds.has(kind)) state.kinds.delete(kind)
        else state.kinds.add(kind)
        update()
        return
      }
      const command = event.target.closest("[data-command]")
      if (command) runCommand(command.dataset.command)
    })

    // Thread details are built the first time a thread opens, which keeps the page light.
    app.addEventListener(
      "toggle",
      event => {
        const thread = event.target
        if (!thread.matches?.("details.thread") || !thread.open || thread.dataset.ready) return
        thread.insertAdjacentHTML("beforeend", renderThreadDetail(records[thread.dataset.index]))
        thread.dataset.ready = "1"
      },
      true,
    )
  }

  /** Re-render everything that depends on the filters. */
  function update() {
    const action = ACTIONS.find(candidate => candidate.key === state.action)
    const base = records.filter(passesSharedFilters)
    renderTiles(base.filter(passesKindFilter))
    renderKinds(base.filter(action.test))
    renderResults(base.filter(action.test).filter(passesKindFilter))
  }

  /** Search and checkbox filters, which apply to every count on the page. */
  function passesSharedFilters(record) {
    if (state.search) {
      const haystack = `${record.subject} ${record.name} ${record.address}`.toLowerCase()
      if (!haystack.includes(state.search)) return false
    }
    if (state.disagreements && !disagreesWithLabel(record)) return false
    if (state.uncertain && topProbability(record) >= 0.6) return false
    return true
  }

  /** Mail-kind filter. */
  function passesKindFilter(record) {
    return state.kinds.size === 0 || state.kinds.has(record.kind)
  }

  /** Action tiles, counted over threads that pass the other filters. */
  function renderTiles(matching) {
    const tiles = ACTIONS.map(action => {
      const group = matching.filter(action.test)
      const senders = new Set(group.map(record => record.address)).size
      return `<button class="tile${state.action === action.key ? " active" : ""}" data-action="${action.key}" title="${escape(action.hint ?? action.label)}">
        <span class="value">${group.length.toLocaleString("en-US")}</span>
        <span class="label">${action.label}</span>
        <span class="sub">${senders} sender${senders === 1 ? "" : "s"}</span>
      </button>`
    })
    tiles.push(`<button class="tile" disabled>
        <span class="value">$${summary.cost.toFixed(2)}</span>
        <span class="label">Jev cost</span>
        <span class="sub">${summary.latencyP50} ms median, ${summary.latencyP95} ms p95</span>
      </button>`)
    document.getElementById("tiles").innerHTML = tiles.join("")
  }

  /** Stacked bar and legend of mail kinds; both toggle the kind filter. */
  function renderKinds(matching) {
    const counts = KINDS.map(kind => ({
      kind,
      count: matching.filter(record => record.kind === kind).length,
    }))
    const total = matching.length
    const bar = document.getElementById("kind-bar")
    bar.classList.toggle("filtered", state.kinds.size > 0)
    bar.innerHTML = counts
      .filter(({ count }) => count > 0)
      .map(
        ({ kind, count }) =>
          `<button style="--kind: var(--kind-${kind}); flex: ${count}" class="${state.kinds.has(kind) ? "active" : ""}" data-kind="${kind}" title="${KIND_LABELS[kind]}: ${count} threads (${percent(count, total)})" aria-label="${KIND_LABELS[kind]}, ${count} threads"></button>`,
      )
      .join("")
    document.getElementById("kind-legend").innerHTML = counts
      .map(
        ({ kind, count }) =>
          `<button class="chip${state.kinds.has(kind) ? " active" : ""}" data-kind="${kind}" style="--kind: var(--kind-${kind})"><span class="swatch"></span>${KIND_LABELS[kind]} <span class="count">${count} · ${percent(count, total)}</span></button>`,
      )
      .join("")
  }

  /** Grouped threads. */
  function renderResults(matching) {
    const grouping = GROUPINGS[state.groupBy]
    const groups = new Map()
    for (const record of matching)
      for (const key of grouping.keysOf(record)) {
        if (!groups.has(key)) groups.set(key, { key, records: [] })
        groups.get(key).records.push(record)
      }
    const sorted = [...groups.values()].sort(
      (a, b) =>
        b.records.length - a.records.length || grouping.title(a).localeCompare(grouping.title(b)),
    )
    const openByDefault = sorted.length <= 6

    const filters = [
      state.action !== "all" ? ACTIONS.find(action => action.key === state.action).label : "",
      ...[...state.kinds].map(kind => KIND_LABELS[kind]),
      state.search ? `“${escape(state.search)}”` : "",
      state.disagreements ? "disagrees with earlier label" : "",
      state.uncertain ? "uncertain kind" : "",
    ].filter(Boolean)
    document.getElementById("result-line").innerHTML = `
      <span>${matching.length} thread${matching.length === 1 ? "" : "s"} in ${sorted.length} group${sorted.length === 1 ? "" : "s"}${filters.length > 0 ? ` · ${filters.join(", ")}` : ""}</span>
      ${filters.length > 0 ? `<button class="link-button" data-command="clear">Clear filters</button>` : ""}
      <button class="link-button" data-command="expand">Expand all</button>
      <button class="link-button" data-command="collapse">Collapse all</button>
    `

    document.getElementById("results").innerHTML =
      sorted.length === 0
        ? `<div class="empty">No threads match.</div>`
        : sorted.map(group => renderGroup(group, grouping, openByDefault)).join("")
  }

  /** One collapsible group of threads. */
  function renderGroup(group, grouping, open) {
    const threads = group.records.slice().sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
    const sub = grouping.sub(group)
    return `<details class="group"${open ? " open" : ""}>
      <summary>
        <span class="group-title">${escape(grouping.title(group))}</span>
        ${sub ? `<span class="group-sub">${escape(sub)}</span>` : ""}
        <span class="group-meta">${state.groupBy === "sender" ? senderBadges(threads) : ""}<span class="group-count">${threads.length}</span></span>
      </summary>
      <div class="threads">${threads.map(record => renderThreadSummary(record)).join("")}</div>
    </details>`
  }

  /** Mail kinds and actions across one sender's threads. */
  function senderBadges(threads) {
    const kinds = countBy(threads, record => record.kind)
    const actions = countBy(threads.flatMap(actionKeys), key => key)
    return [
      ...[...actions].map(([key, count]) => actionBadge(key, count)),
      ...[...kinds].map(([kind, count]) => kindBadge(kind, kinds.size > 1 ? count : 0)),
    ].join("")
  }

  /** The always-visible line for one thread. */
  function renderThreadSummary(record) {
    const index = records.indexOf(record)
    const date = new Date(record.receivedAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })
    const from =
      state.groupBy === "sender"
        ? ""
        : `<span class="from">${escape(record.name || record.address)}</span>`
    return `<details class="thread" data-index="${index}">
      <summary>
        <span class="date">${date}</span>
        <span class="subject" title="${escape(record.subject)}">${from}${escape(record.subject || "(no subject)")}</span>
        <span class="badges">${actionKeys(record)
          .map(key => actionBadge(key))
          .join("")}${kindBadge(record.kind)}</span>
      </summary>
    </details>`
  }

  /** Everything Jev and the rules said about one thread. */
  function renderThreadDetail(record) {
    const reasons = record.unsubscribe
      ? "Eligible"
      : record.blockedBy.map(reason => REASON_LABELS[reason] ?? reason).join("; ")
    const facts = [
      ["From", `${escape(record.name)} &lt;${escape(record.address)}&gt;`],
      ["Received", escape(new Date(record.receivedAt).toLocaleString("en-US"))],
      [
        "Gmail",
        `${capitalize(record.category)}${record.inInbox ? ", in Inbox" : ", not in Inbox"}`,
      ],
      ["Decision", `${capitalize(record.decision)} (${escape(record.classification)})`],
      ["Unsubscribe", escape(reasons)],
      ["One-click", record.oneClick ? "Yes" : "No"],
      ["List-Id", record.listId ? `<span class="mono">${escape(record.listId)}</span>` : "–"],
      [
        "Protections",
        record.protections.length > 0
          ? escape(
              record.protections
                .map(name => REASON_LABELS[name]?.replace("Protected: ", "") ?? name)
                .join("; "),
            )
          : "None",
      ],
      ["Earlier label", record.label ? escape(record.label) : "–"],
      ["If cold outreach", escape(record.coldType.replaceAll("_", " "))],
      ["If it needs you", escape(record.attentionReason.replaceAll("_", " "))],
    ]
    return `<div class="detail">
      <div class="full-subject">${escape(record.subject || "(no subject)")}<a href="${escape(record.url)}" target="_blank" rel="noopener">Open in Gmail ↗</a></div>
      <div>
        <h3>Mail kind</h3>
        ${KINDS.map(kind => probabilityRow(KIND_LABELS[kind], record.kinds[kind] ?? 0, `var(--kind-${kind})`)).join("")}
        <h3 style="margin-top: 12px">Other questions</h3>
        ${probabilityRow("Needs attention", record.needsAttention)}
        ${probabilityRow("Routine sign-in", record.routineAuthentication)}
      </div>
      <dl class="facts">${facts.map(([term, value]) => `<dt>${term}</dt><dd>${value}</dd>`).join("")}</dl>
    </div>`
  }

  /** A labeled probability bar. */
  function probabilityRow(name, value, color) {
    return `<div class="prob-row" title="${escape(name)}: ${value.toFixed(2)}">
      <span class="name">${escape(name)}</span>
      <span class="prob-track"><span class="prob-fill" style="width: ${Math.round(value * 100)}%${color ? `; --kind: ${color}` : ""}; display: block"></span></span>
      <span class="value">${value.toFixed(2)}</span>
    </div>`
  }

  /** Run details at the foot of the page. */
  function renderRunDetails() {
    const { thresholds } = summary
    const facts = [
      ["Messages received", summary.receivedMessages.toLocaleString("en-US")],
      ["Threads classified", summary.threads.toLocaleString("en-US")],
      ["Errors", summary.errors],
      ["Model", escape(summary.models.join(", "))],
      ["Input tokens", summary.inputTokens.toLocaleString("en-US")],
      ["Cost", `$${summary.cost.toFixed(4)} at $0.042 per million tokens`],
      ["Latency", `${summary.latencyP50} ms median, ${summary.latencyP95} ms p95`],
      [
        "Thresholds",
        `Archive and unsubscribe at marketing ≥ ${thresholds.marketing}; archive cold outreach at ≥ ${thresholds.archive}; promote at needs attention ≥ ${thresholds.promote} unless routine sign-in ≥ ${thresholds.routineAuthentication}`,
      ],
      ["Earlier labels", escape(summary.labelsSource ?? "None")],
      ...errors.map(error => [
        "Error",
        `<a href="${escape(error.url)}">${escape(error.error)}</a>`,
      ]),
    ]
    document.getElementById("run-details").innerHTML = facts
      .map(([term, value]) => `<dt>${term}</dt><dd>${value}</dd>`)
      .join("")
  }

  /** Handle the result-line buttons. */
  function runCommand(command) {
    if (command === "expand" || command === "collapse")
      for (const group of document.querySelectorAll("details.group"))
        group.open = command === "expand"
    if (command === "clear") {
      Object.assign(state, { action: "all", search: "", disagreements: false, uncertain: false })
      state.kinds.clear()
      document.getElementById("search").value = ""
      document.getElementById("disagreements").checked = false
      document.getElementById("uncertain").checked = false
      update()
    }
  }

  /** Actions the job would take on a thread: unsubscribing, then any label change. */
  function actionKeys(record) {
    return [
      ...(record.unsubscribe ? ["unsubscribe"] : []),
      ...(record.decision === "none" ? [] : [record.decision]),
    ]
  }

  /** Readable action for grouping. */
  function actionLabel(record) {
    const label =
      record.decision === "none"
        ? ""
        : `${capitalize(record.decision)}: ${record.classification.replaceAll("-", " ")}`
    if (record.unsubscribe) return label ? `Unsubscribe and ${label.toLowerCase()}` : "Unsubscribe"
    return label || "No action"
  }

  /** Badge for an action, with an optional count. */
  function actionBadge(key, count = 0) {
    const label = { unsubscribe: "Unsubscribe", archive: "Archive", promote: "Promote" }[key]
    return `<span class="badge action" style="--action: var(--action-${key})">${label}${count > 1 ? ` ×${count}` : ""}</span>`
  }

  /** Badge for a mail kind, with an optional count. */
  function kindBadge(kind, count = 0) {
    return `<span class="badge" style="--kind: var(--kind-${kind})"><span class="swatch"></span>${KIND_LABELS[kind] ?? kind}${count > 1 ? ` ×${count}` : ""}</span>`
  }

  /** Whether Jev's call disagrees with the sender's earlier marketing label. */
  function disagreesWithLabel(record) {
    if (!record.label) return false
    return (record.label === "marketing") !== (record.kind === "marketing")
  }

  /** Highest mail-kind probability. */
  function topProbability(record) {
    return Math.max(...Object.values(record.kinds))
  }

  /** Count items by key, largest first. */
  function countBy(items, keyOf) {
    const counts = new Map()
    for (const item of items) counts.set(keyOf(item), (counts.get(keyOf(item)) ?? 0) + 1)
    return new Map([...counts].sort((a, b) => b[1] - a[1]))
  }

  /** Format a share as a percentage. */
  function percent(part, whole) {
    return whole === 0 ? "0%" : `${Math.round((part / whole) * 100)}%`
  }

  /** Upper-case the first letter. */
  function capitalize(text) {
    return text ? text[0].toUpperCase() + text.slice(1) : ""
  }

  /** Escape text for HTML. */
  function escape(text) {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
  }
})()
