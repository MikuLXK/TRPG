import type { Request } from "express";

export const registerAdminContentRoutes = (deps: {
  app: any;
  requireAdmin: any;
  adminStateReady: Promise<void>;
  adminState: any;
  rooms: Record<string, any>;
  socketRoomIndex: Record<string, string>;
  io: any;
  getActivePlayers: (room: any) => Array<any>;
  sanitizeScriptInput: (input: any) => any;
  addAdminLog: (...args: any[]) => void;
  persistAdminState: () => Promise<void>;
}) => {
  const { app, requireAdmin } = deps;

  app.get("/api/admin/scripts", requireAdmin, async (_req: any, res: any) => {
    await deps.adminStateReady;
    const rows = [...deps.adminState.scripts].sort((a: any, b: any) => b.updatedAt - a.updatedAt);
    res.json({ rows });
  });

  app.post("/api/admin/scripts", requireAdmin, async (req: Request, res: any) => {
    await deps.adminStateReady;
    const operator = (req as Request & { adminUser: any }).adminUser;
    const base = deps.sanitizeScriptInput((req as any).body || {});
    const scriptId = String(base.id || "").trim();
    if (!scriptId) return res.status(400).json({ error: "剧本 ID 不能为空" });
    if (deps.adminState.scripts.some((script: any) => script.id === scriptId)) return res.status(400).json({ error: "剧本 ID 已存在" });
    if (!Array.isArray(base.roleTemplates) || base.roleTemplates.length === 0) return res.status(400).json({ error: "剧本至少需要一个角色模板" });

    const now = Date.now();
    const script = {
      ...base,
      id: scriptId,
      source: "admin",
      isPublished: (req as any).body?.isPublished !== false,
      createdAt: now,
      updatedAt: now
    };
    deps.adminState.scripts.push(script);
    deps.addAdminLog(operator.username, "create_script", "script", script.id, { title: script.title });
    await deps.persistAdminState();
    res.json({ script });
  });

  app.put("/api/admin/scripts/:id", requireAdmin, async (req: Request, res: any) => {
    await deps.adminStateReady;
    const operator = (req as Request & { adminUser: any }).adminUser;
    const id = String((req as any).params.id || "").trim();
    const index = deps.adminState.scripts.findIndex((script: any) => script.id === id);
    if (index < 0) return res.status(404).json({ error: "剧本不存在" });

    const current = deps.adminState.scripts[index];
    const base = deps.sanitizeScriptInput({ ...current, ...(req as any).body, id: current.id });
    if (!Array.isArray(base.roleTemplates) || base.roleTemplates.length === 0) return res.status(400).json({ error: "剧本至少需要一个角色模板" });

    const next = {
      ...base,
      id: current.id,
      source: current.source,
      isPublished: typeof (req as any).body?.isPublished === "boolean" ? (req as any).body.isPublished : current.isPublished,
      createdAt: current.createdAt,
      updatedAt: Date.now()
    };
    deps.adminState.scripts[index] = next;
    deps.addAdminLog(operator.username, "update_script", "script", id, { title: next.title });
    await deps.persistAdminState();
    res.json({ script: next });
  });

  app.patch("/api/admin/scripts/:id/publish", requireAdmin, async (req: Request, res: any) => {
    await deps.adminStateReady;
    const operator = (req as Request & { adminUser: any }).adminUser;
    const id = String((req as any).params.id || "").trim();
    const script = deps.adminState.scripts.find((item: any) => item.id === id);
    if (!script) return res.status(404).json({ error: "剧本不存在" });

    script.isPublished = Boolean((req as any).body?.isPublished);
    script.updatedAt = Date.now();
    deps.addAdminLog(operator.username, script.isPublished ? "publish_script" : "unpublish_script", "script", id);
    await deps.persistAdminState();
    res.json({ script });
  });

  app.delete("/api/admin/scripts/:id", requireAdmin, async (req: Request, res: any) => {
    await deps.adminStateReady;
    const operator = (req as Request & { adminUser: any }).adminUser;
    const id = String((req as any).params.id || "").trim();
    const index = deps.adminState.scripts.findIndex((script: any) => script.id === id);
    if (index < 0) return res.status(404).json({ error: "剧本不存在" });
    if (deps.adminState.scripts[index].source === "builtin") return res.status(400).json({ error: "内置剧本不允许删除" });

    deps.adminState.scripts.splice(index, 1);
    deps.addAdminLog(operator.username, "delete_script", "script", id);
    await deps.persistAdminState();
    res.json({ ok: true });
  });

  app.get("/api/admin/rooms", requireAdmin, async (_req: any, res: any) => {
    await deps.adminStateReady;
    const rows = Object.values(deps.rooms).map((room: any) => ({
      id: room.id,
      name: room.name,
      scriptId: room.scriptId,
      scriptTitle: room.script.title,
      hostId: room.hostId,
      status: room.status,
      hasStarted: room.hasStarted,
      players: room.players.map((player: any) => ({
        id: player.id,
        name: player.name,
        accountUsername: player.accountUsername,
        isOnline: player.isOnline,
        isReady: player.isReady
      })),
      activePlayers: deps.getActivePlayers(room).length,
      maxPlayers: room.maxPlayers,
      currentRound: room.currentRound,
      logCount: room.logs.length
    }));
    res.json({ rows });
  });

  app.post("/api/admin/rooms/:id/force-close", requireAdmin, async (req: Request, res: any) => {
    await deps.adminStateReady;
    const operator = (req as Request & { adminUser: any }).adminUser;
    const id = String((req as any).params.id || "").trim();
    const room = deps.rooms[id];
    if (!room) return res.status(404).json({ error: "房间不存在" });

    room.players.forEach((player: any) => {
      delete deps.socketRoomIndex[player.id];
      deps.io.sockets.sockets.get(player.id)?.leave(id);
    });
    delete deps.rooms[id];
    deps.io.emit("rooms_list_updated");
    deps.addAdminLog(operator.username, "force_close_room", "room", id, { roomName: room.name });
    await deps.persistAdminState();
    res.json({ ok: true });
  });

  app.get("/api/admin/logs", requireAdmin, async (req: any, res: any) => {
    await deps.adminStateReady;
    const query = String(req.query.q || "").trim().toLowerCase();
    const targetType = String(req.query.targetType || "").trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));

    let rows = [...deps.adminState.logs];
    if (query) {
      rows = rows.filter((log: any) => {
        const haystack = `${log.operator} ${log.action} ${log.targetId} ${JSON.stringify(log.details || {})}`.toLowerCase();
        return haystack.includes(query);
      });
    }
    if (["user", "script", "room", "system"].includes(targetType)) {
      rows = rows.filter((log: any) => log.targetType === targetType);
    }

    const total = rows.length;
    const start = (page - 1) * pageSize;
    rows = rows.slice(start, start + pageSize);
    res.json({ rows, total, page, pageSize });
  });
};

