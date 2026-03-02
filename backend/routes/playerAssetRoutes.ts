import type { Request } from "express";

export const registerPlayerAssetRoutes = (deps: {
  app: any;
  requirePlayer: any;
  adminStateReady: Promise<void>;
  adminState: any;
  sanitizeScriptInput: (input: any) => any;
  addAdminLog: (...args: any[]) => void;
  persistAdminState: () => Promise<void>;
}) => {
  const { app, requirePlayer } = deps;

  app.get("/api/workshop/scripts", requirePlayer, async (req: Request, res: any) => {
    await deps.adminStateReady;
    const user = (req as Request & { playerUser: any }).playerUser;
    const query = String((req as any).query.q || "").trim().toLowerCase();
    const mineOnly = String((req as any).query.mine || "").trim() === "1";
    let rows = deps.adminState.workshopScripts.filter((script: any) => (mineOnly ? script.ownerUid === user.uid : script.isPublic || script.ownerUid === user.uid));
    if (query) {
      rows = rows.filter((script: any) => {
        const haystack = `${script.id} ${script.title} ${script.description} ${(script.tags || []).join(" ")} ${script.ownerUsername}`.toLowerCase();
        return haystack.includes(query);
      });
    }
    rows.sort((a: any, b: any) => b.updatedAt - a.updatedAt);
    res.json({ rows });
  });

  app.post("/api/workshop/scripts", requirePlayer, async (req: Request, res: any) => {
    await deps.adminStateReady;
    const user = (req as Request & { playerUser: any }).playerUser;
    const base = deps.sanitizeScriptInput((req as any).body || {});
    const now = Date.now();
    const scriptId = String(base.id || `workshop-${now}`).trim();
    if (!scriptId) return res.status(400).json({ error: "剧本 ID 不能为空" });
    if (!Array.isArray(base.roleTemplates) || base.roleTemplates.length === 0) return res.status(400).json({ error: "剧本至少需要一个角色模板" });
    if (deps.adminState.workshopScripts.find((item: any) => item.id === scriptId)) return res.status(400).json({ error: "剧本 ID 已存在" });

    const record = {
      ...base,
      id: scriptId,
      ownerUid: user.uid,
      ownerUsername: user.username,
      isPublic: (req as any).body?.isPublic !== false,
      createdAt: now,
      updatedAt: now,
      downloads: 0
    };
    deps.adminState.workshopScripts.push(record);
    deps.addAdminLog(user.username, "upload_workshop_script", "script", record.id, { isPublic: record.isPublic });
    await deps.persistAdminState();
    res.json({ script: record });
  });

  app.put("/api/workshop/scripts/:id", requirePlayer, async (req: Request, res: any) => {
    await deps.adminStateReady;
    const user = (req as Request & { playerUser: any }).playerUser;
    const id = String((req as any).params.id || "").trim();
    const index = deps.adminState.workshopScripts.findIndex((item: any) => item.id === id);
    if (index < 0) return res.status(404).json({ error: "剧本不存在" });

    const current = deps.adminState.workshopScripts[index];
    if (current.ownerUid !== user.uid && user.role !== "moderator") return res.status(403).json({ error: "无权限修改该剧本" });
    const base = deps.sanitizeScriptInput({ ...current, ...(req as any).body, id: current.id });
    if (!Array.isArray(base.roleTemplates) || base.roleTemplates.length === 0) return res.status(400).json({ error: "剧本至少需要一个角色模板" });

    const next = {
      ...base,
      id: current.id,
      ownerUid: current.ownerUid,
      ownerUsername: current.ownerUsername,
      isPublic: typeof (req as any).body?.isPublic === "boolean" ? (req as any).body.isPublic : current.isPublic,
      createdAt: current.createdAt,
      updatedAt: Date.now(),
      downloads: current.downloads
    };
    deps.adminState.workshopScripts[index] = next;
    deps.addAdminLog(user.username, "update_workshop_script", "script", id, { isPublic: next.isPublic });
    await deps.persistAdminState();
    res.json({ script: next });
  });

  app.delete("/api/workshop/scripts/:id", requirePlayer, async (req: Request, res: any) => {
    await deps.adminStateReady;
    const user = (req as Request & { playerUser: any }).playerUser;
    const id = String((req as any).params.id || "").trim();
    const index = deps.adminState.workshopScripts.findIndex((item: any) => item.id === id);
    if (index < 0) return res.status(404).json({ error: "剧本不存在" });

    const target = deps.adminState.workshopScripts[index];
    if (target.ownerUid !== user.uid && user.role !== "moderator") return res.status(403).json({ error: "无权限删除该剧本" });
    deps.adminState.workshopScripts.splice(index, 1);
    deps.addAdminLog(user.username, "delete_workshop_script", "script", id);
    await deps.persistAdminState();
    res.json({ ok: true });
  });

  app.post("/api/workshop/scripts/:id/download", requirePlayer, async (req: Request, res: any) => {
    await deps.adminStateReady;
    const id = String((req as any).params.id || "").trim();
    const script = deps.adminState.workshopScripts.find((item: any) => item.id === id);
    if (!script || !script.isPublic) return res.status(404).json({ error: "剧本不存在或未公开" });
    script.downloads += 1;
    script.updatedAt = Date.now();
    await deps.persistAdminState();
    res.json({ script });
  });

  app.get("/api/cloud/saves", requirePlayer, async (req: Request, res: any) => {
    await deps.adminStateReady;
    const user = (req as Request & { playerUser: any }).playerUser;
    const rows = deps.adminState.cloudSaves
      .filter((save: any) => save.ownerUid === user.uid)
      .sort((a: any, b: any) => b.updatedAt - a.updatedAt)
      .map((save: any) => ({
        id: save.id,
        name: save.name,
        ownerUid: save.ownerUid,
        ownerUsername: save.ownerUsername,
        createdAt: save.createdAt,
        updatedAt: save.updatedAt
      }));
    res.json({ rows });
  });

  app.get("/api/cloud/saves/:id", requirePlayer, async (req: Request, res: any) => {
    await deps.adminStateReady;
    const user = (req as Request & { playerUser: any }).playerUser;
    const id = String((req as any).params.id || "").trim();
    const save = deps.adminState.cloudSaves.find((item: any) => item.id === id && item.ownerUid === user.uid);
    if (!save) return res.status(404).json({ error: "云存档不存在" });
    res.json({ save });
  });

  app.post("/api/cloud/saves", requirePlayer, async (req: Request, res: any) => {
    await deps.adminStateReady;
    const user = (req as Request & { playerUser: any }).playerUser;
    const now = Date.now();
    const name = String((req as any).body?.name || "").trim();
    const data = (req as any).body?.data;
    if (!name) return res.status(400).json({ error: "存档名称不能为空" });
    if (data === undefined || data === null) return res.status(400).json({ error: "存档数据不能为空" });

    const record = {
      id: String((req as any).body?.id || `cloud-${now}-${Math.random().toString(36).slice(2, 8)}`),
      name,
      data,
      ownerUid: user.uid,
      ownerUsername: user.username,
      createdAt: now,
      updatedAt: now
    };
    deps.adminState.cloudSaves = [record, ...deps.adminState.cloudSaves.filter((save: any) => save.id !== record.id)];
    deps.addAdminLog(user.username, "upload_cloud_save", "system", record.id, { name: record.name });
    await deps.persistAdminState();
    res.json({ save: record });
  });

  app.put("/api/cloud/saves/:id", requirePlayer, async (req: Request, res: any) => {
    await deps.adminStateReady;
    const user = (req as Request & { playerUser: any }).playerUser;
    const id = String((req as any).params.id || "").trim();
    const save = deps.adminState.cloudSaves.find((item: any) => item.id === id && item.ownerUid === user.uid);
    if (!save) return res.status(404).json({ error: "云存档不存在" });

    const nextName = String((req as any).body?.name || save.name).trim();
    const nextData = (req as any).body?.data ?? save.data;
    if (!nextName) return res.status(400).json({ error: "存档名称不能为空" });
    save.name = nextName;
    save.data = nextData;
    save.updatedAt = Date.now();
    deps.addAdminLog(user.username, "update_cloud_save", "system", save.id, { name: save.name });
    await deps.persistAdminState();
    res.json({ save });
  });

  app.delete("/api/cloud/saves/:id", requirePlayer, async (req: Request, res: any) => {
    await deps.adminStateReady;
    const user = (req as Request & { playerUser: any }).playerUser;
    const id = String((req as any).params.id || "").trim();
    const index = deps.adminState.cloudSaves.findIndex((item: any) => item.id === id && item.ownerUid === user.uid);
    if (index < 0) return res.status(404).json({ error: "云存档不存在" });

    deps.adminState.cloudSaves.splice(index, 1);
    deps.addAdminLog(user.username, "delete_cloud_save", "system", id);
    await deps.persistAdminState();
    res.json({ ok: true });
  });
};

