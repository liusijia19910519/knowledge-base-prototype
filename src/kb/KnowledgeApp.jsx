import { useEffect, useMemo, useState } from "react";
import { can, loadState, memberName, nodeRole, resetState, ROLE_OPTIONS, roleLabel, saveState, spaceRole, teamRole, visibleNodes, visibleSpaces } from "./store.js";
import "./kb.css";

function useStore() {
  const [state, setState] = useState(loadState);
  const update = (recipe) => setState((current) => {
    const next = recipe(current);
    saveState(next);
    return next;
  });
  return [state, update];
}

function route() {
  const hash = window.location.hash.replace(/^#/, "") || "/home";
  const [path, id] = hash.split("/").filter(Boolean).length
    ? [hash.split("/").filter(Boolean)[0], hash.split("/").filter(Boolean)[1] || ""]
    : ["home", ""];
  return { path, id };
}

function go(path) {
  window.location.hash = path.startsWith("/") ? path : `/${path}`;
}

function formatTime(value) {
  if (!value) return "刚刚";
  const date = new Date(value);
  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function KnowledgeApp() {
  const [state, update] = useStore();
  const [location, setLocation] = useState(route);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [confirm, setConfirm] = useState(null);
  useEffect(() => {
    const sync = () => setLocation(route());
    window.addEventListener("hashchange", sync);
    if (!window.location.hash) go("/home");
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const userId = state.viewAs;
  const me = state.members.find((item) => item.id === userId);
  const spaces = visibleSpaces(state, userId);
  const nodes = visibleNodes(state, userId);
  const say = (text) => setNotice(text);

  const openDoc = (id) => {
    update((current) => ({ ...current, recents: [id, ...current.recents.filter((item) => item !== id)].slice(0, 12) }));
    go(`/doc/${id}`);
  };

  return (
    <div className="kb-app">
      <aside className="kb-nav">
        <div className="kb-brand"><strong>知识库</strong><small>{state.org.name}</small></div>
        <label className="kb-search"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索文档或知识库" /></label>
        <nav>
          <button className={location.path === "ask" ? "active" : ""} onClick={() => go("/ask")}>问 AI</button>
          <button className={location.path === "home" ? "active" : ""} onClick={() => go("/home")}>主页</button>
          <button className={location.path === "plaza" ? "active" : ""} onClick={() => go("/plaza")}>知识广场</button>
          <button className={location.path === "shared" ? "active" : ""} onClick={() => go("/shared")}>共享知识库</button>
          <button className={location.path === "personal" ? "active" : ""} onClick={() => go("/personal")}>个人知识库</button>
          <button className={location.path === "recycle" ? "active" : ""} onClick={() => go("/recycle")}>回收站</button>
          {me?.admin && <button className={location.path === "admin" ? "active" : ""} onClick={() => go("/admin")}>管理后台</button>}
        </nav>
        <div className="kb-nav-note">权限只影响这个原型里能点开的内容，浏览器不会做真正的安全隔离。</div>
        <footer>
          <label>当前身份
            <select value={state.viewAs} onChange={(event) => update((current) => ({ ...current, viewAs: event.target.value }))}>
              {state.members.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.title}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => setConfirm({ title: "恢复示例数据", body: "这会清掉你在本机保存的演示内容。", action: () => update(() => resetState()) })}>恢复示例</button>
        </footer>
      </aside>
      <main>
        {location.path === "ask" && <AskPage state={state} userId={userId} initialScope="company" onOpen={openDoc} />}
        {location.path === "home" && <HomePage state={state} userId={userId} query={query} onOpen={openDoc} update={update} />}
        {location.path === "plaza" && <SpaceList state={state} userId={userId} title="知识广场" hint="这里列出当前身份看得到的团队知识库。" spaces={spaces.filter((space) => !space.personal)} />}
        {location.path === "shared" && <SpaceList state={state} userId={userId} title="共享知识库" hint="团队里的知识库。团队成员的角色可以继承到库上，也可以单独指定。" spaces={spaces.filter((space) => !space.personal)} />}
        {location.path === "personal" && <SpaceList state={state} userId={userId} title="个人知识库" hint="个人库只有所有者可见。" spaces={spaces.filter((space) => space.personal)} onCreate={() => update((current) => ({ ...current, spaces: [...current.spaces, { id: `space-${Date.now()}`, name: "新建个人库", description: "仅自己可见", teamId: "", personal: true, ownerId: userId, visibility: "private", managerInherit: "manager", memberInherit: "none", members: [] }] }))} />}
        {location.path === "space" && <SpacePage state={state} userId={userId} spaceId={location.id} query={query} update={update} say={say} ask={(id) => go(`/ask/${id}`)} openDoc={openDoc} setConfirm={setConfirm} />}
        {location.path === "doc" && <DocPage state={state} userId={userId} nodeId={location.id} update={update} say={say} setConfirm={setConfirm} onOpen={openDoc} />}
        {location.path === "recycle" && <RecyclePage state={state} userId={userId} update={update} setConfirm={setConfirm} />}
        {location.path === "admin" && me?.admin && <AdminPage state={state} update={update} say={say} />}
        {location.path === "admin" && !me?.admin && <Empty title="没有管理后台入口" body="当前身份不是管理员。换到周宁可以查看演示用的组织、许可和团队默认权限。" />}
      </main>
      {notice && <div className="kb-toast" role="status">{notice}<button onClick={() => setNotice("")}>知道了</button></div>}
      {confirm && <ConfirmDialog {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}

function ConfirmDialog({ title, body, action, onClose }) {
  return <div className="kb-modal-backdrop" onMouseDown={onClose}><section className="kb-modal" onMouseDown={(event) => event.stopPropagation()}><h2>{title}</h2><p>{body}</p><div><button onClick={onClose}>取消</button><button className="primary" onClick={() => { action(); onClose(); }}>确认</button></div></section></div>;
}

function Empty({ title, body }) {
  return <section className="kb-empty"><h1>{title}</h1><p>{body}</p></section>;
}

function HomePage({ state, userId, query, onOpen, update }) {
  const [tab, setTab] = useState("recent");
  const docs = visibleNodes(state, userId).filter((node) => node.type === "doc");
  const list = docs.filter((node) => {
    const blob = `${node.name}${node.body}`;
    if (query && !blob.includes(query.trim())) return false;
    if (tab === "favorite") return node.favorite;
    if (tab === "mine") return node.ownerId === userId;
    return state.recents.includes(node.id) || tab === "all";
  });
  return <section className="kb-page">
    <header><h1>主页</h1><p>最近访问、收藏和我拥有的文档。搜索框同时过滤标题和正文。</p></header>
    <div className="kb-tabs">{[["recent", "最近访问"], ["favorite", "收藏"], ["mine", "我拥有的"], ["all", "全部可见"]].map(([id, label]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{label}</button>)}</div>
    {!list.length && <Empty title="没有匹配的文档" body="换一个关键词，或先打开一篇示例文档。" />}
    <div className="kb-table">{list.map((node) => {
      const space = state.spaces.find((item) => item.id === node.spaceId);
      return <button key={node.id} onClick={() => onOpen(node.id)}><b>{node.name}</b><span>{space?.name}</span><span>{memberName(state, node.ownerId)}</span><span>{formatTime(node.updatedAt)}</span><em onClick={(event) => { event.stopPropagation(); update((current) => ({ ...current, nodes: current.nodes.map((item) => item.id === node.id ? { ...item, favorite: !item.favorite } : item) })); }}>{node.favorite ? "已收藏" : "收藏"}</em></button>;
    })}</div>
  </section>;
}

function SpaceList({ title, hint, spaces, state, userId, onCreate }) {
  return <section className="kb-page">
    <header><h1>{title}</h1><p>{hint}</p>{onCreate && <button className="primary" onClick={onCreate}>新建个人库</button>}</header>
    {!spaces.length && <Empty title="这里还没有知识库" body="当前身份看不到内容，或还没有创建。" />}
    <div className="kb-cards">{spaces.map((space) => <button key={space.id} onClick={() => go(`/space/${space.id}`)}><strong>{space.name}</strong><p>{space.description}</p><small>{roleLabel(spaceRole(state, space, userId))} · {space.personal ? "仅自己可见" : "团队可见"}</small></button>)}</div>
  </section>;
}

function SpacePage({ state, userId, spaceId, query, update, say, openDoc, setConfirm }) {
  const space = state.spaces.find((item) => item.id === spaceId);
  const role = spaceRole(state, space, userId);
  const [folder, setFolder] = useState("");
  const [memberOpen, setMemberOpen] = useState(false);
  if (!space || !can(role, "view")) return <Empty title="看不到这个知识库" body="当前身份没有访问权限。回到主页，或换一个演示身份。" />;
  const nodes = state.nodes.filter((node) => node.spaceId === space.id && !node.deletedAt && node.parentId === folder && can(nodeRole(state, node, userId), "view"));
  const shown = nodes.filter((node) => !query || node.name.includes(query.trim()));
  const createNode = (type) => {
    if (!can(role, "edit")) return say("当前身份不能新建。");
    const name = type === "folder" ? "新建文件夹" : "未命名文档";
    const id = `${type}-${Date.now()}`;
    update((current) => ({ ...current, nodes: [...current.nodes, { id, spaceId: space.id, parentId: folder, type, name, body: type === "doc" ? "在这里写下正文。" : "", ownerId: userId, favorite: false, updatedAt: new Date().toISOString(), deletedAt: "", inherit: true, members: [], faq: false }] }));
    if (type === "doc") openDoc(id);
  };
  return <section className="kb-page">
    <header><div><button onClick={() => go(space.personal ? "/personal" : "/shared")}>返回</button><h1>{space.name}</h1><p>{space.description} · 你的角色是{roleLabel(role)}{space.ownerId === userId ? "，你是所有者" : ""}</p></div><div className="kb-row">{can(role, "edit") && <button onClick={() => createNode("doc")}>新建文档</button>}{can(role, "edit") && <button onClick={() => createNode("folder")}>新建文件夹</button>}{can(role, "edit") && <button onClick={() => { createNode("doc"); say("已按文件名生成一篇文档，没有实际上传。"); }}>上传</button>}{can(role, "manage") && <button onClick={() => setMemberOpen(true)}>成员与权限</button>}</div></header>
    <div className="kb-crumb"><button onClick={() => setFolder("")}>全部</button>{folder && <span>/ {state.nodes.find((node) => node.id === folder)?.name}</span>}</div>
    {!shown.length && <Empty title="这个目录是空的" body="可以新建文档或文件夹。上传只会在本地记一条文档。" />}
    <div className="kb-table">{shown.map((node) => <button key={node.id} onClick={() => node.type === "folder" ? setFolder(node.id) : openDoc(node.id)}><b>{node.type === "folder" ? "文件夹 · " : ""}{node.name}</b><span>{memberName(state, node.ownerId)}</span><span>{formatTime(node.updatedAt)}</span><span>{roleLabel(nodeRole(state, node, userId))}</span></button>)}</div>
    {memberOpen && <MemberPanel title={`${space.name} 的成员`} hint="团队管理员和团队成员会继承到知识库。单独指定的人会覆盖继承。" rows={spaceMemberRows(state, space)} onClose={() => setMemberOpen(false)} onChange={(target, nextRole) => update((current) => ({ ...current, spaces: current.spaces.map((item) => item.id === space.id ? applySpaceRole(item, target, nextRole) : item) }))} />}
  </section>;
}

function spaceMemberRows(state, space) {
  const team = state.teams.find((item) => item.id === space.teamId);
  const rows = [];
  if (team) {
    rows.push({ key: "inherit-manager", label: "团队管理员", detail: "继承", role: space.managerInherit, locked: false, target: { kind: "inherit-manager" } });
    rows.push({ key: "inherit-member", label: "团队成员", detail: "继承", role: space.memberInherit, locked: false, target: { kind: "inherit-member" } });
    Object.keys(team.members).forEach((id) => rows.push({ key: id, label: memberName(state, id), detail: `团队角色 ${roleLabel(team.members[id])}`, role: spaceRole(state, space, id), locked: false, target: { kind: "staff", id } }));
  }
  if (space.personal) rows.push({ key: space.ownerId, label: memberName(state, space.ownerId), detail: "所有者", role: "manager", locked: true, target: null });
  return rows;
}

function applySpaceRole(space, target, role) {
  if (target.kind === "inherit-manager") return { ...space, managerInherit: role };
  if (target.kind === "inherit-member") return { ...space, memberInherit: role };
  const members = space.members.filter((item) => !(item.type === "staff" && item.id === target.id));
  if (role !== "none") members.push({ type: "staff", id: target.id, role });
  return { ...space, members };
}

function DocPage({ state, userId, nodeId, update, say, setConfirm, onOpen }) {
  const node = state.nodes.find((item) => item.id === nodeId);
  const role = nodeRole(state, node, userId);
  const [draft, setDraft] = useState(node?.body || "");
  const [editing, setEditing] = useState(false);
  const [memberOpen, setMemberOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [scope, setScope] = useState("doc");
  const [answer, setAnswer] = useState(null);
  useEffect(() => { setDraft(node?.body || ""); setEditing(false); setAnswer(null); }, [nodeId]);
  if (!node || !can(role, "view")) return <Empty title="看不到这篇文档" body="它可能已删除，或当前身份没有权限。" />;
  const space = state.spaces.find((item) => item.id === node.spaceId);
  const save = () => { update((current) => ({ ...current, nodes: current.nodes.map((item) => item.id === node.id ? { ...item, body: draft, updatedAt: new Date().toISOString() } : item) })); setEditing(false); say("已保存在本机。"); };
  const ask = () => {
    const result = mockAnswer(state, userId, scope === "doc" ? [node] : visibleNodes(state, userId).filter((item) => item.type === "doc" && (scope === "company" || item.spaceId === node.spaceId)), question, node);
    setAnswer(result);
    setQuestion("");
  };
  return <section className="kb-doc">
    <article>
      <header><button onClick={() => go(`/space/${space.id}`)}>返回 {space.name}</button><h1>{node.name}</h1><p>{memberName(state, node.ownerId)} · {node.ownerId === userId ? "所有者" : roleLabel(role)} · {node.inherit !== false ? "权限跟随知识库" : "使用单独成员"}</p><div>{can(role, "edit") && !editing && <button onClick={() => setEditing(true)}>编辑</button>}{can(role, "manage") && <button onClick={() => setMemberOpen(true)}>成员与权限</button>}{can(role, "edit") && <button onClick={() => setConfirm({ title: "删除文档", body: "删除后进入回收站，可以恢复。", action: () => { update((current) => ({ ...current, nodes: current.nodes.map((item) => item.id === node.id ? { ...item, deletedAt: new Date().toISOString() } : item) })); go("/recycle"); } })}>删除</button>}</div></header>
      {editing ? <div className="kb-editor"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} /><div><button onClick={() => { setDraft(node.body); setEditing(false); }}>取消</button><button className="primary" onClick={save}>保存</button></div></div> : <div className="kb-prose">{node.body.split("\n").map((line) => <p key={line}>{line}</p>)}</div>}
    </article>
    <aside>
      <h2>问 AI</h2>
      <p className="kb-sim">模拟回答，不会调用真实模型。范围只包含当前身份看得到的文档。</p>
      <select value={scope} onChange={(event) => setScope(event.target.value)}><option value="doc">当前文档</option><option value="space">当前知识库</option><option value="company">全公司可见知识</option></select>
      <textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="例如：报销需要哪些材料" />
      <button className="primary" onClick={ask}>发送</button>
      {answer && <div className="kb-answer"><p>{answer.text}</p>{answer.citations.map((item) => <button key={item.id} onClick={() => onOpen(item.id)}>{item.name}</button>)}</div>}
    </aside>
    {memberOpen && <MemberPanel title="文档成员" hint={node.inherit !== false ? "现在跟随知识库。改成单独指定后，不再自动跟随。" : "已单独指定成员。"} rows={[{ key: "owner", label: memberName(state, node.ownerId), detail: "所有者", role: "manager", locked: true }, ...state.members.filter((item) => item.id !== node.ownerId).map((item) => ({ key: item.id, label: item.name, detail: node.members.some((member) => member.id === item.id) ? "单独指定" : "未指定", role: node.members.find((member) => member.id === item.id)?.role || (node.inherit !== false ? nodeRole(state, node, item.id) : "none"), locked: false, target: item.id }))]} onClose={() => setMemberOpen(false)} onChange={(target, nextRole) => update((current) => ({ ...current, nodes: current.nodes.map((item) => item.id === node.id ? { ...item, inherit: false, members: [...item.members.filter((member) => member.id !== target), ...(nextRole === "none" ? [] : [{ type: "staff", id: target, role: nextRole }])] } : item) }))} />}
  </section>;
}

function mockAnswer(state, userId, pool, question, current) {
  const text = question.trim();
  if (!text) return { text: "请先写下问题。这是模拟回答。", citations: [] };
  const faq = pool.find((node) => node.faq && node.name === text);
  if (faq) return { text: `命中已维护的问答，没有再生成一段新的回答：${faq.body}`, citations: [{ id: faq.id, name: faq.name }] };
  const hits = pool.filter((node) => `${node.name}${node.body}`.includes(text.slice(0, 8)) || node.id === current?.id).slice(0, 3);
  if (!hits.length) return { text: "当前身份在这个范围内看不到可引用的文档。模拟回答不会编造来源。", citations: [] };
  return { text: `模拟回答：根据 ${hits.map((node) => `《${node.name}》`).join("、")}，${hits[0].body}`, citations: hits.map((node) => ({ id: node.id, name: node.name })) };
}

function MemberPanel({ title, hint, rows, onClose, onChange }) {
  return <div className="kb-modal-backdrop" onMouseDown={onClose}><section className="kb-modal wide" onMouseDown={(event) => event.stopPropagation()}><h2>{title}</h2><p>{hint}</p>{rows.map((row) => <div className="kb-perm-row" key={row.key}><b>{row.label}</b><span>{row.detail}</span>{row.locked ? <em>{roleLabel(row.role)}</em> : <select value={row.role} onChange={(event) => onChange(row.target, event.target.value)}>{ROLE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>}</div>)}<div><button onClick={onClose}>关闭</button></div></section></div>;
}

function AskPage({ state, userId, onOpen }) {
  const preset = window.location.hash.split("/").filter(Boolean)[1] || "";
  const [scope, setScope] = useState(preset ? "space" : "company");
  const [spaceId, setSpaceId] = useState(preset || visibleSpaces(state, userId)[0]?.id || "");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(null);
  const spaces = visibleSpaces(state, userId).filter((space) => !space.personal || space.ownerId === userId);
  const pool = visibleNodes(state, userId).filter((node) => node.type === "doc" && (scope === "company" || node.spaceId === spaceId));
  return <section className="kb-page"><header><h1>问 AI</h1><p>选择全公司或某一个知识库。回答会带可点击的来源，并标明这是模拟。</p></header><div className="kb-row"><select value={scope} onChange={(event) => setScope(event.target.value)}><option value="company">全公司可见知识</option><option value="space">指定知识库</option></select>{scope === "space" && <select value={spaceId} onChange={(event) => setSpaceId(event.target.value)}>{spaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}</select>}</div><textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="报销需要哪些材料" /><button className="primary" onClick={() => setAnswer(mockAnswer(state, userId, pool, question))}>发送</button>{answer && <div className="kb-answer"><p>{answer.text}</p>{answer.citations.map((item) => <button key={item.id} onClick={() => onOpen(item.id)}>{item.name}</button>)}</div>}</section>;
}

function RecyclePage({ state, userId, update, setConfirm }) {
  const deleted = state.nodes.filter((node) => node.deletedAt && can(spaceRole(state, state.spaces.find((space) => space.id === node.spaceId), userId), "manage"));
  return <section className="kb-page"><header><h1>回收站</h1><p>演示用回收站。恢复后回到原知识库。界面写着 7 天，但不会真的自动清理。</p></header>{!deleted.length && <Empty title="回收站是空的" body="删除文档后会出现在这里。" />}{deleted.map((node) => <div className="kb-perm-row" key={node.id}><b>{node.name}</b><span>{formatTime(node.deletedAt)}</span><button onClick={() => update((current) => ({ ...current, nodes: current.nodes.map((item) => item.id === node.id ? { ...item, deletedAt: "" } : item) }))}>恢复</button><button onClick={() => setConfirm({ title: "彻底删除", body: "彻底删除后不能从回收站恢复。", action: () => update((current) => ({ ...current, nodes: current.nodes.filter((item) => item.id !== node.id) })) })}>彻底删除</button></div>)}</section>;
}

function AdminPage({ state, update }) {
  const [section, setSection] = useState("members");
  const [name, setName] = useState("");
  const addMember = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    update((current) => ({ ...current, members: [...current.members, { id: `member-${Date.now()}`, name: trimmed, staffId: `demo.${current.members.length + 1}`, deptId: "product", title: "演示成员", admin: false, licensed: current.members.filter((item) => item.licensed).length < current.licenseLimit, tags: [] }] }));
    setName("");
  };
  return <section className="kb-admin"><aside><button className={section === "members" ? "active" : ""} onClick={() => setSection("members")}>组织与成员</button><button className={section === "license" ? "active" : ""} onClick={() => setSection("license")}>管理员与许可</button><button className={section === "teams" ? "active" : ""} onClick={() => setSection("teams")}>团队默认权限</button></aside><div>{section === "members" && <div><h1>组织与成员</h1><p>部门、标签和成员都是演示数据。添加成员只写在这台浏览器里。</p><ul>{state.departments.map((dept) => <li key={dept.id}>{dept.parentId ? "— " : ""}{dept.name}</li>)}</ul><p>标签：{state.tags.map((tag) => tag.name).join("、")}</p><div className="kb-table">{state.members.map((member) => <div key={member.id}><b>{member.name}</b><span>{state.departments.find((dept) => dept.id === member.deptId)?.name}</span><span>{member.staffId}</span><span>{member.tags.map((id) => state.tags.find((tag) => tag.id === id)?.name).filter(Boolean).join("、") || "无标签"}</span></div>)}</div><div className="kb-row"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="演示成员姓名" /><button onClick={addMember}>添加演示成员</button></div></div>}{section === "license" && <div><h1>管理员与许可</h1><p>已分配 {state.members.filter((item) => item.licensed).length} / {state.licenseLimit}。这不是真实套餐。</p>{state.members.filter((item) => item.admin).map((member) => <p key={member.id}>管理员：{member.name}</p>)}{state.members.map((member) => <div className="kb-perm-row" key={member.id}><b>{member.name}</b><span>{member.licensed ? "已分配许可" : "未分配"}</span></div>)}</div>}{section === "teams" && <div><h1>团队默认权限</h1><p>对应管理后台里看到的创建默认值。保存后只影响之后新建的演示知识库。</p><label>谁可以创建团队<select value={state.teamDefaults.whoCanCreate} onChange={(event) => update((current) => ({ ...current, teamDefaults: { ...current.teamDefaults, whoCanCreate: event.target.value } }))}><option value="all">所有人</option><option value="admin">仅企业管理员</option></select></label><label>新知识库给团队成员的角色<select value={state.teamDefaults.spaceMemberInherit} onChange={(event) => update((current) => ({ ...current, teamDefaults: { ...current.teamDefaults, spaceMemberInherit: event.target.value } }))}>{ROLE_OPTIONS.filter(([value]) => value !== "none").map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{state.teams.map((team) => <article key={team.id}><h2>{team.name}</h2><p>{team.intro}</p>{Object.entries(team.members).map(([id, role]) => <div key={id} className="kb-perm-row"><b>{memberName(state, id)}</b><span>团队角色 {roleLabel(role)} · 计算值 {roleLabel(teamRole(state, team, id))}</span></div>)}</article>)}</div>}</div></section>;
}
